"""Tests Correspondencia — cross-entity, permisos, SLA, anexos."""
from __future__ import annotations

from datetime import datetime, timedelta
from io import BytesIO

from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIClient

from apps.correspondencia.models import Correspondencia, EstadoCorrespondencia, SentidoCorrespondencia
from apps.correspondencia.services import compute_fecha_vencimiento, next_numero_radicado
from apps.entities.models import Entity, Secretaria
from apps.pqrs.models import sumar_dias_habiles

User = get_user_model()


@override_settings(
    USE_B2_STORAGE=False,
    FILE_DELIVERY_SIGNING_KEY="",
    MEDIA_ROOT="/tmp/softone-corr-test-media",
)
class CorrespondenciaModuleTests(TestCase):
    def setUp(self):
        self.entity_a = Entity.objects.create(
            name="Alcaldía Corr A",
            code="CA",
            slug="alcaldia-corr-a",
            enable_correspondencia=True,
        )
        self.entity_b = Entity.objects.create(
            name="Alcaldía Corr B",
            code="CB",
            slug="alcaldia-corr-b",
            enable_correspondencia=True,
        )
        self.sec_a = Secretaria.objects.create(entity=self.entity_a, nombre="General A")
        self.sec_a2 = Secretaria.objects.create(entity=self.entity_a, nombre="Hacienda A")
        self.sec_b = Secretaria.objects.create(entity=self.entity_b, nombre="General B")

        self.admin_a = User.objects.create_user(
            email="corr-admin-a@test.com",
            password="testpass1234",
            full_name="Admin A",
            entity=self.entity_a,
            role="admin",
        )
        self.secretario_a = User.objects.create_user(
            email="corr-sec-a@test.com",
            password="testpass1234",
            full_name="Sec A",
            entity=self.entity_a,
            role="secretario",
            secretaria=self.sec_a,
            enabled_modules=["correspondencia"],
        )
        self.admin_b = User.objects.create_user(
            email="corr-admin-b@test.com",
            password="testpass1234",
            full_name="Admin B",
            entity=self.entity_b,
            role="admin",
        )
        self.client = APIClient()

    def _payload(self, **overrides):
        data = {
            "sentido": "entrada",
            "tipologia": "oficio",
            "remitente_nombre": "Ciudadano Pérez",
            "destinatario_nombre": "Alcaldía",
            "canal": "digital",
            "asunto": "Solicitud de información",
            "descripcion": "Detalle",
            "numero_folios": 2,
            "secretaria_id": self.sec_a.id,
            "dias_habiles_respuesta": 10,
        }
        data.update(overrides)
        return data

    def test_sla_dias_habiles(self):
        # Jueves 16 jul 2026 → +1 hábil = viernes 17 (sin festivo en medio)
        jueves = timezone.make_aware(datetime(2026, 7, 16, 10, 0, 0))
        venc = sumar_dias_habiles(jueves, 1)
        self.assertEqual(venc.date().isoformat(), "2026-07-17")
        venc5 = compute_fecha_vencimiento(jueves, 5)
        self.assertGreater(venc5, jueves)

    def test_radicado_sequence(self):
        n1 = next_numero_radicado(self.entity_a.id)
        Correspondencia.objects.create(
            entity=self.entity_a,
            numero_radicado=n1,
            sentido=SentidoCorrespondencia.ENTRADA,
            remitente_nombre="A",
            destinatario_nombre="B",
            canal="digital",
            asunto="x",
            secretaria=self.sec_a,
            fecha_vencimiento=timezone.now() + timedelta(days=10),
            created_by=self.admin_a,
        )
        n2 = next_numero_radicado(self.entity_a.id)
        self.assertNotEqual(n1, n2)
        self.assertTrue(n2.endswith("0002") or int(n2.rsplit("-", 1)[-1]) > 1)

    def test_admin_crea_y_lista(self):
        self.client.force_authenticate(user=self.admin_a)
        res = self.client.post("/api/v1/correspondencia/", self._payload(), format="json")
        self.assertEqual(res.status_code, 201, res.content)
        self.assertTrue(res.data["numero_radicado"].startswith("CORR-"))
        self.assertEqual(res.data["sla_status"], "en_plazo")

        lista = self.client.get("/api/v1/correspondencia/")
        self.assertEqual(lista.status_code, 200)
        self.assertGreaterEqual(lista.data["count"], 1)

    def test_cross_entity_isolation(self):
        self.client.force_authenticate(user=self.admin_a)
        created = self.client.post("/api/v1/correspondencia/", self._payload(), format="json")
        pk = created.data["id"]

        self.client.force_authenticate(user=self.admin_b)
        res = self.client.get(f"/api/v1/correspondencia/{pk}/")
        self.assertIn(res.status_code, (403, 404))

        lista = self.client.get("/api/v1/correspondencia/")
        self.assertEqual(lista.data["count"], 0)

    def test_secretario_scope(self):
        self.client.force_authenticate(user=self.admin_a)
        self.client.post(
            "/api/v1/correspondencia/",
            self._payload(secretaria_id=self.sec_a.id, asunto="Para sec A"),
            format="json",
        )
        self.client.post(
            "/api/v1/correspondencia/",
            self._payload(secretaria_id=self.sec_a2.id, asunto="Para hacienda"),
            format="json",
        )

        self.client.force_authenticate(user=self.secretario_a)
        lista = self.client.get("/api/v1/correspondencia/")
        self.assertEqual(lista.data["count"], 1)
        self.assertEqual(lista.data["results"][0]["asunto"], "Para sec A")

        # No puede radicar en otra secretaría
        bad = self.client.post(
            "/api/v1/correspondencia/",
            self._payload(secretaria_id=self.sec_a2.id),
            format="json",
        )
        self.assertEqual(bad.status_code, 403)

    def test_responder_y_anexo(self):
        self.client.force_authenticate(user=self.admin_a)
        created = self.client.post("/api/v1/correspondencia/", self._payload(), format="json")
        pk = created.data["id"]

        resp = self.client.post(
            f"/api/v1/correspondencia/{pk}/responder/",
            {"respuesta_texto": "Respuesta oficial"},
            format="json",
        )
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.data["estado"], EstadoCorrespondencia.RESPONDIDA)

        upload = SimpleUploadedFile(
            "doc.pdf",
            b"%PDF-1.4 test",
            content_type="application/pdf",
        )
        anexo = self.client.post(
            f"/api/v1/correspondencia/{pk}/anexos/",
            {"tipo": "respuesta", "file": upload},
            format="multipart",
        )
        self.assertEqual(anexo.status_code, 201, anexo.content)
        self.assertEqual(anexo.data["nombre"], "doc.pdf")

    def test_export_excel(self):
        self.client.force_authenticate(user=self.admin_a)
        self.client.post("/api/v1/correspondencia/", self._payload(), format="json")
        res = self.client.get("/api/v1/correspondencia/export/")
        self.assertEqual(res.status_code, 200)
        self.assertIn(
            "spreadsheetml",
            res["Content-Type"],
        )

    def test_canal_correo_requiere_email(self):
        self.client.force_authenticate(user=self.admin_a)
        res = self.client.post(
            "/api/v1/correspondencia/",
            self._payload(canal="correo", contacto_email=""),
            format="json",
        )
        self.assertEqual(res.status_code, 400)
