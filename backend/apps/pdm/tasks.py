"""Tareas Celery para informes PDM."""
from __future__ import annotations

from celery import shared_task


@shared_task(bind=True, max_retries=1, time_limit=900, soft_time_limit=840)
def generar_informe_pdm(self, informe_id: int) -> None:
    from apps.pdm.informes.service import run_informe_pdm_generation

    run_informe_pdm_generation(informe_id)


@shared_task(name="apps.pdm.tasks.purge_expired_informes_pdm")
def purge_expired_informes_pdm() -> int:
    from apps.pdm.models import InformePDM

    return InformePDM.purge_expired()
