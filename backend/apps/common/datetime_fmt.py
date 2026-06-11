"""Formateo de fechas en hora de Colombia."""
from __future__ import annotations

from datetime import datetime

from django.utils import timezone


def localtime_co(dt: datetime | None) -> datetime | None:
    if not dt:
        return None
    if timezone.is_naive(dt):
        dt = timezone.make_aware(dt, timezone.get_current_timezone())
    return timezone.localtime(dt)


def format_fecha_co(dt: datetime | None, *, fallback: str = "—") -> str:
    local = localtime_co(dt)
    if not local:
        return fallback
    return local.strftime("%d/%m/%Y")


def format_fecha_hora_co(dt: datetime | None, *, fallback: str = "—") -> str:
    local = localtime_co(dt)
    if not local:
        return fallback
    return local.strftime("%d/%m/%Y %H:%M")


def format_now_fecha_hora_co() -> str:
    return timezone.localtime(timezone.now()).strftime("%d/%m/%Y %H:%M")
