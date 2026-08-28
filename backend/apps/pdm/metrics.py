"""Cálculo de métricas de producto por año (avance, estado)."""
from __future__ import annotations

from datetime import datetime

from django.db.models import Count, Q, Sum

from .ejecucion_mensual import ultimo_dia_mes
from .models import ActividadEstado, PdmActividad, PdmProducto

ANIOS_PDM = (2024, 2025, 2026, 2027)


def _meta_programada(producto: PdmProducto, anio: int) -> float:
    return float(
        {
            2024: producto.programacion_2024,
            2025: producto.programacion_2025,
            2026: producto.programacion_2026,
            2027: producto.programacion_2027,
        }.get(anio, 0)
        or 0
    )


def _presupuesto_anio(producto: PdmProducto, anio: int) -> float:
    return float(
        {
            2024: producto.total_2024,
            2025: producto.total_2025,
            2026: producto.total_2026,
            2027: producto.total_2027,
        }.get(anio, 0)
        or 0
    )


def ejecucion_for_productos(entity_id: int, codigos: list[str], anio: int) -> dict[str, dict[str, float]]:
    """Suma pto. definitivo y pagos de ejecución por codigo_producto para un año."""
    from .ejecucion_resumen import ejecucion_por_codigo

    return ejecucion_por_codigo(entity_id, codigos, anio)


def ejecucion_definitivo_for_productos(entity_id: int, codigos: list[str], anio: int) -> dict[str, float]:
    return {
        codigo: values["pto_definitivo"]
        for codigo, values in ejecucion_for_productos(entity_id, codigos, anio).items()
    }


def actividad_aggs_for_productos(
    entity_id: int,
    claves: list[str],
    hasta_mes: int | None = None,
    anio_corte: int | None = None,
) -> dict[str, dict[int, dict]]:
    """Agregados de actividades por clave_producto y año.

    Si hasta_mes está definido, solo incluye actividades con fecha_ejecucion <= fin de ese mes
    del anio_corte (o del propio anio de la actividad si anio_corte es None).
    """
    if not claves:
        return {}

    qs = PdmActividad.objects.filter(entity_id=entity_id, clave_producto__in=claves, anio__in=ANIOS_PDM)
    if hasta_mes is not None:
        filtradas: list[PdmActividad] = []
        for act in qs.only("id", "clave_producto", "anio", "meta_ejecutar", "estado", "fecha_ejecucion"):
            anio_ref = anio_corte if anio_corte is not None else act.anio
            if act.fecha_ejecucion and act.fecha_ejecucion <= ultimo_dia_mes(anio_ref, hasta_mes):
                filtradas.append(act)
            elif act.fecha_ejecucion is None and hasta_mes == 12:
                filtradas.append(act)
        out: dict[str, dict[int, dict]] = {}
        for act in filtradas:
            bucket = out.setdefault(act.clave_producto, {}).setdefault(
                act.anio,
                {
                    "meta_asignada": 0.0,
                    "meta_ejecutada": 0.0,
                    "total_actividades": 0,
                    "actividades_completadas": 0,
                },
            )
            bucket["meta_asignada"] += float(act.meta_ejecutar or 0)
            bucket["total_actividades"] += 1
            if act.estado == ActividadEstado.COMPLETADA:
                bucket["meta_ejecutada"] += float(act.meta_ejecutar or 0)
                bucket["actividades_completadas"] += 1
        return out

    rows = (
        qs.values("clave_producto", "anio")
        .annotate(
            meta_asignada=Sum("meta_ejecutar"),
            meta_ejecutada=Sum("meta_ejecutar", filter=Q(estado=ActividadEstado.COMPLETADA)),
            total_actividades=Count("id"),
            actividades_completadas=Count("id", filter=Q(estado=ActividadEstado.COMPLETADA)),
        )
    )
    out: dict[str, dict[int, dict]] = {}
    for row in rows:
        code = row["clave_producto"]
        anio = int(row["anio"])
        out.setdefault(code, {})[anio] = {
            "meta_asignada": float(row["meta_asignada"] or 0),
            "meta_ejecutada": float(row["meta_ejecutada"] or 0),
            "total_actividades": int(row["total_actividades"] or 0),
            "actividades_completadas": int(row["actividades_completadas"] or 0),
        }
    return out


def resumen_anio(producto: PdmProducto, anio: int, aggs: dict | None = None) -> dict:
    agg = (aggs or {}).get(anio, {})
    meta_programada = _meta_programada(producto, anio)
    meta_ejecutada = float(agg.get("meta_ejecutada", 0))
    total_actividades = int(agg.get("total_actividades", 0))
    porcentaje_avance = 0.0
    if meta_ejecutada > 0 and meta_programada > 0:
        porcentaje_avance = min(100.0, (meta_ejecutada / meta_programada) * 100)
    return {
        "anio": anio,
        "meta_programada": meta_programada,
        "meta_asignada": float(agg.get("meta_asignada", 0)),
        "meta_disponible": max(0.0, meta_programada - float(agg.get("meta_asignada", 0))),
        "meta_ejecutada": meta_ejecutada,
        "total_actividades": total_actividades,
        "actividades_completadas": int(agg.get("actividades_completadas", 0)),
        "porcentaje_avance": round(porcentaje_avance, 2),
        "presupuesto": _presupuesto_anio(producto, anio),
    }


def estado_producto_anio(producto: PdmProducto, anio: int, aggs: dict | None = None) -> str:
    resumen = resumen_anio(producto, anio, aggs)
    avance = resumen["porcentaje_avance"]
    if anio > datetime.now().year and resumen["meta_programada"] > 0:
        return "POR_EJECUTAR"
    if avance >= 100:
        return "COMPLETADO"
    if avance == 0 and resumen["total_actividades"] == 0:
        return "PENDIENTE"
    if resumen["total_actividades"] > 0:
        return "EN_PROGRESO"
    return "PENDIENTE"


def avance_general_producto(producto: PdmProducto, aggs_by_anio: dict | None = None) -> float:
    """Promedio de avance en años con meta programada > 0."""
    aggs_by_anio = aggs_by_anio or {}
    avance_sum = 0.0
    anios_meta = 0
    for anio in ANIOS_PDM:
        resumen = resumen_anio(producto, anio, aggs_by_anio)
        if resumen["meta_programada"] > 0:
            anios_meta += 1
            avance_sum += resumen["porcentaje_avance"]
    return round(avance_sum / anios_meta, 2) if anios_meta else 0.0


def producto_list_metrics(producto: PdmProducto, anio: int, aggs_by_anio: dict | None = None) -> dict:
    aggs_by_anio = aggs_by_anio or {}
    resumen = resumen_anio(producto, anio, aggs_by_anio)
    return {
        "avance_anio": resumen["porcentaje_avance"],
        "estado_anio": estado_producto_anio(producto, anio, aggs_by_anio),
        "meta_anio": resumen["meta_programada"],
        "presupuesto_anio": resumen["presupuesto"],
        "porcentaje_ejecucion": avance_general_producto(producto, aggs_by_anio),
    }
