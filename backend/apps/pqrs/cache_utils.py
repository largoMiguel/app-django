"""Invalidación de caché de estadísticas PQRS."""
from __future__ import annotations

from django.core.cache import cache


def _stats_version_key(entity_id: int | None) -> str:
    return f"pqrs:stats:ver:{entity_id or 0}"


def pqrs_stats_cache_key(user) -> str:
    entity_id = user.entity_id or 0
    version = cache.get(_stats_version_key(entity_id), 0)
    return f"pqrs:stats:{user.id}:{entity_id}:v{version}"


def _ai_version_key(entity_id: int | None) -> str:
    return f"pqrs:ai:ver:{entity_id or 0}"


def pqrs_compliance_cache_key(user) -> str:
    entity_id = user.entity_id or 0
    version = cache.get(_ai_version_key(entity_id), 0)
    return f"pqrs:compliance:{user.id}:{entity_id}:v{version}"


def pqrs_insights_cache_key(user) -> str:
    entity_id = user.entity_id or 0
    version = cache.get(_ai_version_key(entity_id), 0)
    return f"pqrs:insights:{user.id}:{entity_id}:v{version}"


def bump_pqrs_stats_cache(entity_id: int | None) -> None:
    """Incrementa versión de caché para forzar recálculo de stats del dashboard."""
    key = _stats_version_key(entity_id)
    try:
        cache.incr(key)
    except ValueError:
        cache.set(key, 1, timeout=None)


def bump_pqrs_ai_cache(entity_id: int | None) -> None:
    """Invalida caché de compliance/insights IA al cambiar PQRS."""
    key = _ai_version_key(entity_id)
    try:
        cache.incr(key)
    except ValueError:
        cache.set(key, 1, timeout=None)
