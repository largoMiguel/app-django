"""Herramientas read-only del chat PDM — consultas acotadas por entidad."""
from __future__ import annotations

import json
from datetime import datetime
from typing import Any

from django.core.cache import cache
from django.core.exceptions import ObjectDoesNotExist
from django.db.models import Count, Q, Sum

from apps.entities.models import Entity

from .bpin_view import DATOS_GOV_CO_PORTAL
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
    linea: str | None = None,
    sector: str | None = None,
    programa: str | None = None,
    ods: str | None = None,
    anio: int | None = None,
    limit: int = 15,
) -> dict:
    """Busca productos del PDM por texto o filtros."""
    limit = min(max(1, limit), 25)
    qs = _producto_base_qs(entity)

    if linea:
        qs = qs.filter(linea_estrategica__icontains=linea)
    if sector:
        qs = qs.filter(sector_mga__icontains=sector)
    if programa:
        qs = qs.filter(programa_mga__icontains=programa)
    if ods:
        qs = qs.filter(ods__icontains=ods)

    if query:
        qs = qs.filter(
            Q(codigo_producto__icontains=query)
            | Q(producto_mga__icontains=query)
            | Q(codigo_indicador_producto__icontains=query)
            | Q(linea_estrategica__icontains=query)
            | Q(sector_mga__icontains=query)
            | Q(programa_mga__icontains=query)
            | Q(bpin__icontains=query)
            | Q(responsable_secretaria_nombre__icontains=query)
        )

    productos = list(qs.order_by("codigo_producto")[:limit])
    target_anio = anio or _current_year()
    codigos = [p.codigo_producto for p in productos]
    aggs_map = actividad_aggs_for_productos(entity.id, codigos) if codigos else {}
    ejec_map = ejecucion_for_productos(entity.id, codigos, target_anio) if codigos else {}

    items = []
    for p in productos:
        metrics = producto_list_metrics(p, target_anio, aggs_map.get(p.codigo_producto, {}))
        ej = ejec_map.get(p.codigo_producto, {"pto_definitivo": 0.0, "pagos": 0.0})
        items.append({
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
        })

    return {"total_encontrados": len(items), "anio": target_anio, "productos": items}


def detalle_producto(entity: Entity, codigo_producto: str, anio: int | None = None) -> dict:
    """Detalle completo de un producto PDM."""
    try:
        p = _producto_base_qs(entity).get(codigo_producto=codigo_producto)
    except PdmProducto.DoesNotExist:
        return {"error": f"Producto {codigo_producto} no encontrado en el PDM de {entity.name}."}

    target_anio = anio or _current_year()
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

    return {
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
        "url_bpin": f"{DATOS_GOV_CO_PORTAL}?bpin={p.bpin}" if p.bpin else None,
        "ods": p.ods,
        "responsable": p.responsable_secretaria_nombre,
        "anio_seguimiento": target_anio,
        "avance_fisico_pct": metrics["avance_anio"],
        "estado_anio": metrics["estado_anio"],
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
    }


def ejecucion_presupuestal(
    entity: Entity,
    anio: int | None = None,
    codigo_producto: str | None = None,
    limit: int = 8,
) -> dict:
    """Ejecución presupuestal agregada o por producto."""
    target_anio, advertencia = _normalize_anio(anio)
    limit = min(max(1, limit), 15)
    qs = PDMEjecucionPresupuestal.objects.filter(entity=entity, anio=target_anio)
    if codigo_producto:
        qs = qs.filter(codigo_producto=codigo_producto)

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

    result = {
        "anio": target_anio,
        "codigo_producto": codigo_producto,
        "totales_entidad": {
            "pto_definitivo_cop": pto,
            "pagos_cop": pagos,
            "avance_financiero_pct": round((pagos / pto) * 100, 1) if pto else 0.0,
        },
        "top_productos_por_pagos": [
            {
                "codigo_producto": r["codigo_producto"],
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
    if advertencia:
        result["advertencia_anio"] = advertencia
    return result


def contratos(
    entity: Entity,
    anio: int | None = None,
    codigo_producto: str | None = None,
) -> dict:
    """Contratos RPS del PDM."""
    qs = PDMContratoRPS.objects.filter(entity=entity)
    if anio:
        qs = qs.filter(anio=anio)
    if codigo_producto:
        qs = qs.filter(codigo_producto=codigo_producto)

    rows = list(
        qs.order_by("-valor")[:25]
        .values("no_crp", "codigo_producto", "concepto", "valor", "anio", "contratista")
    )
    total = sum(float(r["valor"] or 0) for r in rows)

    return {
        "anio": anio,
        "codigo_producto": codigo_producto,
        "total_contratado_cop": total,
        "cantidad": len(rows),
        "contratos": [
            {
                "no_crp": r["no_crp"],
                "codigo_producto": r["codigo_producto"],
                "concepto": r["concepto"],
                "valor_cop": float(r["valor"] or 0),
                "anio": r["anio"],
                "contratista": r["contratista"],
            }
            for r in rows
        ],
    }


def metas_cumplidas_anio(entity: Entity, anio: int | None = None) -> dict:
    """Metas y avances físicos cumplidos o en progreso para un año."""
    target_anio, advertencia = _normalize_anio(anio)
    productos = list(_producto_base_qs(entity))
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
    return result


def actividades(
    entity: Entity,
    codigo_producto: str | None = None,
    anio: int | None = None,
    estado: str | None = None,
) -> dict:
    """Actividades del PDM con evidencias."""
    target_anio, advertencia = _normalize_anio(anio)
    qs = PdmActividad.objects.filter(entity=entity, anio=target_anio).select_related("evidencia")
    if codigo_producto:
        qs = qs.filter(codigo_producto=codigo_producto)
    if estado:
        qs = qs.filter(estado=estado.upper())

    rows = list(qs.order_by("anio", "id")[:30])
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

    result = {"anio": target_anio, "total": len(items), "actividades": items}
    if advertencia:
        result["advertencia_anio"] = advertencia
    return result


def iniciativas_sgr(entity: Entity) -> dict:
    """Iniciativas SGR de la entidad."""
    rows = list(
        PdmIniciativaSGR.objects.filter(entity=entity)
        .order_by("consecutivo")[:30]
        .values(
            "consecutivo", "iniciativa_sgr", "tipo_iniciativa", "sector_mga",
            "recursos_sgr_indicativos", "bpin", "linea_estrategica",
        )
    )
    return {
        "total": len(rows),
        "iniciativas": [
            {
                **r,
                "recursos_sgr_indicativos": float(r["recursos_sgr_indicativos"] or 0),
                "url_bpin": f"{DATOS_GOV_CO_PORTAL}?bpin={r['bpin']}" if r.get("bpin") else None,
            }
            for r in rows
        ],
    }


# ── Definiciones OpenAI tools ─────────────────────────────────────────

TOOL_DEFINITIONS: list[dict] = [
    {
        "type": "function",
        "function": {
            "name": "metas_cumplidas_anio",
            "description": (
                "Metas cumplidas, productos completados/en progreso y actividades finalizadas "
                "para un año del PDM. Usar para preguntas sobre metas, cumplimiento o avance físico del año."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "anio": {
                        "type": "integer",
                        "description": "Año PDM (2024-2027). Si el usuario dice 'este año', usar el año calendario actual.",
                    },
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
            "name": "buscar_productos",
            "description": "Busca productos del plan indicativo por texto o filtros (línea, sector, programa, ODS, año).",
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {"type": "string", "description": "Texto libre de búsqueda"},
                    "linea": {"type": "string"},
                    "sector": {"type": "string"},
                    "programa": {"type": "string"},
                    "ods": {"type": "string"},
                    "anio": {"type": "integer"},
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
            "description": "Detalle completo de un producto: metas, avance, actividades, evidencias, ejecución y contratos.",
            "parameters": {
                "type": "object",
                "properties": {
                    "codigo_producto": {"type": "string"},
                    "anio": {"type": "integer"},
                },
                "required": ["codigo_producto"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "ejecucion_presupuestal",
            "description": (
                "Avance financiero (pto definitivo, pagos, %) de la entidad para un año. "
                "Responde totales_entidad primero; top_productos solo como complemento."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "anio": {"type": "integer", "description": "Año PDM (2024-2027), obligatorio"},
                    "codigo_producto": {"type": "string"},
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
            "description": "Contratos RPS asociados al PDM (contratista, valor, concepto).",
            "parameters": {
                "type": "object",
                "properties": {
                    "anio": {"type": "integer"},
                    "codigo_producto": {"type": "string"},
                },
                "required": [],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "actividades",
            "description": "Actividades del PDM con evidencias y URLs externas para un año.",
            "parameters": {
                "type": "object",
                "properties": {
                    "codigo_producto": {"type": "string"},
                    "anio": {"type": "integer", "description": "Año PDM (2024-2027), obligatorio"},
                    "estado": {"type": "string", "description": "PENDIENTE|EN_PROGRESO|COMPLETADA|CANCELADA"},
                },
                "required": ["anio"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "iniciativas_sgr",
            "description": "Iniciativas SGR del PDM con recursos indicativos y BPIN.",
            "parameters": {"type": "object", "properties": {}, "required": []},
        },
    },
]

_TOOL_FUNCS = {
    "metas_cumplidas_anio": lambda entity, args: metas_cumplidas_anio(entity, **{k: v for k, v in args.items() if v is not None}),
    "resumen_pdm": lambda entity, args: resumen_pdm(entity),
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
            sources.append({
                "tipo": "contrato",
                "titulo": f"CRP {c.get('no_crp')} — {c.get('contratista', '')[:40]}",
                "url": None,
                "codigo_producto": c.get("codigo_producto"),
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
