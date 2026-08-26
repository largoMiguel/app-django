"""Tests para compute_pdm_analytics."""
from django.test import TestCase

from apps.entities.models import Entity
from apps.pdm.analytics import compute_pdm_analytics
from apps.pdm.models import PDMEjecucionPresupuestal, PdmProducto


class PdmAnalyticsTests(TestCase):
    def setUp(self):
        self.entity = Entity.objects.create(
            name="Test Entity",
            code="TE",
            slug="test-entity",
            enable_pdm=True,
        )

    def _producto(self, clave: str, codigo: str, sector: str, programacion_2026: float, total_2026: float):
        return PdmProducto.objects.create(
            entity=self.entity,
            clave_producto=clave,
            codigo_producto=codigo,
            sector_mga=sector,
            programacion_2026=programacion_2026,
            total_2026=total_2026,
        )

    def test_productos_al_100_coincide_con_completado(self):
        self._producto("1001", "1001", "Sector A", 10, 100)
        self._producto("1002", "1002", "Sector B", 10, 100)
        qs = PdmProducto.objects.filter(entity=self.entity)
        data = compute_pdm_analytics(qs, self.entity.id, anio=2026)
        assert data["productos_al_100"] == data["estado_distribucion"]["completado"]

    def test_plan_presupuestal_no_duplica_multi_indicador(self):
        self._producto("4003018-400301802", "4003018", "Sector A", 100, 1_000_000)
        self._producto("4003018-400301807", "4003018", "Sector B", 100, 1_000_000)
        PDMEjecucionPresupuestal.objects.create(
            entity=self.entity,
            codigo_producto="4003018",
            descripcion_fte="SGP",
            anio=2026,
            pto_definitivo=500_000,
            pagos=250_000,
        )
        qs = PdmProducto.objects.filter(entity=self.entity)
        data = compute_pdm_analytics(qs, self.entity.id, anio=2026)
        row_2026 = next(r for r in data["presupuestal_por_anio"] if r["anio"] == 2026)
        assert row_2026["plan"] == 1_000_000
        assert row_2026["ejecucion"] == 500_000

    def test_ejecucion_repartida_proporcionalmente_por_sector(self):
        self._producto("4003018-400301802", "4003018", "Sector A", 100, 0)
        self._producto("4003018-400301807", "4003018", "Sector B", 100, 0)
        PDMEjecucionPresupuestal.objects.create(
            entity=self.entity,
            codigo_producto="4003018",
            descripcion_fte="SGP",
            anio=2026,
            pto_definitivo=1_000_000,
            pagos=400_000,
        )
        qs = PdmProducto.objects.filter(entity=self.entity)
        data = compute_pdm_analytics(qs, self.entity.id, anio=2026)
        sectores = {s["sector"]: s for s in data["por_sector_estado"]}
        assert sectores["Sector A"]["pto_definitivo"] == 500_000
        assert sectores["Sector B"]["pto_definitivo"] == 500_000
        assert sum(s["total"] for s in data["por_sector_estado"]) == data["productos_con_meta"]

    def test_total_productos_todos_vs_con_meta(self):
        self._producto("1001", "1001", "Sector A", 100, 0)
        self._producto("1002", "1002", "Sector B", 0, 0)
        qs = PdmProducto.objects.filter(entity=self.entity)
        data = compute_pdm_analytics(qs, self.entity.id, anio=2026)
        assert data["total_productos_todos"] == 2
        assert data["productos_con_meta"] == 1
