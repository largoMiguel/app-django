"""Sincroniza avance/estado de la actividad desde su evidencia de ejecución."""
from __future__ import annotations

from .models import ActividadEstado, PlanActividad, PlanEvidencia


def sync_actividad_from_evidencia(actividad: PlanActividad, evidencia: PlanEvidencia | None) -> None:
    avance = evidencia.avance if evidencia else 0
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
