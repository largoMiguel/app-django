"""Eliminación de archivos en B2 / media local."""
from __future__ import annotations

import logging
from pathlib import Path

from botocore.exceptions import ClientError
from django.conf import settings

from .b2_client import delete_prefix, get_b2_client, purge_bucket

logger = logging.getLogger(__name__)


def delete_pqrs_storage_key(key: str | None) -> None:
    """Elimina un objeto del cubo PQRS (p. ej. archivo_respuesta)."""
    if not key or not settings.USE_B2_STORAGE:
        return
    client = get_b2_client()
    try:
        client.delete_object(Bucket=settings.B2_BUCKET_PQRS, Key=key.lstrip("/"))
    except ClientError as exc:
        logger.warning("No se pudo borrar %s en %s: %s", key, settings.B2_BUCKET_PQRS, exc)


def delete_pqrs_respuesta_prefix(pqrs) -> None:
    """Elimina archivos de respuesta de una PQRS (ruta nueva y legacy)."""
    if not settings.USE_B2_STORAGE:
        return
    delete_prefix(
        settings.B2_BUCKET_PQRS,
        f"entities/{pqrs.entity_id}/{pqrs.numero_radicado}/respuesta/",
    )
    delete_prefix(settings.B2_BUCKET_PQRS, f"pqrs/respuestas/{pqrs.id}_")


def cleanup_pqrs_files(pqrs) -> None:
    """Borra todos los archivos de una PQRS (adjuntos, respuesta y carpetas legacy)."""
    for arch in pqrs.archivos.all():
        if arch.archivo:
            arch.archivo.delete(save=False)

    if pqrs.archivo_respuesta:
        delete_pqrs_storage_key(pqrs.archivo_respuesta)

    if settings.USE_B2_STORAGE:
        delete_prefix(
            settings.B2_BUCKET_PQRS,
            f"entities/{pqrs.entity_id}/{pqrs.numero_radicado}/",
        )
        delete_prefix(settings.B2_BUCKET_PQRS, f"entities/{pqrs.entity_id}/pqrs/{pqrs.id}/")
        delete_prefix(settings.B2_BUCKET_PQRS, f"pqrs/respuestas/{pqrs.id}_")
        return

    media_root = Path(settings.MEDIA_ROOT)
    for rel in (
        f"entities/{pqrs.entity_id}/{pqrs.numero_radicado}",
        f"entities/{pqrs.entity_id}/pqrs/{pqrs.id}",
    ):
        folder = media_root / rel
        if folder.exists():
            import shutil

            shutil.rmtree(folder, ignore_errors=True)


def cleanup_pdm_evidencia_files(evidencia) -> None:
    """Borra archivos de evidencia PDM y sus carpetas (nueva ruta y legacy)."""
    from apps.pdm.storage_paths import pdm_evidencia_legacy_prefix, pdm_evidencia_prefix

    for arch in evidencia.archivos.all():
        if arch.archivo:
            arch.archivo.delete(save=False)

    if settings.USE_B2_STORAGE:
        delete_prefix(settings.B2_BUCKET_PDM, f"{pdm_evidencia_prefix(evidencia)}/")
        delete_prefix(settings.B2_BUCKET_PDM, f"{pdm_evidencia_legacy_prefix(evidencia)}/")
        return

    media_root = Path(settings.MEDIA_ROOT)
    for rel in (pdm_evidencia_prefix(evidencia), pdm_evidencia_legacy_prefix(evidencia)):
        folder = media_root / rel
        if folder.exists():
            import shutil

            shutil.rmtree(folder, ignore_errors=True)


def cleanup_entity_storage(entity_id: int, *, pqrs_ids: list[int] | None = None) -> None:
    """Elimina todos los archivos B2 de una entidad."""
    if not settings.USE_B2_STORAGE:
        media_dir = Path(settings.MEDIA_ROOT) / "entities" / str(entity_id)
        if media_dir.exists():
            import shutil

            shutil.rmtree(media_dir, ignore_errors=True)
        return

    if pqrs_ids is None:
        from apps.pqrs.models import PQRS

        pqrs_ids = list(PQRS.objects.filter(entity_id=entity_id).values_list("id", flat=True))

    from apps.pqrs.models import PQRS

    for pqrs in PQRS.objects.filter(entity_id=entity_id, id__in=pqrs_ids):
        delete_pqrs_respuesta_prefix(pqrs)

    prefix = f"entities/{entity_id}/"
    delete_prefix(settings.B2_BUCKET_PQRS, prefix)
    delete_prefix(settings.B2_BUCKET_PDM, prefix)


def purge_all_buckets(*, include_db_backups: bool = True) -> dict[str, int]:
    """Vacía los cubos B2 de la aplicación."""
    if not settings.USE_B2_STORAGE:
        return {}

    buckets = [settings.B2_BUCKET_PQRS, settings.B2_BUCKET_PDM]
    if include_db_backups:
        buckets.append(settings.B2_BUCKET_DB)

    results: dict[str, int] = {}
    for bucket in buckets:
        results[bucket] = purge_bucket(bucket)
    return results
