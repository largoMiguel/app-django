"""Pruebas del módulo Planes Institucionales."""
from __future__ import annotations

from django.contrib.auth.models import Group
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase
from rest_framework.test import APIRequestFactory, force_authenticate

from apps.accounts.models import User, UserEntityMembership
from apps.entities.models import Entity, Secretaria
from apps.planes.models import PlanActividad, PlanCatalogo, PlanInstitucional
from apps.planes.validators import MAX_EVIDENCIA_ARCHIVOS, validate_evidencia_archivo
from apps.planes.views import PlanActividadViewSet, PlanViewSet
from rest_framework.exceptions import ValidationError


class PlanesValidatorTests(TestCase):
    def test_rejects_invalid_extension(self):
        with self.assertRaises(ValidationError):
            validate_evidencia_archivo("virus.exe", 100)

    def test_accepts_pdf(self):
        validate_evidencia_archivo("informe.pdf", 1024)


class PlanesAccessTests(TestCase):
    def setUp(self):
        self.factory = APIRequestFactory()
        self.entity_a = Entity.objects.create(name="Entidad A", code="EA", slug="entidad-a", enable_planes_institucionales=True)
        self.entity_b = Entity.objects.create(name="Entidad B", code="EB", slug="entidad-b", enable_planes_institucionales=True)
        self.secretaria_a = Secretaria.objects.create(entity=self.entity_a, nombre="Planeación")
        self.admin_group = Group.objects.create(name="admin")

        self.admin_a = User.objects.create_user(
            email="admin-a@test.com",
            password="x",
            entity=self.entity_a,
            is_active=True,
        )
        self.admin_a.groups.add(self.admin_group)

        self.admin_b = User.objects.create_user(
            email="admin-b@test.com",
            password="x",
            entity=self.entity_b,
            is_active=True,
        )
        self.admin_b.groups.add(self.admin_group)

        UserEntityMembership.objects.create(user=self.admin_a, entity=self.entity_a, role="admin", is_active=True)
        UserEntityMembership.objects.create(user=self.admin_b, entity=self.entity_b, role="admin", is_active=True)

        self.catalogo = PlanCatalogo.objects.create(
            entity=None,
            codigo="pinar_test",
            nombre="PINAR Test",
            orden=1,
            es_decreto612=True,
        )
        self.plan_a = PlanInstitucional.objects.create(
            entity=self.entity_a,
            catalogo=self.catalogo,
            anio=2026,
            responsable_secretaria=self.secretaria_a,
            responsable_secretaria_nombre=self.secretaria_a.nombre,
            created_by=self.admin_a,
        )
        self.plan_b = PlanInstitucional.objects.create(
            entity=self.entity_b,
            catalogo=self.catalogo,
            anio=2026,
            created_by=self.admin_b,
        )

    def test_admin_cannot_retrieve_other_entity_plan(self):
        request = self.factory.get(f"/api/v1/planes/{self.plan_b.id}/")
        force_authenticate(request, user=self.admin_a)
        view = PlanViewSet.as_view({"get": "retrieve"})
        response = view(request, pk=self.plan_b.id)
        self.assertEqual(response.status_code, 404)

    def test_admin_lists_only_own_entity_plans(self):
        request = self.factory.get("/api/v1/planes/")
        force_authenticate(request, user=self.admin_a)
        view = PlanViewSet.as_view({"get": "list"})
        response = view(request)
        self.assertEqual(response.status_code, 200)
        ids = [item["id"] for item in response.data["results"]]
        self.assertIn(self.plan_a.id, ids)
        self.assertNotIn(self.plan_b.id, ids)

    def test_create_actividad_accepts_json(self):
        payload = {
            "plan": self.plan_a.id,
            "anio": 2026,
            "trimestre": 1,
            "nombre": "Capacitación TH",
            "meta": "30",
            "descripcion": "Capacitación a talento humano",
        }
        request = self.factory.post("/api/v1/planes/actividades/", payload, format="json")
        force_authenticate(request, user=self.admin_a)
        view = PlanActividadViewSet.as_view({"post": "create"})
        response = view(request)
        self.assertEqual(response.status_code, 201, response.data)
        self.assertEqual(response.data["nombre"], "Capacitación TH")

    def test_create_actividad_for_own_plan(self):
        payload = {
            "plan": self.plan_a.id,
            "anio": 2026,
            "trimestre": 1,
            "nombre": "Actividad trimestre I",
            "meta": "10",
            "responsable_secretaria": self.secretaria_a.id,
        }
        request = self.factory.post("/api/v1/planes/actividades/", payload, format="json")
        force_authenticate(request, user=self.admin_a)
        view = PlanActividadViewSet.as_view({"post": "create"})
        response = view(request)
        self.assertEqual(response.status_code, 201)
        self.assertTrue(
            PlanActividad.objects.filter(entity=self.entity_a, plan=self.plan_a, nombre="Actividad trimestre I").exists()
        )

    def test_evidencia_requires_file_or_url(self):
        actividad = PlanActividad.objects.create(
            entity=self.entity_a,
            plan=self.plan_a,
            anio=2026,
            trimestre=1,
            nombre="Sin evidencia",
            responsable_secretaria=self.secretaria_a,
        )
        request = self.factory.post(
            f"/api/v1/planes/actividades/{actividad.id}/evidencia/",
            {"descripcion": "Evidencia vacía", "cantidad_ejecutada": "5"},
            format="multipart",
        )
        force_authenticate(request, user=self.admin_a)
        view = PlanActividadViewSet.as_view({"post": "evidencia"})
        response = view(request, pk=actividad.id)
        self.assertEqual(response.status_code, 400)

    def test_evidencia_accepts_pdf_upload(self):
        actividad = PlanActividad.objects.create(
            entity=self.entity_a,
            plan=self.plan_a,
            anio=2026,
            trimestre=2,
            nombre="Con evidencia",
            meta="30",
            responsable_secretaria=self.secretaria_a,
        )
        pdf = SimpleUploadedFile("informe.pdf", b"%PDF-1.4 test", content_type="application/pdf")
        request = self.factory.post(
            f"/api/v1/planes/actividades/{actividad.id}/evidencia/",
            {"descripcion": "Informe trimestral", "cantidad_ejecutada": "10", "archivos": pdf},
            format="multipart",
        )
        force_authenticate(request, user=self.admin_a)
        view = PlanActividadViewSet.as_view({"post": "evidencia"})
        response = view(request, pk=actividad.id)
        self.assertEqual(response.status_code, 201)
        actividad.refresh_from_db()
        self.assertEqual(actividad.avance, 33)
        self.assertEqual(actividad.estado, "EN_PROGRESO")

    def test_admin_can_create_custom_catalogo(self):
        payload = {
            "codigo": "plan_propio_test",
            "nombre": "Plan estratégico interno",
            "descripcion": "Plan propio de la entidad",
        }
        request = self.factory.post("/api/v1/planes/catalogo/", payload, format="json")
        force_authenticate(request, user=self.admin_a)
        from apps.planes.views import PlanCatalogoViewSet

        view = PlanCatalogoViewSet.as_view({"post": "create"})
        response = view(request)
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data["nombre"], "Plan estratégico interno")
        self.assertFalse(response.data["es_decreto612"])
        self.assertEqual(response.data["entity"], self.entity_a.id)

    def test_retrieve_plan_without_actividades(self):
        request = self.factory.get(f"/api/v1/planes/{self.plan_a.id}/")
        force_authenticate(request, user=self.admin_a)
        view = PlanViewSet.as_view({"get": "retrieve"})
        response = view(request, pk=self.plan_a.id)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["actividades"], [])
        self.assertEqual(len(response.data["resumen_por_trimestre"]), 4)

    def test_detail_serializer_prefetched_actividad_without_evidencia(self):
        from apps.planes.access import actividades_queryset_for_user
        from apps.planes.serializers import PlanDetailSerializer
        from apps.planes.stats import build_resumen_por_trimestre

        PlanActividad.objects.create(
            entity=self.entity_a,
            plan=self.plan_a,
            anio=2026,
            trimestre=4,
            nombre="Prefetch sin evidencia",
            responsable_secretaria=self.secretaria_a,
        )
        actividades = list(
            actividades_queryset_for_user(self.admin_a, self.entity_a).filter(plan=self.plan_a)
        )
        resumen = build_resumen_por_trimestre(self.plan_a, actividades)
        data = PlanDetailSerializer(
            self.plan_a,
            context={
                "actividades_detail": actividades,
                "resumen_por_trimestre": resumen,
            },
        ).data
        self.assertEqual(len(data["actividades"]), 1)
        self.assertEqual(data["actividades"][0]["evidencias"], [])
        self.assertFalse(data["actividades"][0]["tiene_evidencia"])

    def test_admin_can_retrieve_plan_detail(self):
        request = self.factory.get(f"/api/v1/planes/{self.plan_a.id}/")
        force_authenticate(request, user=self.admin_a)
        view = PlanViewSet.as_view({"get": "retrieve"})
        response = view(request, pk=self.plan_a.id)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["id"], self.plan_a.id)
        self.assertEqual(response.data["nombre"], self.catalogo.nombre)
        self.assertIn("actividades", response.data)
        self.assertIn("resumen_por_trimestre", response.data)

    def test_retrieve_plan_with_actividad_without_evidencia(self):
        PlanActividad.objects.create(
            entity=self.entity_a,
            plan=self.plan_a,
            anio=2026,
            trimestre=2,
            nombre="Actividad sin evidencia",
            responsable_secretaria=self.secretaria_a,
        )
        request = self.factory.get(f"/api/v1/planes/{self.plan_a.id}/")
        force_authenticate(request, user=self.admin_a)
        view = PlanViewSet.as_view({"get": "retrieve"})
        response = view(request, pk=self.plan_a.id)
        self.assertEqual(response.status_code, 200)
        actividades = response.data["actividades"]
        self.assertEqual(len(actividades), 1)
        self.assertEqual(actividades[0]["evidencias"], [])
        self.assertFalse(actividades[0]["tiene_evidencia"])

    def test_actividad_retrieve_without_evidencia(self):
        actividad = PlanActividad.objects.create(
            entity=self.entity_a,
            plan=self.plan_a,
            anio=2026,
            trimestre=3,
            nombre="Detalle sin evidencia",
            responsable_secretaria=self.secretaria_a,
        )
        request = self.factory.get(f"/api/v1/planes/actividades/{actividad.id}/")
        force_authenticate(request, user=self.admin_a)
        view = PlanActividadViewSet.as_view({"get": "retrieve"})
        response = view(request, pk=actividad.id)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["evidencias"], [])
        self.assertFalse(response.data["tiene_evidencia"])

    def test_attach_metrics_on_list_not_queryset(self):
        actividad = PlanActividad.objects.create(
            entity=self.entity_a,
            plan=self.plan_a,
            anio=2026,
            trimestre=1,
            nombre="Con avance",
            avance=50,
            responsable_secretaria=self.secretaria_a,
        )
        from apps.planes.stats import attach_plan_list_metrics

        page = [self.plan_a]
        attach_plan_list_metrics(page, self.admin_a, self.entity_a)
        self.assertEqual(page[0].actividades_count, 1)
        self.assertEqual(page[0].avance_promedio, 50.0)
