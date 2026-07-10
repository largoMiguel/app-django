"""Limpieza de correos reenviados: extraer cuerpo ciudadano e ignorar pie de página de la entidad."""
from __future__ import annotations

import re
import unicodedata
from dataclasses import dataclass, field
from email.utils import getaddresses

from apps.accounts.models import User
from apps.entities.models import Entity, Secretaria
from apps.pqrs.services.ai import normalize_ia_contact_fields

FORWARD_MARKER_RE = re.compile(
    r"^(-{3,}\s*(?:Forwarded message|Mensaje reenviado|Original Message)\s*-{3,}|"
    r"-----Original Message-----)$",
    re.IGNORECASE,
)
FROM_LINE_RE = re.compile(r"^(From|De)\s*:\s*(.+)$", re.IGNORECASE)
TO_LINE_RE = re.compile(r"^(To|Para|Cc|CC|Copia)\s*:\s*(.+)$", re.IGNORECASE)
SUBJECT_LINE_RE = re.compile(r"^(Subject|Asunto)\s*:\s*(.+)$", re.IGNORECASE)
DATE_LINE_RE = re.compile(
    r"^(Date|Fecha|Enviado el|Sent|Reply-To)\s*:\s*(.+)$",
    re.IGNORECASE,
)
CLOSING_LINE_RE = re.compile(
    r"^(atentamente|cordialmente|saludos|gracias|gesti[oó]n documental|"
    r"secretar[ií]a|oficina de|unidad de|dependencia)",
    re.IGNORECASE,
)
SIG_DELIMITER_RE = re.compile(r"^(-{2,}|_{3,})$")


@dataclass
class EntityEmailContext:
    entity_name: str = ""
    entity_email: str = ""
    entity_phone: str = ""
    entity_address: str = ""
    entity_nit: str = ""
    entity_footer: str = ""
    remitente_email: str = ""
    remitente_name: str = ""
    secretaria_names: list[str] = field(default_factory=list)
    fingerprints: set[str] = field(default_factory=set)


@dataclass
class ForwardedEmailMeta:
    """Metadatos del mensaje original dentro de un reenvío."""

    body: str
    from_email: str | None = None
    from_name: str | None = None
    to_emails: list[str] = field(default_factory=list)
    subject: str | None = None

    @property
    def citizen_emails(self) -> list[str]:
        """Correos del solicitante (excluye bandeja y funcionario que reenvía)."""
        seen: set[str] = set()
        ordered: list[str] = []
        for addr in ([self.from_email] if self.from_email else []) + self.to_emails:
            key = (addr or "").strip().lower()
            if not key or key in seen:
                continue
            seen.add(key)
            ordered.append(key)
        return ordered


def _normalize_text(value: str) -> str:
    if not value:
        return ""
    text = unicodedata.normalize("NFKD", value)
    text = "".join(ch for ch in text if not unicodedata.combining(ch))
    text = re.sub(r"\s+", " ", text.lower().strip())
    return text


def _digits_only(value: str) -> str:
    return re.sub(r"\D", "", value or "")


def build_entity_email_context(entity: Entity, user: User | None = None) -> EntityEmailContext:
    ctx = EntityEmailContext(
        entity_name=(entity.name or "").strip(),
        entity_email=(entity.email or "").strip().lower(),
        entity_phone=(entity.phone or "").strip(),
        entity_address=(entity.address or "").strip(),
        entity_nit=(entity.nit or "").strip(),
        remitente_email=(user.email or "").strip().lower() if user else "",
        remitente_name=(user.full_name or "").strip() if user else "",
        secretaria_names=list(
            Secretaria.objects.filter(entity_id=entity.id, is_active=True)
            .values_list("nombre", flat=True)
        ),
    )
    fps: set[str] = set()
    for raw in (
        ctx.entity_name,
        ctx.entity_email,
        ctx.entity_phone,
        ctx.entity_address,
        ctx.entity_nit,
        ctx.entity_footer,
        ctx.remitente_email,
        ctx.remitente_name,
        *ctx.secretaria_names,
    ):
        norm = _normalize_text(raw)
        if len(norm) >= 4:
            fps.add(norm)
        phone_digits = _digits_only(raw)
        if len(phone_digits) >= 7:
            fps.add(phone_digits)
    for email in (ctx.entity_email, ctx.remitente_email):
        if email and "@" in email:
            fps.add(email.split("@", 1)[1])
    ctx.fingerprints = fps
    return ctx


def _parse_address_list(raw: str) -> list[tuple[str, str]]:
    """Retorna [(nombre, email), ...] desde una línea From/To."""
    return [(name.strip(), addr.strip().lower()) for name, addr in getaddresses([raw]) if addr.strip()]


def _is_receiving_inbox_email(email: str, ctx: EntityEmailContext) -> bool:
    """True si el correo es quien reenvía o la bandeja de ESTA entidad (no otro solicitante)."""
    addr = (email or "").strip().lower()
    if not addr or "@" not in addr:
        return True
    if addr == ctx.remitente_email:
        return True
    if ctx.entity_email and addr == ctx.entity_email:
        return True
    return False


def _collect_solicitante_emails(
    from_email: str,
    to_emails: list[str],
    ctx: EntityEmailContext,
) -> list[str]:
    """From original + To/Cc adicionales; excluye solo bandeja/reenviador de esta entidad."""
    seen: set[str] = set()
    ordered: list[str] = []
    candidates = ([from_email] if from_email else []) + to_emails
    for raw in candidates:
        addr = (raw or "").strip().lower()
        if not addr or addr in seen or _is_receiving_inbox_email(addr, ctx):
            continue
        seen.add(addr)
        ordered.append(addr)
    return ordered


def parse_forwarded_email(text: str, ctx: EntityEmailContext) -> ForwardedEmailMeta:
    """Extrae metadatos del mensaje original reenviado y su cuerpo."""
    lines = text.splitlines()
    meta = ForwardedEmailMeta(body=text.strip())
    start = 0
    from_name = ""
    from_email = ""
    to_emails: list[str] = []
    subject = ""

    for i, line in enumerate(lines):
        if not FORWARD_MARKER_RE.match(line.strip()):
            continue
        start = i + 1
        while start < len(lines):
            stripped = lines[start].strip()
            if not stripped:
                start += 1
                continue
            from_match = FROM_LINE_RE.match(stripped)
            if from_match:
                addrs = _parse_address_list(from_match.group(2))
                if addrs:
                    from_name, from_email = addrs[0]
                start += 1
                continue
            to_match = TO_LINE_RE.match(stripped)
            if to_match:
                to_emails.extend(addr for _, addr in _parse_address_list(to_match.group(2)))
                start += 1
                continue
            subj_match = SUBJECT_LINE_RE.match(stripped)
            if subj_match:
                subject = subj_match.group(2).strip()
                start += 1
                continue
            if DATE_LINE_RE.match(stripped):
                start += 1
                continue
            break
        break

    body = "\n".join(lines[start:]).strip() if start > 0 else text.strip()
    body = strip_entity_footer(body, ctx)

    solicitante_emails = _collect_solicitante_emails(from_email, to_emails, ctx)
    primary_from = solicitante_emails[0] if solicitante_emails else None

    meta.body = body
    meta.from_email = primary_from
    meta.from_name = from_name if from_name and not _value_matches_entity(from_name, ctx) else None
    meta.to_emails = solicitante_emails[1:] if len(solicitante_emails) > 1 else []
    meta.subject = subject or None
    return meta


def extract_forwarded_body(text: str) -> str:
    """Conserva el cuerpo del mensaje reenviado (Gmail/Outlook/español)."""
    lines = text.splitlines()
    start = 0
    for i, line in enumerate(lines):
        if not FORWARD_MARKER_RE.match(line.strip()):
            continue
        start = i + 1
        while start < len(lines):
            stripped = lines[start].strip()
            if not stripped:
                start += 1
                continue
            if (
                FROM_LINE_RE.match(stripped)
                or TO_LINE_RE.match(stripped)
                or SUBJECT_LINE_RE.match(stripped)
                or DATE_LINE_RE.match(stripped)
            ):
                start += 1
                continue
            break
        break
    if start > 0:
        return "\n".join(lines[start:]).strip()
    return text.strip()


def _line_matches_fingerprint(line: str, ctx: EntityEmailContext) -> bool:
    norm = _normalize_text(line)
    if len(norm) < 3:
        return False
    for fp in ctx.fingerprints:
        if len(fp) < 4:
            continue
        if fp in norm or norm in fp:
            return True
    line_digits = _digits_only(line)
    if line_digits and len(line_digits) >= 7:
        entity_phone = _digits_only(ctx.entity_phone)
        if entity_phone and entity_phone in line_digits:
            return True
    return False


def strip_entity_footer(text: str, ctx: EntityEmailContext) -> str:
    """Elimina pie de página / firma de la entidad que reenvía."""
    if not text:
        return text

    cleaned = text
    if ctx.entity_footer and len(ctx.entity_footer) >= 12:
        pattern = re.escape(ctx.entity_footer)
        cleaned = re.sub(pattern, "", cleaned, flags=re.IGNORECASE)

    lines = cleaned.splitlines()
    cut_at = len(lines)
    in_footer = False

    for idx in range(len(lines) - 1, -1, -1):
        line = lines[idx].strip()
        if not line:
            if in_footer:
                cut_at = idx
            continue
        if _line_matches_fingerprint(line, ctx):
            in_footer = True
            cut_at = idx
            continue
        if SIG_DELIMITER_RE.match(line):
            in_footer = True
            cut_at = idx
            continue
        if in_footer and CLOSING_LINE_RE.match(line):
            cut_at = idx
            continue
        if in_footer:
            break

    if in_footer and cut_at < len(lines):
        lines = lines[:cut_at]

    return "\n".join(lines).strip()


def prepare_inbound_email_text(text: str, entity: Entity, user: User | None = None) -> ForwardedEmailMeta:
    """Parsea reenvío: metadatos del ciudadano + cuerpo sin firma institucional."""
    ctx = build_entity_email_context(entity, user)
    return parse_forwarded_email(text, ctx)


def build_inbound_ia_context(meta: ForwardedEmailMeta) -> str:
    """Hint para la IA con el remitente original del correo reenviado."""
    parts: list[str] = []
    if meta.from_email:
        if meta.from_name:
            parts.append(f"Remitente original: {meta.from_name} <{meta.from_email}>")
        else:
            parts.append(f"Remitente original: {meta.from_email}")
    extra = [e for e in meta.citizen_emails if e != meta.from_email]
    if extra:
        parts.append(f"Otros correos del ciudadano en el hilo: {', '.join(extra)}")
    if meta.subject:
        parts.append(f"Asunto original: {meta.subject}")
    return "\n".join(parts)


def apply_original_sender_to_extraction(
    extraido: dict,
    meta: ForwardedEmailMeta,
    entity: Entity,
    user: User | None = None,
) -> dict:
    """Prioriza correo y nombre del mensaje original reenviado."""
    ctx = build_entity_email_context(entity, user)
    result = dict(extraido)

    citizen_emails = meta.citizen_emails

    if citizen_emails:
        result["email_ciudadano"] = ", ".join(citizen_emails)
        result["medio_respuesta"] = "email"

    if meta.from_name and not _value_matches_entity(meta.from_name, ctx):
        ai_name = result.get("nombre_ciudadano")
        if not ai_name or _value_matches_entity(ai_name, ctx):
            result["nombre_ciudadano"] = meta.from_name

    return normalize_ia_contact_fields(result)


def _value_matches_entity(value: str | None, ctx: EntityEmailContext) -> bool:
    if not value:
        return False
    norm = _normalize_text(value)
    if len(norm) < 3:
        return False
    for fp in ctx.fingerprints:
        if len(fp) < 4:
            continue
        if fp == norm or fp in norm or norm in fp:
            return True
    if "@" in value and _is_receiving_inbox_email(value, ctx):
        return True
    value_digits = _digits_only(value)
    entity_digits = _digits_only(ctx.entity_nit) or _digits_only(ctx.entity_phone)
    if value_digits and entity_digits and value_digits == entity_digits:
        return True
    return False


def scrub_entity_from_extraction(
    extraido: dict,
    entity: Entity,
    user: User | None = None,
) -> dict:
    """Quita datos de contacto que pertenecen a la entidad reenviadora, no al ciudadano."""
    ctx = build_entity_email_context(entity, user)
    result = dict(extraido)

    email_raw = result.get("email_ciudadano")
    if email_raw:
        kept = [
            part.strip()
            for part in str(email_raw).replace(";", ",").split(",")
            if part.strip() and not _is_receiving_inbox_email(part.strip(), ctx)
        ]
        result["email_ciudadano"] = ", ".join(kept) if kept else None

    for field in (
        "nombre_ciudadano",
        "telefono_ciudadano",
        "direccion_ciudadano",
        "cedula_ciudadano",
    ):
        if _value_matches_entity(result.get(field), ctx):
            result[field] = None

    entity_norm = _normalize_text(ctx.entity_name)
    nombre = _normalize_text(result.get("nombre_ciudadano") or "")
    if entity_norm and nombre and (
        "alcaldia" in nombre
        or "personeria" in nombre
        or "concejo" in nombre
        or "gobernacion" in nombre
        or "secretaria" in nombre
    ):
        if entity_norm in nombre or nombre in entity_norm:
            result["nombre_ciudadano"] = None

    if result.get("tipo_identificacion") == "NIT" and _value_matches_entity(
        result.get("cedula_ciudadano"), ctx
    ):
        result["tipo_identificacion"] = "CC"
        result["tipo_persona"] = "natural"

    return normalize_ia_contact_fields(result)
