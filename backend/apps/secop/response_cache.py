"""Caché Redis de payloads SECOP ya calculados (KPIs, paneles)."""
from __future__ import annotations

import hashlib
import json

from django.conf import settings
from django.core.cache import cache


def _ttl() -> int:
    return int(getattr(settings, "SECOP_CACHE_TTL", 21600))


def cache_key(entity_id: int, suffix: str, extra: dict | None = None) -> str:
    raw = json.dumps(extra or {}, sort_keys=True, default=str)
    digest = hashlib.sha256(raw.encode()).hexdigest()[:16]
    return f"secop:payload:{entity_id}:{suffix}:{digest}"


def get_cached_payload(entity_id: int, suffix: str, extra: dict | None = None):
    return cache.get(cache_key(entity_id, suffix, extra))


def set_cached_payload(entity_id: int, suffix: str, payload, extra: dict | None = None) -> None:
    cache.set(cache_key(entity_id, suffix, extra), payload, _ttl())


def invalidate_entity_payloads(entity_id: int) -> None:
    # django-redis no soporta SCAN en todas las configs; las claves expiran con SECOP_CACHE_TTL.
    pass
