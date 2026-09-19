"""Estadísticas — PIC."""
from __future__ import annotations

from decimal import Decimal

from django.db.models import Count, Sum
from django.utils import timezone

from apps.entities.models import Entity

from .access import actividades_queryset_for_user
from .calculos import actividad_metrics, total_ejecutado
from .models import PicPlan, Trimestre
from .excel_import import encargados_pendientes_resumen
from .utils import user_display_name


def compute_pic_stats(user, entity: Entity, *, anio: int | None = None) -> dict:
    anio = anio or timezone.now().year
    plan = PicPlan.objects.filter(entity=entity, anio=anio).first()
    act_qs = actividades_queryset_for_user(user, entity).filter(plan__anio=anio)

    valor_total_pic = act_qs.aggregate(t=Sum("valor_total"))["t"] or Decimal("0")
    total_programado = act_qs.aggregate(t=Sum("total_programado"))["t"] or 0

    total_ejecutado_sum = 0
    valor_cobrado_total = Decimal("0")
    for act in act_qs:
        m = actividad_metrics(act)
        total_ejecutado_sum += m["total_ejecutado"]
        valor_cobrado_total += m["valor_cobrado_total"]

    avance_pct = round(100.0 * total_ejecutado_sum / total_programado, 1) if total_programado else 0.0

    por_trimestre = []
    for tri in Trimestre.values:
        prog_field = f"prog_t{tri}"
        programado = act_qs.aggregate(t=Sum(prog_field))["t"] or 0
        ejecutado = 0
        for act in act_qs:
            for item in actividad_metrics(act)["resumen_trimestral"]:
                if item["trimestre"] == tri:
                    ejecutado += item["ejecutado_trimestre"]
        por_trimestre.append(
            {
                "trimestre": tri,
                "trimestre_label": Trimestre(tri).label,
                "programado": programado,
                "ejecutado": ejecutado,
            }
        )

    por_responsable: dict[int, dict] = {}
    for act in act_qs.prefetch_related("responsables"):
        ej = total_ejecutado(act)
        m = actividad_metrics(act)
        for u in act.responsables.all():
            entry = por_responsable.setdefault(
                u.id,
                {
                    "usuario_id": u.id,
                    "nombre": user_display_name(u),
                    "actividades": 0,
                    "total_ejecutado": 0,
                    "valor_cobrado": Decimal("0"),
                },
            )
            entry["actividades"] += 1
            entry["total_ejecutado"] += ej
            entry["valor_cobrado"] += m["valor_cobrado_total"]

    sin_responsables = act_qs.annotate(rc=Count("responsables")).filter(rc=0).count()
    encargados_pendientes = encargados_pendientes_resumen(entity, plan)

    por_responsable_out = [
        {
            **entry,
            "valor_cobrado": str(entry["valor_cobrado"]),
        }
        for entry in por_responsable.values()
    ]

    return {
        "anio": anio,
        "plan_id": plan.id if plan else None,
        "tiene_plan": plan is not None,
        "actividades_total": act_qs.count(),
        "valor_total_pic": str(valor_total_pic),
        "valor_cobrado_total": str(valor_cobrado_total),
        "total_programado": total_programado,
        "total_ejecutado": total_ejecutado_sum,
        "avance_pct": avance_pct,
        "por_trimestre": por_trimestre,
        "por_responsable": por_responsable_out,
        "sin_responsables": sin_responsables,
        "encargados_pendientes": encargados_pendientes,
    }
