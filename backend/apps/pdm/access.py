"""Control de acceso y queryset base por entidad/rol — módulo PDM."""
from __future__ import annotations

import re
from collections import defaultdict

from django.db.models import QuerySet, Sum

from apps.common.media_paths import is_safe_media_relative_path
from apps.common.roles import is_platform_superadmin, user_roles
from apps.entities.models import Entity

from .models import PdmActividad, PdmProducto, PDMEjecucionPresupuestal
from .producto_codigo import codigos_referencia_plan_entidad

SIN_PRODUCTO_EN_PLAN = "Sin producto en plan"


def _is_admin(user) -> bool:
    return "admin" in user_roles(user)


def _is_secretario(user) -> bool:
    return "secretario" in user_roles(user)


def _is_contratista(user) -> bool:
    return "contratista" in user_roles(user)


def productos_queryset_for_user(user, entity: Entity) -> QuerySet[PdmProducto]:
    """Productos visibles según rol."""
    qs = PdmProducto.objects.filter(entity=entity).select_related(
        "responsable_secretaria", "responsable_usuario"
    )
    if _is_admin(user):
        return qs
    if _is_secretario(user):
        if not user.secretaria_id:
            return qs.none()
        return qs.filter(responsable_secretaria_id=user.secretaria_id)
    if _is_contratista(user):
        return qs.filter(responsable_usuario_id=user.id)
    return qs.none()


def codigos_producto_for_user(user, entity: Entity) -> list[str]:
    return list(
        productos_queryset_for_user(user, entity)
        .values_list("codigo_producto", flat=True)
        .distinct()
    )


def claves_producto_for_user(user, entity: Entity) -> list[str]:
    return list(productos_queryset_for_user(user, entity).values_list("clave_producto", flat=True))


def ejecucion_queryset_for_user(user, entity: Entity) -> QuerySet[PDMEjecucionPresupuestal]:
    """Ejecución presupuestal de la entidad; secretario/contratista solo filas de sus productos."""
    qs = PDMEjecucionPresupuestal.objects.filter(entity=entity)
    if _is_admin(user):
        return qs
    if _is_secretario(user) or _is_contratista(user):
        codigos = codigos_producto_for_user(user, entity)
        if not codigos:
            return qs.none()
        return qs.filter(codigo_producto__in=codigos)
    return qs.none()


def ejecucion_agrupada_por_campo_producto(
    user,
    entity: Entity,
    field_name: str,
    default_label: str,
    label_key: str,
) -> list[dict]:
    """Suma pto. definitivo de ejecución (todos los años) agrupados por línea o sector del producto PDM."""
    productos_qs = productos_queryset_for_user(user, entity)
    codigo_to_label = {
        str(row["codigo_producto"]).strip(): row[field_name] or default_label
        for row in productos_qs.values("codigo_producto", field_name)
        if str(row["codigo_producto"]).strip()
    }
    if not codigo_to_label:
        return []

    grouped: dict[str, float] = defaultdict(float)
    rows = (
        ejecucion_queryset_for_user(user, entity)
        .values("codigo_producto")
        .annotate(total=Sum("pto_definitivo"))
    )
    for row in rows:
        total = float(row["total"] or 0)
        if total <= 0:
            continue
        codigo = str(row["codigo_producto"]).strip()
        if codigo not in codigo_to_label:
            label = SIN_PRODUCTO_EN_PLAN
        else:
            label = codigo_to_label[codigo]
        grouped[label] += total

    return sorted(
        [{label_key: label, "total": total} for label, total in grouped.items() if total > 0],
        key=lambda item: item["total"],
        reverse=True,
    )


def ejecucion_sin_producto_en_plan(user, entity: Entity) -> list[dict]:
    """Ejecución cuyo codigo_producto no existe en el Plan Indicativo de la entidad."""
    codigos_plan = codigos_referencia_plan_entidad(entity)
    grouped: dict[str, dict] = defaultdict(lambda: {"pto_definitivo": 0.0, "por_anio": defaultdict(float)})
    rows = (
        ejecucion_queryset_for_user(user, entity)
        .values("codigo_producto", "anio")
        .annotate(total=Sum("pto_definitivo"))
    )
    for row in rows:
        total = float(row["total"] or 0)
        if total <= 0:
            continue
        codigo = str(row["codigo_producto"]).strip()
        anio = int(row["anio"])
        if codigo and codigo not in codigos_plan:
            grouped[codigo]["pto_definitivo"] += total
            grouped[codigo]["por_anio"][anio] += total

    result: list[dict] = []
    for codigo, data in grouped.items():
        detalle_anios = sorted(
            [{"anio": anio, "pto_definitivo": total} for anio, total in data["por_anio"].items()],
            key=lambda item: item["anio"],
        )
        result.append(
            {
                "codigo_producto": codigo,
                "pto_definitivo": data["pto_definitivo"],
                "anios": [item["anio"] for item in detalle_anios],
                "detalle_anios": detalle_anios,
            }
        )

    return sorted(result, key=lambda item: item["pto_definitivo"], reverse=True)


def actividades_queryset_for_user(user, entity: Entity) -> QuerySet[PdmActividad]:
    """Actividades visibles según productos asignados al usuario."""
    qs = (
        PdmActividad.objects.filter(entity=entity)
        .select_related("responsable_secretaria")
        .prefetch_related("evidencia")
    )
    if _is_admin(user):
        return qs
    if _is_secretario(user) or _is_contratista(user):
        claves = claves_producto_for_user(user, entity)
        if not claves:
            return qs.none()
        return qs.filter(clave_producto__in=claves)
    return qs.none()


def user_can_access_producto(user, entity: Entity, clave_producto: str) -> bool:
    return productos_queryset_for_user(user, entity).filter(clave_producto=clave_producto).exists()


def resolve_clave_producto(user, entity: Entity, ref: str) -> str | None:
    """Resuelve clave_producto desde clave exacta o codigo_producto MGA."""
    ref = str(ref or "").strip()
    if not ref:
        return None
    qs = productos_queryset_for_user(user, entity)
    if qs.filter(clave_producto=ref).exists():
        return ref
    match = qs.filter(codigo_producto=ref).order_by("clave_producto").first()
    return match.clave_producto if match else None


def user_can_access_codigo_producto(user, entity: Entity, codigo_producto: str) -> bool:
    """Permite acceso por clave o por codigo_producto MGA (puede haber varios indicadores)."""
    ref = str(codigo_producto or "").strip()
    if not ref:
        return False
    if user_can_access_producto(user, entity, ref):
        return True
    return productos_queryset_for_user(user, entity).filter(codigo_producto=ref).exists()


def user_can_access_actividad(user, entity: Entity, actividad: PdmActividad) -> bool:
    if actividad.entity_id != entity.id:
        return False
    if _is_admin(user) or is_platform_superadmin(user):
        return True
    if _is_secretario(user):
        return user_can_access_producto(user, entity, actividad.clave_producto)
    if _is_contratista(user):
        return actividad.responsable_usuario_id == user.id or user_can_access_producto(
            user, entity, actividad.clave_producto
        )
    return False


def user_can_access_pdm_media_path(user, path: str) -> bool:
    """Valida acceso a archivos media de evidencias PDM."""
    path = path.lstrip("/")
    if not is_safe_media_relative_path(path):
        return False

    from .models import PdmActividad, PdmEvidenciaArchivo

    arch = (
        PdmEvidenciaArchivo.objects.filter(archivo=path)
        .select_related("evidencia__actividad", "evidencia__entity")
        .first()
    )
    if arch:
        return user_can_access_actividad(user, arch.evidencia.entity, arch.evidencia.actividad)

    # Rutas legacy: entities/.../pdm/evidencias/<actividad_id>/
    legacy = re.match(
        r"^entities/(?P<entity_id>\d+)/pdm/evidencias/(?P<actividad_id>\d+)/",
        path,
    )
    if legacy:
        entity = Entity.objects.filter(pk=int(legacy.group("entity_id"))).first()
        if entity is None:
            return False
        actividad = PdmActividad.objects.filter(
            pk=int(legacy.group("actividad_id")),
            entity_id=entity.id,
        ).first()
        if actividad is None:
            return False
        return user_can_access_actividad(user, entity, actividad)

    # Ruta nueva sin registro en BD (archivo huérfano): codigo_producto + año + archivo
    match = re.match(
        r"^entities/(?P<entity_id>\d+)/pdm/evidencias/(?P<codigo>[^/]+)/(?P<anio>\d+)/(?:archivos/)?(?P<file>[^/]+)$",
        path,
    )
    if not match:
        return False

    entity = Entity.objects.filter(pk=int(match.group("entity_id"))).first()
    if entity is None:
        return False

    codigo_path = match.group("codigo")
    anio = int(match.group("anio"))
    for actividad in PdmActividad.objects.filter(entity=entity, anio=anio):
        from .storage_paths import _safe_path_segment

        if _safe_path_segment(actividad.clave_producto) == codigo_path:
            if user_can_access_actividad(user, entity, actividad):
                return True
    return False
