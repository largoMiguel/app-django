"""Tests de consistencia de sumas en ejecución presupuestal PDM."""
from django.contrib.auth import get_user_model
from django.test import TestCase

from apps.entities.models import Entity
from apps.pdm.analytics import compute_pdm_analytics
from apps.pdm.access import productos_queryset_for_user
from apps.pdm.ejecucion_resumen import resumen_ejecucion_entidad
from apps.pdm.models import PDMEjecucionPresupuestal, PdmProducto

User = get_user_model()


class PdmEjecucionSumasTests(TestCase):
    def setUp(self):
        self.entity = Entity.objects.create(name="PDM Test", code="PDM", slug="pdm-test")
        self.admin = User.objects.create_user(
            email="pdm-admin@test.com",
            password="testpass1234",
            full_name="Admin PDM",
            entity=self.entity,
            role="admin",
            is_staff=True,
        )
        self.producto_con_meta = PdmProducto.objects.create(
            entity=self.entity,
            codigo_producto="P001",
            linea_estrategica="Línea A",
            sector_mga="Sector X",
            programacion_2024=10,
            total_2024=1_000_000,
            total_2025=500_000,
        )
        PdmProducto.objects.create(
            entity=self.entity,
            codigo_producto="P002",
            linea_estrategica="Línea B",
            sector_mga="Sector Y",
        )
        self._crear_ejecucion("P001", 2024, pto_definitivo=100, pagos=40)
        self._crear_ejecucion("P001", 2025, pto_definitivo=200, pagos=80)
        self._crear_ejecucion("P002", 2024, pto_definitivo=50, pagos=10)
        self._crear_ejecucion("HUERFANO", 2024, pto_definitivo=999, pagos=999)

    def _crear_ejecucion(self, codigo: str, anio: int, *, pto_definitivo: float, pagos: float) -> None:
        PDMEjecucionPresupuestal.objects.create(
            entity=self.entity,
            codigo_producto=codigo,
            descripcion_fte="Fuente 1",
            anio=anio,
            pto_definitivo=pto_definitivo,
            pagos=pagos,
        )

    def test_resumen_dashboard_solo_productos_en_plan(self):
        resumen = resumen_ejecucion_entidad(self.admin, self.entity)

        self.assertEqual(resumen["totales"]["pto_definitivo"], 350.0)
        self.assertEqual(resumen["totales"]["pagos"], 130.0)
        self.assertEqual(resumen["totales_incluye_huerfanos"]["pto_definitivo"], 1349.0)

        suma_anios_pto = sum(item["pto_definitivo"] for item in resumen["anios"])
        suma_anios_pagos = sum(item["pagos"] for item in resumen["anios"])
        self.assertEqual(suma_anios_pto, resumen["totales"]["pto_definitivo"])
        self.assertEqual(suma_anios_pagos, resumen["totales"]["pagos"])

        suma_lineas = sum(item["total"] for item in resumen["ejecucion_por_linea"])
        self.assertEqual(suma_lineas, resumen["totales_incluye_huerfanos"]["pto_definitivo"])

        suma_lineas_en_plan = sum(
            item["total"]
            for item in resumen["ejecucion_por_linea"]
            if item["linea"] != "Sin producto en plan"
        )
        self.assertEqual(suma_lineas_en_plan, resumen["totales"]["pto_definitivo"])

    def test_analisis_cuatrienio_coincide_con_dashboard(self):
        productos_qs = productos_queryset_for_user(self.admin, self.entity)
        analisis = compute_pdm_analytics(productos_qs, self.entity.id, anio=None)
        resumen = resumen_ejecucion_entidad(self.admin, self.entity)

        self.assertEqual(analisis["presupuesto"]["pto_definitivo"], resumen["totales"]["pto_definitivo"])
        self.assertEqual(analisis["presupuesto"]["pagos"], resumen["totales"]["pagos"])

        suma_presupuestal = sum(row["ejecucion"] for row in analisis["presupuestal_por_anio"])
        suma_pagos = sum(row["pagos"] for row in analisis["presupuestal_por_anio"])
        self.assertEqual(suma_presupuestal, analisis["presupuesto"]["pto_definitivo"])
        self.assertEqual(suma_pagos, analisis["presupuesto"]["pagos"])

        suma_sector_pto = sum(row["pto_definitivo"] for row in analisis["por_sector_estado"])
        suma_sector_pagos = sum(row["pagos"] for row in analisis["por_sector_estado"])
        self.assertEqual(suma_sector_pto, analisis["presupuesto"]["pto_definitivo"])
        self.assertEqual(suma_sector_pagos, analisis["presupuesto"]["pagos"])

    def test_analisis_anio_filtrado_suma_por_anio(self):
        productos_qs = productos_queryset_for_user(self.admin, self.entity)
        analisis = compute_pdm_analytics(productos_qs, self.entity.id, anio=2024)

        self.assertEqual(analisis["presupuesto"]["pto_definitivo"], 150.0)
        self.assertEqual(analisis["presupuesto"]["pagos"], 50.0)

        fila_2024 = next(row for row in analisis["presupuestal_por_anio"] if row["anio"] == 2024)
        self.assertEqual(fila_2024["ejecucion"], 150.0)
        self.assertEqual(fila_2024["pagos"], 50.0)
