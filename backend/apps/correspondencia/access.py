"""Control de acceso — módulo Correspondencia."""
from __future__ import annotations

from django.db.models import Q, QuerySet
from rest_framework.exceptions import PermissionDenied

from apps.common.modules import require_user_module
from apps.common.roles import is_platform_superadmin, user_roles
from apps.entities.models import Entity

from .models import Correspondencia


def _is_admin(user) -> bool:
    return "admin" in user_roles(user)


def _is_secretario(user) -> bool:
    return "secretario" in user_roles(user)


def ensure_correspondencia_access(user, entity: Entity) -> None:
    if is_platform_superadmin(user):
        raise PermissionDenied("El superadministrador no opera el módulo de correspondencia.")
    if not user.entity_id or user.entity_id != entity.id:
        raise PermissionDenied("No tiene permisos para gestionar esta entidad.")
    require_user_module(
        user,
        "correspondencia",
        message="El módulo Correspondencia no está habilitado.",
    )
    roles = user_roles(user)
    if not ({"admin", "secretario"} & roles):
        raise PermissionDenied("Solo administradores y secretarios pueden operar correspondencia.")


def correspondencia_queryset(user, entity: Entity) -> QuerySet[Correspondencia]:
    qs = (
        Correspondencia.objects.filter(entity=entity)
        .select_related("secretaria", "assigned_to", "created_by")
        .order_by("-fecha_radicacion", "-id")
    )
    if _is_admin(user):
        return qs
    if _is_secretario(user):
        if not user.secretaria_id:
            return qs.none()
        return qs.filter(Q(secretaria_id=user.secretaria_id) | Q(assigned_to_id=user.id))
    return qs.none()


def user_can_access_correspondencia(user, obj: Correspondencia) -> bool:
    if is_platform_superadmin(user):
        return False
    if not user.entity_id or obj.entity_id != user.entity_id:
        return False
    if _is_admin(user):
        return True
    if _is_secretario(user):
        return obj.secretaria_id == user.secretaria_id or obj.assigned_to_id == user.id
    return False
