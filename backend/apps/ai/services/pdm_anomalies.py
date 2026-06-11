"""Detección de anomalías en PDM."""
from __future__ import annotations

from typing import Any

from apps.pdm.metrics import (
    ANIOS_PDM,
    actividad_aggs_for_productos,
    estado_producto_anio,
    resumen_anio,
)
from apps.pdm.models import PdmActividad, PdmProducto, PDMEjecucionPresupuestal


def _avance_fisico(producto: PdmProducto, anio: int, aggs_by_anio: dict) -> float:
    return float(resumen_anio(producto, anio, aggs_by_anio).get("porcentaje_avance", 0))


def detect_pdm_anomalies(
    entity_id: int,
    anio: int | None = None,
    *,
    codigos: list[str] | None = None,
) -> list[dict[str, Any]]:
    """Detecta anomalías en productos PDM (opcional: solo códigos dados)."""
    if anio is None:
        from datetime import datetime
        anio = datetime.now().year
        if anio not in ANIOS_PDM:
            anio = ANIOS_PDM[-1]

    productos_qs = PdmProducto.objects.filter(entity_id=entity_id).select_related("responsable_secretaria")
    if codigos is not None:
        if not codigos:
            return []
        productos_qs = productos_qs.filter(codigo_producto__in=codigos)
    productos = list(productos_qs)
    codigos = [p.codigo_producto for p in productos]
    all_aggs = actividad_aggs_for_productos(entity_id, codigos)
    anomalies: list[dict[str, Any]] = []

    plan_codes = set(codigos)
    orphan_codes = (
        PDMEjecucionPresupuestal.objects.filter(entity_id=entity_id, anio=anio)
        .exclude(codigo_producto__in=plan_codes)
        .values_list("codigo_producto", flat=True)
        .distinct()
    )
    for code in orphan_codes[:20]:
        anomalies.append({
            "type": "orphan_execution",
            "severity": "medium",
            "codigo_producto": code,
            "title": f"Ejecución sin producto en plan: {code}",
            "message": f"El código {code} tiene ejecución presupuestal en {anio} pero no existe en el Plan Indicativo.",
            "score": 60,
        })

    for producto in productos:
        meta_programada = getattr(producto, f"programacion_{anio}", 0) or 0
        if meta_programada <= 0:
            continue

        aggs_by_anio = all_aggs.get(producto.codigo_producto, {})
        avance_fisico = _avance_fisico(producto, anio, aggs_by_anio)
        estado = estado_producto_anio(producto, anio, aggs_by_anio)

        ejecucion = PDMEjecucionPresupuestal.objects.filter(
            entity_id=entity_id,
            codigo_producto=producto.codigo_producto,
            anio=anio,
        )
        total_pagos = sum(e.pagos or 0 for e in ejecucion)
        total_definitivo = sum(e.pto_definitivo or 0 for e in ejecucion)
        avance_financiero = (total_pagos / total_definitivo * 100) if total_definitivo > 0 else 0

        if avance_fisico > 0 and avance_financiero > 0:
            diff = abs(avance_fisico - avance_financiero)
            if diff > 40:
                anomalies.append({
                    "type": "physical_financial_divergence",
                    "severity": "high",
                    "codigo_producto": producto.codigo_producto,
                    "producto_mga": producto.producto_mga,
                    "title": f"Divergencia físico/financiero: {producto.codigo_producto}",
                    "message": (
                        f"Avance físico {avance_fisico:.0f}% vs financiero {avance_financiero:.0f}% "
                        f"(diferencia {diff:.0f} puntos)."
                    ),
                    "score": min(100, diff),
                    "metadata": {
                        "avance_fisico": avance_fisico,
                        "avance_financiero": avance_financiero,
                    },
                })

        actividades_count = PdmActividad.objects.filter(
            codigo_producto=producto.codigo_producto,
            anio=anio,
        ).count()
        if meta_programada > 0 and actividades_count == 0 and estado != "COMPLETADO":
            anomalies.append({
                "type": "no_activities",
                "severity": "medium",
                "codigo_producto": producto.codigo_producto,
                "producto_mga": producto.producto_mga,
                "title": f"Meta sin actividades: {producto.codigo_producto}",
                "message": f"Producto con meta programada {meta_programada} en {anio} pero sin actividades registradas.",
                "score": 50,
            })

        if total_pagos > 0 and avance_fisico < 10:
            anomalies.append({
                "type": "execution_no_progress",
                "severity": "high",
                "codigo_producto": producto.codigo_producto,
                "producto_mga": producto.producto_mga,
                "title": f"Pagos sin avance físico: {producto.codigo_producto}",
                "message": f"Pagos de ${total_pagos:,.0f} pero avance físico solo {avance_fisico:.0f}%.",
                "score": 70,
            })

    anomalies.sort(key=lambda x: x.get("score", 0), reverse=True)
    return anomalies


def forecast_pdm_completion(entity_id: int, anio: int | None = None) -> list[dict[str, Any]]:
    """Pronóstico simple de cumplimiento a fin de año."""
    from datetime import datetime

    if anio is None:
        anio = datetime.now().year
        if anio not in ANIOS_PDM:
            anio = ANIOS_PDM[-1]

    now = datetime.now()
    months_elapsed = max(1, now.month)
    months_remaining = max(1, 12 - now.month + 1)

    productos = list(PdmProducto.objects.filter(entity_id=entity_id))
    codigos = [p.codigo_producto for p in productos]
    all_aggs = actividad_aggs_for_productos(entity_id, codigos)
    forecasts: list[dict[str, Any]] = []

    for producto in productos:
        meta = getattr(producto, f"programacion_{anio}", 0) or 0
        if meta <= 0:
            continue

        aggs_by_anio = all_aggs.get(producto.codigo_producto, {})
        avance = _avance_fisico(producto, anio, aggs_by_anio)
        pace = avance / months_elapsed
        projected = min(100, pace * 12)
        at_risk = projected < 80 and avance < 50

        if at_risk or avance < 30:
            forecasts.append({
                "codigo_producto": producto.codigo_producto,
                "producto_mga": producto.producto_mga,
                "avance_actual": round(avance, 1),
                "projected_year_end": round(projected, 1),
                "at_risk": at_risk,
                "months_remaining": months_remaining,
                "responsable": producto.responsable_secretaria_nombre or "",
            })

    forecasts.sort(key=lambda x: x["avance_actual"])
    return forecasts
