"""Control de acceso y queryset base por entidad/rol — módulo PDM."""
from __future__ import annotations

import re

from django.db.models import Q, QuerySet

from apps.common.media_paths import is_safe_media_relative_path
from apps.common.roles import is_platform_superadmin, user_roles
from apps.entities.models import Entity

from .models import PdmActividad, PdmProducto, PDMEjecucionPresupuestal


def codigos_ejecucion_coinciden(producto_codigo: str, ejecucion_codigo: str) -> bool:
    """True si un código PDM y uno de ejecución presupuestal representan el mismo producto."""
    a = str(producto_codigo or "").strip()
    b = str(ejecucion_codigo or "").strip()
    if not a or not b:
        return False
    if a == b:
        return True
    if a.startswith(b) or b.startswith(a):
        return True

    from .ejecucion_parser import extraer_codigo_producto

    ea = extraer_codigo_producto(a)
    eb = extraer_codigo_producto(b)
    if ea and ea == b:
        return True
    if eb and eb == a:
        return True
    if ea and eb and ea == eb:
        return True

    da = re.sub(r"\D", "", a)
    db = re.sub(r"\D", "", b)
    if not da or not db:
        return False
    if da == db:
        return True
    if len(da) >= 4 and len(db) >= 4 and (da.startswith(db) or db.startswith(da)):
        return True
    return False


def codigos_ejecucion_for_productos(entity: Entity, product_codigos: list[str]) -> list[str]:
    """Códigos en ejecución presupuestal que corresponden a los productos PDM dados."""
    product_codigos = [str(c).strip() for c in product_codigos if str(c).strip()]
    if not product_codigos:
        return []

    ejecucion_codigos = [
        str(c).strip()
        for c in PDMEjecucionPresupuestal.objects.filter(entity=entity)
        .values_list("codigo_producto", flat=True)
        .distinct()
        if str(c).strip()
    ]
    return [ej for ej in ejecucion_codigos if any(codigos_ejecucion_coinciden(pc, ej) for pc in product_codigos)]


def ejecucion_queryset_for_user(user, entity: Entity) -> QuerySet[PDMEjecucionPresupuestal]:
    """Ejecución presupuestal visible según rol (secretario: productos asignados)."""
    qs = PDMEjecucionPresupuestal.objects.filter(entity=entity)
    if _is_secretario(user) and not _is_admin(user):
        product_codigos = codigos_producto_for_user(user, entity)
        ej_codigos = codigos_ejecucion_for_productos(entity, product_codigos)
        qs = qs.filter(codigo_producto__in=ej_codigos) if ej_codigos else qs.none()
    return qs


def ejecucion_pagos_por_producto_codigo(user, entity: Entity) -> dict[str, float]:
    """Suma pagos de ejecución (todos los años) por código de producto PDM."""
    from django.db.models import Sum

    product_codigos = [str(c).strip() for c in codigos_producto_for_user(user, entity) if str(c).strip()]
    if not product_codigos:
        return {}

    result = {pc: 0.0 for pc in product_codigos}
    rows = (
        ejecucion_queryset_for_user(user, entity)
        .values("codigo_producto")
        .annotate(pagos=Sum("pagos"))
    )
    for row in rows:
        ej_codigo = str(row["codigo_producto"]).strip()
        pagos = float(row["pagos"] or 0)
        for pc in product_codigos:
            if codigos_ejecucion_coinciden(pc, ej_codigo):
                result[pc] += pagos
                break
    return result


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
