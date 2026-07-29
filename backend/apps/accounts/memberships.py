"""Resolución de membresías multi-entidad y contexto activo en request.user."""
from __future__ import annotations

from django.contrib.auth.models import Group
from django.db import transaction
from django.db.models import Q
from rest_framework.exceptions import PermissionDenied

from apps.accounts.models import UserEntityMembership

ENTITY_HEADER = "HTTP_X_ENTITY_ID"


def memberships_queryset(user):
    return (
        UserEntityMembership.objects.filter(user=user, is_active=True)
        .select_related("entity", "secretaria", "supervisor")
        .order_by("-is_default", "entity__name")
    )


def list_memberships(user) -> list[UserEntityMembership]:
    cached = getattr(user, "_memberships_cache", None)
    if cached is not None:
        return cached
    items = list(memberships_queryset(user))
    user._memberships_cache = items
    return items


def default_membership(user) -> UserEntityMembership | None:
    for m in list_memberships(user):
        if m.is_default:
            return m
    items = list_memberships(user)
    return items[0] if items else None


def resolve_membership(user, entity_id: int | None) -> UserEntityMembership | None:
    if entity_id is None:
        return default_membership(user)
    for m in list_memberships(user):
        if m.entity_id == entity_id:
            return m
    return None


def apply_membership_context(user, membership: UserEntityMembership | None) -> None:
    """Sobrescribe en memoria entity/role/secretaria/modules del usuario activo."""
    if membership is None:
        user._active_membership = None
        user._active_role = None
        user._active_entity_id = None
        user.entity = None
        user.entity_id = None
        user.role = ""
        user.secretaria = None
        user.secretaria_id = None
        user.enabled_modules = []
        return

    user._active_membership = membership
    user._active_role = membership.role
    user._active_entity_id = membership.entity_id
    user.entity = membership.entity
    user.entity_id = membership.entity_id
    user.role = membership.role or ""
    user.secretaria = membership.secretaria
    user.secretaria_id = membership.secretaria_id
    user.enabled_modules = list(membership.enabled_modules or [])


def apply_request_entity_context(request, user) -> None:
    """Lee X-Entity-Id y aplica la membresía activa al usuario."""
    if not user or not getattr(user, "is_authenticated", False):
        return

    raw = request.META.get(ENTITY_HEADER, "").strip()
    if raw:
        try:
            entity_id = int(raw)
        except ValueError as exc:
            raise PermissionDenied(
                "Identificador de entidad inválido.",
                code="entity_not_allowed",
            ) from exc
        membership = resolve_membership(user, entity_id)
        if membership is None:
            raise PermissionDenied(
                "No tiene acceso a la entidad solicitada.",
                code="entity_not_allowed",
            )
        apply_membership_context(user, membership)
        return

    active_memberships = list_memberships(user)
    if len(active_memberships) > 1:
        apply_membership_context(user, None)
        return

    membership = default_membership(user)
    if membership:
        apply_membership_context(user, membership)
    elif user.entity_id:
        user._active_role = user.role or None
        user._active_entity_id = user.entity_id


def sync_user_cache_from_membership(membership: UserEntityMembership) -> None:
    """Actualiza campos cacheados en User cuando la membresía es la predeterminada."""
    user = membership.user
    if not membership.is_default:
        return
    user.entity = membership.entity
    user.entity_id = membership.entity_id
    user.role = membership.role or ""
    user.secretaria = membership.secretaria
    user.secretaria_id = membership.secretaria_id
    user.enabled_modules = list(membership.enabled_modules or [])
    user.save(
        update_fields=[
            "entity",
            "entity_id",
            "role",
            "secretaria",
            "secretaria_id",
            "enabled_modules",
        ]
    )


MANAGED_ROLES = frozenset({"superadmin", "admin", "secretario", "contratista", "ciudadano"})


def ensure_membership_group(role: str) -> None:
    if role:
        Group.objects.get_or_create(name=role)


def sync_groups_from_memberships(user) -> None:
    """Sincroniza grupos Django como unión de roles en todas las membresías activas."""
    active_roles = {
        m.role
        for m in UserEntityMembership.objects.filter(user=user, is_active=True)
        if m.role in MANAGED_ROLES
    }
    current = set(user.groups.filter(name__in=MANAGED_ROLES).values_list("name", flat=True))
    to_remove = current - active_roles
    if to_remove:
        user.groups.remove(*Group.objects.filter(name__in=to_remove))
    for role in active_roles:
        g, _ = Group.objects.get_or_create(name=role)
        user.groups.add(g)


def sync_user_flags_from_memberships(user) -> None:
    """Recalcula is_staff / is_superuser según la unión de membresías activas."""
    roles = {
        m.role
        for m in UserEntityMembership.objects.filter(user=user, is_active=True)
        if m.role
    }
    user.is_superuser = "superadmin" in roles
    user.is_staff = bool(roles & {"superadmin", "admin"})
    user.save(update_fields=["is_staff", "is_superuser"])


@transaction.atomic
def upsert_membership(
    *,
    user,
    entity,
    role: str,
    secretaria=None,
    enabled_modules=None,
    supervisor=None,
    is_default: bool | None = None,
) -> UserEntityMembership:
    defaults = {
        "role": role or "",
        "secretaria": secretaria,
        "enabled_modules": list(enabled_modules or []),
        "supervisor": supervisor,
        "is_active": True,
    }
    membership, created = UserEntityMembership.objects.update_or_create(
        user=user,
        entity=entity,
        defaults=defaults,
    )
    if is_default is True or (created and not UserEntityMembership.objects.filter(user=user, is_default=True).exists()):
        UserEntityMembership.objects.filter(user=user).exclude(pk=membership.pk).update(is_default=False)
        membership.is_default = True
        membership.save(update_fields=["is_default", "updated_at"])
    sync_user_cache_from_membership(membership if membership.is_default else default_membership(user) or membership)
    ensure_membership_group(role)
    sync_groups_from_memberships(user)
    sync_user_flags_from_memberships(user)
    return membership


def contratista_membership_filter_for_secretario(user) -> Q:
    """Contratistas bajo supervisión directa o de la misma secretaría."""
    q = Q(supervisor_id=user.id)
    secretaria_id = getattr(user, "secretaria_id", None)
    if secretaria_id:
        q |= Q(secretaria_id=secretaria_id)
    return q


def contratista_user_ids_for_secretario(user) -> list[int]:
    if not user.entity_id:
        return []
    return list(
        UserEntityMembership.objects.filter(
            entity_id=user.entity_id,
            role="contratista",
            is_active=True,
        )
        .filter(contratista_membership_filter_for_secretario(user))
        .values_list("user_id", flat=True)
    )


def cascade_modules_to_supervised(supervisor_membership: UserEntityMembership) -> None:
    """Si un secretario pierde módulos, los contratistas bajo su supervisión también."""
    allowed = set(supervisor_membership.enabled_modules or [])
    subs = UserEntityMembership.objects.filter(
        entity=supervisor_membership.entity,
        role="contratista",
        is_active=True,
    ).filter(contratista_membership_filter_for_secretario(supervisor_membership.user))
    for sub in subs:
        current = set(sub.enabled_modules or [])
        trimmed = sorted(current & allowed)
        if trimmed != list(sub.enabled_modules or []):
            sub.enabled_modules = trimmed
            sub.save(update_fields=["enabled_modules", "updated_at"])
