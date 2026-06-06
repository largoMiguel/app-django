"""Backblaze B2 storages (S3-compatible) for PQRS and PDM files."""
from __future__ import annotations

from django.conf import settings
from django.core.files.storage import FileSystemStorage, default_storage
from storages.backends.s3 import S3Storage


class _B2Storage(S3Storage):
    access_key = settings.B2_KEY_ID
    secret_key = settings.B2_APP_KEY
    endpoint_url = settings.B2_ENDPOINT_URL
    region_name = settings.B2_REGION
    addressing_style = "virtual"
    querystring_auth = False
    file_overwrite = False
    default_acl = None
    signature_version = "s3v4"


class B2PqrsStorage(_B2Storage):
    bucket_name = settings.B2_BUCKET_PQRS


class B2PdmStorage(_B2Storage):
    bucket_name = settings.B2_BUCKET_PDM


b2_pqrs_storage = B2PqrsStorage()
b2_pdm_storage = B2PdmStorage()


def pqrs_file_storage():
    if settings.USE_B2_STORAGE:
        return b2_pqrs_storage
    return default_storage


def pdm_file_storage():
    if settings.USE_B2_STORAGE:
        return b2_pdm_storage
    return default_storage


def pqrs_storage_for_paths() -> B2PqrsStorage | FileSystemStorage:
    """Storage used for PQRS paths stored as plain strings (archivo_respuesta)."""
    if settings.USE_B2_STORAGE:
        return b2_pqrs_storage
    return FileSystemStorage(location=settings.MEDIA_ROOT)
