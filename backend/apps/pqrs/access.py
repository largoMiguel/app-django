"""Control de acceso a PQRS y archivos media."""
from __future__ import annotations

import re

from django.db.models import Q

from apps.common.roles import is_platform_superadmin, user_roles

from .models import PQRS


def user_can_access_pqrs(user, pqrs: PQRS) -> bool:
    roles = user_roles(user)
    if is_platform_superadmin(user):
        return False
    if not user.entity_id or pqrs.entity_id != user.entity_id:
        return False
    if "admin" in roles:
        return True
    if "secretario" in roles:
        return bool(user.secretaria_id and pqrs.assigned_to_id == user.secretaria_id)
    if "ciudadano" in roles:
        return pqrs.created_by_id == user.id
    return False


def ciudadano_pqrs_filter(user) -> Q:
    return Q(created_by_id=user.id)


def pqrs_queryset_for_user(user, qs):
    """Filtra queryset según roles del usuario (admite multi-rol con unión)."""
    if is_platform_superadmin(user):
        return qs.none()

    roles = user_roles(user)
    if not user.entity_id:
        return qs.none()

    entity_qs = qs.filter(entity_id=user.entity_id)

    if "admin" in roles:
        return entity_qs

    combined: Q | None = None
    if "secretario" in roles and user.secretaria_id:
        combined = Q(assigned_to_id=user.secretaria_id)
    if "ciudadano" in roles:
        citizen_q = ciudadano_pqrs_filter(user)
        combined = citizen_q if combined is None else (combined | citizen_q)

    return entity_qs.filter(combined) if combined is not None else qs.none()


def user_can_access_media_path(user, path: str) -> bool:
    """Valida acceso a un archivo bajo MEDIA_ROOT."""
    path = path.lstrip("/")
    if ".." in path or path.startswith("/"):
        return False

    entity_match = re.match(
        r"^entities/(?P<entity_id>\d+)/pqrs/(?P<pqrs_id>\d+)/",
        path,
    )
    if entity_match:
        pqrs = PQRS.objects.filter(
            pk=int(entity_match.group("pqrs_id")),
            entity_id=int(entity_match.group("entity_id")),
        ).first()
        return pqrs is not None and user_can_access_pqrs(user, pqrs)

    resp_match = re.match(r"^pqrs/respuestas/(?P<pqrs_id>\d+)_", path)
    if resp_match:
        pqrs = PQRS.objects.filter(pk=int(resp_match.group("pqrs_id"))).first()
        return pqrs is not None and user_can_access_pqrs(user, pqrs)

    return False
