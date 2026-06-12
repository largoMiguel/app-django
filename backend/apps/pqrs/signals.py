"""Señales PQRS — limpieza de archivos en B2."""
from __future__ import annotations

from django.db.models.signals import post_delete, post_save, pre_delete
from django.dispatch import receiver

from apps.common.storage_cleanup import cleanup_pqrs_files

from .cache_utils import bump_pqrs_ai_cache, bump_pqrs_stats_cache
from .models import PQRS


@receiver(pre_delete, sender=PQRS)
def delete_pqrs_storage_files(sender, instance: PQRS, **kwargs):
    cleanup_pqrs_files(instance)


@receiver(post_save, sender=PQRS)
def invalidate_pqrs_stats_on_save(sender, instance: PQRS, **kwargs):
    bump_pqrs_stats_cache(instance.entity_id)
    bump_pqrs_ai_cache(instance.entity_id)


@receiver(post_delete, sender=PQRS)
def invalidate_pqrs_stats_on_delete(sender, instance: PQRS, **kwargs):
    bump_pqrs_stats_cache(instance.entity_id)
    bump_pqrs_ai_cache(instance.entity_id)
