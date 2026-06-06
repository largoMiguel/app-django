"""Señales PQRS — limpieza de archivos en B2."""
from __future__ import annotations

from django.db.models.signals import pre_delete
from django.dispatch import receiver

from apps.common.storage_cleanup import cleanup_pqrs_files

from .models import PQRS


@receiver(pre_delete, sender=PQRS)
def delete_pqrs_storage_files(sender, instance: PQRS, **kwargs):
    cleanup_pqrs_files(instance)
