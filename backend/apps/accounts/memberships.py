"""Resolución de membresías multi-entidad y contexto activo en request.user."""
from __future__ import annotations

from django.contrib.auth.models import Group
from django.db import transaction
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


def ensure_membership_group(role: str) -> None:
    if role:
        Group.objects.get_or_create(name=role)


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
    return membership


def cascade_modules_to_supervised(supervisor_membership: UserEntityMembership) -> None:
    """Si un secretario pierde módulos, los contratistas bajo su supervisión también."""
    allowed = set(supervisor_membership.enabled_modules or [])
    for sub in UserEntityMembership.objects.filter(
        supervisor=supervisor_membership.user,
        entity=supervisor_membership.entity,
        role="contratista",
        is_active=True,
    ):
        current = set(sub.enabled_modules or [])
        trimmed = sorted(current & allowed)
        if trimmed != list(sub.enabled_modules or []):
            sub.enabled_modules = trimmed
            sub.save(update_fields=["enabled_modules", "updated_at"])
