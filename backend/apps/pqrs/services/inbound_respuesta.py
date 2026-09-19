"""Procesar respuesta PQRS desde correo entrante (radicado en asunto)."""
from __future__ import annotations

import logging
import re
from typing import TYPE_CHECKING

from django.core.files.base import ContentFile
from django.db import transaction
from django.utils import timezone

from apps.common.storages import pqrs_storage_for_paths
from apps.pqrs.access import user_can_access_pqrs
from apps.pqrs.models import AsignacionAuditoria, EstadoPQRS, PQRS
from apps.pqrs.services.email_print import create_email_print_document
from apps.pqrs.storage_paths import pqrs_respuesta_path
from apps.pqrs.validators import validate_inbound_attachment

if TYPE_CHECKING:
    from apps.accounts.models import User
    from apps.entities.models import Entity
    from apps.pqrs.services.inbound import ParsedEmail
    from apps.pqrs.services.email_sanitize import ForwardedEmailMeta

logger = logging.getLogger(__name__)

RADICADO_RE = re.compile(r"PQRS-\d+-\d{8}-\d{3}", re.IGNORECASE)


def extract_radicado_from_text(*texts: str | None) -> str | None:
    """Busca PQRS-ENTIDAD-FECHA-SEC en cualquier fragmento de texto."""
    for text in texts:
        if not text:
            continue
        match = RADICADO_RE.search(text)
        if match:
            return match.group(0).upper()
    return None


def extract_radicado_from_subject(subject: str) -> str | None:
    return extract_radicado_from_text(subject)


def extract_radicado_from_email(
    *,
    subject: str = "",
    forward_subject: str | None = None,
    body: str = "",
) -> str | None:
    """Detecta radicado en asunto del reenvío, asunto original o cuerpo."""
    return extract_radicado_from_text(subject, forward_subject, body)


def _save_respuesta_archivo(
    pqrs: PQRS,
    *,
    filename: str,
    content: bytes,
) -> str:
    storage = pqrs_storage_for_paths()
    safe_name = pqrs_respuesta_path(
        pqrs,
        f"respuesta_{int(timezone.now().timestamp())}_{filename}",
    )
    return storage.save(safe_name, ContentFile(content))


def _build_respuesta_pdf(
    pqrs: PQRS,
    *,
    texto: str,
    subject: str,
    forward_meta: ForwardedEmailMeta,
    fecha_base,
) -> tuple[str, bytes, str]:
    content, filename, content_type = create_email_print_document(
        body=texto,
        subject=subject,
        radicado=pqrs.numero_radicado,
        from_name=forward_meta.from_name or "",
        from_email=forward_meta.from_email or "",
        to_emails=forward_meta.to_emails or [],
        date=fecha_base,
    )
    return filename, content, content_type


def procesar_respuesta_inbound(
    parsed: ParsedEmail,
    *,
    entity: Entity,
    user: User,
    forward_meta: ForwardedEmailMeta,
    subject_line: str,
) -> PQRS:
    """Marca PQRS como respondida desde correo reenviado al buzón PQRS."""
    radicado = extract_radicado_from_email(
        subject=subject_line,
        forward_subject=forward_meta.subject,
        body=forward_meta.body or parsed.texto,
    )
    if not radicado:
        raise ValueError(
            "No se encontró radicado PQRS en el asunto ni en el cuerpo del correo."
        )

    pqrs = PQRS.objects.filter(entity=entity, numero_radicado__iexact=radicado).first()
    if not pqrs:
        raise LookupError(f"Radicado {radicado} no encontrado en la entidad.")

    if not user_can_access_pqrs(user, pqrs):
        raise PermissionError(f"Sin acceso a la PQRS {radicado}.")

    if pqrs.estado == EstadoPQRS.RESPONDIDA:
        raise ValueError(f"La PQRS {radicado} ya fue respondida.")

    if pqrs.estado == EstadoPQRS.CERRADA:
        raise ValueError(f"La PQRS {radicado} está cerrada.")

    texto = (forward_meta.body or "").strip()
    if not texto and not parsed.adjuntos:
        raise ValueError("Correo de respuesta sin texto ni adjuntos.")

    if not texto:
        texto = f"Respuesta registrada por correo (adjuntos: {len(parsed.adjuntos)})."

    fecha_respuesta = parsed.recibido_at or timezone.now()
    archivo_path: str | None = None

    if parsed.adjuntos:
        fname, content, _ctype = parsed.adjuntos[0]
        try:
            validate_inbound_attachment(fname, len(content))
            archivo_path = _save_respuesta_archivo(pqrs, filename=fname, content=content)
        except Exception:  # noqa: BLE001
            logger.warning("Adjunto principal omitido en respuesta %s: %s", radicado, fname)

    if not archivo_path and texto:
        pdf_name, pdf_content, _ = _build_respuesta_pdf(
            pqrs,
            texto=texto,
            subject=subject_line,
            forward_meta=forward_meta,
            fecha_base=fecha_respuesta,
        )
        archivo_path = _save_respuesta_archivo(
            pqrs,
            filename=pdf_name,
            content=pdf_content,
        )

    with transaction.atomic():
        AsignacionAuditoria.objects.create(
            pqrs=pqrs,
            secretaria_anterior=pqrs.assigned_to,
            usuario_anterior=user,
            accion="respuesta",
            justificacion=f"[Correo] {texto[:500]}",
        )
        pqrs.respuesta = texto
        if archivo_path:
            pqrs.archivo_respuesta = archivo_path
        pqrs.estado = EstadoPQRS.RESPONDIDA
        pqrs.fecha_respuesta = fecha_respuesta
        pqrs.save(
            update_fields=[
                "respuesta",
                "archivo_respuesta",
                "estado",
                "fecha_respuesta",
                "updated_at",
            ]
        )

    logger.info(
        "PQRS %s marcada como respondida desde correo de %s",
        pqrs.numero_radicado,
        parsed.remitente,
    )
    return pqrs
