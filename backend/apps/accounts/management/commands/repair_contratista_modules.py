"""Rellena enabled_modules de contratistas vacíos desde su supervisor."""
from __future__ import annotations

from django.core.management.base import BaseCommand

from apps.accounts.models import UserEntityMembership


class Command(BaseCommand):
    help = "Copia enabled_modules del supervisor a contratistas con lista vacía."

    def add_arguments(self, parser):
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Solo muestra cambios sin guardar.",
        )

    def handle(self, *args, **options):
        dry_run = options["dry_run"]
        repaired = 0
        skipped = 0

        qs = UserEntityMembership.objects.filter(
            role="contratista",
            is_active=True,
            enabled_modules=[],
        ).select_related("supervisor", "entity", "user")

        for membership in qs.iterator():
            if not membership.supervisor_id:
                skipped += 1
                self.stdout.write(
                    f"  SKIP {membership.user.email} — sin supervisor"
                )
                continue

            sup = UserEntityMembership.objects.filter(
                user_id=membership.supervisor_id,
                entity_id=membership.entity_id,
                is_active=True,
            ).first()
            if not sup or not sup.enabled_modules:
                skipped += 1
                self.stdout.write(
                    f"  SKIP {membership.user.email} — supervisor sin módulos"
                )
                continue

            modules = list(sup.enabled_modules)
            self.stdout.write(
                f"  {'[dry-run] ' if dry_run else ''}{membership.user.email}: "
                f"[] → {modules}"
            )
            if not dry_run:
                membership.enabled_modules = modules
                membership.save(update_fields=["enabled_modules", "updated_at"])
            repaired += 1

        self.stdout.write(
            self.style.SUCCESS(
                f"Listo: {repaired} reparados, {skipped} omitidos"
                + (" (dry-run)" if dry_run else "")
            )
        )
