"""Análisis de compliance y SLA para PQRS."""
from __future__ import annotations

from datetime import timedelta
from typing import Any

from django.db.models import Avg, Count, F, Q
from django.db.models.functions import ExtractYear, TruncMonth
from django.utils import timezone

from apps.pqrs.models import EstadoPQRS, PQRS


def compute_compliance_stats(
    entity_id: int,
    *,
    qs=None,
    fecha_desde=None,
    fecha_hasta=None,
) -> dict[str, Any]:
    """Calcula métricas de cumplimiento SLA y compliance."""
    if qs is None:
        qs = PQRS.objects.filter(entity_id=entity_id)
    if fecha_desde:
        qs = qs.filter(fecha_solicitud__gte=fecha_desde)
    if fecha_hasta:
        qs = qs.filter(fecha_solicitud__lte=fecha_hasta)

    total = qs.count()
    respondidas = qs.filter(estado__in=[EstadoPQRS.RESPONDIDA, EstadoPQRS.CERRADA])
    respondidas_count = respondidas.count()

    # Respondidas en término
    en_termo = respondidas.filter(
        fecha_respuesta__isnull=False,
        fecha_vencimiento__isnull=False,
        fecha_respuesta__lte=F("fecha_vencimiento"),
    ).count()

  # Vencidas abiertas
    abiertas = qs.exclude(estado__in=[EstadoPQRS.RESPONDIDA, EstadoPQRS.CERRADA])
    vencidas_abiertas = abiertas.filter(
        fecha_vencimiento__lt=timezone.now(),
    ).count()

    # Días promedio de respuesta
    avg_days = (
        respondidas.filter(fecha_respuesta__isnull=False)
        .annotate(
            dias=F("fecha_respuesta") - F("fecha_solicitud"),
        )
        .aggregate(avg=Avg("dias"))
    )
    avg_response_days = None
    if avg_days.get("avg"):
        avg_response_days = round(avg_days["avg"].total_seconds() / 86400, 1)

    # Aging del backlog (días desde solicitud)
    now = timezone.now()
    aging = {
        "0_7": abiertas.filter(fecha_solicitud__gte=now - timedelta(days=7)).count(),
        "8_15": abiertas.filter(
            fecha_solicitud__gte=now - timedelta(days=15),
            fecha_solicitud__lt=now - timedelta(days=7),
        ).count(),
        "16_30": abiertas.filter(
            fecha_solicitud__gte=now - timedelta(days=30),
            fecha_solicitud__lt=now - timedelta(days=15),
        ).count(),
        "30_plus": abiertas.filter(fecha_solicitud__lt=now - timedelta(days=30)).count(),
    }

    # Por tipo
    by_tipo = list(
        qs.values("tipo_solicitud")
        .annotate(
            total=Count("id"),
            respondidas=Count("id", filter=Q(estado__in=[EstadoPQRS.RESPONDIDA, EstadoPQRS.CERRADA])),
            vencidas=Count(
                "id",
                filter=Q(
                    fecha_vencimiento__lt=now,
                    estado__in=[EstadoPQRS.RECIBIDA, EstadoPQRS.ASIGNADA, EstadoPQRS.EN_PROCESO],
                ),
            ),
        )
        .order_by("-total")
    )

    # Timeline YoY (por mes del año actual vs anterior)
    current_year = now.year
    timeline = list(
        qs.filter(fecha_solicitud__year__in=[current_year, current_year - 1])
        .annotate(year=ExtractYear("fecha_solicitud"), month=TruncMonth("fecha_solicitud"))
        .values("year", "month")
        .annotate(
            recibidas=Count("id"),
            resueltas=Count("id", filter=Q(estado__in=[EstadoPQRS.RESPONDIDA, EstadoPQRS.CERRADA])),
        )
        .order_by("year", "month")
    )

    pct_en_termo = round(en_termo / respondidas_count * 100, 1) if respondidas_count else 0

    return {
        "total": total,
        "respondidas": respondidas_count,
        "pct_en_termo": pct_en_termo,
        "en_termo": en_termo,
        "vencidas_abiertas": vencidas_abiertas,
        "avg_response_days": avg_response_days,
        "aging": aging,
        "by_tipo": by_tipo,
        "timeline_yoy": timeline,
        "compliance_score": round(
            (pct_en_termo * 0.6) + (max(0, 100 - vencidas_abiertas * 5) * 0.4),
            1,
        ),
    }


def compute_sla_risk_scores(entity_id: int, qs=None) -> list[dict[str, Any]]:
    """Calcula score de riesgo SLA (0-100) para PQRS abiertas."""
    now = timezone.now()
    base = qs if qs is not None else PQRS.objects.filter(entity_id=entity_id)
    abiertas = base.exclude(
        estado__in=[EstadoPQRS.RESPONDIDA, EstadoPQRS.CERRADA],
    ).select_related("assigned_to")

    results: list[dict[str, Any]] = []
    for pqrs in abiertas:
        score = 0.0
        factors: list[str] = []

        if pqrs.fecha_vencimiento:
            dias_restantes = (pqrs.fecha_vencimiento - now).days
            if dias_restantes < 0:
                score += 50
                factors.append(f"Vencida hace {abs(dias_restantes)} días")
            elif dias_restantes == 0:
                score += 40
                factors.append("Vence hoy")
            elif dias_restantes <= 3:
                score += 30
                factors.append(f"Vence en {dias_restantes} días")
            elif dias_restantes <= 5:
                score += 20
                factors.append(f"Vence en {dias_restantes} días")

        dias_abierta = (now - pqrs.fecha_solicitud).days
        if dias_abierta > 30:
            score += 20
            factors.append(f"Abierta {dias_abierta} días")
        elif dias_abierta > 15:
            score += 10
            factors.append(f"Abierta {dias_abierta} días")

        if not pqrs.assigned_to_id:
            score += 15
            factors.append("Sin asignar")

        if pqrs.estado == EstadoPQRS.RECHAZADA_ASIGNACION:
            score += 25
            factors.append("Asignación rechazada")

        score = min(100, score)
        results.append({
            "pqrs_id": pqrs.id,
            "numero_radicado": pqrs.numero_radicado,
            "asunto": pqrs.asunto,
            "estado": pqrs.estado,
            "risk_score": round(score, 1),
            "factors": factors,
            "assigned_to_nombre": pqrs.assigned_to.nombre if pqrs.assigned_to else None,
        })

    results.sort(key=lambda x: x["risk_score"], reverse=True)
    return results
