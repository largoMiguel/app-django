"""Control de acceso — módulo Asistencia."""
from __future__ import annotations

from django.db.models import Count, QuerySet
from rest_framework.exceptions import PermissionDenied

from apps.common.modules import require_user_module
from apps.common.roles import is_platform_superadmin, user_roles
from apps.entities.models import Entity

from .models import EquipoRegistro, Funcionario, RegistroAsistencia


def _is_admin(user) -> bool:
    return "admin" in user_roles(user)


def ensure_asistencia_access(user, entity: Entity) -> None:
    if is_platform_superadmin(user):
        raise PermissionDenied("El superadministrador no opera el módulo de asistencia.")
    if not user.entity_id or user.entity_id != entity.id:
        raise PermissionDenied("No tiene permisos para gestionar esta entidad.")
    require_user_module(user, "asistencia", message="El módulo Asistencia no está habilitado.")


def funcionarios_queryset(user, entity: Entity) -> QuerySet[Funcionario]:
    return (
        Funcionario.objects.filter(entity=entity)
        .annotate(face_templates_count=Count("face_templates"))
        .order_by("apellidos", "nombres")
    )


def equipos_queryset(user, entity: Entity) -> QuerySet[EquipoRegistro]:
    return EquipoRegistro.objects.filter(entity=entity).order_by("nombre")


def registros_queryset(user, entity: Entity) -> QuerySet[RegistroAsistencia]:
    return (
        RegistroAsistencia.objects.filter(entity=entity)
        .select_related("funcionario", "equipo")
        .order_by("-fecha_hora")
    )


def user_can_delete_funcionario(user) -> bool:
    return _is_admin(user) or is_platform_superadmin(user)


def user_can_delete_equipo(user) -> bool:
    return _is_admin(user) or is_platform_superadmin(user)
