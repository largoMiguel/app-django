"""Clerk Backend API helpers for user provisioning and sync."""
from __future__ import annotations

import logging
from functools import lru_cache

from django.conf import settings
from clerk_backend_api import Clerk
from clerk_backend_api.models import ClerkErrors

logger = logging.getLogger(__name__)


class ClerkServiceError(Exception):
    """Raised when a Clerk API call fails."""


def _split_name(full_name: str) -> tuple[str, str]:
    parts = (full_name or "").strip().split(None, 1)
    if not parts:
        return "", ""
    if len(parts) == 1:
        return parts[0], ""
    return parts[0], parts[1]


def _primary_email(clerk_user) -> str | None:
    addresses = clerk_user.email_addresses or []
    primary_id = getattr(clerk_user, "primary_email_address_id", None)
    for addr in addresses:
        if primary_id and getattr(addr, "id", None) == primary_id:
            return addr.email_address
    if addresses:
        return addresses[0].email_address
    return None


@lru_cache(maxsize=1)
def get_clerk_client() -> Clerk:
    secret = settings.CLERK_SECRET_KEY
    if not secret:
        raise ClerkServiceError("CLERK_SECRET_KEY no configurada.")
    return Clerk(bearer_auth=secret)


def find_user_by_email(email: str):
    """Return Clerk user for email if it exists."""
    client = get_clerk_client()
    normalized = email.strip().lower()
    try:
        users = client.users.list(request={"email_address": [normalized]})
    except ClerkErrors as exc:
        raise ClerkServiceError(str(exc)) from exc
    return users[0] if users else None


def create_user(*, email: str, password: str, full_name: str = "") -> str:
    """Create a Clerk user with password. Returns clerk user id."""
    client = get_clerk_client()
    first_name, last_name = _split_name(full_name)
    normalized = email.strip().lower()
    try:
        clerk_user = client.users.create(
            email_address=[normalized],
            password=password,
            first_name=first_name or None,
            last_name=last_name or None,
            skip_password_checks=False,
        )
    except ClerkErrors as exc:
        raise ClerkServiceError(str(exc)) from exc
    return clerk_user.id


def create_invitation(*, email: str) -> None:
    """Send a Clerk invitation email so the user sets their own password."""
    client = get_clerk_client()
    normalized = email.strip().lower()
    try:
        client.invitations.create(request={"email_address": normalized})
    except ClerkErrors as exc:
        raise ClerkServiceError(str(exc)) from exc


def ensure_user(*, email: str, password: str, full_name: str = "") -> str:
    """Idempotent: find existing Clerk user by email or create one."""
    existing = find_user_by_email(email)
    if existing:
        return existing.id
    return create_user(email=email, password=password, full_name=full_name)


def get_user(clerk_id: str):
    """Fetch Clerk user by id."""
    client = get_clerk_client()
    try:
        return client.users.get(user_id=clerk_id)
    except ClerkErrors as exc:
        raise ClerkServiceError(str(exc)) from exc


def get_primary_email_for_clerk_id(clerk_id: str) -> str | None:
    clerk_user = get_user(clerk_id)
    return _primary_email(clerk_user)


def update_user_email(*, clerk_id: str, email: str) -> None:
    """Add and set primary email in Clerk."""
    client = get_clerk_client()
    normalized = email.strip().lower()
    try:
        client.email_addresses.create(
            request={
                "user_id": clerk_id,
                "email_address": normalized,
                "verified": True,
                "primary": True,
            }
        )
    except ClerkErrors as exc:
        raise ClerkServiceError(str(exc)) from exc


def ban_user(clerk_id: str) -> None:
    """Ban user in Clerk (soft-disable login)."""
    client = get_clerk_client()
    try:
        client.users.ban(user_id=clerk_id)
    except ClerkErrors as exc:
        raise ClerkServiceError(str(exc)) from exc


def unban_user(clerk_id: str) -> None:
    client = get_clerk_client()
    try:
        client.users.unban(user_id=clerk_id)
    except ClerkErrors as exc:
        raise ClerkServiceError(str(exc)) from exc


def delete_user(clerk_id: str) -> None:
    client = get_clerk_client()
    try:
        client.users.delete(user_id=clerk_id)
    except ClerkErrors as exc:
        raise ClerkServiceError(str(exc)) from exc
