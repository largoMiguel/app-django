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
    """Suma cantidad_ejecutada de evidencias.

    Consulta la BD directamente cuando la actividad ya existe, para evitar
    caché de prefetch vacía (p. ej. al crear la primera evidencia vía API).
    """
    if actividad.pk:
        total = Decimal("0")
        for cantidad in PlanEvidencia.objects.filter(actividad_id=actividad.pk).values_list(
            "cantidad_ejecutada", flat=True
        ):
            total += Decimal(cantidad or 0)
        return total

    total = Decimal("0")
    for ev in actividad.evidencias.all():
        total += Decimal(ev.cantidad_ejecutada or 0)
    return total


def ejecutado_restante(
    actividad: PlanActividad,
    *,
    exclude_evidencia_id: int | None = None,
) -> Decimal | None:
    """Unidades que aún se pueden registrar. None si la meta no es numérica."""
    meta = parse_meta_programada(actividad.meta)
    if meta is None or meta <= 0:
        return None
    ejecutado = total_ejecutado(actividad)
    if exclude_evidencia_id:
        cantidad = (
            PlanEvidencia.objects.filter(pk=exclude_evidencia_id, actividad_id=actividad.pk)
            .values_list("cantidad_ejecutada", flat=True)
            .first()
        )
        if cantidad is not None:
            ejecutado -= Decimal(cantidad or 0)
    restante = meta - ejecutado
    return max(Decimal("0"), restante)


def validate_cantidad_ejecutada(
    actividad: PlanActividad,
    cantidad: Decimal,
    *,
    exclude_evidencia_id: int | None = None,
) -> None:
    """Valida que la cantidad no supere la meta programada."""
    from rest_framework.exceptions import ValidationError

    if cantidad <= 0:
        raise ValidationError({"cantidad_ejecutada": "La cantidad ejecutada debe ser mayor a 0."})
    restante = ejecutado_restante(actividad, exclude_evidencia_id=exclude_evidencia_id)
    if restante is None:
        return
    if cantidad > restante:
        meta = parse_meta_programada(actividad.meta)
        ya = (meta or Decimal("0")) - restante
        raise ValidationError(
            {
                "cantidad_ejecutada": (
                    f"Solo puede registrar hasta {restante} unidades "
                    f"(meta {meta}, ya ejecutado {ya})."
                )
            }
        )


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
