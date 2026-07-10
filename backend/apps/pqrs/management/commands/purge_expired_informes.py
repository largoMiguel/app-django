"""Purga informes PQRS expirados (cron)."""
from __future__ import annotations

from django.core.management.base import BaseCommand

from apps.pqrs.models import InformePQRS


class Command(BaseCommand):
    help = "Elimina informes PQRS expirados y sus archivos en B2."

    def handle(self, *args, **options):
        deleted = InformePQRS.purge_expired()
        self.stdout.write(self.style.SUCCESS(f"Informes expirados eliminados: {deleted}"))
