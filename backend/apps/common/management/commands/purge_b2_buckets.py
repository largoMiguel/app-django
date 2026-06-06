"""Vacía los cubos B2 de la aplicación."""
from __future__ import annotations

from django.core.management.base import BaseCommand, CommandError

from apps.common.b2_client import count_bucket_objects
from apps.common.storage_cleanup import purge_all_buckets


class Command(BaseCommand):
    help = "Elimina todos los objetos de softone-pqrs, softone-pdm y (opcional) softone-db."

    def add_arguments(self, parser):
        parser.add_argument(
            "--keep-db-backups",
            action="store_true",
            help="No vaciar el cubo softone-db",
        )
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Solo muestra conteos actuales",
        )

    def handle(self, *args, **options):
        from django.conf import settings

        if not settings.USE_B2_STORAGE:
            raise CommandError("B2 no configurado.")

        buckets = [settings.B2_BUCKET_PQRS, settings.B2_BUCKET_PDM]
        if not options["keep_db_backups"]:
            buckets.append(settings.B2_BUCKET_DB)

        if options["dry_run"]:
            for bucket in buckets:
                self.stdout.write(f"{bucket}: {count_bucket_objects(bucket)} objeto(s)")
            return

        results = purge_all_buckets(include_db_backups=not options["keep_db_backups"])
        for bucket, count in results.items():
            remaining = count_bucket_objects(bucket)
            self.stdout.write(
                self.style.SUCCESS(f"{bucket}: {count} eliminado(s), {remaining} restante(s)")
            )
