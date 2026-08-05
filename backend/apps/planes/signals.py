"""Señales Planes — limpieza de archivos en B2 / media local."""
from __future__ import annotations

from django.db.models.signals import pre_delete
from django.dispatch import receiver

from apps.common.storage_cleanup import cleanup_planes_evidencia_files

from .models import PlanEvidencia


@receiver(pre_delete, sender=PlanEvidencia)
def delete_planes_evidencia_storage_files(sender, instance: PlanEvidencia, **kwargs):
    cleanup_planes_evidencia_files(instance)
