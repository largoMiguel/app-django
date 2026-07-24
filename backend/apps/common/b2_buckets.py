"""Helpers for B2 bucket names configured per environment."""
from __future__ import annotations

from django.conf import settings


def configured_b2_buckets() -> frozenset[str]:
    """Unique bucket names from settings (demo may use one bucket for all modules)."""
    return frozenset(
        {
            settings.B2_BUCKET_PQRS,
            settings.B2_BUCKET_PDM,
            settings.B2_BUCKET_ASISTENCIA,
            settings.B2_BUCKET_CORRESPONDENCIA,
            settings.B2_BUCKET_DB,
        }
    )


def b2_bucket_url_pattern() -> str:
    """Regex alternation for urlpatterns/nginx (bucket names may contain hyphens)."""
    buckets = sorted(configured_b2_buckets())
    if not buckets:
        return "storage-demo"
    escaped = [b.replace("-", r"\-") for b in buckets]
    return "|".join(escaped)
