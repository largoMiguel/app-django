"""Tests reconocimiento facial — módulo Asistencia."""
from __future__ import annotations

import base64
from io import BytesIO

from django.contrib.auth import get_user_model
from django.core.cache import cache
from django.test import TestCase, override_settings
from PIL import Image
from rest_framework.test import APIClient

from apps.asistencia.models import EquipoRegistro, Funcionario, FuncionarioFaceTemplate, RegistroAsistencia, TipoRegistro
from apps.asistencia.services import (
    enroll_face_template,
    issue_pairing_code,
    match_funcionario_by_descriptor,
    pair_equipo,
    register_punch_facial,
    remove_face_templates,
)
from apps.entities.models import Entity, Secretaria

User = get_user_model()


def _make_jpeg_b64() -> str:
    img = Image.new("RGB", (32, 32), color=(120, 160, 200))
    buf = BytesIO()
    img.save(buf, format="JPEG")
    return base64.b64encode(buf.getvalue()).decode()


def _descriptor(seed: float = 0.1) -> list[float]:
    return [seed + (i * 0.001) for i in range(128)]


class AsistenciaFacialTests(TestCase):
    def setUp(self):
        self.entity_a = Entity.objects.create(
            name="Alcaldía A",
            code="A",
            slug="alcaldia-a-facial",
            enable_asistencia=True,
            asistencias_por_dia=2,
        )
        self.entity_b = Entity.objects.create(
            name="Alcaldía B",
            code="B",
            slug="alcaldia-b-facial",
            enable_asistencia=True,
            asistencias_por_dia=2,
        )
        self.secretaria_a = Secretaria.objects.create(
            entity=self.entity_a,
            nombre="Talento Humano A",
        )
        self.admin_a = User.objects.create_user(
            email="admin-facial@test.com",
            password="testpass1234",
            full_name="Admin A",
            entity=self.entity_a,
            role="admin",
        )
        self.func_a = Funcionario.objects.create(
            entity=self.entity_a,
            cedula="900",
            nombres="Ana",
            apellidos="Facial",
        )
        self.func_b = Funcionario.objects.create(
            entity=self.entity_b,
            cedula="900",
            nombres="Bob",
            apellidos="Otro",
        )
        self.equipo_a = EquipoRegistro.objects.create(entity=self.entity_a, nombre="Kiosk Facial")
        self.client = APIClient()
        self.foto = _make_jpeg_b64()
        self.descriptor_a = _descriptor(0.1)
        self.descriptor_b = _descriptor(0.9)

    @override_settings(USE_B2_STORAGE=False)
    def test_enroll_creates_template(self):
        self.client.force_authenticate(user=self.admin_a)
        res = self.client.post(
            f"/api/v1/asistencia/funcionarios/{self.func_a.id}/rostro",
            {"descriptor": self.descriptor_a, "foto_base64": self.foto},
            format="json",
        )
        self.assertEqual(res.status_code, 201)
        self.assertTrue(res.data["face_enrolled"])
        self.assertEqual(FuncionarioFaceTemplate.objects.filter(funcionario=self.func_a).count(), 1)

    @override_settings(USE_B2_STORAGE=False)
    def test_match_resolves_funcionario(self):
        enroll_face_template(
            funcionario=self.func_a,
            descriptor=self.descriptor_a,
            foto_base64=self.foto,
        )
        match = match_funcionario_by_descriptor(self.entity_a, self.descriptor_a)
        self.assertIsNotNone(match)
        funcionario, distance = match
        self.assertEqual(funcionario.id, self.func_a.id)
        self.assertLess(distance, 0.6)

    @override_settings(USE_B2_STORAGE=False)
    def test_unknown_face_returns_none(self):
        enroll_face_template(
            funcionario=self.func_a,
            descriptor=self.descriptor_a,
            foto_base64=self.foto,
        )
        match = match_funcionario_by_descriptor(self.entity_a, self.descriptor_b)
        self.assertIsNone(match)

    @override_settings(USE_B2_STORAGE=False)
    def test_entity_isolation_for_match(self):
        enroll_face_template(
            funcionario=self.func_b,
            descriptor=self.descriptor_b,
            foto_base64=self.foto,
        )
        match = match_funcionario_by_descriptor(self.entity_a, self.descriptor_b)
        self.assertIsNone(match)

    @override_settings(USE_B2_STORAGE=False)
    def test_facial_punch_registers_attendance(self):
        enroll_face_template(
            funcionario=self.func_a,
            descriptor=self.descriptor_a,
            foto_base64=self.foto,
        )
        code = issue_pairing_code(self.equipo_a)
        _, token = pair_equipo(code)
        res = self.client.post(
            "/api/v1/public/asistencia/kiosk/registros-facial",
            {
                "descriptor": self.descriptor_a,
                "foto_base64": self.foto,
                "idempotency_key": "facial-1",
                "liveness_passed": True,
            },
            format="json",
            HTTP_AUTHORIZATION=f"Bearer {token}",
        )
        self.assertEqual(res.status_code, 201, res.data)
        self.assertEqual(res.data["registro"]["tipo"], TipoRegistro.ENTRADA)
        self.assertEqual(res.data["funcionario_nombre"], self.func_a.nombre_completo)

    @override_settings(USE_B2_STORAGE=False)
    def test_facial_punch_requires_liveness(self):
        enroll_face_template(
            funcionario=self.func_a,
            descriptor=self.descriptor_a,
            foto_base64=self.foto,
        )
        code = issue_pairing_code(self.equipo_a)
        _, token = pair_equipo(code)
        res = self.client.post(
            "/api/v1/public/asistencia/kiosk/registros-facial",
            {
                "descriptor": self.descriptor_a,
                "foto_base64": self.foto,
                "idempotency_key": "facial-no-live",
                "liveness_passed": False,
            },
            format="json",
            HTTP_AUTHORIZATION=f"Bearer {token}",
        )
        self.assertEqual(res.status_code, 400)

    @override_settings(USE_B2_STORAGE=False)
    def test_facial_punch_unknown_face_404(self):
        code = issue_pairing_code(self.equipo_a)
        _, token = pair_equipo(code)
        res = self.client.post(
            "/api/v1/public/asistencia/kiosk/registros-facial",
            {
                "descriptor": self.descriptor_a,
                "foto_base64": self.foto,
                "idempotency_key": "facial-unknown",
                "liveness_passed": True,
            },
            format="json",
            HTTP_AUTHORIZATION=f"Bearer {token}",
        )
        self.assertEqual(res.status_code, 404)

    @override_settings(USE_B2_STORAGE=False)
    def test_remove_face_templates(self):
        enroll_face_template(
            funcionario=self.func_a,
            descriptor=self.descriptor_a,
            foto_base64=self.foto,
        )
        deleted = remove_face_templates(self.func_a)
        self.assertEqual(deleted, 1)
        self.assertFalse(self.func_a.face_templates.exists())

    @override_settings(USE_B2_STORAGE=False)
    def test_reenroll_after_delete(self):
        enroll_face_template(
            funcionario=self.func_a,
            descriptor=self.descriptor_a,
            foto_base64=self.foto,
        )
        remove_face_templates(self.func_a)
        tpl = enroll_face_template(
            funcionario=self.func_a,
            descriptor=self.descriptor_a,
            foto_base64=self.foto,
        )
        self.assertIsNotNone(tpl.id)
        match = match_funcionario_by_descriptor(self.entity_a, self.descriptor_a)
        self.assertIsNotNone(match)
