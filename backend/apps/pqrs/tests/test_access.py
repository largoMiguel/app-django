"""Tests de control de acceso PQRS."""
from django.contrib.auth import get_user_model
from django.contrib.auth.models import Group
from django.test import TestCase
from rest_framework.test import APIClient

from apps.common.roles import is_platform_superadmin
from apps.entities.models import Entity, Secretaria
from apps.pqrs.access import pqrs_queryset_for_user, user_can_access_pqrs
from apps.pqrs.models import EstadoPQRS, PQRS

User = get_user_model()


class PQRSAccessTests(TestCase):
    def setUp(self):
        self.entity = Entity.objects.create(name="Test Entity", code="TST", slug="test-entity")
        self.other_entity = Entity.objects.create(name="Other", code="OTH", slug="other")
        self.secretaria = Secretaria.objects.create(entity=self.entity, nombre="Secretaría General")
        self.superadmin = User.objects.create_user(
            email="super@test.com",
            password="testpass1234",
            full_name="Super",
            role="superadmin",
            is_superuser=True,
            is_staff=True,
        )
        Group.objects.get_or_create(name="superadmin")[0].user_set.add(self.superadmin)
        self.admin = User.objects.create_user(
            email="admin@test.com",
            password="testpass1234",
            full_name="Admin",
            entity=self.entity,
            role="admin",
            is_staff=True,
        )
        self.secretario = User.objects.create_user(
            email="sec@test.com",
            password="testpass1234",
            full_name="Secretario",
            entity=self.entity,
            secretaria=self.secretaria,
            role="secretario",
        )
        self.ciudadano = User.objects.create_user(
            email="ciu@test.com",
            password="testpass1234",
            full_name="Ciudadano",
            entity=self.entity,
            role="ciudadano",
        )
        self.other_ciudadano = User.objects.create_user(
            email="otro@test.com",
            password="testpass1234",
            full_name="Otro",
            entity=self.entity,
            role="ciudadano",
        )
        self.pqrs_asignada = PQRS.objects.create(
            entity=self.entity,
            created_by=self.ciudadano,
            assigned_to=self.secretaria,
            numero_radicado="TST-001",
            tipo_solicitud="peticion",
            asunto="Test",
            descripcion="Desc",
            estado=EstadoPQRS.ASIGNADA,
        )
        self.pqrs_propia = PQRS.objects.create(
            entity=self.entity,
            created_by=self.ciudadano,
            numero_radicado="TST-002",
            tipo_solicitud="queja",
            asunto="Propia",
            descripcion="Desc",
            estado=EstadoPQRS.RECIBIDA,
        )
        self.pqrs_ajena = PQRS.objects.create(
            entity=self.entity,
            created_by=self.other_ciudadano,
            numero_radicado="TST-003",
            tipo_solicitud="queja",
            asunto="Ajena",
            descripcion="Desc",
            estado=EstadoPQRS.RECIBIDA,
        )
        self.pqrs_otra_entidad = PQRS.objects.create(
            entity=self.other_entity,
            created_by=self.other_ciudadano,
            numero_radicado="OTH-001",
            tipo_solicitud="peticion",
            asunto="Otra entidad",
            descripcion="Desc",
            estado=EstadoPQRS.RECIBIDA,
        )

    def test_admin_ve_todas_de_su_entidad(self):
        qs = pqrs_queryset_for_user(self.admin, PQRS.objects.all())
        self.assertEqual(qs.count(), 3)

    def test_secretario_solo_ve_asignadas(self):
        qs = pqrs_queryset_for_user(self.secretario, PQRS.objects.all())
        self.assertEqual(list(qs.values_list("numero_radicado", flat=True)), ["TST-001"])

    def test_ciudadano_solo_ve_creadas_por_el(self):
        qs = pqrs_queryset_for_user(self.ciudadano, PQRS.objects.all())
        numeros = set(qs.values_list("numero_radicado", flat=True))
        self.assertEqual(numeros, {"TST-001", "TST-002"})
        self.assertNotIn("TST-003", numeros)

    def test_ciudadano_no_accede_por_email_ajeno(self):
        self.assertFalse(user_can_access_pqrs(self.ciudadano, self.pqrs_ajena))

    def test_ciudadano_accede_solo_por_created_by(self):
        self.assertTrue(user_can_access_pqrs(self.ciudadano, self.pqrs_propia))

    def test_superadmin_no_ve_pqrs(self):
        self.assertTrue(is_platform_superadmin(self.superadmin))
        qs = pqrs_queryset_for_user(self.superadmin, PQRS.objects.all())
        self.assertEqual(qs.count(), 0)
        self.assertFalse(user_can_access_pqrs(self.superadmin, self.pqrs_propia))

    def test_admin_no_ve_pqrs_de_otra_entidad(self):
        qs = pqrs_queryset_for_user(self.admin, PQRS.objects.all())
        numeros = set(qs.values_list("numero_radicado", flat=True))
        self.assertNotIn("OTH-001", numeros)
        self.assertEqual(qs.count(), 3)

    def test_superadmin_api_pqrs_bloqueado(self):
        client = APIClient()
        client.force_authenticate(user=self.superadmin)
        response = client.get("/api/v1/pqrs/")
        self.assertEqual(response.status_code, 403)

    def test_is_superuser_sin_grupo_bloqueado_en_pqrs(self):
        raw_super = User.objects.create_user(
            email="raw@test.com",
            password="testpass1234",
            full_name="Raw",
            entity=self.entity,
            role="admin",
            is_superuser=True,
            is_staff=True,
        )
        self.assertTrue(is_platform_superadmin(raw_super))
        qs = pqrs_queryset_for_user(raw_super, PQRS.objects.all())
        self.assertEqual(qs.count(), 0)
        client = APIClient()
        client.force_authenticate(user=raw_super)
        self.assertEqual(client.get("/api/v1/pqrs/").status_code, 403)

    def test_reports_preview_requiere_modulo_reports(self):
        client = APIClient()
        client.force_authenticate(user=self.admin)
        response = client.get("/api/v1/pqrs/reports-preview/")
        self.assertEqual(response.status_code, 403)

    def test_reports_preview_admin_con_modulo_activo(self):
        self.entity.enable_reports_pdf = True
        self.entity.save(update_fields=["enable_reports_pdf"])
        self.admin.enabled_modules = ["pqrs", "reports_pdf"]
        self.admin.save(update_fields=["enabled_modules"])

        client = APIClient()
        client.force_authenticate(user=self.admin)
        response = client.get("/api/v1/pqrs/reports-preview/")
        self.assertEqual(response.status_code, 200)
        self.assertIn("rows", response.data)
        self.assertIn("stats", response.data)
        self.assertEqual(response.data["total"], 3)
