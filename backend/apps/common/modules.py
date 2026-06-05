"""Validación de módulos por entidad y usuario."""

from __future__ import annotations

from rest_framework.exceptions import PermissionDenied

from apps.common.roles import primary_role

ENTITY_MODULE_FLAGS = {
    "pqrs": "enable_pqrs",
    "users_admin": "enable_users_admin",
    "reports_pdf": "enable_reports_pdf",
    "ai_reports": "enable_ai_reports",
    "planes_institucionales": "enable_planes_institucionales",
    "contratacion": "enable_contratacion",
    "pdm": "enable_pdm",
    "asistencia": "enable_asistencia",
    "correspondencia": "enable_correspondencia",
    "presupuesto": "enable_presupuesto",
}


def entity_has_module(entity, module_key: str) -> bool:
    if entity is None:
        return False
    flag = ENTITY_MODULE_FLAGS.get(module_key)
    if not flag:
        return False
    return bool(getattr(entity, flag, False))


def user_has_module(user, module_key: str) -> bool:
    entity = getattr(user, "entity", None)
    if not entity_has_module(entity, module_key):
        return False
    user_modules = getattr(user, "enabled_modules", None) or []
    role = primary_role(user)
    if role == "secretario":
        if not user_modules:
            return False
        return module_key in user_modules
    if user_modules:
        return module_key in user_modules
    return True


def require_user_module(user, module_key: str, *, message: str | None = None) -> None:
    if not user_has_module(user, module_key):
        raise PermissionDenied(message or f"El módulo '{module_key}' no está habilitado.")
