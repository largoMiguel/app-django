"""Tests para insights ignorados."""
from django.test import TestCase

from apps.ai.insight_fingerprint import attach_insight_fingerprints, filter_ignored_insights, insight_fingerprint
from apps.ai.models import AIInsightIgnorado
from apps.entities.models import Entity


class InsightFingerprintTests(TestCase):
    def test_fingerprint_estable(self):
        insight = {
            "title": "Divergencia físico/financiero: 4003018",
            "metadata": {"codigo_producto": "4003018"},
        }
        fp1 = insight_fingerprint("pdm", insight)
        fp2 = insight_fingerprint("pdm", insight)
        assert fp1 == fp2
        assert len(fp1) == 40


class InsightIgnoreTests(TestCase):
    def setUp(self):
        self.entity = Entity.objects.create(
            name="Test Entity",
            code="TE",
            slug="test-entity-ai",
            enable_pdm=True,
        )

    def test_filtra_insights_ignorados(self):
        insight = {
            "title": "Test insight",
            "text": "Detalle",
            "severity": "low",
            "metadata": {"codigo_producto": "123"},
        }
        enriched = attach_insight_fingerprints("pdm", [insight])
        fp = enriched[0]["fingerprint"]
        AIInsightIgnorado.objects.create(
            entity=self.entity,
            module="pdm",
            fingerprint=fp,
            title=insight["title"],
        )
        visible = filter_ignored_insights(self.entity.id, "pdm", enriched)
        assert visible == []

    def test_restaurar_insight_permitido(self):
        insight = {"title": "Otro", "metadata": {"codigo_producto": "999"}}
        fp = insight_fingerprint("pdm", insight)
        AIInsightIgnorado.objects.create(
            entity=self.entity,
            module="pdm",
            fingerprint=fp,
            title="Otro",
        )
        deleted, _ = AIInsightIgnorado.objects.filter(
            entity=self.entity,
            module="pdm",
            fingerprint=fp,
        ).delete()
        assert deleted == 1
