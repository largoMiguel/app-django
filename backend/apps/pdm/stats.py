"""Estadísticas agregadas del módulo PDM por entidad."""
from __future__ import annotations

from collections import defaultdict

from .metrics import ANIOS_PDM, actividad_aggs_for_productos, estado_producto_anio, resumen_anio
from .models import PdmIniciativaSGR, PdmProducto


def compute_pdm_stats(productos: list[PdmProducto], iniciativas_count: int, lineas_count: int) -> dict:
    presupuesto_por_anio = {anio: 0.0 for anio in ANIOS_PDM}
    presupuesto_por_linea: dict[str, float] = defaultdict(float)
    presupuesto_por_sector: dict[str, float] = defaultdict(float)

    for p in productos:
        total_cuat = float(p.total_2024 + p.total_2025 + p.total_2026 + p.total_2027)
        linea = p.linea_estrategica or "Sin línea"
        sector = p.sector_mga or "Sin sector"
        presupuesto_por_linea[linea] += total_cuat
        presupuesto_por_sector[sector] += total_cuat
        presupuesto_por_anio[2024] += float(p.total_2024 or 0)
        presupuesto_por_anio[2025] += float(p.total_2025 or 0)
        presupuesto_por_anio[2026] += float(p.total_2026 or 0)
        presupuesto_por_anio[2027] += float(p.total_2027 or 0)

    presupuesto_total = sum(presupuesto_por_anio.values())
    return {
        "total_lineas_estrategicas": lineas_count,
        "total_productos": len(productos),
        "total_iniciativas_sgr": iniciativas_count,
        "presupuesto_total": presupuesto_total,
        "presupuesto_por_anio": {str(k): v for k, v in presupuesto_por_anio.items()},
        "presupuesto_por_linea": sorted(
            [{"linea": k, "total": v} for k, v in presupuesto_por_linea.items()],
            key=lambda x: x["total"],
            reverse=True,
        ),
        "presupuesto_por_sector": sorted(
            [{"sector": k, "total": v} for k, v in presupuesto_por_sector.items()],
            key=lambda x: x["total"],
            reverse=True,
        ),
    }


def compute_estado_stats(productos: list[PdmProducto], entity_id: int, anio: int) -> dict:
    codigos = [p.codigo_producto for p in productos]
    aggs_map = actividad_aggs_for_productos(entity_id, codigos)
    stats = {"pendiente": 0, "en_progreso": 0, "completado": 0, "por_ejecutar": 0, "total": 0}
    for p in productos:
        aggs_anio = aggs_map.get(p.codigo_producto, {})
        if resumen_anio(p, anio, aggs_anio).get("meta_programada", 0) <= 0:
            continue
        stats["total"] += 1
        estado = estado_producto_anio(p, anio, aggs_anio)
        key = {
            "PENDIENTE": "pendiente",
            "EN_PROGRESO": "en_progreso",
            "COMPLETADO": "completado",
            "POR_EJECUTAR": "por_ejecutar",
        }.get(estado)
        if key:
            stats[key] += 1
    return stats


def filter_options_from_productos(productos_qs) -> dict:
    lineas = list(
        productos_qs.exclude(linea_estrategica__isnull=True)
        .exclude(linea_estrategica="")
        .values_list("linea_estrategica", flat=True)
        .distinct()
        .order_by("linea_estrategica")
    )
    sectores = list(
        productos_qs.exclude(sector_mga__isnull=True)
        .exclude(sector_mga="")
        .values_list("sector_mga", flat=True)
        .distinct()
        .order_by("sector_mga")
    )
    ods = list(
        productos_qs.exclude(ods__isnull=True)
        .exclude(ods="")
        .values_list("ods", flat=True)
        .distinct()
        .order_by("ods")
    )
    tipos = list(
        productos_qs.exclude(tipo_acumulacion__isnull=True)
        .exclude(tipo_acumulacion="")
        .values_list("tipo_acumulacion", flat=True)
        .distinct()
        .order_by("tipo_acumulacion")
    )
    return {"lineas_estrategicas": lineas, "sectores": sectores, "ods": ods, "tipos_acumulacion": tipos}
