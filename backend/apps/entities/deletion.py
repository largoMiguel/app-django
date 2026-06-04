"""Eliminación completa de una entidad y todos sus datos relacionados."""
from __future__ import annotations

import shutil
from pathlib import Path

from django.conf import settings
from django.contrib.auth import get_user_model
from django.db import transaction

from apps.accounts.services.user_cleanup import clear_legacy_jwt_tokens

from .models import Entity

User = get_user_model()


def delete_entity_completely(entity: Entity) -> None:
    """Borra usuarios, registros en cascada (PQRS, PDM, secretarías…) y archivos media."""
    entity_id = entity.id
    media_dir = Path(settings.MEDIA_ROOT) / "entities" / str(entity_id)

    with transaction.atomic():
        user_ids = list(User.objects.filter(entity_id=entity_id).values_list("pk", flat=True))
        for uid in user_ids:
            clear_legacy_jwt_tokens(uid)
        User.objects.filter(entity_id=entity_id).delete()
        entity.delete()

    if media_dir.exists():
        shutil.rmtree(media_dir, ignore_errors=True)
