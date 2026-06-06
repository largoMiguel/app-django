"""Migra archivos locales de MEDIA_ROOT a Backblaze B2."""
from __future__ import annotations

import mimetypes
from pathlib import Path

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError

from apps.common.b2_client import get_b2_client
from apps.common.storages import b2_pdm_storage, b2_pqrs_storage


def _bucket_for_key(key: str) -> str | None:
    normalized = key.replace("\\", "/").lstrip("/")
    if normalized.startswith("entities/") and "/pqrs/" in normalized:
        return settings.B2_BUCKET_PQRS
    if normalized.startswith("pqrs/respuestas/"):
        return settings.B2_BUCKET_PQRS
    if normalized.startswith("entities/") and "/pdm/" in normalized:
        return settings.B2_BUCKET_PDM
    return None


class Command(BaseCommand):
    help = "Sube archivos existentes en MEDIA_ROOT al cubo B2 correspondiente (idempotente)."

    def add_arguments(self, parser):
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Solo listar archivos que se subirían",
        )

    def handle(self, *args, **options):
        if not settings.USE_B2_STORAGE:
            raise CommandError("B2 no configurado (B2_KEY_ID / B2_APP_KEY).")

        media_root = Path(settings.MEDIA_ROOT)
        if not media_root.exists():
            self.stdout.write("MEDIA_ROOT no existe; nada que migrar.")
            return

        client = get_b2_client()
        storages = {
            settings.B2_BUCKET_PQRS: b2_pqrs_storage,
            settings.B2_BUCKET_PDM: b2_pdm_storage,
        }

        uploaded = 0
        skipped = 0
        unknown = 0

        for path in sorted(media_root.rglob("*")):
            if not path.is_file():
                continue

            key = path.relative_to(media_root).as_posix()
            bucket = _bucket_for_key(key)
            if bucket is None:
                unknown += 1
                self.stdout.write(self.style.WARNING(f"SKIP (sin cubo): {key}"))
                continue

            storage = storages[bucket]
            if storage.exists(key):
                skipped += 1
                continue

            if options["dry_run"]:
                self.stdout.write(f"DRY-RUN: {bucket}/{key}")
                uploaded += 1
                continue

            content_type = mimetypes.guess_type(path.name)[0] or "application/octet-stream"
            with path.open("rb") as fh:
                client.put_object(
                    Bucket=bucket,
                    Key=key,
                    Body=fh.read(),
                    ContentType=content_type,
                )
            uploaded += 1
            self.stdout.write(f"OK: {bucket}/{key}")

        self.stdout.write(
            self.style.SUCCESS(
                f"Migración completada: {uploaded} subido(s), {skipped} ya existían, {unknown} omitidos."
            )
        )
