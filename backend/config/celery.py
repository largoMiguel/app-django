"""Configuración Celery para tareas async de IA."""
import os

from celery import Celery
from celery.schedules import crontab

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings.prod")

app = Celery("softone")
app.config_from_object("django.conf:settings", namespace="CELERY")
app.autodiscover_tasks()

app.conf.beat_schedule = {
    "compute-sla-risk-scores": {
        "task": "apps.ai.tasks.compute_all_sla_risk_scores",
        "schedule": crontab(hour=6, minute=0),
    },
    "detect-pdm-anomalies": {
        "task": "apps.ai.tasks.detect_all_pdm_anomalies",
        "schedule": crontab(hour=6, minute=30),
    },
    "reindex-embeddings": {
        "task": "apps.ai.tasks.reindex_all_embeddings",
        "schedule": crontab(hour=2, minute=0, day_of_week=0),
    },
    "purge-old-asistencia-photos": {
        "task": "apps.asistencia.tasks.purge_old_asistencia_photos",
        "schedule": crontab(hour=3, minute=15),
    },
}
