"""Agregados de PQRS para dashboard e informes."""
from __future__ import annotations

from datetime import timedelta

from django.db.models import Count, Q
from django.db.models.functions import ExtractMonth
from django.utils import timezone

from apps.common.roles import user_roles

from .models import EstadoPQRS


def compute_pqrs_stats(queryset, user) -> dict:
    """Calcula estadísticas sobre un queryset ya filtrado por acceso."""
    roles = user_roles(user)
    now = timezone.now()
    month = now.month
    alert_limit = now + timedelta(days=5)
    closed_states = (EstadoPQRS.RESPONDIDA, EstadoPQRS.CERRADA)

    by_estado = {
        row["estado"] or "": row["total"]
        for row in queryset.values("estado").annotate(total=Count("id"))
    }
    by_tipo = {
        row["tipo_solicitud"] or "otro": row["total"]
        for row in queryset.values("tipo_solicitud").annotate(total=Count("id"))
    }
    by_canal = {
        row["canal_llegada"] or "otro": row["total"]
        for row in queryset.values("canal_llegada").annotate(total=Count("id"))
    }

    timeline = {i: {"recibidas": 0, "resueltas": 0} for i in range(12)}
    for row in queryset.annotate(month=ExtractMonth("fecha_solicitud")).values("month").annotate(
        recibidas=Count("id"),
        resueltas=Count("id", filter=Q(estado__in=closed_states)),
    ):
        month_index = (row["month"] or 1) - 1
        if 0 <= month_index < 12:
            timeline[month_index]["recibidas"] = row["recibidas"]
            timeline[month_index]["resueltas"] = row["resueltas"]

    this_month = queryset.filter(fecha_solicitud__month=month).count()
    sin_asignar = queryset.filter(~Q(estado__in=closed_states), assigned_to__isnull=True).count()
    alerta_count = queryset.filter(
        ~Q(estado__in=closed_states),
        fecha_vencimiento__isnull=False,
        fecha_vencimiento__lte=alert_limit,
    ).count()

    by_secretaria = []
    if "admin" in roles:
        by_secretaria = list(
            queryset.filter(assigned_to__isnull=False)
            .values("assigned_to_id", "assigned_to__nombre")
            .annotate(
                total=Count("id"),
                respondidas=Count("id", filter=Q(estado=EstadoPQRS.RESPONDIDA)),
                cerradas=Count("id", filter=Q(estado=EstadoPQRS.CERRADA)),
                en_proceso=Count("id", filter=Q(estado=EstadoPQRS.EN_PROCESO)),
                pendientes=Count("id", filter=~Q(estado__in=closed_states)),
                vencidas=Count(
                    "id",
                    filter=~Q(estado__in=closed_states) & Q(fecha_vencimiento__lt=now),
                ),
            )
            .order_by("-total")
        )

    total = queryset.count()
    pendientes = queryset.filter(~Q(estado__in=closed_states)).count()

    return {
        "total": total,
        "this_month": this_month,
        "respondidas": by_estado.get(EstadoPQRS.RESPONDIDA, 0),
        "cerradas": by_estado.get(EstadoPQRS.CERRADA, 0),
        "pendientes": pendientes,
        "sin_asignar": sin_asignar,
        "alerta_count": alerta_count,
        "by_estado": by_estado,
        "by_tipo": by_tipo,
        "by_canal": by_canal,
        "timeline": [
            {"month": i, "mes": i, "recibidas": timeline[i]["recibidas"], "resueltas": timeline[i]["resueltas"]}
            for i in range(12)
        ],
        "by_secretaria": [
            {
                "secretaria_id": row["assigned_to_id"],
                "nombre": row["assigned_to__nombre"] or f"#{row['assigned_to_id']}",
                "total": row["total"],
                "respondidas": row["respondidas"],
                "cerradas": row["cerradas"],
                "en_proceso": row["en_proceso"],
                "pendientes": row["pendientes"],
                "vencidas": row["vencidas"],
            }
            for row in by_secretaria
        ],
    }
