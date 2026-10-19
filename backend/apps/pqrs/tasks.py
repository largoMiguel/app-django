"""Tareas Celery — PQRS (correos e informes PDF)."""
from __future__ import annotations

import logging

from celery import shared_task

logger = logging.getLogger(__name__)


@shared_task(bind=True, max_retries=2, time_limit=900, soft_time_limit=840, acks_late=True)
def generar_informe_pqrs_task(self, informe_id: int) -> None:
    from apps.pqrs.services.informe_service import run_informe_pqrs_generation

    run_informe_pqrs_generation(informe_id)


@shared_task(bind=True, max_retries=2, acks_late=True)
def enviar_respuesta_pqrs_async(
    self,
    pqrs_id: int,
    texto_respuesta: str,
    destinatarios_raw: str,
    user_id: int | None = None,
) -> None:
    from django.contrib.auth import get_user_model

    from apps.pqrs.models import PQRS
    from apps.pqrs.services.email import enviar_respuesta

    User = get_user_model()
    pqrs = PQRS.objects.filter(pk=pqrs_id).first()
    if not pqrs:
        logger.warning("PQRS %s no encontrada para envío async de respuesta", pqrs_id)
        return
    user = User.objects.filter(pk=user_id).first() if user_id else None
    try:
        enviar_respuesta(pqrs, texto_respuesta, destinatarios_raw, enviado_por=user)
    except Exception:
        logger.exception("Error enviando respuesta PQRS %s en background", pqrs_id)
        raise


@shared_task(bind=True, max_retries=2, acks_late=True)
def reenviar_correo_pqrs_async(
    self,
    correo_id: int,
    email_destino: str | None = None,
) -> None:
    from apps.pqrs.models import PQRSCorreo
    from apps.pqrs.services.email import reenviar_correo

    correo = PQRSCorreo.objects.filter(pk=correo_id).select_related("pqrs").first()
    if not correo:
        logger.warning("Correo PQRS %s no encontrado para reenvío async", correo_id)
        return
    try:
        reenviar_correo(correo, email_destino or None)
    except Exception:
        logger.exception("Error reenviando correo PQRS %s", correo_id)
        raise
