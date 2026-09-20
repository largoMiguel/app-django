"""Envío de respuestas PQRS vía Gmail API."""
from __future__ import annotations

import logging
from typing import Any

from django.conf import settings
from django.utils import timezone

from apps.google_integration.errors import GmailIntegrationError
from apps.google_integration.gmail_client import get_access_token_for_connection, send_raw_message
from apps.google_integration.mime_build import build_reply_message
from apps.google_integration.models import (
    GmailEnvioAuditoria,
    GoogleConnectionStatus,
    GoogleEmailConnection,
    PQRSGmailOrigin,
)
from apps.pqrs.models import EstadoCorreoPQRS, PQRS, PQRSCorreo, TipoCorreoPQRS
from apps.pqrs.services.correo_alerta import sync_correo_alerta
from apps.pqrs.services.email import (
    _adjuntos_respuesta,
    _build_respuesta_bodies,
    _crear_registro_correo,
    _from_name,
    parse_email_list,
)

logger = logging.getLogger(__name__)


def user_has_gmail_send(user) -> GoogleEmailConnection | None:
    if not getattr(settings, "GOOGLE_GMAIL_SEND_ENABLED", False):
        return None
    try:
        conn = GoogleEmailConnection.objects.get(user=user)
    except GoogleEmailConnection.DoesNotExist:
        return None
    if conn.status == GoogleConnectionStatus.REVOCADA:
        return None
    return conn


def _read_attachment_bytes(pqrs: PQRS) -> list[tuple[str, bytes, str]]:
    from apps.pqrs.services.email import _build_zeptomail_attachment, _read_bytes_from_storage

    path = pqrs.archivo_respuesta
    if not path:
        return []
    try:
        content = _read_bytes_from_storage(path)
    except Exception:  # noqa: BLE001
        return []
    nombre = path.rsplit("/", 1)[-1]
    return [(nombre, content, "application/octet-stream")]


def enviar_respuesta_gmail(
    pqrs: PQRS,
    texto_respuesta: str,
    destinatarios_raw: str,
    *,
    enviado_por,
    archivo_path_set: bool = False,
) -> tuple[PQRSCorreo, bool, str | None]:
    conn = user_has_gmail_send(enviado_por)
    if not conn:
        raise GmailIntegrationError(
            "Gmail no conectado para este usuario.",
            code="no_connection",
        )

    recipients = parse_email_list(destinatarios_raw)
    if not recipients:
        raise ValueError("No hay destinatarios válidos.")

    subject, text_body, html_body = _build_respuesta_bodies(
        pqrs, texto_respuesta, enviado_por=enviado_por
    )
    registro = _crear_registro_correo(
        pqrs=pqrs,
        tipo=TipoCorreoPQRS.RESPUESTA,
        asunto=subject,
        cuerpo_resumen=text_body,
        destinatarios=recipients,
        enviado_por=enviado_por,
    )
    registro.proveedor = "gmail"
    registro.save(update_fields=["proveedor", "updated_at"])

    from apps.google_integration.models import PQRSGmailOrigin

    origin = PQRSGmailOrigin.objects.filter(pqrs_id=pqrs.id).first()
    thread_id = ""
    in_reply_to = ""
    references = ""
    reply_subject = pqrs.asunto
    if origin:
        thread_id = origin.gmail_thread_id or ""
        in_reply_to = origin.in_reply_to_header or origin.internet_message_id or ""
        references = origin.references_header or ""
        if origin.original_subject:
            reply_subject = origin.original_subject

    attachments = _read_attachment_bytes(pqrs) if archivo_path_set or pqrs.archivo_respuesta else []

    try:
        access = get_access_token_for_connection(conn)
        raw = build_reply_message(
            from_email=conn.google_email,
            from_name=_from_name(pqrs, include_secretaria=True),
            to_addrs=recipients,
            subject=reply_subject,
            body_text=text_body,
            body_html=html_body,
            in_reply_to=in_reply_to,
            references=references,
            attachments=attachments,
        )
        result = send_raw_message(access, raw_rfc822_b64url=raw, thread_id=thread_id or None)
        gmail_msg_id = result.get("id") or ""
        gmail_thread = result.get("threadId") or thread_id

        registro.estado = EstadoCorreoPQRS.ENVIADO
        registro.gmail_message_id = gmail_msg_id
        for d in registro.destinatarios:
            d["estado"] = "enviado"
        registro.save(update_fields=["estado", "gmail_message_id", "destinatarios", "updated_at"])

        pqrs.email_enviado = True
        pqrs.email_error = ""
        pqrs.save(update_fields=["email_enviado", "email_error", "updated_at"])
        sync_correo_alerta(pqrs)

        GmailEnvioAuditoria.objects.create(
            pqrs=pqrs,
            user=enviado_por,
            entity=pqrs.entity,
            google_email=conn.google_email,
            gmail_message_id=gmail_msg_id,
            gmail_thread_id=gmail_thread or "",
            destinatarios=recipients,
            estado="enviado",
        )
        return registro, True, None
    except GmailIntegrationError as exc:
        if exc.code == "requiere_reautorizacion":
            conn.status = GoogleConnectionStatus.REQUIERE_REAUTORIZACION
            conn.save(update_fields=["status", "updated_at"])
        registro.estado = EstadoCorreoPQRS.ERROR
        registro.error = str(exc)[:500]
        for d in registro.destinatarios:
            d["estado"] = "error"
            d["motivo"] = str(exc)[:500]
        registro.save(update_fields=["estado", "error", "destinatarios", "updated_at"])
        GmailEnvioAuditoria.objects.create(
            pqrs=pqrs,
            user=enviado_por,
            entity=pqrs.entity,
            google_email=conn.google_email,
            destinatarios=recipients,
            estado="error",
            error=str(exc)[:500],
        )
        return registro, False, str(exc)
    except Exception as exc:  # noqa: BLE001
        registro.estado = EstadoCorreoPQRS.ERROR
        registro.error = str(exc)[:500]
        registro.save(update_fields=["estado", "error", "updated_at"])
        return registro, False, str(exc)[:500]
