"""Entrada normalizada para crear PQRS desde correo (IMAP, Gmail Add-on)."""
from __future__ import annotations

import logging
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any

from django.db import transaction
from django.utils import timezone

from apps.entities.models import Entity
from apps.pqrs.models import CanalLlegada, PQRS
from apps.pqrs.services.ai import extraer_pqrs_con_ia
from apps.pqrs.services.creation import crear_pqrs_desde_ia
from apps.pqrs.services.email import enviar_radicacion
from apps.pqrs.services.email_sanitize import (
    ForwardedEmailMeta,
    apply_original_sender_to_extraction,
    scrub_entity_from_extraction,
)

logger = logging.getLogger(__name__)


@dataclass
class EmailPqrsInput:
    """Payload común para radicación desde correo."""

    entity: Entity
    created_by: Any
    texto: str
    subject_line: str = ""
    archivos: list[tuple[str, bytes]] = field(default_factory=list)
    content_types: dict[str, str] = field(default_factory=dict)
    fecha_base: datetime | None = None
    forward_meta: ForwardedEmailMeta | None = None
    entity_email: str = ""
    extraido: dict[str, Any] | None = None
    skip_ia: bool = False
    auditoria_creacion: str = "PQRS creada automáticamente desde correo (IA)."
    secretaria_fallback: Any = None
    limit_archivos: bool = False
    send_radicacion_email: bool = True
    email_meta: dict[str, Any] | None = None


def _build_email_meta(
    inp: EmailPqrsInput,
    fecha_base: datetime,
) -> dict[str, Any]:
    if inp.email_meta is not None:
        return inp.email_meta
    meta: dict[str, Any] = {"subject": inp.subject_line, "date": fecha_base}
    if inp.forward_meta:
        from apps.pqrs.services.email_print import email_meta_from_forward

        meta.update(
            email_meta_from_forward(
                inp.forward_meta,
                entity_email=inp.entity_email or (inp.entity.email or "").strip(),
            )
        )
        meta["subject"] = inp.subject_line or inp.forward_meta.subject or meta.get("subject", "")
    return meta


def crear_pqrs_desde_email(inp: EmailPqrsInput) -> PQRS:
    """Extrae con IA (opcional) y crea PQRS con canal email."""
    if not inp.texto.strip() and not inp.archivos:
        raise ValueError("Correo sin texto ni adjuntos legibles.")

    fecha_base = inp.fecha_base or timezone.now()
    if isinstance(fecha_base, datetime) and timezone.is_naive(fecha_base):
        fecha_base = timezone.make_aware(fecha_base, timezone.get_current_timezone())

    if inp.extraido is not None:
        extraido = dict(inp.extraido)
    elif inp.skip_ia:
        raise ValueError("Se requiere extraido o extracción IA.")
    else:
        extraido = extraer_pqrs_con_ia(
            inp.texto,
            inp.archivos,
            inp.entity.id,
            inbound_entity_name=inp.entity.name,
        )
        extraido = scrub_entity_from_extraction(extraido, inp.entity, inp.created_by)
        if inp.forward_meta:
            extraido = apply_original_sender_to_extraction(
                extraido, inp.forward_meta, inp.entity, inp.created_by
            )

    extraido["canal_llegada"] = CanalLlegada.EMAIL
    email_meta = _build_email_meta(inp, fecha_base)
    fallback = inp.secretaria_fallback
    if fallback is None and inp.created_by is not None:
        fallback = getattr(inp.created_by, "secretaria", None)

    with transaction.atomic():
        pqrs = crear_pqrs_desde_ia(
            inp.entity,
            extraido,
            created_by=inp.created_by,
            texto=inp.texto,
            files_bytes=inp.archivos or None,
            files_content_types=inp.content_types or None,
            canal_llegada=CanalLlegada.EMAIL,
            fecha_base=fecha_base,
            auditoria_creacion=inp.auditoria_creacion,
            secretaria_fallback=fallback,
            limit_archivos=inp.limit_archivos,
            email_meta=email_meta,
        )

    if inp.send_radicacion_email and pqrs.email_ciudadano:
        try:
            enviar_radicacion(pqrs)
        except Exception:  # noqa: BLE001
            logger.exception("Error enviando radicación PQRS %s", pqrs.numero_radicado)

    return pqrs
