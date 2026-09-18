"""Señales — limpieza B2 al borrar ejecuciones PIC."""
from __future__ import annotations

from django.db.models.signals import pre_delete
from django.dispatch import receiver

from .models import PicEjecucion


@receiver(pre_delete, sender=PicEjecucion)
def cleanup_pic_ejecucion_files(sender, instance: PicEjecucion, **kwargs):
    from apps.common.storage_cleanup import cleanup_pic_ejecucion_files

    cleanup_pic_ejecucion_files(instance)
