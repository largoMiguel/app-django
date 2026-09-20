"""Caché de previsualización IA del Add-on (token firmado)."""
from __future__ import annotations

import json
import secrets
from typing import Any

from django.core import signing
from django.core.cache import cache

PREVIEW_SALT = "google-addon-pqrs-preview"
PREVIEW_TTL = 600


def store_preview(payload: dict[str, Any]) -> str:
    token = secrets.token_urlsafe(32)
    cache.set(f"gmail_preview:{token}", payload, PREVIEW_TTL)
    signed = signing.dumps({"t": token}, salt=PREVIEW_SALT)
    return signed


def load_preview(signed_token: str) -> dict[str, Any] | None:
    try:
        data = signing.loads(signed_token, salt=PREVIEW_SALT, max_age=PREVIEW_TTL)
    except signing.BadSignature:
        return None
    token = data.get("t")
    if not token:
        return None
    raw = cache.get(f"gmail_preview:{token}")
    if raw is None:
        return None
    if isinstance(raw, dict):
        return raw
    try:
        return json.loads(raw)
    except Exception:  # noqa: BLE001
        return None


def apply_editable_fields(extraido: dict[str, Any], form: dict[str, Any]) -> dict[str, Any]:
    """Solo campos en lista blanca desde la tarjeta."""
    out = dict(extraido)
    allowed_scalar = (
        "tipo_solicitud",
        "asunto",
        "descripcion",
        "nombre_ciudadano",
        "email_ciudadano",
        "telefono_ciudadano",
        "cedula_ciudadano",
        "medio_respuesta",
    )
    for key in allowed_scalar:
        if key in form and form[key] is not None:
            val = form[key]
            if isinstance(val, str):
                val = val.strip()
            out[key] = val or out.get(key)
    if form.get("secretaria_id"):
        try:
            sid = int(form["secretaria_id"])
            out["secretaria_ids"] = [sid]
            out["secretaria_id"] = sid
        except (TypeError, ValueError):
            pass
    return out
