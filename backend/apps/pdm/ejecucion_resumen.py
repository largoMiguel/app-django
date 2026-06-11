"""Agregaciones de ejecución presupuestal PDM (dashboard y analítica)."""
from __future__ import annotations

from django.db.models import Sum

from .access import ejecucion_queryset_for_user, productos_queryset_for_user
from .metrics import ANIOS_PDM
from .models import PDMEjecucionPresupuestal
from apps.entities.models import Entity


def _float(value) -> float:
    return float(value or 0)


def _agrupar_por_anio(qs) -> dict[int, dict[str, float]]:
    grouped = {
        int(row["anio"]): {
            "pto_definitivo": _float(row["pto_definitivo"]),
            "pagos": _float(row["pagos"]),
        }
        for row in qs.filter(anio__isnull=False)
        .values("anio")
        .annotate(pto_definitivo=Sum("pto_definitivo"), pagos=Sum("pagos"))
    }
    return grouped


def resumen_ejecucion_por_anio(
    qs,
    *,
    anios: tuple[int, ...] = ANIOS_PDM,
) -> tuple[list[dict], dict[str, float]]:
    """Resume pto. definitivo y pagos por año a partir de un queryset de ejecución."""
    grouped = _agrupar_por_anio(qs)
    anios_payload = [
        {
            "anio": y,
            "pto_definitivo": grouped.get(y, {}).get("pto_definitivo", 0.0),
            "pagos": grouped.get(y, {}).get("pagos", 0.0),
        }
        for y in anios
    ]
    totales = {
        "pto_definitivo": sum(item["pto_definitivo"] for item in anios_payload),
        "pagos": sum(item["pagos"] for item in anios_payload),
    }
    return anios_payload, totales


def codigos_producto_en_plan(user, entity: Entity) -> set[str]:
    """Códigos canónicos de productos del plan visibles para el usuario."""
    return {
        str(codigo).strip()
        for codigo in productos_queryset_for_user(user, entity).values_list("codigo_producto", flat=True)
        if str(codigo).strip()
    }


def resumen_ejecucion_entidad(user, entity: Entity) -> dict:
    """
    Resumen anual de ejecución para el dashboard.

    Los totales principales (`anios`, `totales`) incluyen solo productos del plan.
    La ejecución huérfana se expone aparte vía `ejecucion_sin_producto_plan`.
    """
    from .access import (
        ejecucion_agrupada_por_campo_producto,
        ejecucion_sin_producto_en_plan,
    )

    qs = ejecucion_queryset_for_user(user, entity)
    codigos_plan = codigos_producto_en_plan(user, entity)
    qs_en_plan = qs.filter(codigo_producto__in=codigos_plan) if codigos_plan else qs.none()

    anios, totales = resumen_ejecucion_por_anio(qs_en_plan)
    anios_todos, totales_todos = resumen_ejecucion_por_anio(qs)

    return {
        "anios": anios,
        "totales": totales,
        "totales_incluye_huerfanos": totales_todos,
        "anios_incluye_huerfanos": anios_todos,
        "ejecucion_por_linea": ejecucion_agrupada_por_campo_producto(
            user, entity, "linea_estrategica", "Sin línea", "linea"
        ),
        "ejecucion_por_sector": ejecucion_agrupada_por_campo_producto(
            user, entity, "sector_mga", "Sin sector", "sector"
        ),
        "ejecucion_sin_producto_plan": ejecucion_sin_producto_en_plan(user, entity),
    }


def ejecucion_por_codigo(
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
            "pto_definitivo": _float(row["pto_definitivo"]),
            "pagos": _float(row["pagos"]),
        }
        for row in rows
    }


def ejecucion_por_anio(entity_id: int, codigos: list[str]) -> dict[int, dict[str, float]]:
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
    return {
        int(row["anio"]): {
            "pto_definitivo": _float(row["pto_definitivo"]),
            "pagos": _float(row["pagos"]),
        }
        for row in rows
    }


def totales_ejecucion_codigos(
    ejecucion_map: dict[str, dict[str, float]],
    codigos: list[str],
) -> dict[str, float]:
    pto = 0.0
    pagos = 0.0
    for codigo in codigos:
        data = ejecucion_map.get(codigo, {})
        pto += data.get("pto_definitivo", 0.0)
        pagos += data.get("pagos", 0.0)
    return {"pto_definitivo": pto, "pagos": pagos}


def ejecucion_totales_anio_plan(entity_id: int, codigos: list[str], anio: int) -> dict[str, float]:
    """Totales de ejecución del año para los productos del plan indicados."""
    ejecucion_map = ejecucion_por_codigo(entity_id, codigos, anio)
    totales = totales_ejecucion_codigos(ejecucion_map, codigos)
    pto = totales["pto_definitivo"]
    pagos = totales["pagos"]
    return {
        **totales,
        "pct_pagado": round((pagos / pto) * 100, 1) if pto else 0.0,
    }


def normalizar_anio_pdm(anio: int | None) -> int:
    """Restringe el año de seguimiento al cuatrienio PDM."""
    from datetime import datetime

    if anio is None:
        anio = datetime.now().year
    if anio in ANIOS_PDM:
        return anio
    return ANIOS_PDM[-1]
