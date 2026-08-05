"""Tests de cálculo de avance por evidencias."""
from decimal import Decimal
from unittest import TestCase

from apps.planes.evidencia_sync import compute_avance_pct, parse_meta_programada, total_ejecutado


class MockEvidencia:
    def __init__(self, cantidad):
        self.cantidad_ejecutada = Decimal(str(cantidad))


class MockActividad:
    def __init__(self, meta="", evidencias=None):
        self.meta = meta
        self.evidencias = evidencias or []

    class EvidenciasManager:
        def __init__(self, items):
            self._items = items

        def all(self):
            return self._items

    def __init__(self, meta="", evidencias=None):
        self.meta = meta
        self.evidencias = self.EvidenciasManager(evidencias or [])


class EvidenciaSyncTests(TestCase):
    def test_parse_meta_programada(self):
        self.assertEqual(parse_meta_programada("30"), Decimal("30"))
        self.assertEqual(parse_meta_programada("30 unidades"), Decimal("30"))

    def test_avance_10_de_30(self):
        act = MockActividad(meta="30", evidencias=[MockEvidencia(10)])
        self.assertEqual(compute_avance_pct(act), 33)

    def test_avance_suma_evidencias(self):
        act = MockActividad(
            meta="30",
            evidencias=[MockEvidencia(10), MockEvidencia(5)],
        )
        self.assertEqual(total_ejecutado(act), Decimal("15"))
        self.assertEqual(compute_avance_pct(act), 50)
