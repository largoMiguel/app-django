"""Eliminación completa de una entidad y todos sus datos relacionados."""
from __future__ import annotations

from django.contrib.auth import get_user_model
from django.db import transaction

from apps.common.storage_cleanup import cleanup_entity_storage

from .models import Entity

User = get_user_model()


def delete_entity_completely(entity: Entity) -> None:
    """Borra usuarios, registros en cascada (PQRS, PDM, secretarías…) y archivos B2/media."""
    entity_id = entity.id

    from apps.pqrs.models import PQRS

    pqrs_ids = list(PQRS.objects.filter(entity_id=entity_id).values_list("id", flat=True))
    cleanup_entity_storage(entity_id, pqrs_ids=pqrs_ids)

    with transaction.atomic():
        User.objects.filter(entity_id=entity_id).delete()
        entity.delete()
