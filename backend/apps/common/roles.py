"""Helpers de roles compartidos entre apps."""


def user_roles(user) -> set[str]:
    return {r.lower() for r in user.role_names}


def is_platform_superadmin(user) -> bool:
    """Superadmin de plataforma: gestión global, sin operación PQRS por entidad."""
    if not user or not getattr(user, "is_authenticated", False):
        return False
    return "superadmin" in user_roles(user) or bool(getattr(user, "is_superuser", False))


def is_entity_admin(user) -> bool:
    if not user or not getattr(user, "is_authenticated", False):
        return False
    if is_platform_superadmin(user):
        return False
    return "admin" in user_roles(user) and bool(user.entity_id)
