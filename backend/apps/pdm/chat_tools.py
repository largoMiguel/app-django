"""Herramientas read-only del chat PDM — consultas acotadas por entidad."""
from __future__ import annotations

import json
import re
from datetime import datetime
from typing import Any

from django.core.cache import cache
from django.core.exceptions import ObjectDoesNotExist
from django.db.models import Q, Sum

from apps.entities.models import Entity

from .analytics import _parse_bpines, compute_pdm_proyectos
from .bpin_view import (
    DATOS_GOV_CO_PORTAL,
    _normalize_proyecto_bpin,
    consultar_bpin_externo,
    consultar_bpines_externos,
)
from .metrics import (
    ANIOS_PDM,
    actividad_aggs_for_productos,
    ejecucion_for_productos,
    producto_list_metrics,
    resumen_anio,
)

__all__ = ["ANIOS_PDM", "TOOL_DEFINITIONS", "execute_tool"]
from .models import (
    PDMContratoRPS,
    PDMEjecucionPresupuestal,
    PdmActividad,
    PdmActividadEvidencia,
    PdmIniciativaSGR,
    PdmProducto,
)

MAX_TOOL_RESULT_CHARS = 6000
RESUMEN_CACHE_TTL = 600  # 10 min


def _truncate(data: Any) -> str:
    text = json.dumps(data, ensure_ascii=False, default=str)
    if len(text) <= MAX_TOOL_RESULT_CHARS:
        return text
    return text[: MAX_TOOL_RESULT_CHARS - 20] + '…(truncado)"}'


def _current_year() -> int:
    return datetime.now().year


def _normalize_anio(anio: int | None) -> tuple[int, str | None]:
    """Valida año PDM; devuelve (anio_ok, advertencia)."""
    if anio is None:
        return _current_year(), None
    try:
        anio = int(anio)
    except (TypeError, ValueError):
        return _current_year(), None
    if anio not in ANIOS_PDM:
        valid = ", ".join(str(y) for y in ANIOS_PDM)
        return _current_year(), (
            f"No hay datos del PDM para {anio}. Los años válidos son: {valid}. "
            f"Se usan datos de {_current_year()}."
        )
    return anio, None


def _producto_base_qs(entity: Entity):
    return PdmProducto.objects.filter(entity=entity)


def _producto_label(p: PdmProducto) -> str:
    return (p.producto_mga or p.codigo_indicador_producto or p.codigo_producto or "").strip()


def _looks_like_bpin(text: str) -> bool:
    """Detecta códigos BPIN PIIP (~13 dígitos, suelen empezar por 20)."""
    t = re.sub(r"\D", "", (text or "").strip())
    return len(t) >= 12 and t.startswith("20")


def _normalize_bpin(text: str) -> str:
    return re.sub(r"\D", "", (text or "").strip())


def _producto_metrics_item(
    entity: Entity,
    p: PdmProducto,
    target_anio: int,
    aggs_map: dict | None = None,
    ejec_map: dict | None = None,
) -> dict:
    """Resumen estándar de producto con meta, avance y ejecución del año."""
    aggs = (aggs_map or {}).get(p.codigo_producto, {})
    metrics = producto_list_metrics(p, target_anio, aggs)
    ej = (ejec_map or {}).get(
        p.codigo_producto, {"pto_definitivo": 0.0, "pagos": 0.0}
    )
    return {
        "codigo_producto": p.codigo_producto,
        "nombre": _producto_label(p),
        "linea_estrategica": p.linea_estrategica,
        "sector_mga": p.sector_mga,
        "programa_mga": p.programa_mga,
        "bpin": p.bpin,
        "ods": p.ods,
        "responsable": p.responsable_secretaria_nombre,
        "meta_anio": metrics["meta_anio"],
        "avance_fisico_pct": metrics["avance_anio"],
        "estado_anio": metrics["estado_anio"],
        "presupuesto_anio_cop": metrics["presupuesto_anio"],
        "pto_definitivo_anio_cop": ej["pto_definitivo"],
        "pagos_anio_cop": ej["pagos"],
        "url_bpin": f"{DATOS_GOV_CO_PORTAL}?bpin={p.bpin}" if p.bpin else None,
    }


def _resolve_producto(
    entity: Entity,
    codigo_producto: str | None = None,
    query: str | None = None,
) -> tuple[PdmProducto | None, str | None]:
    """Resuelve un producto por código exacto, parcial o búsqueda por texto."""
    if codigo_producto:
        codigo = codigo_producto.strip()
        try:
            return _producto_base_qs(entity).get(codigo_producto=codigo), None
        except PdmProducto.DoesNotExist:
            partial = list(
                _producto_base_qs(entity).filter(codigo_producto__icontains=codigo)[:2]
            )
            if len(partial) == 1:
                return partial[0], None
            if len(partial) > 1:
                return None, (
                    f"Varios productos coinciden con '{codigo}'. "
                    "Usa buscar_productos para elegir el código exacto."
                )

    if query:
        q = query.strip()
        if _looks_like_bpin(q):
            return None, (
                f"'{q}' parece un BPIN de proyecto PIIP, no un código de producto. "
                "Usa consultar_proyecto_bpin."
            )
        matches = list(_producto_search_qs(entity, q).order_by("codigo_producto")[:3])
        if len(matches) == 1:
            return matches[0], None
        if len(matches) > 1:
            return None, (
                f"Varios productos coinciden con '{q}'. "
                "Usa buscar_productos para ver la lista completa."
            )

    return None, None


def _producto_search_qs(entity: Entity, query: str):
    """QuerySet de productos filtrado por texto libre."""
    q = query.strip()
    return _producto_base_qs(entity).filter(
        Q(codigo_producto__icontains=q)
        | Q(producto_mga__icontains=q)
        | Q(codigo_indicador_producto__icontains=q)
        | Q(indicador_producto_mga__icontains=q)
        | Q(linea_estrategica__icontains=q)
        | Q(sector_mga__icontains=q)
        | Q(programa_mga__icontains=q)
        | Q(bpin__icontains=q)
        | Q(responsable_secretaria_nombre__icontains=q)
        | Q(ods__icontains=q)
    )


def _has_search_filters(**kwargs: Any) -> bool:
    return any(v not in (None, "") for v in kwargs.values())


def resumen_pdm(entity: Entity) -> dict:
    """Resumen general del PDM de la entidad (cacheado)."""
    cache_key = f"pdm_chat_resumen:{entity.id}"
    cached = cache.get(cache_key)
    if cached is not None:
        return cached

    productos = list(_producto_base_qs(entity))
    codigos = [p.codigo_producto for p in productos]
    anio = _current_year()

    lineas = {p.linea_estrategica for p in productos if p.linea_estrategica}
    sectores = {p.sector_mga for p in productos if p.sector_mga}

    presupuesto_cuatrienio = sum(
        float(p.total_2024 or 0) + float(p.total_2025 or 0)
        + float(p.total_2026 or 0) + float(p.total_2027 or 0)
        for p in productos
    )

    ejecucion_por_anio: list[dict] = []
    for y in ANIOS_PDM:
        rows = (
            PDMEjecucionPresupuestal.objects.filter(entity=entity, anio=y)
            .aggregate(pto=Sum("pto_definitivo"), pagos=Sum("pagos"))
        )
        ejecucion_por_anio.append({
            "anio": y,
            "pto_definitivo": float(rows["pto"] or 0),
            "pagos": float(rows["pagos"] or 0),
            "avance_financiero_pct": round(
                (float(rows["pagos"] or 0) / float(rows["pto"] or 1)) * 100, 1
            ) if rows["pto"] else 0.0,
        })

    aggs_map = actividad_aggs_for_productos(entity.id, codigos) if codigos else {}
    avances_anio: list[dict] = []
    for y in ANIOS_PDM:
        avances = []
        for p in productos:
            aggs = aggs_map.get(p.codigo_producto, {})
            res = resumen_anio(p, y, aggs)
            if res["meta_programada"] > 0:
                avances.append(res["porcentaje_avance"])
        avance_prom = round(sum(avances) / len(avances), 1) if avances else 0.0
        avances_anio.append({"anio": y, "avance_fisico_promedio_pct": avance_prom})

    result = {
        "entidad": entity.name,
        "plan": entity.plan_name,
        "total_productos": len(productos),
        "total_lineas_estrategicas": len(lineas),
        "total_sectores": len(sectores),
        "total_iniciativas_sgr": PdmIniciativaSGR.objects.filter(entity=entity).count(),
        "presupuesto_cuatrienio_cop": presupuesto_cuatrienio,
        "ejecucion_por_anio": ejecucion_por_anio,
        "avance_fisico_por_anio": avances_anio,
        "anio_seguimiento": anio,
        "portal_bpin": DATOS_GOV_CO_PORTAL,
    }
    cache.set(cache_key, result, RESUMEN_CACHE_TTL)
    return result


def buscar_productos(
    entity: Entity,
    query: str = "",
    codigo_producto: str | None = None,
    linea: str | None = None,
    sector: str | None = None,
    programa: str | None = None,
    ods: str | None = None,
    anio: int | None = None,
    limit: int = 15,
) -> dict:
    """Busca productos del PDM por texto o filtros."""
    target_anio, advertencia = _normalize_anio(anio)
    limit = min(max(1, limit), 25)

    if query and _looks_like_bpin(query):
        bpin = _normalize_bpin(query)
        return {
            "anio_seguimiento": target_anio,
            "total_encontrados": 0,
            "productos": [],
            "sugerencia": (
                f"'{query}' es un código BPIN de proyecto PIIP, no un producto del plan. "
                f"Usa consultar_proyecto_bpin con bpin={bpin}."
            ),
        }

    qs = _producto_base_qs(entity)
    if codigo_producto:
        qs = qs.filter(codigo_producto__icontains=codigo_producto.strip())
    if linea:
        qs = qs.filter(linea_estrategica__icontains=linea)
    if sector:
        qs = qs.filter(sector_mga__icontains=sector)
    if programa:
        qs = qs.filter(programa_mga__icontains=programa)
    if ods:
        qs = qs.filter(ods__icontains=ods)
    if query:
        q = query.strip()
        qs = qs.filter(
            Q(codigo_producto__icontains=q)
            | Q(producto_mga__icontains=q)
            | Q(codigo_indicador_producto__icontains=q)
            | Q(indicador_producto_mga__icontains=q)
            | Q(linea_estrategica__icontains=q)
            | Q(sector_mga__icontains=q)
            | Q(programa_mga__icontains=q)
            | Q(bpin__icontains=q)
            | Q(responsable_secretaria_nombre__icontains=q)
            | Q(ods__icontains=q)
        )

    filtros = {
        "query": query,
        "codigo_producto": codigo_producto,
        "linea": linea,
        "sector": sector,
        "programa": programa,
        "ods": ods,
    }
    if not _has_search_filters(**filtros):
        return {
            "anio_seguimiento": target_anio,
            "total_encontrados": 0,
            "productos": [],
            "nota": (
                "Indica query, codigo_producto o filtros (linea, sector, programa, ods) "
                "para buscar productos del plan."
            ),
        }

    productos = list(qs.order_by("codigo_producto")[:limit])
    codigos = [p.codigo_producto for p in productos]
    aggs_map = actividad_aggs_for_productos(entity.id, codigos) if codigos else {}
    ejec_map = ejecucion_for_productos(entity.id, codigos, target_anio) if codigos else {}

    items = [
        _producto_metrics_item(entity, p, target_anio, aggs_map, ejec_map)
        for p in productos
    ]

    result: dict[str, Any] = {
        "total_encontrados": len(items),
        "anio_seguimiento": target_anio,
        "filtros": {k: v for k, v in filtros.items() if v},
        "productos": items,
    }
    if advertencia:
        result["advertencia_anio"] = advertencia
    if not items:
        result["mensaje"] = "No se encontraron productos con esos criterios en el PDM."
    return result


def detalle_producto(
    entity: Entity,
    codigo_producto: str | None = None,
    query: str | None = None,
    anio: int | None = None,
) -> dict:
    """Detalle completo de un producto PDM."""
    if not codigo_producto and not query:
        return {
            "error": "Indica codigo_producto o query (nombre) para consultar un producto del PDM."
        }

    target_anio, advertencia = _normalize_anio(anio)
    p, resolve_msg = _resolve_producto(entity, codigo_producto, query)
    if not p:
        if resolve_msg:
            return {"error": resolve_msg}
        ref = codigo_producto or query or ""
        return {
            "error": f"Producto '{ref}' no encontrado en el PDM de {entity.name}. "
            "Prueba buscar_productos con query o nombre parcial."
        }

    codigo_producto = p.codigo_producto
    aggs_map = actividad_aggs_for_productos(entity.id, [codigo_producto])
    aggs = aggs_map.get(codigo_producto, {})
    metrics = producto_list_metrics(p, target_anio, aggs)
    ej = ejecucion_for_productos(entity.id, [codigo_producto], target_anio).get(
        codigo_producto, {"pto_definitivo": 0.0, "pagos": 0.0}
    )

    resumen_anios = {str(y): resumen_anio(p, y, aggs) for y in ANIOS_PDM}

    actividades = list(
        PdmActividad.objects.filter(entity=entity, codigo_producto=codigo_producto)
        .select_related("responsable_secretaria")
        .prefetch_related("evidencia")
        .order_by("anio", "id")[:30]
    )
    act_items = []
    for a in actividades:
        ev = None
        try:
            ev = a.evidencia
        except ObjectDoesNotExist:
            ev = None
        act_items.append({
            "id": a.id,
            "nombre": a.nombre,
            "anio": a.anio,
            "estado": a.estado,
            "meta_ejecutar": a.meta_ejecutar,
            "responsable": a.responsable_secretaria.nombre if a.responsable_secretaria else None,
            "evidencia": {
                "descripcion": ev.descripcion if ev else None,
                "url_evidencia": ev.url_evidencia if ev else None,
            } if ev else None,
        })

    fuentes_ejec = list(
        PDMEjecucionPresupuestal.objects.filter(
            entity=entity, codigo_producto=codigo_producto, anio=target_anio
        ).values("descripcion_fte", "pto_definitivo", "pagos", "bpin")[:20]
    )

    contratos = list(
        PDMContratoRPS.objects.filter(entity=entity, codigo_producto=codigo_producto)
        .order_by("-anio")[:15]
        .values("no_crp", "concepto", "valor", "anio", "contratista")
    )

    bpines_vinculados = list(_parse_bpines(p.bpin)) if p.bpin else []

    result = {
        "codigo_producto": p.codigo_producto,
        "nombre": _producto_label(p),
        "linea_estrategica": p.linea_estrategica,
        "sector_mga": p.sector_mga,
        "programa_mga": p.programa_mga,
        "producto_mga": p.producto_mga,
        "indicador": p.indicador_producto_mga,
        "unidad_medida": p.unidad_medida,
        "meta_cuatrienio": p.meta_cuatrienio,
        "bpin": p.bpin,
        "bpines_vinculados": bpines_vinculados,
        "url_bpin": f"{DATOS_GOV_CO_PORTAL}?bpin={bpines_vinculados[0]}" if bpines_vinculados else None,
        "ods": p.ods,
        "responsable": p.responsable_secretaria_nombre,
        "anio_seguimiento": target_anio,
        "avance_fisico_pct": metrics["avance_anio"],
        "estado_anio": metrics["estado_anio"],
        "meta_anio": metrics["meta_anio"],
        "presupuesto_anio_cop": metrics["presupuesto_anio"],
        "pto_definitivo_anio_cop": ej["pto_definitivo"],
        "pagos_anio_cop": ej["pagos"],
        "resumen_por_anio": resumen_anios,
        "actividades": act_items,
        "fuentes_ejecucion": [
            {
                "fuente": r["descripcion_fte"],
                "pto_definitivo": float(r["pto_definitivo"] or 0),
                "pagos": float(r["pagos"] or 0),
                "bpin": r["bpin"],
            }
            for r in fuentes_ejec
        ],
        "contratos": [
            {
                "no_crp": c["no_crp"],
                "concepto": c["concepto"],
                "valor_cop": float(c["valor"] or 0),
                "anio": c["anio"],
                "contratista": c["contratista"],
            }
            for c in contratos
        ],
        "total_contratos": len(contratos),
    }
    if advertencia:
        result["advertencia_anio"] = advertencia
    return result


def ejecucion_presupuestal(
    entity: Entity,
    anio: int | None = None,
    codigo_producto: str | None = None,
    query: str | None = None,
    limit: int = 8,
) -> dict:
    """Ejecución presupuestal agregada o por producto."""
    target_anio, advertencia = _normalize_anio(anio)
    limit = min(max(1, limit), 15)

    resolved_codigo = codigo_producto
    if not resolved_codigo and query:
        p, resolve_msg = _resolve_producto(entity, query=query)
        if resolve_msg:
            return {"error": resolve_msg, "anio": target_anio}
        if p:
            resolved_codigo = p.codigo_producto

    qs = PDMEjecucionPresupuestal.objects.filter(entity=entity, anio=target_anio)
    if resolved_codigo:
        qs = qs.filter(codigo_producto=resolved_codigo)

    totales = qs.aggregate(pto=Sum("pto_definitivo"), pagos=Sum("pagos"))
    pto = float(totales["pto"] or 0)
    pagos = float(totales["pagos"] or 0)

    por_producto_qs = (
        qs.values("codigo_producto")
        .annotate(pto_definitivo=Sum("pto_definitivo"), pagos=Sum("pagos"))
        .order_by("-pagos")
    )
    total_productos = por_producto_qs.count()
    por_producto = list(por_producto_qs[:limit])

    codigos_top = [r["codigo_producto"] for r in por_producto]
    productos_map = {
        p.codigo_producto: p
        for p in _producto_base_qs(entity).filter(codigo_producto__in=codigos_top)
    }

    result = {
        "anio": target_anio,
        "codigo_producto": resolved_codigo,
        "query": query,
        "totales_entidad": {
            "pto_definitivo_cop": pto,
            "pagos_cop": pagos,
            "avance_financiero_pct": round((pagos / pto) * 100, 1) if pto else 0.0,
        },
        "top_productos_por_pagos": [
            {
                "codigo_producto": r["codigo_producto"],
                "nombre": _producto_label(productos_map[r["codigo_producto"]])
                if r["codigo_producto"] in productos_map
                else None,
                "pto_definitivo_cop": float(r["pto_definitivo"] or 0),
                "pagos_cop": float(r["pagos"] or 0),
                "avance_pct": round(
                    (float(r["pagos"] or 0) / float(r["pto_definitivo"] or 1)) * 100, 1
                ) if r["pto_definitivo"] else 0.0,
            }
            for r in por_producto
        ],
        "total_productos_con_ejecucion": total_productos,
        "nota": "Prioriza totales_entidad; solo lista top productos si el usuario pide detalle.",
    }
    if resolved_codigo and pto == 0 and pagos == 0:
        result["mensaje"] = (
            f"No hay ejecución presupuestal registrada para el producto {resolved_codigo} en {target_anio}."
        )
    if advertencia:
        result["advertencia_anio"] = advertencia
    return result


def _enrich_contratos_with_productos(
    entity: Entity,
    rows: list[dict],
    target_anio: int,
) -> list[dict]:
    """Agrega meta y datos del producto PDM vinculado a cada contrato."""
    codigos = list({r["codigo_producto"] for r in rows if r.get("codigo_producto")})
    productos_map = {
        p.codigo_producto: p
        for p in _producto_base_qs(entity).filter(codigo_producto__in=codigos)
    }
    aggs_map = actividad_aggs_for_productos(entity.id, codigos) if codigos else {}

    enriched: list[dict] = []
    for r in rows:
        cp = r.get("codigo_producto")
        p = productos_map.get(cp)
        producto_info = None
        if p:
            producto_info = _producto_metrics_item(entity, p, target_anio, aggs_map)
        enriched.append({
            "no_crp": r["no_crp"],
            "codigo_producto": r["codigo_producto"],
            "concepto": r["concepto"],
            "valor_cop": float(r["valor"] or 0),
            "anio": r["anio"],
            "contratista": r["contratista"],
            "producto_vinculado": producto_info,
        })
    return enriched


def contratos(
    entity: Entity,
    anio: int | None = None,
    codigo_producto: str | None = None,
    contratista: str | None = None,
    no_crp: str | None = None,
    query: str | None = None,
    limit: int = 10,
) -> dict:
    """Contratos RPS del PDM con producto/meta vinculados."""
    target_anio, advertencia = _normalize_anio(anio)
    limit = min(max(1, limit), 25)
    qs = PDMContratoRPS.objects.filter(entity=entity)

    if anio is not None:
        qs = qs.filter(anio=target_anio)
    if codigo_producto:
        qs = qs.filter(codigo_producto=codigo_producto)
    if contratista:
        qs = qs.filter(contratista__icontains=contratista.strip())
    if no_crp:
        qs = qs.filter(no_crp__icontains=no_crp.strip())
    if query:
        q = query.strip()
        qs = qs.filter(
            Q(contratista__icontains=q)
            | Q(no_crp__icontains=q)
            | Q(concepto__icontains=q)
            | Q(codigo_producto__icontains=q)
        )

    rows = list(
        qs.order_by("-valor")[:limit]
        .values("no_crp", "codigo_producto", "concepto", "valor", "anio", "contratista")
    )
    total = sum(float(r["valor"] or 0) for r in rows)

    result: dict[str, Any] = {
        "anio_seguimiento": target_anio,
        "anio_filtro": anio,
        "codigo_producto": codigo_producto,
        "contratista": contratista,
        "no_crp": no_crp,
        "query": query,
        "total_contratado_cop": total,
        "cantidad": len(rows),
        "contratos": _enrich_contratos_with_productos(entity, rows, target_anio),
    }
    if advertencia:
        result["advertencia_anio"] = advertencia
    if not rows and any([contratista, no_crp, query, codigo_producto]):
        result["mensaje"] = (
            "No se encontraron contratos con esos criterios en el PDM de la entidad."
        )
    elif not rows:
        result["nota"] = (
            "Sin filtros específicos no hay resultados. "
            "Usa contratista, no_crp, query o codigo_producto para buscar un contrato."
        )
    return result


def metas_cumplidas_anio(
    entity: Entity,
    anio: int | None = None,
    query: str | None = None,
    linea: str | None = None,
    sector: str | None = None,
) -> dict:
    """Metas y avances físicos cumplidos o en progreso para un año."""
    target_anio, advertencia = _normalize_anio(anio)
    productos_qs = _producto_base_qs(entity)
    if linea:
        productos_qs = productos_qs.filter(linea_estrategica__icontains=linea)
    if sector:
        productos_qs = productos_qs.filter(sector_mga__icontains=sector)
    if query:
        q = query.strip()
        if _looks_like_bpin(q):
            productos_qs = productos_qs.filter(bpin__icontains=_normalize_bpin(q))
        else:
            productos_qs = productos_qs.filter(
                Q(codigo_producto__icontains=q)
                | Q(producto_mga__icontains=q)
                | Q(linea_estrategica__icontains=q)
                | Q(sector_mga__icontains=q)
                | Q(programa_mga__icontains=q)
            )

    productos = list(productos_qs)
    codigos = [p.codigo_producto for p in productos]
    aggs_map = actividad_aggs_for_productos(entity.id, codigos) if codigos else {}

    completados: list[dict] = []
    en_progreso: list[dict] = []
    pendientes: list[dict] = []

    for p in productos:
        aggs = aggs_map.get(p.codigo_producto, {})
        metrics = producto_list_metrics(p, target_anio, aggs)
        if metrics["meta_anio"] <= 0:
            continue
        estado = metrics["estado_anio"]
        item = {
            "codigo_producto": p.codigo_producto,
            "nombre": _producto_label(p),
            "meta_anio": metrics["meta_anio"],
            "avance_fisico_pct": metrics["avance_anio"],
            "estado": estado,
            "linea_estrategica": p.linea_estrategica,
        }
        if estado == "COMPLETADO":
            completados.append(item)
        elif estado in ("EN_PROGRESO", "POR_EJECUTAR"):
            en_progreso.append(item)
        else:
            pendientes.append(item)

    actividades_completadas = list(
        PdmActividad.objects.filter(
            entity=entity, anio=target_anio, estado="COMPLETADA"
        ).select_related("evidencia").order_by("-updated_at")[:20]
    )
    act_items = []
    for a in actividades_completadas:
        ev = None
        try:
            ev = a.evidencia
        except ObjectDoesNotExist:
            pass
        act_items.append({
            "codigo_producto": a.codigo_producto,
            "nombre": a.nombre,
            "descripcion": a.descripcion,
            "meta_ejecutar": a.meta_ejecutar,
            "url_evidencia": ev.url_evidencia if ev else None,
            "evidencia_descripcion": ev.descripcion if ev else None,
        })

    ej = ejecucion_presupuestal(entity, anio=target_anio, limit=5)

    result = {
        "anio": target_anio,
        "anio_calendario_actual": _current_year(),
        "filtros": {
            k: v for k, v in {"query": query, "linea": linea, "sector": sector}.items() if v
        },
        "resumen": {
            "productos_meta_cumplida": len(completados),
            "productos_en_progreso": len(en_progreso),
            "productos_pendientes": len(pendientes),
            "actividades_completadas": len(act_items),
        },
        "productos_completados": completados[:12],
        "productos_en_progreso": en_progreso[:8],
        "productos_pendientes": pendientes[:8],
        "actividades_completadas": act_items,
        "avance_financiero_entidad": ej["totales_entidad"],
    }
    if advertencia:
        result["advertencia_anio"] = advertencia
    if query and not completados and not en_progreso and not pendientes:
        result["mensaje"] = f"No hay productos con meta en {target_anio} que coincidan con '{query}'."
    return result


def actividades(
    entity: Entity,
    codigo_producto: str | None = None,
    query: str | None = None,
    anio: int | None = None,
    estado: str | None = None,
    limit: int = 30,
) -> dict:
    """Actividades del PDM con evidencias."""
    target_anio, advertencia = _normalize_anio(anio)
    limit = min(max(1, limit), 40)

    resolved_codigo = codigo_producto
    producto_info = None
    if not resolved_codigo and query:
        p, resolve_msg = _resolve_producto(entity, query=query)
        if resolve_msg:
            return {"error": resolve_msg, "anio": target_anio}
        if p:
            resolved_codigo = p.codigo_producto
            producto_info = {
                "codigo_producto": p.codigo_producto,
                "nombre": _producto_label(p),
                "linea_estrategica": p.linea_estrategica,
            }
    elif resolved_codigo:
        p, _ = _resolve_producto(entity, codigo_producto=resolved_codigo)
        if p:
            resolved_codigo = p.codigo_producto
            producto_info = {
                "codigo_producto": p.codigo_producto,
                "nombre": _producto_label(p),
                "linea_estrategica": p.linea_estrategica,
            }

    qs = PdmActividad.objects.filter(entity=entity, anio=target_anio).select_related("evidencia")
    if resolved_codigo:
        qs = qs.filter(codigo_producto=resolved_codigo)
    elif query:
        q = query.strip()
        qs = qs.filter(
            Q(nombre__icontains=q)
            | Q(descripcion__icontains=q)
            | Q(codigo_producto__icontains=q)
        )
    elif not estado:
        return {
            "anio": target_anio,
            "total": 0,
            "actividades": [],
            "nota": (
                "Indica codigo_producto, query (nombre de producto o actividad) "
                "para consultar actividades."
            ),
        }

    if estado:
        qs = qs.filter(estado=estado.upper())

    rows = list(qs.order_by("anio", "id")[:limit])
    items = []
    for a in rows:
        ev = None
        try:
            ev = a.evidencia
        except ObjectDoesNotExist:
            ev = None
        items.append({
            "id": a.id,
            "codigo_producto": a.codigo_producto,
            "nombre": a.nombre,
            "descripcion": a.descripcion,
            "anio": a.anio,
            "estado": a.estado,
            "meta_ejecutar": a.meta_ejecutar,
            "fecha_inicio": a.fecha_inicio.isoformat() if a.fecha_inicio else None,
            "fecha_fin": a.fecha_fin.isoformat() if a.fecha_fin else None,
            "evidencia_descripcion": ev.descripcion if ev else None,
            "url_evidencia": ev.url_evidencia if ev else None,
        })

    result: dict[str, Any] = {
        "anio": target_anio,
        "codigo_producto": resolved_codigo,
        "query": query,
        "producto_vinculado": producto_info,
        "total": len(items),
        "actividades": items,
    }
    if advertencia:
        result["advertencia_anio"] = advertencia
    if not items and _has_search_filters(codigo_producto=resolved_codigo, query=query, estado=estado):
        result["mensaje"] = "No se encontraron actividades con esos criterios."
    return result


def _productos_por_bpin(entity: Entity, bpin: str) -> list[PdmProducto]:
    """Productos del PDM vinculados a un código BPIN."""
    bpin = _normalize_bpin(bpin)
    if not bpin:
        return []
    resultado: list[PdmProducto] = []
    for p in _producto_base_qs(entity).exclude(bpin__isnull=True).exclude(bpin=""):
        if bpin in _parse_bpines(p.bpin):
            resultado.append(p)
    return resultado


def consultar_proyecto_bpin(
    entity: Entity,
    bpin: str,
    anio: int | None = None,
) -> dict:
    """Consulta un proyecto BPIN: datos PIIP (datos.gov.co) + productos vinculados en el PDM."""
    bpin_raw = (bpin or "").strip()
    bpin = _normalize_bpin(bpin_raw)
    if not bpin:
        return {"error": "Código BPIN requerido."}
    if not _looks_like_bpin(bpin):
        return {
            "error": (
                f"'{bpin_raw}' no parece un BPIN válido (~13 dígitos, ej. 2024157620018). "
                "Si buscas un producto del plan, usa buscar_productos o detalle_producto."
            ),
        }

    target_anio, advertencia = _normalize_anio(anio)
    productos = _productos_por_bpin(entity, bpin)
    codigos = [p.codigo_producto for p in productos]

    externo_raw, consulta_url, ext_error = consultar_bpin_externo(bpin)
    proyecto_piip = _normalize_proyecto_bpin(externo_raw) if externo_raw else None

    aggs_map = actividad_aggs_for_productos(entity.id, codigos) if codigos else {}
    ejec_map = ejecucion_for_productos(entity.id, codigos, target_anio) if codigos else {}

    productos_vinculados = [
        _producto_metrics_item(entity, p, target_anio, aggs_map, ejec_map)
        for p in productos
    ]

    contratos_bpin = list(
        PDMContratoRPS.objects.filter(entity=entity, codigo_producto__in=codigos)
        .order_by("-valor")[:10]
        .values("no_crp", "codigo_producto", "contratista", "valor", "anio")
    ) if codigos else []

    ejec_bpin = (
        PDMEjecucionPresupuestal.objects.filter(
            entity=entity, bpin__icontains=bpin, anio=target_anio
        ).aggregate(pto=Sum("pto_definitivo"), pagos=Sum("pagos"))
    )
    pto_bpin = float(ejec_bpin["pto"] or 0)
    pagos_bpin = float(ejec_bpin["pagos"] or 0)

    iniciativas = list(
        PdmIniciativaSGR.objects.filter(entity=entity, bpin__icontains=bpin)
        .order_by("consecutivo")[:5]
        .values("consecutivo", "iniciativa_sgr", "tipo_iniciativa", "recursos_sgr_indicativos", "bpin")
    )

    result: dict[str, Any] = {
        "bpin": bpin,
        "encontrado_en_pdm": bool(productos or iniciativas),
        "proyecto_piip": proyecto_piip,
        "datos_abiertos_error": ext_error if not proyecto_piip else None,
        "consulta_url": consulta_url,
        "url_portal": f"{DATOS_GOV_CO_PORTAL}?bpin={bpin}",
        "anio_seguimiento": target_anio,
        "productos_vinculados": productos_vinculados,
        "total_productos_vinculados": len(productos_vinculados),
        "contratos_vinculados": [
            {
                "no_crp": c["no_crp"],
                "codigo_producto": c["codigo_producto"],
                "contratista": c["contratista"],
                "valor_cop": float(c["valor"] or 0),
                "anio": c["anio"],
            }
            for c in contratos_bpin
        ],
        "total_contratos_mostrados": len(contratos_bpin),
        "ejecucion_presupuestal_bpin_anio": {
            "pto_definitivo_cop": pto_bpin,
            "pagos_cop": pagos_bpin,
            "avance_pct": round((pagos_bpin / pto_bpin) * 100, 1) if pto_bpin else 0.0,
        },
        "iniciativas_sgr": [
            {
                **i,
                "recursos_sgr_indicativos": float(i["recursos_sgr_indicativos"] or 0),
                "url_bpin": f"{DATOS_GOV_CO_PORTAL}?bpin={i['bpin']}" if i.get("bpin") else None,
            }
            for i in iniciativas
        ],
    }
    if advertencia:
        result["advertencia_anio"] = advertencia
    if not productos and not proyecto_piip and not iniciativas:
        result["mensaje"] = (
            f"No se encontró el BPIN {bpin} en el PDM de {entity.name} "
            "ni en el portal de datos abiertos."
        )
    elif productos:
        result["nota"] = (
            "Cada producto_vinculado incluye meta_anio, avance y presupuesto del año consultado."
        )
    return result


def listar_proyectos(
    entity: Entity,
    query: str = "",
    sector: str | None = None,
    linea: str | None = None,
    limit: int = 15,
) -> dict:
    """Lista proyectos BPIN del PDM agrupados por código BPIN."""
    limit = min(max(1, limit), 30)
    data = compute_pdm_proyectos(_producto_base_qs(entity), entity.id)
    proyectos = data["proyectos"]

    if query:
        q = query.strip().lower()
        if _looks_like_bpin(q):
            q = _normalize_bpin(q).lower()
        proyectos = [
            p for p in proyectos
            if q in p["bpin"].lower()
            or any(
                q in (pr.get("nombre") or "").lower()
                or q in (pr.get("codigo_producto") or "").lower()
                or q in (pr.get("sector_mga") or "").lower()
                or q in (pr.get("linea_estrategica") or "").lower()
                for pr in p.get("productos", [])
            )
        ]

    if sector:
        s = sector.strip().lower()
        proyectos = [
            p for p in proyectos
            if any(s in (pr.get("sector_mga") or "").lower() for pr in p.get("productos", []))
        ]
    if linea:
        ln = linea.strip().lower()
        proyectos = [
            p for p in proyectos
            if any(ln in (pr.get("linea_estrategica") or "").lower() for pr in p.get("productos", []))
        ]

    total_filtrados = len(proyectos)
    proyectos = proyectos[:limit]
    bpines = [p["bpin"] for p in proyectos]
    externos, ext_error = consultar_bpines_externos(bpines)

    items = []
    for p in proyectos:
        ext = externos.get(p["bpin"], {})
        items.append({
            "bpin": p["bpin"],
            "nombre_proyecto": ext.get("nombreproyecto"),
            "estado_piip": ext.get("estadoproyecto"),
            "sector_piip": ext.get("sector"),
            "entidad_responsable": ext.get("entidadresponsable"),
            "total_productos": p["total_productos"],
            "avance_general_pct": p["avance_general"],
            "presupuesto_total_cop": p["presupuesto_total"],
            "completados": p["completados"],
            "en_progreso": p["en_progreso"],
            "pendientes": p["pendientes"],
            "url_portal": f"{DATOS_GOV_CO_PORTAL}?bpin={p['bpin']}",
            "productos_codigos": [pr["codigo_producto"] for pr in p["productos"][:6]],
            "productos_nombres": [pr.get("nombre") for pr in p["productos"][:3]],
        })

    result = {
        "total_proyectos": data["total_proyectos"],
        "total_filtrados": total_filtrados,
        "mostrados": len(items),
        "filtros": {
            k: v for k, v in {"query": query, "sector": sector, "linea": linea}.items() if v
        },
        "productos_sin_bpin": data["productos_sin_bpin"],
        "avance_promedio_pct": data["avance_promedio"],
        "proyectos": items,
        "datos_abiertos_error": ext_error,
        "portal_bpin": DATOS_GOV_CO_PORTAL,
        "nota": "Para detalle de un BPIN específico usa consultar_proyecto_bpin.",
    }
    if query and not items:
        result["mensaje"] = f"No se encontraron proyectos BPIN que coincidan con '{query}'."
    return result


def iniciativas_sgr(
    entity: Entity,
    query: str | None = None,
    bpin: str | None = None,
    limit: int = 30,
) -> dict:
    """Iniciativas SGR de la entidad."""
    limit = min(max(1, limit), 40)
    qs = PdmIniciativaSGR.objects.filter(entity=entity)
    if bpin:
        qs = qs.filter(bpin__icontains=_normalize_bpin(bpin))
    if query:
        q = query.strip()
        if _looks_like_bpin(q):
            qs = qs.filter(bpin__icontains=_normalize_bpin(q))
        else:
            qs = qs.filter(
                Q(iniciativa_sgr__icontains=q)
                | Q(tipo_iniciativa__icontains=q)
                | Q(sector_mga__icontains=q)
                | Q(linea_estrategica__icontains=q)
                | Q(bpin__icontains=q)
            )

    rows = list(
        qs.order_by("consecutivo")[:limit].values(
            "consecutivo",
            "iniciativa_sgr",
            "tipo_iniciativa",
            "sector_mga",
            "recursos_sgr_indicativos",
            "bpin",
            "linea_estrategica",
        )
    )

    result = {
        "total": len(rows),
        "filtros": {k: v for k, v in {"query": query, "bpin": bpin}.items() if v},
        "iniciativas": [
            {
                **r,
                "recursos_sgr_indicativos": float(r["recursos_sgr_indicativos"] or 0),
                "url_bpin": f"{DATOS_GOV_CO_PORTAL}?bpin={r['bpin']}" if r.get("bpin") else None,
            }
            for r in rows
        ],
    }
    if query or bpin:
        if not rows:
            ref = bpin or query
            result["mensaje"] = f"No se encontraron iniciativas SGR que coincidan con '{ref}'."
    else:
        result["nota"] = "Usa query o bpin para filtrar iniciativas específicas."
    return result


# ── Definiciones OpenAI tools ─────────────────────────────────────────

TOOL_DEFINITIONS: list[dict] = [
    {
        "type": "function",
        "function": {
            "name": "metas_cumplidas_anio",
            "description": (
                "Resumen de metas cumplidas, productos por estado y actividades finalizadas de un año. "
                "Usar para preguntas generales de cumplimiento del PDM. "
                "Para UN producto o sector específico, filtra con query, linea o sector. "
                "NO usar para ubicar contratos ni BPIN individuales."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "anio": {
                        "type": "integer",
                        "description": "Año PDM (2024-2027). Si el usuario dice 'este año', usar el año calendario actual.",
                    },
                    "query": {
                        "type": "string",
                        "description": "Filtro opcional por nombre/código de producto, sector o BPIN",
                    },
                    "linea": {"type": "string", "description": "Filtrar por línea estratégica"},
                    "sector": {"type": "string", "description": "Filtrar por sector MGA"},
                },
                "required": ["anio"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "resumen_pdm",
            "description": "Resumen general del PDM: totales, presupuesto cuatrienio, ejecución y avance físico por año.",
            "parameters": {"type": "object", "properties": {}, "required": []},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "consultar_proyecto_bpin",
            "description": (
                "Consulta UN proyecto de inversión pública por código BPIN (~13 dígitos, ej. 2024157620018). "
                "Devuelve datos PIIP, productos del PDM vinculados con meta_anio, contratos y ejecución. "
                "Usar SIEMPRE cuando el usuario mencione un BPIN, 'ese proyecto' o un número largo de inversión. "
                "NO confundir BPIN con codigo_producto del plan (ej. 2201028)."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "bpin": {"type": "string", "description": "Código BPIN del proyecto (13 dígitos)"},
                    "anio": {"type": "integer", "description": "Año PDM para métricas (2024-2027)"},
                },
                "required": ["bpin"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "listar_proyectos",
            "description": (
                "Lista y filtra proyectos BPIN del PDM (avance, productos vinculados, presupuesto). "
                "Usar para explorar proyectos por nombre, sector, línea o BPIN parcial. "
                "Para detalle de UN BPIN con metas y contratos: consultar_proyecto_bpin."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {
                        "type": "string",
                        "description": "BPIN, nombre de proyecto o producto vinculado",
                    },
                    "sector": {"type": "string", "description": "Filtrar por sector MGA de productos vinculados"},
                    "linea": {"type": "string", "description": "Filtrar por línea estratégica"},
                    "limit": {"type": "integer", "description": "Máximo resultados (default 15)"},
                },
                "required": [],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "buscar_productos",
            "description": (
                "Busca productos del plan indicativo por nombre, código, sector, línea, programa u ODS. "
                "Devuelve meta_anio, avance y presupuesto. "
                "Usar para '¿qué productos hay en educación?', 'busca alimentación escolar', etc. "
                "NO usar para BPIN (~13 dígitos) ni contratistas; para BPIN usar consultar_proyecto_bpin, "
                "para contratos usar contratos."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {"type": "string", "description": "Texto libre: nombre, palabra clave o código parcial"},
                    "codigo_producto": {"type": "string", "description": "Código exacto o parcial del producto"},
                    "linea": {"type": "string"},
                    "sector": {"type": "string"},
                    "programa": {"type": "string"},
                    "ods": {"type": "string"},
                    "anio": {"type": "integer", "description": "Año PDM para meta y avance (2024-2027)"},
                    "limit": {"type": "integer", "description": "Máximo resultados (default 15)"},
                },
                "required": [],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "detalle_producto",
            "description": (
                "Detalle completo de UN producto: metas por año, avance, actividades, evidencias, "
                "ejecución, contratos y BPIN vinculados. "
                "Usar codigo_producto si se conoce; si solo hay nombre del historial, usar query."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "codigo_producto": {
                        "type": "string",
                        "description": "Código del producto del plan (ej. 2201028)",
                    },
                    "query": {
                        "type": "string",
                        "description": "Nombre o texto para resolver el producto si no hay código exacto",
                    },
                    "anio": {"type": "integer", "description": "Año PDM para métricas (2024-2027)"},
                },
                "required": [],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "ejecucion_presupuestal",
            "description": (
                "Avance financiero (pto definitivo, pagos, %) de la entidad o de un producto para un año. "
                "Totales primero; top_productos como complemento. "
                "Si no conoces el código, usa query con nombre del producto."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "anio": {"type": "integer", "description": "Año PDM (2024-2027), obligatorio"},
                    "codigo_producto": {"type": "string"},
                    "query": {
                        "type": "string",
                        "description": "Nombre del producto si no tienes codigo_producto",
                    },
                    "limit": {"type": "integer", "description": "Máx. productos en detalle (default 8)"},
                },
                "required": ["anio"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "contratos",
            "description": (
                "Busca contratos RPS del PDM por contratista, número CRP, código de producto o texto libre. "
                "Devuelve el producto y la meta del plan vinculados a cada contrato. "
                "Usar SIEMPRE para preguntas sobre contratos, contratistas, CRP o "
                "'en qué meta/producto está ese contrato'. NO uses buscar_productos para contratistas."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "anio": {
                        "type": "integer",
                        "description": "Año PDM (2024-2027) para metas del producto vinculado",
                    },
                    "codigo_producto": {"type": "string"},
                    "contratista": {
                        "type": "string",
                        "description": "Nombre o parte del nombre del contratista (ej. FUNDACION PASITOS)",
                    },
                    "no_crp": {
                        "type": "string",
                        "description": "Número de registro presupuestal / contrato (CRP)",
                    },
                    "query": {
                        "type": "string",
                        "description": "Búsqueda libre en contratista, CRP, concepto o código de producto",
                    },
                    "limit": {"type": "integer", "description": "Máximo resultados (default 10)"},
                },
                "required": [],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "actividades",
            "description": (
                "Actividades del PDM con evidencias y URLs para un año. "
                "Filtra por codigo_producto o query (nombre de producto/actividad). "
                "Usar para '¿qué evidencias tiene?', 'actividades de ese producto'."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "codigo_producto": {"type": "string"},
                    "query": {
                        "type": "string",
                        "description": "Nombre de producto o actividad si no hay código",
                    },
                    "anio": {"type": "integer", "description": "Año PDM (2024-2027), obligatorio"},
                    "estado": {"type": "string", "description": "PENDIENTE|EN_PROGRESO|COMPLETADA|CANCELADA"},
                    "limit": {"type": "integer", "description": "Máximo resultados (default 30)"},
                },
                "required": ["anio"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "iniciativas_sgr",
            "description": (
                "Iniciativas SGR del PDM con recursos indicativos y BPIN. "
                "Filtra con query (nombre, sector, línea) o bpin."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {"type": "string", "description": "Nombre, sector, línea o texto libre"},
                    "bpin": {"type": "string", "description": "Código BPIN vinculado a la iniciativa"},
                    "limit": {"type": "integer", "description": "Máximo resultados (default 30)"},
                },
                "required": [],
            },
        },
    },
]

_TOOL_FUNCS = {
    "metas_cumplidas_anio": lambda entity, args: metas_cumplidas_anio(entity, **{k: v for k, v in args.items() if v is not None}),
    "resumen_pdm": lambda entity, args: resumen_pdm(entity),
    "consultar_proyecto_bpin": lambda entity, args: consultar_proyecto_bpin(entity, **{k: v for k, v in args.items() if v is not None}),
    "listar_proyectos": lambda entity, args: listar_proyectos(entity, **{k: v for k, v in args.items() if v is not None}),
    "buscar_productos": lambda entity, args: buscar_productos(entity, **{k: v for k, v in args.items() if v is not None}),
    "detalle_producto": lambda entity, args: detalle_producto(entity, **{k: v for k, v in args.items() if v is not None}),
    "ejecucion_presupuestal": lambda entity, args: ejecucion_presupuestal(entity, **{k: v for k, v in args.items() if v is not None}),
    "contratos": lambda entity, args: contratos(entity, **{k: v for k, v in args.items() if v is not None}),
    "actividades": lambda entity, args: actividades(entity, **{k: v for k, v in args.items() if v is not None}),
    "iniciativas_sgr": lambda entity, args: iniciativas_sgr(entity),
}


def execute_tool(entity: Entity, name: str, arguments: dict) -> tuple[str, list[dict]]:
    """Ejecuta una tool y devuelve (resultado JSON truncado, fuentes extraídas)."""
    fn = _TOOL_FUNCS.get(name)
    if not fn:
        return json.dumps({"error": f"Tool desconocida: {name}"}), []

    try:
        result = fn(entity, arguments)
    except Exception as exc:  # noqa: BLE001
        return json.dumps({"error": str(exc)}), []

    sources = _extract_sources(name, result)
    return _truncate(result), sources


def _extract_sources(tool_name: str, result: dict) -> list[dict]:
    """Extrae fuentes citables de los resultados de tools."""
    if result.get("error"):
        return []

    sources: list[dict] = []

    if tool_name == "metas_cumplidas_anio":
        sources.append({
            "tipo": "metas_anio",
            "titulo": f"Metas cumplidas PDM — año {result.get('anio', '')}",
            "url": None,
        })
        for p in result.get("productos_completados", [])[:5]:
            sources.append({
                "tipo": "producto",
                "titulo": f"{p.get('codigo_producto')} — {p.get('nombre', '')[:60]}",
                "url": None,
                "codigo_producto": p.get("codigo_producto"),
            })
        for a in result.get("actividades_completadas", [])[:3]:
            if a.get("url_evidencia"):
                sources.append({
                    "tipo": "evidencia",
                    "titulo": f"Evidencia: {a.get('nombre', '')[:60]}",
                    "url": a["url_evidencia"],
                    "codigo_producto": a.get("codigo_producto"),
                })

    elif tool_name == "ejecucion_presupuestal":
        sources.append({
            "tipo": "ejecucion",
            "titulo": f"Ejecución presupuestal — año {result.get('anio', '')}",
            "url": None,
        })

    elif tool_name == "resumen_pdm":
        sources.append({
            "tipo": "resumen_pdm",
            "titulo": f"Resumen PDM — {result.get('entidad', '')}",
            "url": None,
        })
        if result.get("portal_bpin"):
            sources.append({"tipo": "portal_bpin", "titulo": "Portal BPIN datos.gov.co", "url": result["portal_bpin"]})

    elif tool_name == "consultar_proyecto_bpin":
        bpin = result.get("bpin", "")
        nombre = (result.get("proyecto_piip") or {}).get("nombreproyecto") or f"BPIN {bpin}"
        sources.append({
            "tipo": "proyecto_bpin",
            "titulo": f"{bpin} — {str(nombre)[:80]}",
            "url": result.get("url_portal"),
            "bpin": bpin,
        })
        for p in result.get("productos_vinculados", [])[:6]:
            sources.append({
                "tipo": "producto",
                "titulo": f"{p.get('codigo_producto')} — {p.get('nombre', '')[:60]}",
                "url": result.get("url_portal"),
                "codigo_producto": p.get("codigo_producto"),
                "bpin": bpin,
            })

    elif tool_name == "listar_proyectos":
        sources.append({
            "tipo": "proyectos_pdm",
            "titulo": f"Proyectos BPIN del PDM — {result.get('mostrados', 0)} mostrados",
            "url": result.get("portal_bpin"),
        })
        for p in result.get("proyectos", [])[:8]:
            titulo = p.get("nombre_proyecto") or f"BPIN {p.get('bpin')}"
            sources.append({
                "tipo": "proyecto_bpin",
                "titulo": f"{p.get('bpin')} — {str(titulo)[:70]}",
                "url": p.get("url_portal"),
                "bpin": p.get("bpin"),
            })

    elif tool_name == "buscar_productos":
        for p in result.get("productos", [])[:8]:
            src = {
                "tipo": "producto",
                "titulo": f"{p.get('codigo_producto')} — {p.get('nombre', '')[:80]}",
                "url": p.get("url_bpin"),
                "codigo_producto": p.get("codigo_producto"),
            }
            sources.append(src)

    elif tool_name == "detalle_producto":
        sources.append({
            "tipo": "producto",
            "titulo": f"{result.get('codigo_producto')} — {result.get('nombre', '')[:80]}",
            "url": result.get("url_bpin"),
            "codigo_producto": result.get("codigo_producto"),
        })
        for a in result.get("actividades", []):
            if a.get("evidencia") and a["evidencia"].get("url_evidencia"):
                sources.append({
                    "tipo": "evidencia",
                    "titulo": f"Evidencia actividad: {a.get('nombre', '')[:60]}",
                    "url": a["evidencia"]["url_evidencia"],
                    "codigo_producto": result.get("codigo_producto"),
                })

    elif tool_name == "actividades":
        for a in result.get("actividades", []):
            if a.get("url_evidencia"):
                sources.append({
                    "tipo": "evidencia",
                    "titulo": f"Evidencia: {a.get('nombre', '')[:60]}",
                    "url": a["url_evidencia"],
                    "codigo_producto": a.get("codigo_producto"),
                })

    elif tool_name == "contratos":
        for c in result.get("contratos", [])[:5]:
            pv = c.get("producto_vinculado") or {}
            titulo = f"CRP {c.get('no_crp')} — {c.get('contratista', '')[:40]}"
            if pv.get("codigo_producto"):
                titulo = f"{pv['codigo_producto']} — {titulo}"
            sources.append({
                "tipo": "contrato",
                "titulo": titulo,
                "url": pv.get("url_bpin"),
                "codigo_producto": pv.get("codigo_producto") or c.get("codigo_producto"),
            })

    elif tool_name == "iniciativas_sgr":
        for i in result.get("iniciativas", [])[:5]:
            if i.get("url_bpin"):
                sources.append({
                    "tipo": "iniciativa_sgr",
                    "titulo": f"{i.get('consecutivo')} — {i.get('iniciativa_sgr', '')[:60]}",
                    "url": i["url_bpin"],
                })

    return sources
