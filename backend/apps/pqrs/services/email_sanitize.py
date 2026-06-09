"""Limpieza de correos reenviados: extraer cuerpo ciudadano e ignorar pie de página de la entidad."""
from __future__ import annotations

import re
import unicodedata
from dataclasses import dataclass, field

from apps.accounts.models import User
from apps.entities.models import Entity, Secretaria
from apps.pqrs.services.ai import normalize_ia_contact_fields

FORWARD_MARKER_RE = re.compile(
    r"^(-{3,}\s*(?:Forwarded message|Mensaje reenviado|Original Message)\s*-{3,}|"
    r"-----Original Message-----)$",
    re.IGNORECASE,
)
FORWARD_HEADER_RE = re.compile(
    r"^(From|De|Date|Fecha|Subject|Asunto|To|Para|Cc|Enviado el|Sent|Reply-To):",
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
        entity_footer=(entity.footer_text or "").strip(),
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
            if FORWARD_HEADER_RE.match(stripped):
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


def prepare_inbound_email_text(text: str, entity: Entity, user: User | None = None) -> str:
    """Texto listo para IA: cuerpo reenviado sin firma institucional."""
    ctx = build_entity_email_context(entity, user)
    body = extract_forwarded_body(text)
    body = strip_entity_footer(body, ctx)
    return body.strip()


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
    if "@" in value:
        domain = value.split("@", 1)[1].lower()
        if domain.endswith(".gov.co") and ctx.remitente_email.endswith(f"@{domain}"):
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

    for field in (
        "nombre_ciudadano",
        "email_ciudadano",
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
