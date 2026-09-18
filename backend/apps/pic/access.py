"""Control de acceso y queryset base por entidad/rol — PIC."""
from __future__ import annotations

from django.db.models import Q, QuerySet
from rest_framework.exceptions import PermissionDenied

from apps.common.modules import require_user_module
from apps.common.roles import is_platform_superadmin, user_roles
from apps.entities.models import Entity

from .models import PicActividad, PicPlan


def _is_admin(user) -> bool:
    return "admin" in user_roles(user)


def _is_secretario(user) -> bool:
    return "secretario" in user_roles(user)


def _is_contratista(user) -> bool:
    return "contratista" in user_roles(user)


def ensure_pic_access(user, entity: Entity) -> None:
    if is_platform_superadmin(user):
        raise PermissionDenied("El superadministrador no opera el módulo PIC.")
    if not user.entity_id or user.entity_id != entity.id:
        raise PermissionDenied("No tiene permisos para gestionar esta entidad.")
    require_user_module(user, "pic", message="El módulo PIC no está habilitado.")
    roles = user_roles(user)
    if not ({"admin", "secretario", "contratista"} & roles):
        raise PermissionDenied("Solo administradores, secretarios y contratistas pueden operar PIC.")


def actividades_queryset_for_user(user, entity: Entity) -> QuerySet[PicActividad]:
    qs = (
        PicActividad.objects.filter(entity=entity)
        .select_related("plan", "responsable_secretaria")
        .prefetch_related("responsables", "ejecuciones", "ejecuciones__archivos")
    )
    if _is_admin(user):
        return qs
    if _is_secretario(user):
        if not user.secretaria_id:
            return qs.none()
        return qs.filter(
            Q(responsable_secretaria_id=user.secretaria_id)
            | Q(responsables__secretaria_id=user.secretaria_id)
        ).distinct()
    if _is_contratista(user):
        return qs.filter(responsables=user).distinct()
    return qs.none()


def user_can_access_actividad(user, entity: Entity, actividad: PicActividad) -> bool:
    if actividad.entity_id != entity.id:
        return False
    return actividades_queryset_for_user(user, entity).filter(pk=actividad.pk).exists()


def plan_queryset_for_user(user, entity: Entity) -> QuerySet[PicPlan]:
    if _is_admin(user):
        return PicPlan.objects.filter(entity=entity)
    act_plan_ids = actividades_queryset_for_user(user, entity).values_list("plan_id", flat=True).distinct()
    return PicPlan.objects.filter(entity=entity, id__in=act_plan_ids)
