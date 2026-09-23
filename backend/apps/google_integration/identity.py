"""Verificación de tokens Google (Add-on HTTP)."""
from __future__ import annotations

import logging
from typing import Any

from django.conf import settings
from google.auth.transport import requests as google_requests
from google.oauth2 import id_token

logger = logging.getLogger(__name__)


def _audiences() -> list[str]:
    auds: list[str] = []
    for key in ("GOOGLE_ADDON_CLIENT_ID", "GOOGLE_CLIENT_ID"):
        val = (getattr(settings, key, "") or "").strip()
        if val and val not in auds:
            auds.append(val)
    return auds


def verify_google_id_token(token: str) -> dict[str, Any]:
    """Legacy: prueba client IDs OAuth (userIdToken del add-on)."""
    if not token:
        raise ValueError("Token vacío.")
    audiences = _audiences()
    if not audiences:
        raise RuntimeError("GOOGLE_ADDON_CLIENT_ID o GOOGLE_CLIENT_ID no configurados.")
    last_exc: Exception | None = None
    for aud in audiences:
        try:
            return id_token.verify_oauth2_token(
                token,
                google_requests.Request(),
                audience=aud,
            )
        except Exception as exc:  # noqa: BLE001
            last_exc = exc
            continue
    raise ValueError("Token de Google inválido.") from last_exc


def verify_user_id_token(token: str) -> dict[str, Any]:
    """userIdToken: audience = OAuth client ID del add-on (HTTP Deployments)."""
    addon_id = (getattr(settings, "GOOGLE_ADDON_CLIENT_ID", "") or "").strip()
    if addon_id:
        try:
            return id_token.verify_oauth2_token(
                token,
                google_requests.Request(),
                audience=addon_id,
            )
        except Exception as exc:  # noqa: BLE001
            logger.debug("userIdToken con GOOGLE_ADDON_CLIENT_ID falló: %s", exc)
    return verify_google_id_token(token)


def verify_system_id_token(token: str, http_endpoint: str) -> dict[str, Any]:
    """systemIdToken: audience = URL HTTPS del endpoint invocado + email SA del add-on."""
    if not token:
        raise ValueError("Token vacío.")
    endpoint = (http_endpoint or "").strip()
    if not endpoint:
        raise ValueError("Falta URL del endpoint para validar systemIdToken.")
    endpoint = endpoint.split("?", 1)[0].rstrip("/")
    candidates = [endpoint]
    if not endpoint.endswith("/"):
        candidates.append(endpoint + "/")

    last_exc: Exception | None = None
    claims: dict[str, Any] | None = None
    for aud in candidates:
        try:
            claims = id_token.verify_oauth2_token(
                token,
                google_requests.Request(),
                audience=aud,
            )
            break
        except Exception as exc:  # noqa: BLE001
            last_exc = exc
            continue
    if claims is None:
        raise ValueError("Token de Google inválido (systemIdToken).") from last_exc

    expected_sa = (getattr(settings, "GOOGLE_ADDON_SERVICE_ACCOUNT_EMAIL", "") or "").strip().lower()
    if expected_sa:
        email = (claims.get("email") or "").strip().lower()
        if email != expected_sa:
            raise ValueError("systemIdToken: cuenta de servicio del add-on no coincide.")
    return claims


def email_from_id_token_claims(claims: dict[str, Any]) -> str:
    email = (claims.get("email") or "").strip().lower()
    if not email:
        raise ValueError("El token no incluye email.")
    if claims.get("email_verified") is False:
        raise ValueError("Email de Google no verificado.")
    return email


def extract_addon_auth(event: dict[str, Any]) -> tuple[str, str, str]:
    """Retorna (user_oauth_token, user_id_token, system_id_token)."""
    auth = event.get("authorizationEventObject") or {}
    user_oauth = (auth.get("userOAuthToken") or "").strip()
    user_id = (auth.get("userIdToken") or "").strip()
    system_id = (auth.get("systemIdToken") or "").strip()
    if not user_id:
        raise ValueError("Falta userIdToken en el evento de Gmail.")
    if not system_id:
        raise ValueError("Falta systemIdToken en el evento de Gmail.")
    return user_oauth, user_id, system_id


def extract_gmail_message_context(event: dict[str, Any]) -> tuple[str, str, str]:
    gmail = event.get("gmail") or {}
    message_id = (gmail.get("messageId") or "").strip()
    thread_id = (gmail.get("threadId") or "").strip()
    access_token = (gmail.get("accessToken") or "").strip()
    if not message_id:
        raise ValueError("Falta gmail.messageId.")
    if not access_token:
        raise ValueError("Falta gmail.accessToken.")
    return message_id, thread_id, access_token
