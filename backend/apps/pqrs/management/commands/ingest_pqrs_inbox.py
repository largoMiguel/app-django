"""Ingesta correos PQRS desde buzón IMAP (Zoho)."""
from __future__ import annotations

import imaplib
import logging
import ssl

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError

from apps.pqrs.services.inbound import parse_email_message, procesar_correo

logger = logging.getLogger(__name__)


class Command(BaseCommand):
    help = "Lee correos no leídos del buzón PQRS y crea radicados automáticamente."

    def add_arguments(self, parser):
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Solo lista correos UNSEEN sin procesarlos ni marcarlos.",
        )

    def handle(self, *args, **options):
        if not getattr(settings, "PQRS_INBOUND_ENABLED", False):
            self.stdout.write("PQRS inbound deshabilitado (PQRS_INBOUND_ENABLED=false).")
            return

        host = settings.IMAP_HOST
        port = int(settings.IMAP_PORT)
        user = settings.IMAP_USER
        password = settings.IMAP_PASSWORD
        mailbox = settings.IMAP_MAILBOX or "INBOX"

        if not all([host, user, password]):
            raise CommandError("IMAP_HOST, IMAP_USER e IMAP_PASSWORD son obligatorios.")

        context = ssl.create_default_context()
        mail = imaplib.IMAP4_SSL(host, port, ssl_context=context)
        try:
            mail.login(user, password)
            status, _ = mail.select(mailbox, readonly=options["dry_run"])
            if status != "OK":
                raise CommandError(f"No se pudo abrir buzón {mailbox}.")

            status, data = mail.search(None, "UNSEEN")
            if status != "OK":
                raise CommandError("Error buscando correos UNSEEN.")

            ids = (data[0] or b"").split()
            self.stdout.write(f"Correos UNSEEN: {len(ids)}")

            procesados = 0
            ignorados = 0
            errores = 0

            for num in ids:
                status, fetched = mail.fetch(num, "(RFC822)")
                if status != "OK" or not fetched or not fetched[0]:
                    errores += 1
                    continue
                raw = fetched[0][1]
                if not isinstance(raw, (bytes, bytearray)):
                    errores += 1
                    continue

                parsed = parse_email_message(bytes(raw))
                if options["dry_run"]:
                    self.stdout.write(f"  [dry-run] {parsed.remitente} — {parsed.asunto[:80]}")
                    continue

                result = procesar_correo(parsed)
                if result.estado == "procesado":
                    procesados += 1
                    self.stdout.write(self.style.SUCCESS(
                        f"  OK {parsed.remitente} → {result.pqrs.numero_radicado if result.pqrs else '?'}"
                    ))
                elif result.estado.startswith("ignorado"):
                    ignorados += 1
                    self.stdout.write(f"  IGNORADO {parsed.remitente}: {result.motivo}")
                else:
                    errores += 1
                    self.stdout.write(self.style.WARNING(
                        f"  ERROR {parsed.remitente}: {result.motivo}"
                    ))

                mail.store(num, "+FLAGS", "\\Seen")

            if not options["dry_run"]:
                self.stdout.write(
                    f"Resumen: procesados={procesados}, ignorados={ignorados}, errores={errores}"
                )
        finally:
            try:
                mail.logout()
            except Exception:  # noqa: BLE001
                pass
