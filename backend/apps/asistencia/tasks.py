"""Tareas Celery del módulo Asistencia."""
from __future__ import annotations

import logging

from celery import shared_task

logger = logging.getLogger(__name__)

PHOTO_RETENTION_DAYS = 15


@shared_task(name="apps.asistencia.tasks.purge_old_asistencia_photos")
def purge_old_asistencia_photos(keep_days: int = PHOTO_RETENTION_DAYS) -> dict:
    """Elimina fotos de marcación con más de `keep_days` días y limpia foto_key."""
    from apps.asistencia.services import purge_old_photos

    result = purge_old_photos(keep_days=keep_days)
    logger.info(
        "Asistencia photos purge: deleted=%s cleared=%s keep_days=%s",
        result.get("deleted_files"),
        result.get("cleared_records"),
        keep_days,
    )
    return result


# Asegura descubrimiento explícito por autodiscover_tasks
__all__ = ("purge_old_asistencia_photos",)