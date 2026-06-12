"""Tests de asignación múltiple y adjuntos entrantes."""
from __future__ import annotations

import email
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient

from apps.entities.models import Entity, Secretaria
from apps.pqrs.models import (
    CanalLlegada,
    EstadoCorreoPQRS,
    EstadoPQRS,
    PQRS,
    PQRSArchivo,
    PQRSCorreo,
    TipoCorreoPQRS,
)
from apps.pqrs.services.creation import sincronizar_asignaciones
from apps.pqrs.services.email import _app_base_url, _build_asignacion_bodies
from apps.pqrs.services.inbound import _extract_attachments

User = get_user_model()


def _build_multipart_email(attachments: list[tuple[str, bytes, str]]) -> bytes:
    msg = email.message.EmailMessage()
    msg["Subject"] = "PQRS con adjuntos"
    msg["From"] = "funcionario@entidad.gov.co"
    msg["To"] = "pqrs@entidad.gov.co"
    msg.set_content("Cuerpo de prueba con varios adjuntos.")
    for filename, content, ctype in attachments:
        main, sub = (ctype.split("/", 1) + ["octet-stream"])[:2]
        msg.add_attachment(content, maintype=main, subtype=sub, filename=filename)
    return msg.as_bytes()


class PQRSAssignmentTests(TestCase):
    def setUp(self):
        self.entity = Entity.objects.create(
            name="Entidad Test",
            code="ENT",
            slug="entidad-test",
            enable_pqrs=True,
        )
        self.secretaria_a = Secretaria.objects.create(entity=self.entity, nombre="Secretaría A")
        self.secretaria_b = Secretaria.objects.create(entity=self.entity, nombre="Secretaría B")
        self.admin = User.objects.create_user(
            email="admin@test.com",
            password="testpass1234",
            full_name="Admin",
            entity=self.entity,
            role="admin",
            is_staff=True,
        )
        self.secretario_a = User.objects.create_user(
            email="seca@test.com",
            password="testpass1234",
            full_name="Sec A",
            entity=self.entity,
            secretaria=self.secretaria_a,
            role="secretario",
            enabled_modules=["pqrs"],
        )
        self.secretario_b = User.objects.create_user(
            email="secb@test.com",
            password="testpass1234",
            full_name="Sec B",
            entity=self.entity,
            secretaria=self.secretaria_b,
            role="secretario",
            enabled_modules=["pqrs"],
        )
        self.funcionario_a = User.objects.create_user(
            email="funcionario@test.com",
            password="testpass1234",
            full_name="Funcionario A",
            entity=self.entity,
            secretaria=self.secretaria_a,
            role="admin",
            enabled_modules=["pqrs"],
        )
        self.pqrs = PQRS.objects.create(
            entity=self.entity,
            numero_radicado="PQRS-1-20260101-001",
            tipo_solicitud="peticion",
            asunto="Asunto",
            descripcion="Descripción",
            estado=EstadoPQRS.RECIBIDA,
        )
        self.client = APIClient()
        self.client.force_authenticate(user=self.admin)

    def test_app_base_url_con_cors_lista(self):
        with self.settings(CORS_ALLOWED_ORIGINS=["https://app.softone360.com"], APP_BASE_URL=""):
            self.assertEqual(_app_base_url(), "https://app.softone360.com")

    @patch("apps.pqrs.services.email._post_zeptomail", return_value=(True, "req-asig", None))
    def test_build_asignacion_incluye_enlace_pqrs(self, _mock_mail):
        _, text_body, html_body = _build_asignacion_bodies(
            self.pqrs,
            self.secretaria_a,
            justificacion="Prueba",
        )
        self.assertIn(f"/pqrs?id={self.pqrs.id}", text_body)
        self.assertIn(f"/pqrs?id={self.pqrs.id}", html_body)

    def test_asignar_multiples_secretarias(self):
        response = self.client.post(
            f"/api/v1/pqrs/{self.pqrs.id}/asignar/",
            {"secretaria_ids": [self.secretaria_a.id, self.secretaria_b.id], "justificacion": "Compartida"},
            format="json",
        )
        self.assertEqual(response.status_code, 200)
        self.pqrs.refresh_from_db()
        ids = set(self.pqrs.assigned_secretarias.values_list("id", flat=True))
        self.assertEqual(ids, {self.secretaria_a.id, self.secretaria_b.id})
        self.assertEqual(self.pqrs.assigned_to_id, self.secretaria_a.id)
        self.assertEqual(self.pqrs.estado, EstadoPQRS.ASIGNADA)

    def test_rechazo_parcial_mantiene_otras_secretarias(self):
        sincronizar_asignaciones(
            self.pqrs,
            [self.secretaria_a, self.secretaria_b],
            user=self.admin,
            justificacion="Inicial",
            notificar=False,
        )
        client_b = APIClient()
        client_b.force_authenticate(user=self.secretario_b)
        response = client_b.post(
            f"/api/v1/pqrs/{self.pqrs.id}/rechazar-asignacion/",
            {"motivo": "No es de mi competencia"},
            format="json",
        )
        self.assertEqual(response.status_code, 200)
        self.pqrs.refresh_from_db()
        ids = set(self.pqrs.assigned_secretarias.values_list("id", flat=True))
        self.assertEqual(ids, {self.secretaria_a.id})
        self.assertEqual(self.pqrs.estado, EstadoPQRS.ASIGNADA)

    @patch("apps.pqrs.services.email._post_zeptomail", return_value=(True, "req-asig", None))
    def test_notificacion_asignacion_crea_correo(self, _mock_mail):
        sincronizar_asignaciones(
            self.pqrs,
            [self.secretaria_a],
            user=self.admin,
            justificacion="Asignación manual",
            notificar=True,
        )
        correo = PQRSCorreo.objects.filter(
            pqrs=self.pqrs,
            tipo=TipoCorreoPQRS.ASIGNACION,
        ).first()
        self.assertIsNotNone(correo)
        self.assertEqual(correo.estado, EstadoCorreoPQRS.ENVIADO)
        destinos = {d["email"].lower() for d in correo.destinatarios}
        self.assertIn("seca@test.com", destinos)
        self.assertIn("funcionario@test.com", destinos)

    @patch("apps.pqrs.services.email._post_zeptomail", return_value=(True, "req-asig", None))
    def test_reasignacion_notifica_secretaria_nueva(self, _mock_mail):
        sincronizar_asignaciones(
            self.pqrs,
            [self.secretaria_a],
            user=self.admin,
            justificacion="Inicial",
            notificar=False,
        )
        sincronizar_asignaciones(
            self.pqrs,
            [self.secretaria_b],
            user=self.admin,
            justificacion="Cambio de dependencia",
            notificar=True,
        )
        correos = PQRSCorreo.objects.filter(
            pqrs=self.pqrs,
            tipo=TipoCorreoPQRS.ASIGNACION,
            estado=EstadoCorreoPQRS.ENVIADO,
        )
        self.assertEqual(correos.count(), 1)
        destinos = {d["email"].lower() for correo in correos for d in correo.destinatarios}
        self.assertIn("secb@test.com", destinos)
        self.assertNotIn("seca@test.com", destinos)

    @patch("apps.pqrs.services.email._post_zeptomail", return_value=(True, "req-asig", None))
    def test_reintenta_notificacion_si_ya_estaba_asignada_sin_correo(self, _mock_mail):
        sincronizar_asignaciones(
            self.pqrs,
            [self.secretaria_a],
            user=self.admin,
            justificacion="Asignación IA",
            notificar=False,
        )
        sincronizar_asignaciones(
            self.pqrs,
            [self.secretaria_a],
            user=self.admin,
            justificacion="Confirmación admin",
            notificar=True,
        )
        correo = PQRSCorreo.objects.filter(
            pqrs=self.pqrs,
            tipo=TipoCorreoPQRS.ASIGNACION,
            estado=EstadoCorreoPQRS.ENVIADO,
        ).first()
        self.assertIsNotNone(correo)
        destinos = {d["email"].lower() for d in correo.destinatarios}
        self.assertIn("seca@test.com", destinos)

    @patch("apps.pqrs.services.email._post_zeptomail", return_value=(True, "req-asig", None))
    def test_asignar_api_notifica_secretario(self, _mock_mail):
        response = self.client.post(
            f"/api/v1/pqrs/{self.pqrs.id}/asignar/",
            {"secretaria_ids": [self.secretaria_a.id], "justificacion": "Por admin"},
            format="json",
        )
        self.assertEqual(response.status_code, 200)
        correo = PQRSCorreo.objects.filter(
            pqrs=self.pqrs,
            tipo=TipoCorreoPQRS.ASIGNACION,
            estado=EstadoCorreoPQRS.ENVIADO,
        ).first()
        self.assertIsNotNone(correo)

    def test_secretario_remitente_asigna_su_secretaria(self):
        from apps.pqrs.services.creation import crear_pqrs_desde_ia

        extraido = {
            "tipo_solicitud": "peticion",
            "asunto": "Desde correo",
            "descripcion": "Texto",
            "medio_respuesta": "email",
            "secretaria_ids": [self.secretaria_b.id],
            "secretaria_justificacion": "IA eligió otra",
        }
        pqrs = crear_pqrs_desde_ia(
            self.entity,
            extraido,
            created_by=self.secretario_a,
            canal_llegada=CanalLlegada.EMAIL,
            secretaria_fallback=self.secretaria_a,
            generar_pdf_texto=False,
        )
        ids = set(pqrs.assigned_secretarias.values_list("id", flat=True))
        self.assertEqual(ids, {self.secretaria_a.id})
        self.assertEqual(pqrs.assigned_to_id, self.secretaria_a.id)

    @patch("apps.pqrs.services.email._post_zeptomail", return_value=(True, "req-asig", None))
    def test_secretario_remitente_no_recibe_auto_notificacion(self, mock_mail):
        from apps.pqrs.services.creation import crear_pqrs_desde_ia

        extraido = {
            "tipo_solicitud": "peticion",
            "asunto": "Desde correo",
            "descripcion": "Texto",
            "medio_respuesta": "email",
        }
        pqrs = crear_pqrs_desde_ia(
            self.entity,
            extraido,
            created_by=self.secretario_a,
            canal_llegada=CanalLlegada.EMAIL,
            secretaria_fallback=self.secretaria_a,
            generar_pdf_texto=False,
        )
        mock_mail.assert_called_once()
        correo = PQRSCorreo.objects.filter(
            pqrs=pqrs,
            tipo=TipoCorreoPQRS.ASIGNACION,
            estado=EstadoCorreoPQRS.ENVIADO,
        ).first()
        self.assertIsNotNone(correo)
        destinos = {d["email"].lower() for d in correo.destinatarios}
        self.assertNotIn("seca@test.com", destinos)
        self.assertIn("funcionario@test.com", destinos)

    @patch("apps.pqrs.services.email._post_zeptomail", return_value=(True, "req-asig", None))
    def test_secretario_solo_en_dependencia_no_dispara_correo(self, mock_mail):
        from apps.pqrs.services.creation import crear_pqrs_desde_ia

        User.objects.filter(pk=self.funcionario_a.pk).delete()
        extraido = {
            "tipo_solicitud": "peticion",
            "asunto": "Desde correo",
            "descripcion": "Texto",
            "medio_respuesta": "email",
        }
        pqrs = crear_pqrs_desde_ia(
            self.entity,
            extraido,
            created_by=self.secretario_a,
            canal_llegada=CanalLlegada.EMAIL,
            secretaria_fallback=self.secretaria_a,
            generar_pdf_texto=False,
        )
        mock_mail.assert_not_called()
        self.assertFalse(
            PQRSCorreo.objects.filter(
                pqrs=pqrs,
                tipo=TipoCorreoPQRS.ASIGNACION,
            ).exists()
        )


class PQRSInboundAttachmentsTests(TestCase):
    def test_extract_attachments_sin_tope_de_cuatro(self):
        attachments = [
            (f"archivo{i}.pdf", b"%PDF-1.4 test", "application/pdf")
            for i in range(6)
        ]
        raw = _build_multipart_email(attachments)
        msg = email.message_from_bytes(raw)
        extraidos = _extract_attachments(msg)
        self.assertEqual(len(extraidos), 6)

    def test_extract_attachments_acepta_excel(self):
        attachments = [
            ("datos.xlsx", b"PK\x03\x04 fake xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"),
            ("legacy.xls", b"\xd0\xcf\x11\xe0 fake xls", "application/vnd.ms-excel"),
        ]
        raw = _build_multipart_email(attachments)
        msg = email.message_from_bytes(raw)
        extraidos = _extract_attachments(msg)
        self.assertEqual(len(extraidos), 2)
        nombres = {a[0] for a in extraidos}
        self.assertEqual(nombres, {"datos.xlsx", "legacy.xls"})

    def test_attach_archivos_from_bytes_sin_limite_en_correo(self):
        from apps.pqrs.services.creation import attach_archivos_from_bytes

        entity = Entity.objects.create(name="E", code="E2", slug="e2")
        pqrs = PQRS.objects.create(
            entity=entity,
            numero_radicado="PQRS-2-20260101-001",
            tipo_solicitud="peticion",
            asunto="Adjuntos",
            descripcion="Desc",
            canal_llegada=CanalLlegada.EMAIL,
        )
        files = [(f"doc{i}.txt", b"hola") for i in range(6)]
        attach_archivos_from_bytes(
            pqrs, files, user=None, limit_archivos=False, skip_extension_check=True
        )
        self.assertEqual(pqrs.archivos.count(), 6)
        self.assertGreater(PQRSArchivo.MAX_ARCHIVOS, 0)

    def test_attach_archivos_correo_acepta_excel(self):
        from apps.pqrs.services.creation import attach_archivos_from_bytes

        entity = Entity.objects.create(name="E3", code="E3", slug="e3")
        pqrs = PQRS.objects.create(
            entity=entity,
            numero_radicado="PQRS-3-20260101-001",
            tipo_solicitud="peticion",
            asunto="Excel",
            descripcion="Desc",
            canal_llegada=CanalLlegada.EMAIL,
        )
        files = [("reporte.xlsx", b"PK\x03\x04"), ("notas.xls", b"\xd0\xcf")]
        attach_archivos_from_bytes(
            pqrs, files, user=None, limit_archivos=False, skip_extension_check=True
        )
        self.assertEqual(pqrs.archivos.count(), 2)
        nombres = set(pqrs.archivos.values_list("nombre_original", flat=True))
        self.assertEqual(nombres, {"reporte.xlsx", "notas.xls"})
