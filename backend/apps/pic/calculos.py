"""Cálculos de valor a cobrar y resumen trimestral — PIC."""
from __future__ import annotations

from decimal import ROUND_HALF_UP, Decimal

from django.db.models import Sum

from .models import PicActividad, Trimestre


def _round2(value: Decimal) -> Decimal:
    return value.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def calcular_valor_unitario(valor_total: Decimal, total_programado: int) -> Decimal:
    if total_programado <= 0:
        return Decimal("0")
    return _round2(Decimal(valor_total) / Decimal(total_programado))


def total_ejecutado(actividad: PicActividad) -> int:
    return int(
        actividad.ejecuciones.aggregate(total=Sum("cantidad_ejecutada"))["total"] or 0
    )


def disponible_ejecucion(actividad: PicActividad) -> int:
    return max(0, actividad.total_programado - total_ejecutado(actividad))


def valor_cobrado_acumulado(actividad: PicActividad, acum_cantidad: int) -> Decimal:
    if actividad.total_programado <= 0:
        return Decimal("0")
    return _round2(
        Decimal(actividad.valor_total) * Decimal(acum_cantidad) / Decimal(actividad.total_programado)
    )


def calcular_valor_cobrado(actividad: PicActividad, acum_previo: int, cantidad: int) -> Decimal:
    nuevo_acum = acum_previo + cantidad
    return valor_cobrado_acumulado(actividad, nuevo_acum) - valor_cobrado_acumulado(actividad, acum_previo)


def total_valor_cobrado(actividad: PicActividad) -> Decimal:
    return _round2(
        actividad.ejecuciones.aggregate(total=Sum("valor_cobrado"))["total"] or Decimal("0")
    )


def trimestre_from_date(fecha, anio: int) -> int:
    if fecha.year != anio:
        raise ValueError(f"La fecha de ejecución debe pertenecer al año {anio}.")
    mes = fecha.month
    if mes <= 3:
        return 1
    if mes <= 6:
        return 2
    if mes <= 9:
        return 3
    return 4


def resumen_trimestral(actividad: PicActividad) -> list[dict]:
    """Programación acumulada vs ejecutado acumulado por trimestre."""
    progs = [
        actividad.prog_t1,
        actividad.prog_t2,
        actividad.prog_t3,
        actividad.prog_t4,
    ]
    ejecutado_por_tri: dict[int, int] = {1: 0, 2: 0, 3: 0, 4: 0}
    for ej in actividad.ejecuciones.all():
        tri = ej.trimestre
        if tri in ejecutado_por_tri:
            ejecutado_por_tri[tri] += ej.cantidad_ejecutada

    resumen = []
    prog_acum = 0
    ejec_acum = 0
    for tri in Trimestre.values:
        prog_acum += progs[tri - 1]
        ejec_acum += ejecutado_por_tri.get(tri, 0)
        pendiente = max(0, prog_acum - ejec_acum)
        resumen.append(
            {
                "trimestre": tri,
                "trimestre_label": Trimestre(tri).label,
                "programado_trimestre": progs[tri - 1],
                "programado_acumulado": prog_acum,
                "ejecutado_trimestre": ejecutado_por_tri.get(tri, 0),
                "ejecutado_acumulado": ejec_acum,
                "pendiente_acumulado": pendiente,
            }
        )
    return resumen


def actividad_metrics(actividad: PicActividad) -> dict:
    ejecutado = total_ejecutado(actividad)
    disponible = max(0, actividad.total_programado - ejecutado)
    cobrado = total_valor_cobrado(actividad)
    pct = round(100.0 * ejecutado / actividad.total_programado, 1) if actividad.total_programado else 0.0
    return {
        "total_ejecutado": ejecutado,
        "disponible": disponible,
        "valor_cobrado_total": cobrado,
        "avance_pct": pct,
        "resumen_trimestral": resumen_trimestral(actividad),
    }