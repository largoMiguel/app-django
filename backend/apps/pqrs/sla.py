"""Filtros SLA compartidos para PQRS (Modo Alerta, stats, informes)."""
from __future__ import annotations

from datetime import timedelta

from django.db.models import Q
from django.utils import timezone

from .models import EstadoPQRS

CLOSED_STATES = (EstadoPQRS.RESPONDIDA, EstadoPQRS.CERRADA)
ALERTA_SLA_DAYS = 5


def pqrs_abiertas_q() -> Q:
    return ~Q(estado__in=CLOSED_STATES)


def pqrs_sla_alerta_q(*, days: int = ALERTA_SLA_DAYS) -> Q:
    """PQRS abiertas con vencimiento en ≤ `days` días (incluye ya vencidas)."""
    limite = timezone.now() + timedelta(days=days)
    return pqrs_abiertas_q() & Q(fecha_vencimiento__isnull=False, fecha_vencimiento__lte=limite)
