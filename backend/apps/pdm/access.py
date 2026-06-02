"""Control de acceso y queryset base por entidad/rol — módulo PDM."""
from __future__ import annotations

import re
from collections import defaultdict

from django.db.models import Q, QuerySet, Sum

from apps.common.media_paths import is_safe_media_relative_path
from apps.common.roles import is_platform_superadmin, user_roles
from apps.entities.models import Entity

from .models import PdmActividad, PdmProducto, PDMEjecucionPresupuestal
from .producto_codigo import PRODUCTO_KEY_FIELDS, producto_key_to_label_map, producto_keys_from_queryset, producto_lookup_keys


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


def ejecucion_queryset_for_user(user, entity: Entity) -> QuerySet[PDMEjecucionPresupuestal]:
    """Ejecución presupuestal de la entidad; secretario solo filas de sus productos asignados."""
    qs = PDMEjecucionPresupuestal.objects.filter(entity=entity)
    if _is_secretario(user) and not _is_admin(user):
        productos_qs = productos_queryset_for_user(user, entity)
        keys = producto_keys_from_queryset(productos_qs)
        if not keys:
            return qs.none()
        return qs.filter(Q(codigo_producto__in=keys) | Q(bpin__in=keys))
    return qs


def ejecucion_agrupada_por_campo_producto(
    user,
    entity: Entity,
    field_name: str,
    default_label: str,
    label_key: str,
) -> list[dict]:
    """Suma pagos de ejecución (todos los años) agrupados por línea o sector del producto PDM."""
    productos_qs = productos_queryset_for_user(user, entity)
    key_to_label = producto_key_to_label_map(productos_qs, field_name, default_label)
    if not key_to_label:
        return []

    grouped: dict[str, float] = defaultdict(float)
    rows = (
        ejecucion_queryset_for_user(user, entity)
        .values("codigo_producto", "bpin")
        .annotate(pagos=Sum("pagos"))
    )
    for row in rows:
        pagos = float(row["pagos"] or 0)
        if pagos <= 0:
            continue
        codigo = str(row["codigo_producto"]).strip()
        bpin = str(row["bpin"]).strip() if row.get("bpin") else ""
        label = key_to_label.get(codigo) or (key_to_label.get(bpin) if bpin else None)
        if not label:
            continue
        grouped[label] += pagos

    return sorted(
        [{label_key: label, "total": total} for label, total in grouped.items() if total > 0],
        key=lambda item: item["total"],
        reverse=True,
    )


def actividades_queryset_for_user(user, entity: Entity) -> QuerySet[PdmActividad]:
    """Actividades visibles según productos asignados al secretario."""
    qs = (
        PdmActividad.objects.filter(entity=entity)
        .select_related("responsable_secretaria")
        .prefetch_related("evidencia")
    )
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
    if not is_safe_media_relative_path(path):
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


def ejecucion_keys_for_producto(entity: Entity, codigo_producto: str) -> set[str]:
    """Claves con las que puede estar registrada la ejecución de un producto PDM."""
    row = (
        PdmProducto.objects.filter(entity=entity, codigo_producto=codigo_producto)
        .values(*PRODUCTO_KEY_FIELDS)
        .first()
    )
    if not row:
        return {str(codigo_producto).strip()} if str(codigo_producto).strip() else set()
    return producto_lookup_keys(row)
