"""Control de acceso — módulo Contratación (SECOP)."""
from __future__ import annotations

from rest_framework.exceptions import PermissionDenied

from apps.common.modules import require_user_module
from apps.common.roles import is_platform_superadmin, user_roles
from apps.entities.models import Entity


def _is_admin(user) -> bool:
    return "admin" in user_roles(user)


def _is_secretario(user) -> bool:
    return "secretario" in user_roles(user)


def ensure_secop_access(user, entity: Entity) -> None:
    if is_platform_superadmin(user):
        raise PermissionDenied("El superadministrador no opera el módulo de contratación.")
    if not user.entity_id or user.entity_id != entity.id:
        raise PermissionDenied("No tiene permisos para gestionar esta entidad.")
    require_user_module(
        user,
        "contratacion",
        message="El módulo Contratación (SECOP) no está habilitado.",
    )
    roles = user_roles(user)
    if not ({"admin", "secretario"} & roles):
        raise PermissionDenied("Solo administradores y secretarios pueden operar contratación.")


def parse_nits(raw: str | None, fallback: str | None = None) -> list[str]:
    """Normaliza NIT(s) separados por coma."""
    parts: list[str] = []
    for chunk in (raw or "").split(","):
        nit = chunk.strip().replace(".", "").replace("-", "")
        if nit and nit not in parts:
            parts.append(nit)
    if not parts and fallback:
        fb = fallback.strip().replace(".", "").replace("-", "")
        if fb:
            parts.append(fb)
    return parts


def resolve_nits_secop_i(entity: Entity) -> list[str]:
    return parse_nits(entity.nit_secop_i, entity.nit)


def resolve_nits_secop_ii(entity: Entity) -> list[str]:
    return parse_nits(entity.nit_secop_ii, entity.nit)
