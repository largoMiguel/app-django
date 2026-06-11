"""Tests de documento imprimible estilo Gmail."""
from __future__ import annotations

from datetime import datetime
from zoneinfo import ZoneInfo

from django.test import TestCase

from apps.pqrs.services.email_print import build_gmail_print_html, create_email_print_document


class EmailPrintTests(TestCase):
    def test_build_gmail_print_html_incluye_metadatos(self):
        html = build_gmail_print_html(
            from_name="Juan Ciudadano",
            from_email="juan@example.com",
            to_emails=["gobierno@alcaldia.gov.co"],
            subject="Consulta sobre trámite",
            body="Buenos días,\n\nQuisiera información.",
            date=datetime(2026, 6, 8, 10, 30, tzinfo=ZoneInfo("America/Bogota")),
            radicado="PQRS-1-20260608-001",
        )
        self.assertIn("Consulta sobre trámite", html)
        self.assertIn("juan@example.com", html)
        self.assertIn("gobierno@alcaldia.gov.co", html)
        self.assertIn("Buenos días", html)
        self.assertIn("PQRS-1-20260608-001", html)
        self.assertIn("Google Sans", html)

    def test_create_email_print_document_devuelve_bytes(self):
        content, filename, content_type = create_email_print_document(
            body="Texto del correo",
            subject="Asunto",
            radicado="PQRS-1-20260608-001",
            from_email="a@b.com",
            to_emails=["c@d.com"],
        )
        self.assertTrue(filename.startswith("solicitud_"))
        self.assertIn(content_type, ("application/pdf", "text/html; charset=utf-8"))
        self.assertGreater(len(content), 100)
