"""DRF permission helpers para RBAC."""
from __future__ import annotations

from rest_framework.permissions import BasePermission

from apps.common.roles import is_entity_admin, is_platform_superadmin, user_roles


def _role_names(user) -> set[str]:
    return user_roles(user)


def HasRole(*roles: str) -> type[BasePermission]:  # noqa: N802
    required = {r.lower() for r in roles}

    class _HasRole(BasePermission):
        message = "Tu rol no tiene acceso a este recurso."

        def has_permission(self, request, view) -> bool:
            user = request.user
            if not user or not user.is_authenticated:
                return False
            if is_platform_superadmin(user) and "superadmin" in required:
                return True
            return bool(required.intersection(_role_names(user)))

    _HasRole.__name__ = f"HasRole_{'_'.join(sorted(required))}"
    return _HasRole


def HasPerm(*perms: str) -> type[BasePermission]:  # noqa: N802
    required = tuple(perms)

    class _HasPerm(BasePermission):
        message = "Permisos insuficientes."

        def has_permission(self, request, view) -> bool:
            user = request.user
            if not user or not user.is_authenticated:
                return False
            if is_platform_superadmin(user):
                return True
            return all(user.has_perm(p) for p in required)

    _HasPerm.__name__ = f"HasPerm_{'_'.join(required)}"
    return _HasPerm


def HasPermOrRole(*, perms: tuple[str, ...], roles: tuple[str, ...]) -> type[BasePermission]:  # noqa: N802
    required_roles = {r.lower() for r in roles}
    required_perms = tuple(perms)

    class _HasPermOrRole(BasePermission):
        message = "Permisos insuficientes."

        def has_permission(self, request, view) -> bool:
            user = request.user
            if not user or not user.is_authenticated:
                return False
            if is_platform_superadmin(user):
                return True
            user_role_names = _role_names(user)
            if required_roles and required_roles.intersection(user_role_names):
                return True
            if not required_perms:
                return False
            return all(user.has_perm(p) for p in required_perms)

    _HasPermOrRole.__name__ = "HasPermOrRole"
    return _HasPermOrRole


class IsAdminRole(BasePermission):
    """Superadmin de plataforma o admin de entidad."""

    def has_permission(self, request, view) -> bool:
        user = request.user
        if not user or not user.is_authenticated:
            return False
        return is_platform_superadmin(user) or is_entity_admin(user)


class IsSuperAdminRole(BasePermission):
    """Sólo superadmin de plataforma."""

    def has_permission(self, request, view) -> bool:
        return is_platform_superadmin(request.user)
