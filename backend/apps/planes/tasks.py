"""Tareas Celery para informes Planes Institucionales."""
from __future__ import annotations

from celery import shared_task


@shared_task(bind=True, max_retries=1, time_limit=900, soft_time_limit=840)
def generar_informe_planes(self, informe_id: int) -> None:
    from apps.planes.informes.service import run_informe_plan_generation

    run_informe_plan_generation(informe_id)


@shared_task(name="apps.planes.tasks.purge_expired_informes_planes")
def purge_expired_informes_planes() -> int:
    from apps.planes.models import InformePlan

    return InformePlan.purge_expired()
