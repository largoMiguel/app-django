"""Control de acceso — módulo Gestión documental."""
from __future__ import annotations

from django.db.models import Q, QuerySet
from rest_framework.exceptions import PermissionDenied

from apps.common.modules import require_user_module
from apps.common.roles import is_platform_superadmin, user_roles
from apps.entities.models import Entity

from .models import Expediente, InstrumentoArchivistico, SerieDocumental


def _is_admin(user) -> bool:
    return "admin" in user_roles(user)


def _is_secretario(user) -> bool:
    return "secretario" in user_roles(user)


def _is_contratista(user) -> bool:
    return "contratista" in user_roles(user)


def ensure_gd_access(user, entity: Entity) -> None:
    if is_platform_superadmin(user):
        raise PermissionDenied("El superadministrador no opera el módulo de Gestión documental.")
    if not user.entity_id or user.entity_id != entity.id:
        raise PermissionDenied("No tiene permisos para gestionar esta entidad.")
    require_user_module(
        user,
        "gestion_documental",
        message="El módulo Gestión documental no está habilitado.",
    )
    roles = user_roles(user)
    if not ({"admin", "secretario", "contratista"} & roles):
        raise PermissionDenied("Solo administradores, secretarios y contratistas pueden operar gestión documental.")


def expedientes_queryset(user, entity: Entity) -> QuerySet[Expediente]:
    qs = (
        Expediente.objects.filter(entity=entity)
        .select_related("serie", "unidad", "secretaria", "responsable", "created_by")
        .order_by("-updated_at", "-id")
    )
    if _is_admin(user):
        return qs
    if _is_secretario(user):
        if not user.secretaria_id:
            return qs.none()
        return qs.filter(Q(secretaria_id=user.secretaria_id) | Q(responsable_id=user.id))
    if _is_contratista(user):
        return qs.filter(responsable_id=user.id)
    return qs.none()


def user_can_access_expediente(user, obj: Expediente) -> bool:
    if is_platform_superadmin(user):
        return False
    if not user.entity_id or obj.entity_id != user.entity_id:
        return False
    if _is_admin(user):
        return True
    if _is_secretario(user):
        return obj.secretaria_id == user.secretaria_id or obj.responsable_id == user.id
    if _is_contratista(user):
        return obj.responsable_id == user.id
    return False


def series_queryset(user, entity: Entity) -> QuerySet[SerieDocumental]:
    qs = SerieDocumental.objects.filter(entity=entity).select_related("unidad", "parent", "instrumento")
    if _is_admin(user):
        return qs
    if _is_secretario(user) and user.secretaria_id:
        return qs.filter(Q(unidad__secretaria_id=user.secretaria_id) | Q(unidad__isnull=True))
    if _is_contratista(user):
        return qs.none()
    return qs.none()


def instrumentos_queryset(user, entity: Entity) -> QuerySet[InstrumentoArchivistico]:
    if not _is_admin(user) and not _is_secretario(user):
        return InstrumentoArchivistico.objects.none()
    return InstrumentoArchivistico.objects.filter(entity=entity).select_related("created_by")
