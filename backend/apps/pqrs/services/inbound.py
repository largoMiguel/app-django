"""Ingreso de PQRS desde correo reenviado (IMAP)."""
from __future__ import annotations

import email
import html
import logging
import re
from dataclasses import dataclass, field
from datetime import datetime
from email.header import decode_header, make_header
from email.utils import getaddresses, parsedate_to_datetime
from typing import Any

from django.conf import settings
from django.db import transaction
from django.utils import timezone

from apps.accounts.models import User
from apps.common.roles import user_roles
from apps.entities.models import Entity
from apps.pqrs.models import (
    CanalLlegada,
    CorreoEntrantePQRS,
    EstadoCorreoEntrante,
    PQRS,
)
from apps.pqrs.services.email_sanitize import prepare_inbound_email_text, scrub_entity_from_extraction
from apps.pqrs.services.creation import crear_pqrs_desde_ia
from apps.pqrs.services.email import enviar_radicacion
from apps.pqrs.validators import ALLOWED_EXTENSIONS, MAX_UPLOAD_BYTES

logger = logging.getLogger(__name__)

GOVCO_SUFFIX = ".gov.co"
ROLES_PERMITIDOS = frozenset({"admin", "secretario"})


@dataclass
class ParsedEmail:
    message_id: str
    remitente: str
    asunto: str
    texto: str
    adjuntos: list[tuple[str, bytes, str]] = field(default_factory=list)
    recibido_at: datetime | None = None


def _decode_mime(value: str | None) -> str:
    if not value:
        return ""
    try:
        return str(make_header(decode_header(value)))
    except Exception:  # noqa: BLE001
        return str(value)


def _html_to_text(raw_html: str) -> str:
    text = re.sub(r"(?is)<(script|style).*?>.*?</\1>", " ", raw_html)
    text = re.sub(r"(?i)<br\s*/?>", "\n", text)
    text = re.sub(r"(?i)</p>", "\n\n", text)
    text = re.sub(r"<[^>]+>", " ", text)
    return html.unescape(re.sub(r"\s+\n", "\n", text)).strip()


def _extract_body(msg: email.message.Message) -> str:
    plain_parts: list[str] = []
    html_parts: list[str] = []
    if msg.is_multipart():
        for part in msg.walk():
            if part.get_content_disposition() == "attachment":
                continue
            ctype = (part.get_content_type() or "").lower()
            try:
                payload = part.get_payload(decode=True) or b""
                charset = part.get_content_charset() or "utf-8"
                text = payload.decode(charset, errors="ignore")
            except Exception:  # noqa: BLE001
                continue
            if ctype == "text/plain":
                plain_parts.append(text.strip())
            elif ctype == "text/html":
                html_parts.append(text)
    else:
        try:
            payload = msg.get_payload(decode=True) or b""
            charset = msg.get_content_charset() or "utf-8"
            text = payload.decode(charset, errors="ignore")
        except Exception:  # noqa: BLE001
            text = ""
        if (msg.get_content_type() or "").lower() == "text/html":
            html_parts.append(text)
        else:
            plain_parts.append(text.strip())
    if plain_parts:
        return "\n\n".join(p for p in plain_parts if p).strip()
    if html_parts:
        return _html_to_text("\n".join(html_parts))
    return ""


def _safe_filename(name: str) -> str:
    base = (name or "adjunto").replace("\\", "/").rsplit("/", 1)[-1]
    base = re.sub(r"[^\w.\- ]", "_", base).strip() or "adjunto"
    return base[:200]


def _extract_attachments(msg: email.message.Message) -> list[tuple[str, bytes, str]]:
    adjuntos: list[tuple[str, bytes, str]] = []
    for part in msg.walk():
        disposition = (part.get_content_disposition() or "").lower()
        filename = part.get_filename()
        if disposition != "attachment" and not filename:
            continue
        if not filename:
            continue
        content = part.get_payload(decode=True)
        if not content:
            continue
        fname = _safe_filename(_decode_mime(filename))
        ext = fname.rsplit(".", 1)[-1].lower() if "." in fname else ""
        if f".{ext}" not in ALLOWED_EXTENSIONS:
            logger.info("Adjunto omitido (extensión no permitida): %s", fname)
            continue
        if len(content) > MAX_UPLOAD_BYTES:
            logger.info("Adjunto omitido (tamaño): %s", fname)
            continue
        adjuntos.append((fname, content, part.get_content_type() or ""))
        if len(adjuntos) >= 4:
            break
    return adjuntos


def parse_email_message(raw_bytes: bytes) -> ParsedEmail:
    msg = email.message_from_bytes(raw_bytes)
    message_id = (msg.get("Message-ID") or "").strip()
    if not message_id:
        message_id = f"generated-{hash(raw_bytes) & 0xFFFFFFFF:x}@softone360.local"

    addresses = getaddresses([msg.get("From", "")])
    remitente = (addresses[0][1] if addresses else "").strip().lower()
    asunto = _decode_mime(msg.get("Subject", "")).strip()
    texto = _extract_body(msg)
    adjuntos = _extract_attachments(msg)

    recibido_at = None
    try:
        recibido_at = parsedate_to_datetime(msg.get("Date", ""))
        if recibido_at and timezone.is_naive(recibido_at):
            recibido_at = timezone.make_aware(recibido_at, timezone.get_current_timezone())
    except Exception:  # noqa: BLE001
        recibido_at = None

    return ParsedEmail(
        message_id=message_id,
        remitente=remitente,
        asunto=asunto,
        texto=texto,
        adjuntos=adjuntos,
        recibido_at=recibido_at,
    )


def _is_govco_email(address: str) -> bool:
    domain = (address or "").split("@")[-1].lower()
    return domain.endswith(GOVCO_SUFFIX)


def _resolve_remitente_user(email_addr: str) -> User | None:
    if not email_addr:
        return None
    user = (
        User.objects.filter(email__iexact=email_addr, is_active=True)
        .select_related("entity", "secretaria")
        .first()
    )
    if not user:
        return None
    roles = user_roles(user)
    if not ROLES_PERMITIDOS & roles:
        return None
    return user


def _registrar_correo(
    parsed: ParsedEmail,
    *,
    estado: str,
    motivo: str = "",
    entity: Entity | None = None,
    pqrs: PQRS | None = None,
    user: User | None = None,
) -> CorreoEntrantePQRS:
    obj, _created = CorreoEntrantePQRS.objects.update_or_create(
        message_id=parsed.message_id,
        defaults={
            "remitente": parsed.remitente,
            "entity": entity,
            "pqrs": pqrs,
            "remitente_user": user,
            "estado": estado,
            "motivo": motivo[:2000],
            "asunto": parsed.asunto[:500],
            "recibido_at": parsed.recibido_at,
        },
    )
    return obj


def _ensure_entity_ready(entity: Entity) -> str | None:
    if not entity.is_active:
        return "Entidad inactiva."
    if not entity.enable_pqrs:
        return "Módulo PQRS deshabilitado para la entidad."
    if not entity.enable_ai_reports:
        return "Módulo de IA no habilitado para la entidad."
    return None


@dataclass
class InboundResult:
    estado: str
    motivo: str = ""
    pqrs: PQRS | None = None
    correo: CorreoEntrantePQRS | None = None


def procesar_correo(parsed: ParsedEmail) -> InboundResult:
    """Procesa un correo ya parseado. Idempotente por message_id."""
    if CorreoEntrantePQRS.objects.filter(
        message_id=parsed.message_id,
        estado=EstadoCorreoEntrante.PROCESADO,
    ).exists():
        correo = _registrar_correo(
            parsed,
            estado=EstadoCorreoEntrante.IGNORADO_DUPLICADO,
            motivo="Message-ID ya procesado.",
        )
        return InboundResult(estado=correo.estado, motivo=correo.motivo, correo=correo)

    require_govco = getattr(settings, "PQRS_INBOUND_REQUIRE_GOVCO", True)
    if require_govco and not _is_govco_email(parsed.remitente):
        correo = _registrar_correo(
            parsed,
            estado=EstadoCorreoEntrante.IGNORADO_NO_GOVCO,
            motivo=f"Remitente no es dominio {GOVCO_SUFFIX}: {parsed.remitente}",
        )
        return InboundResult(estado=correo.estado, motivo=correo.motivo, correo=correo)

    user = _resolve_remitente_user(parsed.remitente)
    if not user:
        correo = _registrar_correo(
            parsed,
            estado=EstadoCorreoEntrante.IGNORADO_NO_REGISTRADO,
            motivo=f"Remitente no registrado como admin/secretario: {parsed.remitente}",
        )
        return InboundResult(estado=correo.estado, motivo=correo.motivo, correo=correo)

    entity = user.entity
    if not entity:
        correo = _registrar_correo(
            parsed,
            estado=EstadoCorreoEntrante.IGNORADO_SIN_ENTIDAD,
            motivo="Usuario sin entidad asignada.",
            user=user,
        )
        return InboundResult(estado=correo.estado, motivo=correo.motivo, correo=correo)

    entity_error = _ensure_entity_ready(entity)
    if entity_error:
        correo = _registrar_correo(
            parsed,
            estado=EstadoCorreoEntrante.ERROR,
            motivo=entity_error,
            entity=entity,
            user=user,
        )
        return InboundResult(estado=correo.estado, motivo=correo.motivo, correo=correo)

    texto = prepare_inbound_email_text(parsed.texto.strip(), entity, user)
    if parsed.asunto and parsed.asunto.lower() not in texto.lower()[:200]:
        texto = f"Asunto: {parsed.asunto}\n\n{texto}".strip()

    archivos_ia = [(name, content) for name, content, _ctype in parsed.adjuntos]
    if not texto and not archivos_ia:
        correo = _registrar_correo(
            parsed,
            estado=EstadoCorreoEntrante.ERROR,
            motivo="Correo sin texto ni adjuntos legibles.",
            entity=entity,
            user=user,
        )
        return InboundResult(estado=correo.estado, motivo=correo.motivo, correo=correo)

    try:
        from apps.pqrs.services.ai import extraer_pqrs_con_ia

        extraido = extraer_pqrs_con_ia(
            texto,
            archivos_ia,
            entity.id,
            inbound_entity_name=entity.name,
        )
        extraido = scrub_entity_from_extraction(extraido, entity, user)
    except Exception as exc:  # noqa: BLE001
        logger.exception("Error IA procesando correo %s", parsed.message_id)
        correo = _registrar_correo(
            parsed,
            estado=EstadoCorreoEntrante.ERROR,
            motivo=f"Error IA: {exc}",
            entity=entity,
            user=user,
        )
        return InboundResult(estado=correo.estado, motivo=correo.motivo, correo=correo)

    extraido["canal_llegada"] = CanalLlegada.EMAIL
    fecha_base = parsed.recibido_at or timezone.now()

    try:
        with transaction.atomic():
            pqrs = crear_pqrs_desde_ia(
                entity,
                extraido,
                created_by=user,
                texto=texto,
                files_bytes=archivos_ia or None,
                canal_llegada=CanalLlegada.EMAIL,
                fecha_base=fecha_base,
                auditoria_creacion="PQRS creada automáticamente desde correo reenviado (IA).",
                secretaria_fallback=user.secretaria,
            )
            correo = _registrar_correo(
                parsed,
                estado=EstadoCorreoEntrante.PROCESADO,
                motivo=f"Radicado {pqrs.numero_radicado}",
                entity=entity,
                pqrs=pqrs,
                user=user,
            )
    except Exception as exc:  # noqa: BLE001
        logger.exception("Error creando PQRS desde correo %s", parsed.message_id)
        correo = _registrar_correo(
            parsed,
            estado=EstadoCorreoEntrante.ERROR,
            motivo=f"Error creación: {exc}",
            entity=entity,
            user=user,
        )
        return InboundResult(estado=correo.estado, motivo=correo.motivo, correo=correo)

    if pqrs.email_ciudadano:
        try:
            enviar_radicacion(pqrs)
        except Exception:  # noqa: BLE001
            logger.exception("Error enviando radicación PQRS %s", pqrs.numero_radicado)

    logger.info(
        "PQRS %s creada desde correo de %s (entity=%s)",
        pqrs.numero_radicado,
        parsed.remitente,
        entity.name,
    )
    return InboundResult(
        estado=EstadoCorreoEntrante.PROCESADO,
        motivo=correo.motivo,
        pqrs=pqrs,
        correo=correo,
    )
