"""Tests del módulo Asistencia — cross-entity, pairing, inferencia, idempotency."""
from __future__ import annotations

import base64
from io import BytesIO

from django.contrib.auth import get_user_model
from django.core.cache import cache
from django.test import TestCase, override_settings
from PIL import Image
from rest_framework.test import APIClient

from apps.asistencia.device_auth import hash_token
from apps.asistencia.models import EquipoRegistro, Funcionario, RegistroAsistencia, TipoRegistro
from apps.asistencia.services import issue_pairing_code, pair_equipo
from apps.entities.models import Entity, Secretaria

User = get_user_model()

TINY_JPEG_B64 = (
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=="
)


def _make_jpeg_b64() -> str:
    img = Image.new("RGB", (32, 32), color=(120, 160, 200))
    buf = BytesIO()
    img.save(buf, format="JPEG")
    return base64.b64encode(buf.getvalue()).decode()


class AsistenciaModuleTests(TestCase):
    def setUp(self):
        self.entity_a = Entity.objects.create(
            name="Alcaldía A",
            code="A",
            slug="alcaldia-a",
            enable_asistencia=True,
            asistencias_por_dia=2,
        )
        self.entity_b = Entity.objects.create(
            name="Alcaldía B",
            code="B",
            slug="alcaldia-b",
            enable_asistencia=True,
            asistencias_por_dia=4,
        )
        self.admin_a = User.objects.create_user(
            email="admin-a@test.com",
            password="testpass1234",
            full_name="Admin A",
            entity=self.entity_a,
            role="admin",
        )
        self.secretaria_a = Secretaria.objects.create(
            entity=self.entity_a,
            nombre="Talento Humano A",
        )
        self.secretario_a = User.objects.create_user(
            email="sec-a@test.com",
            password="testpass1234",
            full_name="Sec A",
            entity=self.entity_a,
            role="secretario",
            secretaria=self.secretaria_a,
            enabled_modules=["asistencia"],
        )
        self.admin_b = User.objects.create_user(
            email="admin-b@test.com",
            password="testpass1234",
            full_name="Admin B",
            entity=self.entity_b,
            role="admin",
        )
        self.func_a = Funcionario.objects.create(
            entity=self.entity_a,
            cedula="111",
            nombres="Ana",
            apellidos="Pérez",
        )
        self.func_b = Funcionario.objects.create(
            entity=self.entity_b,
            cedula="111",
            nombres="Bob",
            apellidos="López",
        )
        self.equipo_a = EquipoRegistro.objects.create(
            entity=self.entity_a,
            nombre="Recepción",
        )
        self.client = APIClient()

    def test_admin_cannot_see_other_entity_funcionarios(self):
        self.client.force_authenticate(user=self.admin_a)
        res = self.client.get("/api/v1/asistencia/funcionarios")
        self.assertEqual(res.status_code, 200)
        ids = [row["id"] for row in res.data["results"]]
        self.assertIn(self.func_a.id, ids)
        self.assertNotIn(self.func_b.id, ids)

    def test_secretario_without_module_denied(self):
        user = User.objects.create_user(
            email="sec-no@test.com",
            password="testpass1234",
            entity=self.entity_a,
            role="secretario",
            secretaria=self.secretaria_a,
            enabled_modules=[],
        )
        self.client.force_authenticate(user=user)
        res = self.client.get("/api/v1/asistencia/stats")
        self.assertEqual(res.status_code, 403)

    @override_settings(USE_B2_STORAGE=False, ASISTENCIA_PUNCH_COOLDOWN_SECONDS=0)
    def test_pairing_and_punch_sequence_2(self):
        code = issue_pairing_code(self.equipo_a)
        pair_res = self.client.post(
            "/api/v1/public/asistencia/kiosk/pair",
            {"pairing_code": code},
            format="json",
        )
        self.assertEqual(pair_res.status_code, 201)
        token = pair_res.data["device_token"]

        foto = _make_jpeg_b64()
        headers = {"HTTP_AUTHORIZATION": f"Bearer {token}"}

        r1 = self.client.post(
            "/api/v1/public/asistencia/kiosk/registros",
            {
                "cedula": "111",
                "foto_base64": foto,
                "idempotency_key": "key-1",
            },
            format="json",
            **headers,
        )
        self.assertEqual(r1.status_code, 201)
        self.assertEqual(r1.data["registro"]["tipo"], TipoRegistro.ENTRADA)
        token = r1.data.get("device_token", token)
        cache.clear()

        headers = {"HTTP_AUTHORIZATION": f"Bearer {token}"}
        r2 = self.client.post(
            "/api/v1/public/asistencia/kiosk/registros",
            {
                "cedula": "111",
                "foto_base64": foto,
                "idempotency_key": "key-2",
            },
            format="json",
            **headers,
        )
        self.assertEqual(r2.status_code, 201)
        self.assertEqual(r2.data["registro"]["tipo"], TipoRegistro.SALIDA)
        token = r2.data.get("device_token", token)
        cache.clear()

        headers = {"HTTP_AUTHORIZATION": f"Bearer {token}"}
        r3 = self.client.post(
            "/api/v1/public/asistencia/kiosk/registros",
            {
                "cedula": "111",
                "foto_base64": foto,
                "idempotency_key": "key-3",
            },
            format="json",
            **headers,
        )
        self.assertEqual(r3.status_code, 400)

    @override_settings(USE_B2_STORAGE=False)
    def test_idempotency_returns_same_registro(self):
        code = issue_pairing_code(self.equipo_a)
        _, token = pair_equipo(code)
        foto = _make_jpeg_b64()
        payload = {
            "cedula": "111",
            "foto_base64": foto,
            "idempotency_key": "same-key",
        }
        headers = {"HTTP_AUTHORIZATION": f"Bearer {token}"}
        r1 = self.client.post(
            "/api/v1/public/asistencia/kiosk/registros",
            payload,
            format="json",
            **headers,
        )
        self.assertEqual(r1.status_code, 201)
        token = r1.data.get("device_token", token)
        headers = {"HTTP_AUTHORIZATION": f"Bearer {token}"}
        r2 = self.client.post(
            "/api/v1/public/asistencia/kiosk/registros",
            payload,
            format="json",
            **headers,
        )
        self.assertEqual(r2.status_code, 201)
        self.assertEqual(r1.data["registro"]["id"], r2.data["registro"]["id"])
        self.assertEqual(RegistroAsistencia.objects.filter(funcionario=self.func_a).count(), 1)

    @override_settings(USE_B2_STORAGE=False)
    def test_punch_requires_photo(self):
        code = issue_pairing_code(self.equipo_a)
        _, token = pair_equipo(code)
        res = self.client.post(
            "/api/v1/public/asistencia/kiosk/registros",
            {
                "cedula": "111",
                "foto_base64": "",
                "idempotency_key": "no-photo",
            },
            format="json",
            HTTP_AUTHORIZATION=f"Bearer {token}",
        )
        self.assertEqual(res.status_code, 400)

    @override_settings(USE_B2_STORAGE=False, ASISTENCIA_PUNCH_COOLDOWN_SECONDS=0)
    def test_sequence_4_jornada(self):
        equipo = EquipoRegistro.objects.create(entity=self.entity_b, nombre="Kiosk B")
        code = issue_pairing_code(equipo)
        _, token = pair_equipo(code)
        foto = _make_jpeg_b64()
        expected = [
            TipoRegistro.ENTRADA,
            TipoRegistro.SALIDA_ALMUERZO,
            TipoRegistro.RETORNO_ALMUERZO,
            TipoRegistro.SALIDA,
        ]
        for i, tipo in enumerate(expected):
            res = self.client.post(
                "/api/v1/public/asistencia/kiosk/registros",
                {
                    "cedula": "111",
                    "foto_base64": foto,
                    "idempotency_key": f"b-{i}",
                },
                format="json",
                HTTP_AUTHORIZATION=f"Bearer {token}",
            )
            self.assertEqual(res.status_code, 201, res.data)
            self.assertEqual(res.data["registro"]["tipo"], tipo)
            if res.data.get("device_token"):
                token = res.data["device_token"]
            cache.clear()

    def test_revoke_invalidates_token(self):
        raw = "test-device-token"
        self.equipo_a.device_token_hash = hash_token(raw)
        self.equipo_a.save(update_fields=["device_token_hash"])
        res = self.client.get(
            "/api/v1/public/asistencia/kiosk/session",
            HTTP_AUTHORIZATION=f"Bearer {raw}",
        )
        self.assertEqual(res.status_code, 200)
        self.client.force_authenticate(user=self.admin_a)
        self.client.post(f"/api/v1/asistencia/equipos/{self.equipo_a.id}/revoke")
        res2 = self.client.get(
            "/api/v1/public/asistencia/kiosk/session",
            HTTP_AUTHORIZATION=f"Bearer {raw}",
        )
        self.assertEqual(res2.status_code, 401)
