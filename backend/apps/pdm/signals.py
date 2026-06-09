"""Señales PDM — limpieza de archivos en B2 / media local."""
from __future__ import annotations

from django.db.models.signals import pre_delete
from django.dispatch import receiver

from apps.common.storage_cleanup import cleanup_pdm_evidencia_files

from .models import PdmActividadEvidencia


@receiver(pre_delete, sender=PdmActividadEvidencia)
def delete_pdm_evidencia_storage_files(sender, instance: PdmActividadEvidencia, **kwargs):
    cleanup_pdm_evidencia_files(instance)
