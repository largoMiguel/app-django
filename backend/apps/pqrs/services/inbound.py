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
from apps.pqrs.services.email_sanitize import (
    apply_original_sender_to_extraction,
    build_inbound_ia_context,
    prepare_inbound_email_text,
    scrub_entity_from_extraction,
)
from apps.pqrs.services.email_print import email_meta_from_forward
from apps.pqrs.services.creation import crear_pqrs_desde_ia
from apps.pqrs.services.email import enviar_radicacion
from rest_framework.exceptions import ValidationError

from apps.pqrs.validators import validate_inbound_attachment

logger = logging.getLogger(__name__)

GOVCO_SUFFIX = ".gov.co"
ROLES_CREACION = frozenset({"admin", "secretario"})
ROLES_RESPUESTA = frozenset({"admin", "secretario", "contratista"})
ESTADOS_PROCESADOS = frozenset(
    {EstadoCorreoEntrante.PROCESADO, EstadoCorreoEntrante.PROCESADO_RESPUESTA}
)


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
        if not fname:
            continue
        try:
            validate_inbound_attachment(fname, len(content))
        except ValidationError:
            logger.info("Adjunto omitido (tamaño o nombre inválido): %s", fname)
            continue
        adjuntos.append((fname, content, part.get_content_type() or ""))
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


def _resolve_remitente_user(email_addr: str, *, roles_permitidos: frozenset[str]) -> User | None:
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
    if not roles_permitidos & roles:
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


def _ensure_entity_ready(entity: Entity, *, require_ai: bool = False) -> str | None:
    if not entity.is_active:
        return "Entidad inactiva."
    if not entity.enable_pqrs:
        return "Módulo PQRS deshabilitado para la entidad."
    if require_ai and not entity.enable_ai_reports:
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
        estado__in=ESTADOS_PROCESADOS,
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

    forward_meta_preview = None
    subject_line = parsed.asunto
    user_preview = _resolve_remitente_user(parsed.remitente, roles_permitidos=ROLES_RESPUESTA)
    if user_preview and user_preview.entity:
        forward_meta_preview = prepare_inbound_email_text(
            parsed.texto.strip(), user_preview.entity, user_preview
        )
        subject_line = forward_meta_preview.subject or parsed.asunto

    from apps.pqrs.services.inbound_respuesta import extract_radicado_from_subject

    radicado_en_asunto = extract_radicado_from_subject(subject_line)
    roles_permitidos = ROLES_RESPUESTA if radicado_en_asunto else ROLES_CREACION

    user = _resolve_remitente_user(parsed.remitente, roles_permitidos=roles_permitidos)
    if not user:
        rol_txt = "admin/secretario/contratista" if radicado_en_asunto else "admin/secretario"
        correo = _registrar_correo(
            parsed,
            estado=EstadoCorreoEntrante.IGNORADO_NO_REGISTRADO,
            motivo=f"Remitente no registrado como {rol_txt}: {parsed.remitente}",
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

    entity_error = _ensure_entity_ready(entity, require_ai=not radicado_en_asunto)
    if entity_error:
        correo = _registrar_correo(
            parsed,
            estado=EstadoCorreoEntrante.ERROR,
            motivo=entity_error,
            entity=entity,
            user=user,
        )
        return InboundResult(estado=correo.estado, motivo=correo.motivo, correo=correo)

    forward_meta = forward_meta_preview or prepare_inbound_email_text(
        parsed.texto.strip(), entity, user
    )
    subject_line = forward_meta.subject or parsed.asunto

    if radicado_en_asunto:
        from apps.pqrs.services.inbound_respuesta import procesar_respuesta_inbound

        try:
            pqrs = procesar_respuesta_inbound(
                parsed,
                entity=entity,
                user=user,
                forward_meta=forward_meta,
                subject_line=subject_line,
            )
            correo = _registrar_correo(
                parsed,
                estado=EstadoCorreoEntrante.PROCESADO_RESPUESTA,
                motivo=f"Respuesta registrada {pqrs.numero_radicado}",
                entity=entity,
                pqrs=pqrs,
                user=user,
            )
            return InboundResult(
                estado=correo.estado,
                motivo=correo.motivo,
                pqrs=pqrs,
                correo=correo,
            )
        except LookupError as exc:
            correo = _registrar_correo(
                parsed,
                estado=EstadoCorreoEntrante.IGNORADO_RADICADO_NO_ENCONTRADO,
                motivo=str(exc),
                entity=entity,
                user=user,
            )
            return InboundResult(estado=correo.estado, motivo=correo.motivo, correo=correo)
        except ValueError as exc:
            estado = (
                EstadoCorreoEntrante.IGNORADO_YA_RESPONDIDA
                if "ya fue respondida" in str(exc).lower()
                else EstadoCorreoEntrante.ERROR
            )
            correo = _registrar_correo(
                parsed,
                estado=estado,
                motivo=str(exc),
                entity=entity,
                user=user,
            )
            return InboundResult(estado=correo.estado, motivo=correo.motivo, correo=correo)
        except PermissionError as exc:
            correo = _registrar_correo(
                parsed,
                estado=EstadoCorreoEntrante.ERROR,
                motivo=str(exc),
                entity=entity,
                user=user,
            )
            return InboundResult(estado=correo.estado, motivo=correo.motivo, correo=correo)
        except Exception as exc:  # noqa: BLE001
            logger.exception("Error procesando respuesta por correo %s", parsed.message_id)
            correo = _registrar_correo(
                parsed,
                estado=EstadoCorreoEntrante.ERROR,
                motivo=f"Error respuesta: {exc}",
                entity=entity,
                user=user,
            )
            return InboundResult(estado=correo.estado, motivo=correo.motivo, correo=correo)

    texto = forward_meta.body
    ia_hint = build_inbound_ia_context(forward_meta)
    if ia_hint:
        texto = f"{ia_hint}\n\n{texto}".strip()

    if subject_line and subject_line.lower() not in texto.lower()[:300]:
        texto = f"Asunto: {subject_line}\n\n{texto}".strip()

    archivos_ia = [(name, content) for name, content, _ctype in parsed.adjuntos]
    content_types = {name: ctype for name, _content, ctype in parsed.adjuntos}
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
        extraido = apply_original_sender_to_extraction(extraido, forward_meta, entity, user)
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
                files_content_types=content_types or None,
                canal_llegada=CanalLlegada.EMAIL,
                fecha_base=fecha_base,
                auditoria_creacion="PQRS creada automáticamente desde correo reenviado (IA).",
                secretaria_fallback=user.secretaria,
                limit_archivos=False,
                email_meta={
                    **email_meta_from_forward(
                        forward_meta,
                        entity_email=(entity.email or "").strip(),
                    ),
                    "subject": subject_line,
                    "date": fecha_base,
                },
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
