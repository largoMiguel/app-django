"""Caché Redis del usuario resuelto por clerk_id (TTL corto + invalidación en signals)."""
from __future__ import annotations

from django.conf import settings
from django.core.cache import cache

AUTH_USER_TTL = 60


def _user_key(clerk_id: str) -> str:
    return f"auth:user:{clerk_id}"


def get_cached_user_id(clerk_id: str) -> int | None:
    if not getattr(settings, "REDIS_URL", ""):
        return None
    val = cache.get(_user_key(clerk_id))
    if val is None:
        return None
    try:
        return int(val)
    except (TypeError, ValueError):
        return None


def set_cached_user_id(clerk_id: str, user_id: int) -> None:
    if not getattr(settings, "REDIS_URL", "") or not clerk_id:
        return
    cache.set(_user_key(clerk_id), user_id, AUTH_USER_TTL)


def invalidate_user_auth_cache(*, clerk_id: str | None = None, user_id: int | None = None) -> None:
    if not getattr(settings, "REDIS_URL", ""):
        return
    if clerk_id:
        cache.delete(_user_key(clerk_id))
        return
    if user_id:
        from django.contrib.auth import get_user_model

        User = get_user_model()
        cid = User.objects.filter(pk=user_id).values_list("clerk_id", flat=True).first()
        if cid:
            cache.delete(_user_key(cid))
