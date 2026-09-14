"""Pruebas del módulo SECOP."""
from __future__ import annotations

from datetime import date, timedelta
from unittest.mock import patch

from django.contrib.auth.models import Group
from django.test import TestCase
from rest_framework.test import APIRequestFactory, force_authenticate

from apps.accounts.models import User
from apps.entities.models import Entity
from apps.secop.access import parse_nits, resolve_codigos_secop_ii, resolve_nits_secop_i, resolve_nits_secop_ii
from apps.secop.alerts import compute_alerts
from apps.secop.analytics import agrupar_por_responsable, buckets_vencimiento, compute_avance
from apps.secop.datasets import _dedupe_rows, _entity_where
from apps.secop.enrich import enrich_secop2
from apps.secop.normalize import normalize_secop1, normalize_secop2_contract, normalize_secop2_process
from apps.secop.unify import load_secop2_unified
from apps.secop.views import SecopConfigView


class SecopNormalizeTests(TestCase):
    def setUp(self):
        self.entity = Entity.objects.create(
            name="Entidad Test",
            code="TEST",
            slug="entidad-test",
            nit="800099642",
            secop_ii_codigo_entidad="733689657",
            secop_ii_nombre_entidad="PERSONERIA MUNICIPAL DE TOCA",
        )

    def test_dedupe_identical_uid_rows(self):
        rows = [{"uid": "a", "x": 1}, {"uid": "a", "x": 1}, {"uid": "b", "x": 2}]
        out = _dedupe_rows(rows, "uid")
        self.assertEqual(len(out), 2)

    def test_entity_where_filters_by_codigo(self):
        where = _entity_where(
            ["800099642"],
            nit_field="nit_entidad",
            codigos=["733689657"],
            nombres=None,
            codigo_field="codigo_entidad",
            nombre_field="nombre_entidad",
        )
        self.assertIn("733689657", where)
        self.assertIn("800099642", where)

    def test_secop1_no_fake_pagos(self):
        rec = normalize_secop1({"uid": "1", "cuantia_contrato": "1000", "nombre_entidad": "X"})
        self.assertIsNone(rec["valor_pagado"])
        self.assertFalse(rec["datos_pago_disponibles"])

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
                    with patch("apps.secop.unify.enrich_secop2", side_effect=lambda r: r):
                        unified, meta = load_secop2_unified(self.entity, 2024)

        self.assertEqual(meta["total_unificado"], 2)
        contrato = next(r for r in unified if r["tipo_registro"] == "contrato")
        self.assertEqual(contrato["portfolio_id"], "P1")
        self.assertIn("proceso_vinculado", contrato)
        self.assertEqual(contrato["referencia"], "PROC-1")
        self.assertEqual(contrato["referencia_contrato"], "REF-1")

    def test_enrich_injects_pagos(self):
        rec = normalize_secop2_contract(
            {
                "id_contrato": "C1",
                "referencia_del_contrato": "R1",
                "estado_contrato": "En ejecución",
                "valor_del_contrato": "1000000",
                "valor_pagado": "0",
                "valor_pendiente_de_pago": "1000000",
            }
        )
        with patch("apps.secop.enrich.fetch_secop2_facturas", return_value=([
            {
                "id_contrato": "C1",
                "valor_total": "500000",
                "estado": "Pagado",
                "pago_confirmado": "true",
                "fecha_factura": "2026-01-15",
            }
        ], None)):
            with patch("apps.secop.enrich.fetch_secop2_modificaciones", return_value=([], None)):
                out = enrich_secop2([rec])
        self.assertEqual(out[0]["total_pagado_real"], 500000.0)
        self.assertEqual(len(out[0]["pagos"]), 1)


class SecopAnalyticsTests(TestCase):
    def test_compute_avance(self):
        today = date(2026, 6, 15)
        rec = normalize_secop2_contract(
            {
                "id_contrato": "C1",
                "referencia_del_contrato": "R1",
                "estado_contrato": "En ejecución",
                "valor_del_contrato": "1000",
                "valor_pagado": "500",
                "fecha_de_inicio_del_contrato": "2026-01-01T00:00:00.000",
                "fecha_de_fin_del_contrato": "2026-12-31T00:00:00.000",
            }
        )
        avance = compute_avance(rec, today)
        self.assertIsNotNone(avance["avance_tiempo"])
        self.assertIsNotNone(avance["avance_financiero"])

    def test_agrupar_por_supervisor(self):
        rec = normalize_secop2_contract(
            {
                "id_contrato": "C1",
                "referencia_del_contrato": "R1",
                "estado_contrato": "En ejecución",
                "valor_del_contrato": "1000",
                "nombre_supervisor": "Juan Pérez",
            }
        )
        groups = agrupar_por_responsable([rec], "supervisor")
        self.assertEqual(groups[0]["nombre"], "Juan Pérez")
        self.assertEqual(groups[0]["contratos"], 1)


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

    def test_resolve_nits_from_entity_nit(self):
        entity = Entity(name="Test", code="T", slug="test", nit="999")
        self.assertEqual(resolve_nits_secop_i(entity), ["999"])
        self.assertEqual(resolve_nits_secop_ii(entity), ["999"])

    def test_resolve_codigos(self):
        entity = Entity(
            name="Toca",
            code="TOCA",
            slug="toca",
            nit="800099642",
            secop_ii_codigo_entidad="733689657",
        )
        self.assertEqual(resolve_codigos_secop_ii(entity), ["733689657"])


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


class SecopCopilotTests(TestCase):
    def setUp(self):
        self.entity = Entity.objects.create(
            name="Entidad Copiloto",
            code="COPILOT",
            slug="entidad-copiloto",
            nit="800099642",
            secop_ii_codigo_entidad="733689657",
        )
        self.mock_s2 = [
            {"modalidad": "Contratación directa", "valor": 1000, "fuente": "secop2"},
            {"modalidad": "Contratación directa", "valor": 2000, "fuente": "secop2"},
            {"modalidad": "Licitación pública", "valor": 5000, "fuente": "secop2"},
        ]

    @patch("apps.secop.ai_service.chat_completion")
    @patch("apps.secop.ai_service._load_datasets")
    def test_fast_path_chart_skips_llm(self, mock_load, mock_chat):
        from apps.secop.ai_service import run_secop_copilot

        mock_load.return_value = ([], self.mock_s2)
        result = run_secop_copilot(
            self.entity,
            "Muéstrame un gráfico por modalidad de contratación",
            anio=2026,
        )
        mock_chat.assert_not_called()
        self.assertTrue(result["timing"]["fast_path"])
        self.assertIsNotNone(result["chart"])
        self.assertEqual(result["chart"]["tipo"], "pie")
        self.assertEqual(mock_load.call_count, 1)

    @patch("apps.secop.ai_service.chat_completion")
    @patch("apps.secop.ai_service._load_datasets")
    def test_fast_path_bar_chart_type(self, mock_load, mock_chat):
        from apps.secop.ai_service import run_secop_copilot

        mock_load.return_value = ([], self.mock_s2)
        result = run_secop_copilot(
            self.entity,
            "grafico de barras por modalidad",
            anio=2026,
        )
        mock_chat.assert_not_called()
        self.assertEqual(result["chart"]["tipo"], "bar")

    @patch("apps.secop.ai_service.chat_completion")
    @patch("apps.secop.ai_service._load_datasets")
    def test_fast_path_contract_search(self, mock_load, mock_chat):
        from apps.secop.ai_service import run_secop_copilot

        mock_load.return_value = (
            [],
            [
                {
                    "id": "1",
                    "fuente": "secop2",
                    "referencia": "PMT-001",
                    "numero_proceso": "PMT-001",
                    "proveedor": "MIGUEL LOPEZ",
                    "valor": 5000000,
                    "estado": "En ejecución",
                    "objeto": "Servicios",
                },
            ],
        )
        result = run_secop_copilot(
            self.entity,
            "y de miguel, cuanto vale el contrato",
            anio=2026,
        )
        mock_chat.assert_not_called()
        self.assertTrue(result["timing"]["fast_path"])
        self.assertIn("MIGUEL", result["reply"].upper())
        self.assertEqual(len(result["registros"]), 1)

    @patch("apps.secop.ai_service.chat_completion")
    @patch("apps.secop.ai_service._load_datasets")
    def test_tools_reuse_dataset_cache(self, mock_load, mock_chat):
        from apps.secop.ai_service import CopilotRunContext, execute_tool

        mock_load.return_value = ([], self.mock_s2)
        ctx = CopilotRunContext(self.entity, 2026)
        execute_tool(ctx, "por_modalidad", {"anio": 2026})
        execute_tool(ctx, "top_proveedores", {"anio": 2026, "limite": 3})
        self.assertEqual(mock_load.call_count, 1)
        self.assertGreater(ctx.timing["data_load_ms"], 0)
