"""Permisos por rol/entidad."""
from __future__ import annotations

from rest_framework.permissions import BasePermission

from apps.common.roles import is_entity_admin, is_platform_superadmin, user_roles


class IsSuperAdmin(BasePermission):
    message = "Solo el superadministrador puede acceder."

    def has_permission(self, request, view) -> bool:
        return is_platform_superadmin(request.user)


class IsEntityAdmin(BasePermission):
    """Superadmin de plataforma o admin de su entidad."""

    message = "Requiere rol de administrador."

    def has_permission(self, request, view) -> bool:
        user = request.user
        if not user or not user.is_authenticated:
            return False
        return is_platform_superadmin(user) or is_entity_admin(user)


class IsAdminOrSecretario(BasePermission):
    message = "Requiere rol de administrador o secretario."

    def has_permission(self, request, view) -> bool:
        user = request.user
        if not user or not user.is_authenticated:
            return False
        if is_platform_superadmin(user):
            return False
        roles = user_roles(user)
        return bool({"admin", "secretario"} & roles) and bool(user.entity_id)
