"""Sube datos a Backblaze B2 (stdin o archivo local)."""
from __future__ import annotations

import sys

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError

from apps.common.b2_client import get_b2_client, prune_old_objects


class Command(BaseCommand):
    help = "Sube stdin (o --file) a un cubo B2; opcionalmente poda objetos antiguos."

    def add_arguments(self, parser):
        parser.add_argument("--bucket", required=True, help="Nombre del cubo B2")
        parser.add_argument("--key", required=True, help="Clave del objeto en B2")
        parser.add_argument("--file", help="Archivo local (si no se usa stdin)")
        parser.add_argument(
            "--content-type",
            default="application/octet-stream",
            help="Content-Type del objeto",
        )
        parser.add_argument(
            "--prune-days",
            type=int,
            default=0,
            help="Eliminar objetos bajo --prefix más antiguos que N días",
        )
        parser.add_argument(
            "--prefix",
            default="",
            help="Prefijo para poda (ej. backups/)",
        )

    def handle(self, *args, **options):
        if not settings.USE_B2_STORAGE:
            raise CommandError("B2 no configurado (B2_KEY_ID / B2_APP_KEY).")

        bucket = options["bucket"]
        key = options["key"].lstrip("/")
        file_path = options.get("file")

        if file_path:
            with open(file_path, "rb") as fh:
                body = fh.read()
        else:
            body = sys.stdin.buffer.read()

        if not body:
            raise CommandError("No hay datos para subir.")

        client = get_b2_client()
        client.put_object(
            Bucket=bucket,
            Key=key,
            Body=body,
            ContentType=options["content_type"],
        )
        size_mb = len(body) / (1024 * 1024)
        self.stdout.write(self.style.SUCCESS(f"OK: s3://{bucket}/{key} ({size_mb:.2f} MB)"))

        prune_days = options["prune_days"]
        prefix = options["prefix"]
        if prune_days > 0 and prefix:
            removed = prune_old_objects(bucket, prefix, prune_days)
            if removed:
                self.stdout.write(f"Poda: {removed} objeto(s) antiguo(s) eliminado(s).")
