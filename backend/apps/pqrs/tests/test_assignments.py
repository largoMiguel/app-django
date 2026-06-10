"""Tests de asignación múltiple y adjuntos entrantes."""
from __future__ import annotations

import email
from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient

from apps.entities.models import Entity, Secretaria
from apps.pqrs.models import (
    CanalLlegada,
    EstadoPQRS,
    PQRS,
    PQRSArchivo,
    PQRSCorreo,
    TipoCorreoPQRS,
)
from apps.pqrs.services.creation import sincronizar_asignaciones
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

    def test_notificacion_asignacion_crea_correo(self):
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
        destinos = {d["email"].lower() for d in correo.destinatarios}
        self.assertIn("seca@test.com", destinos)


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
        attach_archivos_from_bytes(pqrs, files, user=None, limit_archivos=False)
        self.assertEqual(pqrs.archivos.count(), 6)
        self.assertGreater(PQRSArchivo.MAX_ARCHIVOS, 0)
