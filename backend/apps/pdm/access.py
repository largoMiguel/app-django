"""Control de acceso y queryset base por entidad/rol — módulo PDM."""
from __future__ import annotations

import re

from django.db.models import Q, QuerySet

from apps.common.roles import is_platform_superadmin, user_roles
from apps.entities.models import Entity

from .models import PdmActividad, PdmProducto


def _is_admin(user) -> bool:
    return "admin" in user_roles(user)


def _is_secretario(user) -> bool:
    return "secretario" in user_roles(user)


def productos_queryset_for_user(user, entity: Entity) -> QuerySet[PdmProducto]:
    """Productos visibles: admin ve todos de la entidad; secretario solo los asignados."""
    qs = PdmProducto.objects.filter(entity=entity).select_related("responsable_secretaria")
    if _is_secretario(user) and not _is_admin(user):
        if not user.secretaria_id:
            return qs.none()
        qs = qs.filter(responsable_secretaria_id=user.secretaria_id)
    return qs


def actividades_queryset_for_user(user, entity: Entity) -> QuerySet[PdmActividad]:
    """Actividades visibles según productos asignados al secretario."""
    qs = PdmActividad.objects.filter(entity=entity).select_related("responsable_secretaria")
    if _is_secretario(user) and not _is_admin(user):
        codigos = productos_queryset_for_user(user, entity).values_list("codigo_producto", flat=True)
        qs = qs.filter(codigo_producto__in=codigos)
    return qs


def user_can_access_producto(user, entity: Entity, codigo_producto: str) -> bool:
    return productos_queryset_for_user(user, entity).filter(codigo_producto=codigo_producto).exists()


def user_can_access_actividad(user, entity: Entity, actividad: PdmActividad) -> bool:
    if actividad.entity_id != entity.id:
        return False
    if _is_admin(user) or is_platform_superadmin(user):
        return True
    if _is_secretario(user):
        return user_can_access_producto(user, entity, actividad.codigo_producto)
    return False


def user_can_access_pdm_media_path(user, path: str) -> bool:
    """Valida acceso a archivos media de evidencias PDM."""
    path = path.lstrip("/")
    if ".." in path or path.startswith("/"):
        return False

    match = re.match(
        r"^entities/(?P<entity_id>\d+)/pdm/evidencias/(?P<actividad_id>\d+)/",
        path,
    )
    if not match:
        return False

    entity = Entity.objects.filter(pk=int(match.group("entity_id"))).first()
    if entity is None:
        return False

    actividad = PdmActividad.objects.filter(
        pk=int(match.group("actividad_id")),
        entity_id=entity.id,
    ).first()
    if actividad is None:
        return False

    return user_can_access_actividad(user, entity, actividad)


def codigos_producto_for_user(user, entity: Entity) -> list[str]:
    return list(productos_queryset_for_user(user, entity).values_list("codigo_producto", flat=True))
