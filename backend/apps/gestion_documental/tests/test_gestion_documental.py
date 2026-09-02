"""Pruebas — Gestión documental (cross-entity)."""
from __future__ import annotations

from django.contrib.auth.models import Group
from django.test import TestCase
from rest_framework.test import APIRequestFactory, force_authenticate

from apps.accounts.models import User, UserEntityMembership
from apps.entities.models import Entity, Secretaria
from apps.gestion_documental.models import Expediente, InstrumentoArchivistico, SerieDocumental, TipoInstrumento
from apps.gestion_documental.views import ExpedienteViewSet, InstrumentoViewSet


class GestionDocumentalAccessTests(TestCase):
    def setUp(self):
        self.factory = APIRequestFactory()
        self.entity_a = Entity.objects.create(
            name="Entidad A",
            code="EA",
            slug="entidad-a",
            enable_gestion_documental=True,
        )
        self.entity_b = Entity.objects.create(
            name="Entidad B",
            code="EB",
            slug="entidad-b",
            enable_gestion_documental=True,
        )
        self.secretaria_a = Secretaria.objects.create(entity=self.entity_a, nombre="Archivo")
        self.admin_group = Group.objects.create(name="admin")

        self.admin_a = User.objects.create_user(
            email="admin-a-gd@test.com",
            password="x",
            entity=self.entity_a,
            is_active=True,
        )
        self.admin_a.groups.add(self.admin_group)
        self.admin_b = User.objects.create_user(
            email="admin-b-gd@test.com",
            password="x",
            entity=self.entity_b,
            is_active=True,
        )
        self.admin_b.groups.add(self.admin_group)

        UserEntityMembership.objects.create(user=self.admin_a, entity=self.entity_a, role="admin", is_active=True)
        UserEntityMembership.objects.create(user=self.admin_b, entity=self.entity_b, role="admin", is_active=True)

        self.instrumento_b = InstrumentoArchivistico.objects.create(
            entity=self.entity_b,
            tipo=TipoInstrumento.TRD,
            vigencia=2026,
            titulo="TRD B",
            created_by=self.admin_b,
        )
        self.serie_b = SerieDocumental.objects.create(
            entity=self.entity_b,
            codigo="01.01",
            nombre="Serie B",
        )
        self.expediente_b = Expediente.objects.create(
            entity=self.entity_b,
            codigo="EXP-B-001",
            titulo="Expediente B",
            serie=self.serie_b,
            created_by=self.admin_b,
        )

    def test_admin_cannot_retrieve_other_entity_instrumento(self):
        request = self.factory.get(f"/api/v1/gestion-documental/instrumentos/{self.instrumento_b.id}/")
        force_authenticate(request, user=self.admin_a)
        view = InstrumentoViewSet.as_view({"get": "retrieve"})
        response = view(request, pk=self.instrumento_b.id)
        self.assertEqual(response.status_code, 404)

    def test_admin_cannot_retrieve_other_entity_expediente(self):
        request = self.factory.get(f"/api/v1/gestion-documental/expedientes/{self.expediente_b.id}/")
        force_authenticate(request, user=self.admin_a)
        view = ExpedienteViewSet.as_view({"get": "retrieve"})
        response = view(request, pk=self.expediente_b.id)
        self.assertEqual(response.status_code, 404)

    def test_module_disabled_returns_403(self):
        self.entity_a.enable_gestion_documental = False
        self.entity_a.save(update_fields=["enable_gestion_documental"])
        request = self.factory.get("/api/v1/gestion-documental/stats/")
        force_authenticate(request, user=self.admin_a)
        from apps.gestion_documental.views import GestionDocumentalStatsViewSet

        view = GestionDocumentalStatsViewSet.as_view({"get": "list"})
        response = view(request)
        self.assertEqual(response.status_code, 403)
