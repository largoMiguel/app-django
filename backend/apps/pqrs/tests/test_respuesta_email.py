"""Tests de respuesta PQRS por correo (formato Gmail + firma)."""
from __future__ import annotations

from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.test import TestCase

from apps.entities.models import Entity
from apps.pqrs.models import EstadoPQRS, PQRS
from apps.pqrs.services.email import (
    _build_respuesta_bodies,
    _cc_respondedor,
    enviar_respuesta,
)

User = get_user_model()


class RespuestaEmailCcTests(TestCase):
    def setUp(self):
        self.entity = Entity.objects.create(name="Ent", code="E1", slug="ent")
        self.pqrs = PQRS.objects.create(
            entity=self.entity,
            numero_radicado="PQRS-1-20260101-001",
            tipo_solicitud="peticion",
            asunto="Solicitud de información",
            descripcion="Descripción",
            email_ciudadano="ciudadano@test.com",
            estado=EstadoPQRS.ASIGNADA,
        )
        self.admin = User.objects.create_user(
            email="admin@test.com",
            password="testpass1234",
            full_name="Admin",
            entity=self.entity,
            role="admin",
        )
        self.secretario = User.objects.create_user(
            email="sec@test.com",
            password="testpass1234",
            full_name="Sec",
            entity=self.entity,
            role="secretario",
            email_firma="María Pérez\nSecretaría de Gobierno",
        )

    def test_cc_respondedor_admin_y_secretario(self):
        self.assertEqual(_cc_respondedor(self.admin), ["admin@test.com"])
        self.assertEqual(_cc_respondedor(self.secretario), ["sec@test.com"])

    def test_cc_respondedor_ignora_otros_roles(self):
        ciudadano = User.objects.create_user(
            email="otro@test.com",
            password="testpass1234",
            full_name="Otro",
            entity=self.entity,
            role="ciudadano",
        )
        self.assertEqual(_cc_respondedor(ciudadano), [])
        self.assertEqual(_cc_respondedor(None), [])

    def test_build_respuesta_sin_plantilla_ni_firma(self):
        subject, text_body, html_body = _build_respuesta_bodies(
            self.pqrs,
            "Contenido de la respuesta.",
            enviado_por=self.admin,
        )
        self.assertEqual(subject, "Respuesta a su Petición No. PQRS-1-20260101-001")
        self.assertEqual(text_body, "Contenido de la respuesta.")
        self.assertIn("Contenido de la respuesta.", html_body)
        self.assertNotIn("Estimado/a ciudadano/a", html_body)
        self.assertNotIn("sistema de PQRS", html_body)

    def test_build_respuesta_incluye_firma_secretario(self):
        subject, text_body, html_body = _build_respuesta_bodies(
            self.pqrs,
            "Contenido de la respuesta.",
            enviado_por=self.secretario,
        )
        self.assertEqual(subject, "Respuesta a su Petición No. PQRS-1-20260101-001")
        self.assertIn("María Pérez", text_body)
        self.assertIn("Secretaría de Gobierno", text_body)
        self.assertIn("María Pérez", html_body)
        self.assertTrue(text_body.endswith("Secretaría de Gobierno"))
        self.assertNotIn("\n--\n", text_body)
        self.assertNotIn("border-top", html_body)

    @patch("apps.pqrs.services.email._post_zeptomail", return_value=(True, "req-1", None))
    def test_enviar_respuesta_envia_cc_al_respondedor(self, mock_post):
        enviar_respuesta(
            self.pqrs,
            "Respuesta de prueba",
            "ciudadano@test.com",
            enviado_por=self.secretario,
        )
        mock_post.assert_called_once()
        self.assertEqual(mock_post.call_args.kwargs["cc"], ["sec@test.com"])
        self.assertEqual(mock_post.call_args.kwargs["recipients"], ["ciudadano@test.com"])
        html_body = mock_post.call_args.kwargs["html_body"]
        self.assertIn("María Pérez", html_body)

    @patch("apps.pqrs.services.email._post_zeptomail", return_value=(True, "req-1", None))
    def test_enviar_respuesta_sin_duplicar_si_ciudadano_es_el_mismo(self, mock_post):
        self.pqrs.email_ciudadano = "sec@test.com"
        self.pqrs.save(update_fields=["email_ciudadano", "updated_at"])
        enviar_respuesta(
            self.pqrs,
            "Respuesta",
            "sec@test.com",
            enviado_por=self.secretario,
        )
        self.assertEqual(mock_post.call_args.kwargs["recipients"], ["sec@test.com"])
        self.assertEqual(mock_post.call_args.kwargs["cc"], [])
