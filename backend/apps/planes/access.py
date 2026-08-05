"""Control de acceso y queryset base por entidad/rol — Planes Institucionales."""
from __future__ import annotations

import re

from django.db.models import Q, QuerySet
from rest_framework.exceptions import PermissionDenied

from apps.common.media_paths import is_safe_media_relative_path
from apps.common.modules import require_user_module
from apps.common.roles import is_platform_superadmin, user_roles
from apps.entities.models import Entity

from .models import PlanActividad, PlanInstitucional


def _is_admin(user) -> bool:
    return "admin" in user_roles(user)


def _is_secretario(user) -> bool:
    return "secretario" in user_roles(user)


def _is_contratista(user) -> bool:
    return "contratista" in user_roles(user)


def ensure_planes_access(user, entity: Entity) -> None:
    if is_platform_superadmin(user):
        raise PermissionDenied("El superadministrador no opera el módulo de Planes Institucionales.")
    if not user.entity_id or user.entity_id != entity.id:
        raise PermissionDenied("No tiene permisos para gestionar esta entidad.")
    require_user_module(
        user,
        "planes_institucionales",
        message="El módulo Planes Institucionales no está habilitado.",
    )
    roles = user_roles(user)
    if not ({"admin", "secretario", "contratista"} & roles):
        raise PermissionDenied("Solo administradores, secretarios y contratistas pueden operar planes.")


def planes_queryset_for_user(user, entity: Entity) -> QuerySet[PlanInstitucional]:
    qs = PlanInstitucional.objects.filter(entity=entity).select_related(
        "catalogo", "responsable_secretaria", "responsable_usuario"
    )
    if _is_admin(user):
        return qs
    if _is_secretario(user):
        if not user.secretaria_id:
            return qs.none()
        return qs.filter(responsable_secretaria_id=user.secretaria_id)
    if _is_contratista(user):
        plan_ids = (
            PlanActividad.objects.filter(entity=entity, responsable_usuario_id=user.id)
            .values_list("plan_id", flat=True)
            .distinct()
        )
        return qs.filter(Q(responsable_usuario_id=user.id) | Q(id__in=plan_ids))
    return qs.none()


def actividades_queryset_for_user(user, entity: Entity) -> QuerySet[PlanActividad]:
    qs = (
        PlanActividad.objects.filter(entity=entity)
        .select_related("plan", "plan__catalogo", "responsable_secretaria", "responsable_usuario")
        .prefetch_related("evidencias", "evidencias__archivos")
    )
    if _is_admin(user):
        return qs
    if _is_secretario(user):
        if not user.secretaria_id:
            return qs.none()
        plan_ids = planes_queryset_for_user(user, entity).values_list("id", flat=True)
        return qs.filter(
            Q(plan_id__in=plan_ids)
            | Q(responsable_secretaria_id=user.secretaria_id)
        )
    if _is_contratista(user):
        return qs.filter(responsable_usuario_id=user.id)
    return qs.none()


def user_can_access_plan(user, entity: Entity, plan: PlanInstitucional) -> bool:
    if plan.entity_id != entity.id:
        return False
    return planes_queryset_for_user(user, entity).filter(pk=plan.pk).exists()


def user_can_access_actividad(user, entity: Entity, actividad: PlanActividad) -> bool:
    if actividad.entity_id != entity.id:
        return False
    return actividades_queryset_for_user(user, entity).filter(pk=actividad.pk).exists()


def user_can_access_planes_media_path(user, path: str) -> bool:
    path = path.lstrip("/")
    if not is_safe_media_relative_path(path):
        return False

    from .models import PlanEvidenciaArchivo

    arch = (
        PlanEvidenciaArchivo.objects.filter(archivo=path)
        .select_related("evidencia__actividad__plan", "evidencia__entity")
        .first()
    )
    if arch is None:
        legacy = re.match(
            r"^entities/(?P<entity_id>\d+)/planes/evidencias/",
            path,
        )
        if legacy and user.entity_id == int(legacy.group("entity_id")):
            return user_has_planes_module(user)
        return False

    entity = arch.evidencia.entity
    if not user.entity_id or user.entity_id != entity.id:
        return False
    return user_can_access_actividad(user, entity, arch.evidencia.actividad)


def user_has_planes_module(user) -> bool:
    from apps.common.modules import user_has_module

    return user_has_module(user, "planes_institucionales")
