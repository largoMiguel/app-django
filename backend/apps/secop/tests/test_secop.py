"""Pruebas del módulo SECOP."""
from __future__ import annotations

from datetime import date, timedelta
from unittest.mock import patch

from django.contrib.auth.models import Group
from django.test import TestCase
from rest_framework.test import APIRequestFactory, force_authenticate

from apps.accounts.models import User
from apps.entities.models import Entity
from apps.secop.access import parse_nits, resolve_nits_secop_i, resolve_nits_secop_ii
from apps.secop.alerts import compute_alerts
from apps.secop.datasets import _dedupe_rows
from apps.secop.normalize import normalize_secop2_contract, normalize_secop2_process
from apps.secop.unify import load_secop2_unified
from apps.secop.views import SecopConfigView


class SecopNormalizeTests(TestCase):
    def test_dedupe_identical_uid_rows(self):
        rows = [{"uid": "a", "x": 1}, {"uid": "a", "x": 1}, {"uid": "b", "x": 2}]
        out = _dedupe_rows(rows, "uid")
        self.assertEqual(len(out), 2)

    def test_unify_links_contract_and_process(self):
        contract_row = {
            "id_contrato": "C1",
            "proceso_de_compra": "P1",
            "referencia_del_contrato": "REF-1",
            "estado_contrato": "En ejecución",
            "valor_del_contrato": "1000",
            "urlproceso": {"url": "https://x?noticeUID=N1"},
        }
        process_row = {
            "id_del_proceso": "PR1",
            "id_del_portafolio": "P1",
            "referencia_del_proceso": "PROC-1",
            "adjudicado": "No",
            "precio_base": "1000",
            "urlproceso": {"url": "https://x?noticeUID=N1"},
        }
        process_only = {
            "id_del_proceso": "PR2",
            "id_del_portafolio": "P2",
            "referencia_del_proceso": "PROC-2",
            "adjudicado": "No",
            "precio_base": "500",
        }

        with patch("apps.secop.unify.fetch_secop2_contracts", return_value=([contract_row], None)):
            with patch("apps.secop.unify.fetch_secop2_processes", return_value=([process_row, process_only], None)):
                with patch("apps.secop.unify.fetch_secop2_processes_by_portfolios", return_value=([], None)):
                    unified, meta = load_secop2_unified(["123"], 2024)

        self.assertEqual(meta["total_unificado"], 2)
        contrato = next(r for r in unified if r["tipo_registro"] == "contrato")
        self.assertEqual(contrato["portfolio_id"], "P1")
        self.assertIn("proceso_vinculado", contrato)
        procesos = [r for r in unified if r["tipo_registro"] == "proceso"]
        self.assertEqual(len(procesos), 1)
        self.assertEqual(procesos[0]["id"], "PR2")

    def test_unify_hides_all_process_phases_when_contract_exists(self):
        contract_row = {
            "id_contrato": "C1",
            "proceso_de_compra": "P1",
            "referencia_del_contrato": "MS-SA-MC-003-2026",
            "estado_contrato": "En ejecución",
            "valor_del_contrato": "1000",
            "urlproceso": {"url": "https://x?noticeUID=N1"},
        }
        process_rows = [
            {
                "id_del_proceso": "PR-A",
                "id_del_portafolio": "P1",
                "referencia_del_proceso": "MS-SA-MC-003-2026",
                "adjudicado": "No",
                "precio_base": "1000",
            },
            {
                "id_del_proceso": "PR-B",
                "id_del_portafolio": "P1",
                "referencia_del_proceso": "MS-SA-MC-003-2026 (Manifestación de interés (Menor Cuantía))",
                "adjudicado": "Si",
                "precio_base": "1000",
                "urlproceso": {"url": "https://x?noticeUID=N1"},
            },
        ]

        with patch("apps.secop.unify.fetch_secop2_contracts", return_value=([contract_row], None)):
            with patch("apps.secop.unify.fetch_secop2_processes", return_value=(process_rows, None)):
                with patch("apps.secop.unify.fetch_secop2_processes_by_portfolios", return_value=([], None)):
                    unified, meta = load_secop2_unified(["123"], 2026)

        self.assertEqual(meta["total_unificado"], 1)
        self.assertEqual(unified[0]["tipo_registro"], "contrato")
        self.assertIn("proceso_vinculado", unified[0])

    def test_unify_dedupes_orphan_process_phases_by_portfolio(self):
        process_rows = [
            {
                "id_del_proceso": "PR-A",
                "id_del_portafolio": "P9",
                "referencia_del_proceso": "PROC-9",
                "adjudicado": "No",
                "precio_base": "100",
            },
            {
                "id_del_proceso": "PR-B",
                "id_del_portafolio": "P9",
                "referencia_del_proceso": "PROC-9 (Fase de Selección)",
                "adjudicado": "Si",
                "precio_base": "100",
            },
        ]

        with patch("apps.secop.unify.fetch_secop2_contracts", return_value=([], None)):
            with patch("apps.secop.unify.fetch_secop2_processes", return_value=(process_rows, None)):
                with patch("apps.secop.unify.fetch_secop2_processes_by_portfolios", return_value=([], None)):
                    unified, meta = load_secop2_unified(["123"], 2026)

        self.assertEqual(meta["total_unificado"], 1)
        self.assertEqual(unified[0]["tipo_registro"], "proceso")
        self.assertEqual(unified[0]["id"], "PR-B")


class SecopAlertsTests(TestCase):
    def test_vencido_en_ejecucion_alert(self):
        fin = (date.today() - timedelta(days=10)).isoformat()
        contrato = normalize_secop2_contract(
            {
                "id_contrato": "C1",
                "referencia_del_contrato": "R1",
                "estado_contrato": "En ejecución",
                "valor_del_contrato": "1000000",
                "fecha_de_fin_del_contrato": f"{fin}T00:00:00.000",
            }
        )
        alerts = compute_alerts([], [contrato], nits_i=["1"], nits_ii=["1"], anio=2024)
        codes = {a["codigo"] for a in alerts}
        self.assertIn("vencido_en_ejecucion", codes)


class SecopAccessTests(TestCase):
    def test_parse_nits_comma_separated(self):
        self.assertEqual(parse_nits("111, 222", "000"), ["111", "222"])

    def test_resolve_nits_fallback(self):
        entity = Entity(name="Test", code="T", slug="test", nit="999")
        self.assertEqual(resolve_nits_secop_i(entity), ["999"])
        entity.nit_secop_ii = "888,777"
        self.assertEqual(resolve_nits_secop_ii(entity), ["888", "777"])


class SecopApiAccessTests(TestCase):
    def setUp(self):
        self.factory = APIRequestFactory()
        self.entity = Entity.objects.create(
            name="Entidad SECOP",
            code="SECOP1",
            slug="entidad-secop",
            nit="891855735",
            enable_contratacion=True,
        )
        self.user = User.objects.create_user(
            email="admin-secop@test.com",
            password="unused",
            entity=self.entity,
        )
        admin_group, _ = Group.objects.get_or_create(name="admin")
        self.user.groups.add(admin_group)

    def test_config_requires_module_enabled(self):
        self.entity.enable_contratacion = False
        self.entity.save()
        request = self.factory.get("/api/v1/secop/config/")
        force_authenticate(request, user=self.user)
        view = SecopConfigView.as_view()
        response = view(request)
        self.assertEqual(response.status_code, 403)

    @patch("apps.secop.views.fetch_available_years_secop1", return_value=([], None))
    @patch("apps.secop.views.fetch_available_years_secop2_contracts", return_value=([], None))
    @patch("apps.secop.views.fetch_available_years_secop2_processes", return_value=([], None))
    def test_config_ok_when_enabled(self, *_mocks):
        request = self.factory.get("/api/v1/secop/config/")
        force_authenticate(request, user=self.user)
        view = SecopConfigView.as_view()
        response = view(request)
        self.assertEqual(response.status_code, 200)
        self.assertIn("nits_resueltos_i", response.data)
