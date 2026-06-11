"""Ejecuta tareas Celery de alertas IA (SLA PQRS y anomalías PDM)."""
from django.core.management.base import BaseCommand

from apps.ai.models import AIAlert
from apps.ai.tasks import compute_all_sla_risk_scores, detect_all_pdm_anomalies


class Command(BaseCommand):
    help = "Genera alertas IA (equivalente a Celery Beat 6:00 y 6:30)"

    def add_arguments(self, parser):
        parser.add_argument("--entity-id", type=int, help="Solo esta entidad")

    def handle(self, *args, **options):
        entity_id = options.get("entity_id")
        if entity_id:
            from apps.ai.services.pqrs_compliance import compute_sla_risk_scores
            from apps.ai.services.pdm_anomalies import detect_pdm_anomalies
            from apps.entities.models import Entity

            entity = Entity.objects.filter(id=entity_id).first()
            if not entity:
                self.stderr.write("Entidad no encontrada.")
                return
            if entity.enable_pqrs:
                risks = compute_sla_risk_scores(entity_id)
                high = [r for r in risks if r["risk_score"] >= 50]
                self.stdout.write(f"PQRS riesgos SLA ≥50: {len(high)}")
                compute_all_sla_risk_scores()
            if entity.enable_pdm:
                anomalies = detect_pdm_anomalies(entity_id)
                high = [a for a in anomalies if a.get("score", 0) >= 50]
                self.stdout.write(f"PDM anomalías ≥50: {len(high)}")
                detect_all_pdm_anomalies()
        else:
            compute_all_sla_risk_scores()
            detect_all_pdm_anomalies()

        pqrs_count = AIAlert.objects.filter(
            alert_type="pqrs_sla_risk",
            is_dismissed=False,
        ).count()
        pdm_count = AIAlert.objects.filter(
            alert_type="pdm_anomaly",
            is_dismissed=False,
        ).count()
        self.stdout.write(self.style.SUCCESS(
            f"Alertas activas: PQRS SLA={pqrs_count}, PDM anomalía={pdm_count}",
        ))
