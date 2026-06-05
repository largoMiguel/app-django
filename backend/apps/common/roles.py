"""Helpers de roles compartidos entre apps."""

ROLE_PRIORITY = ("superadmin", "admin", "secretario", "ciudadano")


def user_roles(user) -> set[str]:
    return {r.lower() for r in user.role_names}


def is_platform_superadmin(user) -> bool:
    """Superadmin de plataforma: gestión global, sin operación PQRS por entidad."""
    if not user or not getattr(user, "is_authenticated", False):
        return False
    return "superadmin" in user_roles(user) or bool(getattr(user, "is_superuser", False))


def primary_role(user) -> str:
    if not user:
        return ""
    roles = list(getattr(user, "role_names", None) or [])
    if not roles and hasattr(user, "groups"):
        roles = list(user.groups.values_list("name", flat=True))
    for name in ROLE_PRIORITY:
        if name in roles:
            return name
    return roles[0] if roles else ""


def is_entity_admin(user) -> bool:
    if not user or not getattr(user, "is_authenticated", False):
        return False
    if is_platform_superadmin(user):
        return False
    return "admin" in user_roles(user) and bool(user.entity_id)
