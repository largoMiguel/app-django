"""Tests de agregados PQRS (dashboard stats)."""
from datetime import timedelta

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone

from apps.entities.models import Entity
from apps.pqrs.access import pqrs_queryset_for_user
from apps.pqrs.models import EstadoPQRS, PQRS
from apps.pqrs.stats import compute_pqrs_stats

User = get_user_model()


class PQRSStatsTests(TestCase):
    def setUp(self):
        self.entity = Entity.objects.create(name="Stats Entity", code="STT", slug="stats-entity")
        self.admin = User.objects.create_user(
            email="admin-stats@test.com",
            password="testpass1234",
            full_name="Admin Stats",
            entity=self.entity,
            role="admin",
            is_staff=True,
        )
        for i, estado in enumerate(
            [EstadoPQRS.ASIGNADA, EstadoPQRS.ASIGNADA, EstadoPQRS.RESPONDIDA, EstadoPQRS.CERRADA]
        ):
            PQRS.objects.create(
                entity=self.entity,
                numero_radicado=f"STT-2026010100{i}",
                asunto=f"Asunto {i}",
                estado=estado,
            )

    def test_stats_with_order_by_matches_totals(self):
        base = PQRS.objects.filter(entity=self.entity)
        qs = pqrs_queryset_for_user(self.admin, base).order_by("-fecha_solicitud", "-id")
        stats = compute_pqrs_stats(qs, self.admin)
        self.assertEqual(stats["total"], 4)
        self.assertEqual(stats["respondidas"], 1)
        self.assertEqual(stats["cerradas"], 1)
        self.assertEqual(stats["pendientes"], 2)
        self.assertEqual(stats["by_estado"][EstadoPQRS.ASIGNADA], 2)
        self.assertEqual(
            stats["respondidas"] + stats["cerradas"] + stats["pendientes"],
            stats["total"],
        )

    def test_alerta_sla_counts_open_near_due(self):
        now = timezone.now()
        PQRS.objects.create(
            entity=self.entity,
            numero_radicado="STT-ALERTA-001",
            asunto="Vence pronto",
            estado=EstadoPQRS.ASIGNADA,
            fecha_vencimiento=now + timedelta(days=3),
        )
        PQRS.objects.create(
            entity=self.entity,
            numero_radicado="STT-ALERTA-002",
            asunto="Ya respondida",
            estado=EstadoPQRS.RESPONDIDA,
            fecha_vencimiento=now + timedelta(days=1),
        )
        base = PQRS.objects.filter(entity=self.entity)
        qs = pqrs_queryset_for_user(self.admin, base).order_by("-fecha_solicitud")
        stats = compute_pqrs_stats(qs, self.admin)
        self.assertEqual(stats["alerta_count"], 1)
        self.assertEqual(stats["vencidas_count"], 0)
