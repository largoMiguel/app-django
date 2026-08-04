"""Estadísticas y cronograma — Planes Institucionales."""
from __future__ import annotations

from collections import defaultdict
from datetime import date

from django.db.models import Avg, Count, Q
from django.utils import timezone

from apps.entities.models import Entity

from .access import actividades_queryset_for_user, planes_queryset_for_user
from .models import ActividadEstado, PlanActividad, PlanInstitucional, Trimestre


def _default_anio() -> int:
    return timezone.now().year


def compute_plan_stats(user, entity: Entity, *, anio: int | None = None) -> dict:
    anio = anio or _default_anio()
    planes_qs = planes_queryset_for_user(user, entity).filter(anio=anio)
    act_qs = actividades_queryset_for_user(user, entity).filter(anio=anio)

    por_estado_plan = dict(
        planes_qs.values("estado").annotate(c=Count("id")).values_list("estado", "c")
    )
    por_estado_act = dict(
        act_qs.values("estado").annotate(c=Count("id")).values_list("estado", "c")
    )

    por_trimestre: dict[int, dict] = {}
    for tri in Trimestre.values:
        sub = act_qs.filter(trimestre=tri)
        por_trimestre[tri] = {
            "trimestre": tri,
            "trimestre_label": Trimestre(tri).label,
            "total": sub.count(),
            "completadas": sub.filter(estado=ActividadEstado.COMPLETADA).count(),
            "avance_promedio": round(float(sub.aggregate(a=Avg("avance"))["a"] or 0), 1),
        }

    hoy = timezone.localdate()
    vencidas = act_qs.filter(
        fecha_fin__lt=hoy,
        estado__in=[ActividadEstado.PENDIENTE, ActividadEstado.EN_PROGRESO],
    ).count()

    sin_responsable = planes_qs.filter(responsable_secretaria__isnull=True).count()

    return {
        "anio": anio,
        "planes_total": planes_qs.count(),
        "planes_por_estado": por_estado_plan,
        "actividades_total": act_qs.count(),
        "actividades_por_estado": por_estado_act,
        "por_trimestre": list(por_trimestre.values()),
        "actividades_vencidas": vencidas,
        "planes_sin_responsable": sin_responsable,
        "avance_promedio": round(float(act_qs.aggregate(a=Avg("avance"))["a"] or 0), 1),
    }


def attach_plan_list_metrics(queryset, user, entity: Entity, *, trimestre: int | None = None):
    plan_ids = list(queryset.values_list("id", flat=True))
    if not plan_ids:
        return queryset

    act_filter = Q(plan_id__in=plan_ids)
    if trimestre:
        act_filter &= Q(trimestre=trimestre)

    act_qs = actividades_queryset_for_user(user, entity).filter(act_filter)
    counts = dict(act_qs.values("plan_id").annotate(c=Count("id")).values_list("plan_id", "c"))
    avances = dict(act_qs.values("plan_id").annotate(a=Avg("avance")).values_list("plan_id", "a"))

    for plan in queryset:
        plan.actividades_count = counts.get(plan.id, 0)
        plan.avance_promedio = round(float(avances.get(plan.id) or 0), 1)
    return queryset


def build_resumen_por_trimestre(plan: PlanInstitucional, actividades) -> list[dict]:
    grouped: dict[int, list] = defaultdict(list)
    for act in actividades:
        grouped[act.trimestre].append(act)

    resumen = []
    for tri in Trimestre.values:
        items = grouped.get(tri, [])
        avance = 0.0
        if items:
            avance = sum(a.avance for a in items) / len(items)
        resumen.append(
            {
                "trimestre": tri,
                "trimestre_label": Trimestre(tri).label,
                "total": len(items),
                "completadas": sum(1 for a in items if a.estado == ActividadEstado.COMPLETADA),
                "avance_promedio": round(avance, 1),
            }
        )
    return resumen


def build_cronograma(user, entity: Entity, *, anio: int | None = None) -> list[dict]:
    anio = anio or _default_anio()
    act_qs = (
        actividades_queryset_for_user(user, entity)
        .filter(anio=anio)
        .select_related("plan", "plan__catalogo")
        .order_by("plan__catalogo__orden", "plan_id", "trimestre", "fecha_inicio", "id")
    )

    by_plan: dict[int, dict] = {}
    for act in act_qs:
        bucket = by_plan.setdefault(
            act.plan_id,
            {
                "plan_id": act.plan_id,
                "plan_nombre": act.plan.nombre,
                "catalogo_codigo": act.plan.catalogo.codigo,
                "catalogo_nombre": act.plan.catalogo.nombre,
                "actividades": [],
            },
        )
        bucket["actividades"].append(
            {
                "id": act.id,
                "nombre": act.nombre,
                "trimestre": act.trimestre,
                "trimestre_label": Trimestre(act.trimestre).label if act.trimestre in Trimestre.values else str(act.trimestre),
                "fecha_inicio": act.fecha_inicio.isoformat() if act.fecha_inicio else None,
                "fecha_fin": act.fecha_fin.isoformat() if act.fecha_fin else None,
                "estado": act.estado,
                "avance": act.avance,
                "responsable_secretaria_nombre": act.responsable_secretaria.nombre if act.responsable_secretaria_id else None,
            }
        )

    return list(by_plan.values())
