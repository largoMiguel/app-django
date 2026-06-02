"""Analítica agregada del módulo PDM para la vista de Análisis."""
from __future__ import annotations

from collections import defaultdict
from datetime import datetime

from django.db.models import QuerySet, Sum

from .metrics import (
    ANIOS_PDM,
    actividad_aggs_for_productos,
    avance_general_producto,
    estado_producto_anio,
    resumen_anio,
)
from .models import PDMEjecucionPresupuestal, PdmProducto

_ANALYTICS_FIELDS = (
    "id",
    "codigo_producto",
    "linea_estrategica",
    "sector_mga",
    "ods",
    "programacion_2024",
    "programacion_2025",
    "programacion_2026",
    "programacion_2027",
    "total_2024",
    "total_2025",
    "total_2026",
    "total_2027",
    "responsable_secretaria_id",
    "responsable_secretaria_nombre",
)

_ESTADO_KEYS = {
    "PENDIENTE": "pendiente",
    "EN_PROGRESO": "en_progreso",
    "COMPLETADO": "completado",
    "POR_EJECUTAR": "por_ejecutar",
}


def _productos_for_analytics(productos_qs: QuerySet[PdmProducto]) -> list[PdmProducto]:
    return list(
        PdmProducto.objects.filter(pk__in=productos_qs.values("pk")).only(*_ANALYTICS_FIELDS)
    )


def _ejecucion_por_codigo(
    entity_id: int,
    codigos: list[str],
    anio: int | None = None,
) -> dict[str, dict[str, float]]:
    if not codigos:
        return {}
    qs = PDMEjecucionPresupuestal.objects.filter(entity_id=entity_id, codigo_producto__in=codigos)
    if anio is not None:
        qs = qs.filter(anio=anio)
    rows = qs.values("codigo_producto").annotate(
        pto_definitivo=Sum("pto_definitivo"),
        pagos=Sum("pagos"),
    )
    return {
        str(row["codigo_producto"]): {
            "pto_definitivo": float(row["pto_definitivo"] or 0),
            "pagos": float(row["pagos"] or 0),
        }
        for row in rows
    }


def _ejecucion_por_anio(entity_id: int, codigos: list[str]) -> dict[int, dict[str, float]]:
    if not codigos:
        return {}
    rows = (
        PDMEjecucionPresupuestal.objects.filter(
            entity_id=entity_id,
            codigo_producto__in=codigos,
            anio__in=ANIOS_PDM,
        )
        .values("anio")
        .annotate(pto_definitivo=Sum("pto_definitivo"), pagos=Sum("pagos"))
    )
    out: dict[int, dict[str, float]] = {}
    for row in rows:
        anio = int(row["anio"])
        out[anio] = {
            "pto_definitivo": float(row["pto_definitivo"] or 0),
            "pagos": float(row["pagos"] or 0),
        }
    return out


def _plan_anio(producto: PdmProducto, anio: int) -> float:
    return float(
        {
            2024: producto.total_2024,
            2025: producto.total_2025,
            2026: producto.total_2026,
            2027: producto.total_2027,
        }.get(anio, 0)
        or 0
    )


def _tiene_meta_anio(producto: PdmProducto, anio: int, aggs: dict) -> bool:
    return resumen_anio(producto, anio, aggs).get("meta_programada", 0) > 0


def _tiene_meta_alguna(producto: PdmProducto, aggs: dict) -> bool:
    return any(_tiene_meta_anio(producto, y, aggs) for y in ANIOS_PDM)


def _avance_producto(producto: PdmProducto, aggs: dict, anio: int | None) -> float:
    if anio is not None:
        return resumen_anio(producto, anio, aggs).get("porcentaje_avance", 0.0)
    return avance_general_producto(producto, aggs)


def _estado_producto(producto: PdmProducto, aggs: dict, anio: int | None) -> str:
    if anio is not None:
        return estado_producto_anio(producto, anio, aggs)
    avance = avance_general_producto(producto, aggs)
    if avance >= 100:
        return "COMPLETADO"
    now_year = datetime.now().year
    has_past_present = any(
        _tiene_meta_anio(producto, y, aggs) and y <= now_year for y in ANIOS_PDM
    )
    has_future = any(_tiene_meta_anio(producto, y, aggs) and y > now_year for y in ANIOS_PDM)
    if not has_past_present and has_future:
        return "POR_EJECUTAR"
    total_actividades = sum(int(aggs.get(y, {}).get("total_actividades", 0)) for y in ANIOS_PDM)
    if total_actividades > 0:
        return "EN_PROGRESO"
    return "PENDIENTE"


def _producto_cuenta_para_filtro(producto: PdmProducto, aggs: dict, anio: int | None) -> bool:
    if anio is not None:
        return _tiene_meta_anio(producto, anio, aggs)
    return _tiene_meta_alguna(producto, aggs)


def compute_pdm_analytics(
    productos_qs: QuerySet[PdmProducto],
    entity_id: int,
    anio: int | None = None,
    *,
    include_por_secretaria: bool = False,
) -> dict:
    productos = _productos_for_analytics(productos_qs)
    codigos = [p.codigo_producto for p in productos]
    aggs_map = actividad_aggs_for_productos(entity_id, codigos)
    ejecucion_map = _ejecucion_por_codigo(entity_id, codigos, anio)
    ejecucion_anios = _ejecucion_por_anio(entity_id, codigos)

    productos_relevantes: list[tuple[PdmProducto, dict]] = []
    for p in productos:
        aggs = aggs_map.get(p.codigo_producto, {})
        if _producto_cuenta_para_filtro(p, aggs, anio):
            productos_relevantes.append((p, aggs))

    estado_distribucion = {"pendiente": 0, "en_progreso": 0, "completado": 0, "por_ejecutar": 0, "total": 0}
    avance_sum = 0.0
    completados = 0
    presupuesto_pto = 0.0
    presupuesto_pagos = 0.0

    linea_agg: dict[str, dict] = defaultdict(lambda: {"productos": 0, "avance_sum": 0.0})
    sector_agg: dict[str, dict] = defaultdict(
        lambda: {"completados": 0, "en_progreso": 0, "pendientes": 0, "por_ejecutar": 0, "total": 0}
    )
    ods_agg: dict[str, dict] = defaultdict(
        lambda: {"productos": 0, "avance_sum": 0.0, "presupuesto": 0.0}
    )
    secretaria_agg: dict[int, dict] = defaultdict(
        lambda: {
            "secretaria": "Sin asignar",
            "productos": 0,
            "completados": 0,
            "en_progreso": 0,
            "pendientes": 0,
            "por_ejecutar": 0,
            "avance_sum": 0.0,
            "pto_definitivo": 0.0,
            "pagos": 0.0,
        }
    )

    for p, aggs in productos_relevantes:
        estado = _estado_producto(p, aggs, anio)
        avance = _avance_producto(p, aggs, anio)
        key = _ESTADO_KEYS.get(estado)
        if key:
            estado_distribucion[key] += 1
        estado_distribucion["total"] += 1
        avance_sum += avance
        if avance >= 100:
            completados += 1

        ej = ejecucion_map.get(p.codigo_producto, {"pto_definitivo": 0.0, "pagos": 0.0})
        presupuesto_pto += ej["pto_definitivo"]
        presupuesto_pagos += ej["pagos"]

        linea = p.linea_estrategica or "Sin línea"
        linea_agg[linea]["productos"] += 1
        linea_agg[linea]["avance_sum"] += avance

        sector = p.sector_mga or "Sin sector"
        sector_agg[sector]["total"] += 1
        if estado == "COMPLETADO":
            sector_agg[sector]["completados"] += 1
        elif estado == "EN_PROGRESO":
            sector_agg[sector]["en_progreso"] += 1
        elif estado == "POR_EJECUTAR":
            sector_agg[sector]["por_ejecutar"] += 1
        else:
            sector_agg[sector]["pendientes"] += 1

        ods = p.ods or "Sin ODS"
        ods_agg[ods]["productos"] += 1
        ods_agg[ods]["avance_sum"] += avance
        ods_agg[ods]["presupuesto"] += ej["pto_definitivo"]

        if include_por_secretaria:
            sid = p.responsable_secretaria_id or 0
            sec = secretaria_agg[sid]
            sec["secretaria"] = p.responsable_secretaria_nombre or "Sin asignar"
            sec["productos"] += 1
            sec["avance_sum"] += avance
            sec["pto_definitivo"] += ej["pto_definitivo"]
            sec["pagos"] += ej["pagos"]
            if estado == "COMPLETADO":
                sec["completados"] += 1
            elif estado == "EN_PROGRESO":
                sec["en_progreso"] += 1
            elif estado == "POR_EJECUTAR":
                sec["por_ejecutar"] += 1
            else:
                sec["pendientes"] += 1

    total = estado_distribucion["total"]
    avance_global = round((completados / total) * 100, 1) if total else 0.0

    metas_por_anio = []
    for y in ANIOS_PDM:
        programada = 0
        ejecutada = 0
        for p, aggs in productos_relevantes:
            if not _tiene_meta_anio(p, y, aggs):
                continue
            programada += 1
            if estado_producto_anio(p, y, aggs) == "COMPLETADO":
                ejecutada += 1
        pct = round((ejecutada / programada) * 100, 1) if programada else 0.0
        metas_por_anio.append({"anio": y, "programada": programada, "ejecutada": ejecutada, "pct": pct})

    presupuestal_por_anio = []
    for y in ANIOS_PDM:
        plan = sum(_plan_anio(p, y) for p, _ in productos_relevantes)
        ej_y = ejecucion_anios.get(y, {"pto_definitivo": 0.0, "pagos": 0.0})
        ejec = ej_y["pto_definitivo"]
        pagos = ej_y["pagos"]
        pct_pagado = round((pagos / ejec) * 100, 1) if ejec else 0.0
        presupuestal_por_anio.append(
            {"anio": y, "plan": plan, "ejecucion": ejec, "pagos": pagos, "pct_pagado": pct_pagado}
        )

    por_linea = sorted(
        [
            {
                "linea": linea,
                "productos": data["productos"],
                "avance_pct": round(data["avance_sum"] / data["productos"], 1) if data["productos"] else 0.0,
            }
            for linea, data in linea_agg.items()
        ],
        key=lambda x: x["productos"],
        reverse=True,
    )

    por_sector_estado = sorted(
        [
            {
                "sector": sector,
                "completados": data["completados"],
                "en_progreso": data["en_progreso"],
                "pendientes": data["pendientes"] + data["por_ejecutar"],
            }
            for sector, data in sector_agg.items()
            if data["total"] > 0
        ],
        key=lambda x: x["completados"] + x["en_progreso"] + x["pendientes"],
        reverse=True,
    )[:10]

    por_ods = sorted(
        [
            {
                "ods": ods_name,
                "productos": data["productos"],
                "avance_pct": round(data["avance_sum"] / data["productos"], 1) if data["productos"] else 0.0,
                "presupuesto": data["presupuesto"],
            }
            for ods_name, data in ods_agg.items()
            if ods_name != "Sin ODS" or data["productos"] > 0
        ],
        key=lambda x: x["productos"],
        reverse=True,
    )

    por_secretaria = []
    if include_por_secretaria:
        por_secretaria = sorted(
            [
                {
                    "secretaria_id": sid,
                    "secretaria": data["secretaria"],
                    "productos": data["productos"],
                    "completados": data["completados"],
                    "en_progreso": data["en_progreso"],
                    "pendientes": data["pendientes"],
                    "por_ejecutar": data["por_ejecutar"],
                    "avance_pct": round(data["avance_sum"] / data["productos"], 1) if data["productos"] else 0.0,
                    "pto_definitivo": data["pto_definitivo"],
                    "pagos": data["pagos"],
                }
                for sid, data in secretaria_agg.items()
            ],
            key=lambda x: x["productos"],
            reverse=True,
        )

    return {
        "anio_filtro": anio,
        "total_productos": total,
        "avance_global": avance_global,
        "presupuesto": {
            "pto_definitivo": presupuesto_pto,
            "pagos": presupuesto_pagos,
        },
        "estado_distribucion": estado_distribucion,
        "metas_por_anio": metas_por_anio,
        "por_linea": por_linea,
        "por_sector_estado": por_sector_estado,
        "por_ods": por_ods,
        "presupuestal_por_anio": presupuestal_por_anio,
        "por_secretaria": por_secretaria,
    }
