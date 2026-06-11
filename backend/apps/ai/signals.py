"""Señales para indexación automática de embeddings."""
from __future__ import annotations

import logging

from django.db.models.signals import post_save
from django.dispatch import receiver

logger = logging.getLogger(__name__)


@receiver(post_save, sender="pqrs.PQRS")
def index_pqrs_on_save(sender, instance, created, **kwargs):
    """Indexa PQRS en background al crear o actualizar respuesta."""
    if not instance.entity_id:
        return
    # Import lazy para evitar circular imports
    try:
        from apps.ai.tasks import index_pqrs_embedding

        index_pqrs_embedding.delay(instance.id)
    except Exception as exc:  # noqa: BLE001
        logger.warning("No se pudo encolar indexación PQRS %s: %s", instance.id, exc)
