"""Alcance de datos IA por rol (admin vs secretario)."""
from __future__ import annotations

from django.db.models import Q, QuerySet

from apps.common.roles import is_platform_superadmin, user_roles
from apps.entities.models import Entity
from apps.pdm.access import codigos_producto_for_user
from apps.pqrs.access import pqrs_queryset_for_user
from apps.pqrs.models import PQRS

from .models import AIAlert


def pqrs_queryset_for_ai_user(user) -> QuerySet[PQRS]:
    return pqrs_queryset_for_user(user, PQRS.objects.all())


def pdm_codigos_for_ai_user(user, entity: Entity) -> list[str] | None:
    """None = todos los productos (admin). Lista vacía = sin acceso."""
    if is_platform_superadmin(user):
        return None
    roles = user_roles(user)
    if "admin" in roles:
        return None
    if "secretario" in roles:
        return codigos_producto_for_user(user, entity)
    return []


def filter_alerts_for_user(user, qs: QuerySet[AIAlert]) -> QuerySet[AIAlert]:
    """Secretario: solo alertas de sus PQRS asignadas o productos PDM asignados."""
    if is_platform_superadmin(user):
        return qs.none()

    roles = user_roles(user)
    if "admin" in roles:
        return qs

    if "secretario" not in roles:
        return qs.none()

    pqrs_ids = list(pqrs_queryset_for_ai_user(user).values_list("id", flat=True))
    codigos: list[str] = []
    if user.entity_id and user.entity:
        codigos = pdm_codigos_for_ai_user(user, user.entity) or []

    pqrs_types = [AIAlert.AlertType.PQRS_SLA_RISK, AIAlert.AlertType.PQRS_DUPLICATE]
    pdm_types = [AIAlert.AlertType.PDM_ANOMALY, AIAlert.AlertType.PDM_FORECAST]

    q = Q()
    if pqrs_ids:
        q |= Q(alert_type__in=pqrs_types, object_id__in=pqrs_ids)
    if codigos:
        q |= Q(alert_type__in=pdm_types, metadata__codigo_producto__in=codigos)

    if not q:
        return qs.none()
    return qs.filter(q)
