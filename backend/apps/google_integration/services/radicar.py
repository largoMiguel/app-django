"""Radicación PQRS desde Gmail Add-on."""
from __future__ import annotations

import logging
from datetime import datetime
from typing import Any

from django.db import IntegrityError
from django.utils import timezone
from email.utils import parsedate_to_datetime

from apps.accounts.models import User
from apps.common.roles import user_roles
from apps.entities.models import Entity, Secretaria
from apps.google_integration.entity_resolve import resolve_entity_for_google_user
from apps.google_integration.gmail_client import fetch_message
from apps.google_integration.mime_attachments import download_attachments
from apps.google_integration.mime_parse import ParsedGmailMessage, body_text_for_ia, parse_gmail_api_message
from apps.google_integration.models import PQRSGmailOrigin
from apps.google_integration.preview_cache import apply_editable_fields
from apps.pqrs.models import PQRS
from apps.pqrs.services.email_input import EmailPqrsInput, crear_pqrs_desde_email
from apps.pqrs.services.email_sanitize import ForwardedEmailMeta

logger = logging.getLogger(__name__)

ROLES_RADICAR = frozenset({"admin", "secretario"})


def _parse_received_at(date_header: str) -> datetime | None:
    if not date_header:
        return None
    try:
        dt = parsedate_to_datetime(date_header)
        if timezone.is_naive(dt):
            dt = timezone.make_aware(dt, timezone.get_current_timezone())
        return dt
    except Exception:  # noqa: BLE001
        return None


def resolve_user_for_addon(google_email: str) -> User:
    user = User.objects.filter(email__iexact=google_email, is_active=True).first()
    if not user:
        raise PermissionError(f"Usuario no registrado: {google_email}")
    roles = user_roles(user)
    if not roles & ROLES_RADICAR:
        raise PermissionError("Solo admin o secretario pueden radicar desde Gmail.")
    return user


def ensure_entity(user: User, google_email: str) -> Entity:
    entity = resolve_entity_for_google_user(user, google_email)
    if not entity:
        raise PermissionError(
            "No se pudo determinar la entidad. Verifique dominio institucional y membresías."
        )
    if not entity.is_active or not entity.enable_pqrs:
        raise PermissionError("Módulo PQRS no disponible para la entidad.")
    if not entity.enable_ai_reports:
        raise PermissionError("La entidad no tiene habilitados los reportes con IA.")
    return entity


def check_duplicate(gmail_account_email: str, gmail_message_id: str) -> PQRS | None:
    origin = PQRSGmailOrigin.objects.filter(
        gmail_account_email__iexact=gmail_account_email,
        gmail_message_id=gmail_message_id,
    ).select_related("pqrs").first()
    return origin.pqrs if origin else None


def fetch_and_parse_message(access_token: str, message_id: str, *, with_attachments: bool) -> tuple[ParsedGmailMessage, dict[str, Any], list[tuple[str, bytes]], dict[str, str], list[str]]:
    api_msg = fetch_message(access_token, message_id, format="full")
    parsed = parse_gmail_api_message(api_msg, include_attachments=with_attachments)
    payload = api_msg.get("payload") or {}
    files: list[tuple[str, bytes]] = []
    ctypes: dict[str, str] = {}
    warnings: list[str] = []
    if with_attachments:
        files, ctypes, warnings = download_attachments(access_token, message_id, payload)
    return parsed, api_msg, files, ctypes, warnings


def build_forward_meta(parsed: ParsedGmailMessage) -> ForwardedEmailMeta:
    return ForwardedEmailMeta(
        body=body_text_for_ia(parsed),
        from_email=parsed.from_email or None,
        from_name=parsed.from_name or None,
        to_emails=parsed.to_emails,
        subject=parsed.subject or None,
    )


def save_gmail_origin(pqrs: PQRS, parsed: ParsedGmailMessage, google_account_email: str) -> None:
    PQRSGmailOrigin.objects.create(
        pqrs=pqrs,
        gmail_account_email=google_account_email.lower(),
        gmail_message_id=parsed.gmail_message_id,
        gmail_thread_id=parsed.gmail_thread_id or "",
        internet_message_id=parsed.internet_message_id or "",
        original_from=parsed.from_raw or "",
        original_to=", ".join(parsed.to_emails),
        original_cc=", ".join(parsed.cc_emails),
        original_subject=parsed.subject or "",
        references_header=parsed.references or "",
        in_reply_to_header=parsed.in_reply_to or "",
        text_body=parsed.text_body or "",
        html_body=parsed.html_body or "",
        received_at=_parse_received_at(parsed.date_header),
    )


def radicate_from_preview(
    *,
    user: User,
    entity: Entity,
    google_email: str,
    access_token: str,
    message_id: str,
    preview_payload: dict[str, Any],
    form_inputs: dict[str, Any],
) -> tuple[PQRS, list[str]]:
    existing = check_duplicate(google_email, message_id)
    if existing:
        return existing, []

    parsed, _api, files, ctypes, warnings = fetch_and_parse_message(
        access_token, message_id, with_attachments=True
    )
    extraido = apply_editable_fields(preview_payload.get("extraido") or {}, form_inputs)
    texto = preview_payload.get("texto") or body_text_for_ia(parsed)
    subject_line = parsed.subject or ""

    forward_meta = build_forward_meta(parsed)
    inp = EmailPqrsInput(
        entity=entity,
        created_by=user,
        texto=texto,
        subject_line=subject_line,
        archivos=files,
        content_types=ctypes,
        fecha_base=_parse_received_at(parsed.date_header) or timezone.now(),
        forward_meta=forward_meta,
        entity_email=(entity.email or "").strip(),
        extraido=extraido,
        skip_ia=True,
        auditoria_creacion="PQRS creada desde Gmail Add-on (IA + confirmación).",
        secretaria_fallback=getattr(user, "secretaria", None),
        limit_archivos=False,
        email_meta={
            "subject": subject_line,
            "date": _parse_received_at(parsed.date_header) or timezone.now(),
            "from_email": parsed.from_email,
            "from_name": parsed.from_name,
            "to_emails": parsed.to_emails,
        },
    )
    pqrs = crear_pqrs_desde_email(inp)
    try:
        save_gmail_origin(pqrs, parsed, google_email)
    except IntegrityError:
        dup = check_duplicate(google_email, parsed.gmail_message_id)
        if dup:
            return dup, warnings
        raise
    return pqrs, warnings
