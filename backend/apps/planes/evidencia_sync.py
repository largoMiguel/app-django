"""Sincroniza avance/estado de la actividad desde sus evidencias de ejecución."""
from __future__ import annotations

import re
from decimal import Decimal, InvalidOperation

from .models import ActividadEstado, PlanActividad, PlanEvidencia


def parse_meta_programada(value: str | None) -> Decimal | None:
    """Extrae un número de la meta programada (ej. '30', '30 unidades')."""
    if not value or not str(value).strip():
        return None
    text = str(value).strip().replace(",", ".")
    match = re.search(r"\d+(?:\.\d+)?", text)
    if not match:
        return None
    try:
        return Decimal(match.group())
    except InvalidOperation:
        return None


def total_ejecutado(actividad: PlanActividad) -> Decimal:
    total = Decimal("0")
    for ev in actividad.evidencias.all():
        total += Decimal(ev.cantidad_ejecutada or 0)
    return total


def compute_avance_pct(actividad: PlanActividad) -> int:
    meta = parse_meta_programada(actividad.meta)
    ejecutado = total_ejecutado(actividad)
    if meta is None or meta <= 0:
        if ejecutado > 0:
            return 100
        return 0
    pct = (ejecutado / meta) * Decimal("100")
    return int(min(Decimal("100"), pct).quantize(Decimal("1")))


def sync_actividad_from_evidencias(actividad: PlanActividad) -> None:
    avance = compute_avance_pct(actividad)
    if avance >= 100:
        estado = ActividadEstado.COMPLETADA
    elif avance > 0:
        estado = ActividadEstado.EN_PROGRESO
    else:
        estado = ActividadEstado.PENDIENTE
    actividad.avance = avance
    actividad.estado = estado
    actividad.save(update_fields=["avance", "estado", "updated_at"])


def reset_actividad_ejecucion(actividad: PlanActividad) -> None:
    actividad.avance = 0
    actividad.estado = ActividadEstado.PENDIENTE
    actividad.save(update_fields=["avance", "estado", "updated_at"])
