"""Cliente Gmail API vía urllib (sin SDK pesado)."""
from __future__ import annotations

import json
import logging
import ssl
import urllib.error
import urllib.parse
import urllib.request
from typing import Any

import certifi
from django.conf import settings
from django.utils import timezone

from apps.google_integration.crypto import decrypt_refresh_token
from apps.google_integration.errors import GmailIntegrationError, map_http_error
from apps.google_integration.models import GoogleConnectionStatus, GoogleEmailConnection

logger = logging.getLogger(__name__)

GMAIL_API = "https://gmail.googleapis.com/gmail/v1"
TOKEN_URL = "https://oauth2.googleapis.com/token"


def _ssl_context() -> ssl.SSLContext:
    return ssl.create_default_context(cafile=certifi.where())


def _request_json(
    url: str,
    *,
    method: str = "GET",
    headers: dict[str, str] | None = None,
    body: bytes | None = None,
    timeout: int = 30,
) -> dict[str, Any]:
    req = urllib.request.Request(url, data=body, headers=headers or {}, method=method)
    try:
        with urllib.request.urlopen(req, timeout=timeout, context=_ssl_context()) as resp:
            raw = resp.read().decode("utf-8")
            return json.loads(raw) if raw else {}
    except urllib.error.HTTPError as exc:
        err_body = exc.read().decode("utf-8", errors="ignore")
        raise map_http_error(exc.code, err_body) from exc
    except GmailIntegrationError:
        raise
    except Exception as exc:  # noqa: BLE001
        raise GmailIntegrationError(str(exc)[:500], code="network", retryable=True) from exc


def refresh_access_token(refresh_token: str) -> dict[str, Any]:
    client_id = (settings.GOOGLE_CLIENT_ID or "").strip()
    client_secret = (settings.GOOGLE_CLIENT_SECRET or "").strip()
    if not client_id or not client_secret:
        raise RuntimeError("GOOGLE_CLIENT_ID/SECRET no configurados.")
    data = urllib.parse.urlencode(
        {
            "client_id": client_id,
            "client_secret": client_secret,
            "refresh_token": refresh_token,
            "grant_type": "refresh_token",
        }
    ).encode("utf-8")
    req = urllib.request.Request(
        TOKEN_URL,
        data=data,
        headers={"Content-Type": "application/x-www-form-urlencoded"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=30, context=_ssl_context()) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        err_body = exc.read().decode("utf-8", errors="ignore")
        raise map_http_error(exc.code, err_body) from exc


def get_access_token_for_connection(conn: GoogleEmailConnection) -> str:
    plain = decrypt_refresh_token(bytes(conn.encrypted_refresh_token))
    token_data = refresh_access_token(plain)
    access = token_data.get("access_token")
    if not access:
        conn.status = GoogleConnectionStatus.REQUIERE_REAUTORIZACION
        conn.save(update_fields=["status", "updated_at"])
        raise GmailIntegrationError(
            "No se pudo renovar el acceso a Gmail.",
            code="requiere_reautorizacion",
        )
    conn.last_used_at = timezone.now()
    if conn.status != GoogleConnectionStatus.ACTIVA:
        conn.status = GoogleConnectionStatus.ACTIVA
    conn.save(update_fields=["last_used_at", "status", "updated_at"])
    return str(access)


def fetch_message(
    access_token: str,
    message_id: str,
    *,
    format: str = "full",
) -> dict[str, Any]:
    url = f"{GMAIL_API}/users/me/messages/{urllib.parse.quote(message_id)}?format={format}"
    return _request_json(
        url,
        headers={"Authorization": f"Bearer {access_token}"},
    )


def fetch_attachment(
    access_token: str,
    message_id: str,
    attachment_id: str,
) -> bytes:
    url = (
        f"{GMAIL_API}/users/me/messages/{urllib.parse.quote(message_id)}"
        f"/attachments/{urllib.parse.quote(attachment_id)}"
    )
    data = _request_json(url, headers={"Authorization": f"Bearer {access_token}"})
    raw = data.get("data") or ""
    if not raw:
        return b""
    import base64

    padded = raw + "=" * (-len(raw) % 4)
    return base64.urlsafe_b64decode(padded.encode("ascii"))


def send_raw_message(
    access_token: str,
    *,
    raw_rfc822_b64url: str,
    thread_id: str | None = None,
) -> dict[str, Any]:
    payload: dict[str, Any] = {"raw": raw_rfc822_b64url}
    if thread_id:
        payload["threadId"] = thread_id
    body = json.dumps(payload).encode("utf-8")
    return _request_json(
        f"{GMAIL_API}/users/me/messages/send",
        method="POST",
        headers={
            "Authorization": f"Bearer {access_token}",
            "Content-Type": "application/json",
        },
        body=body,
    )


def exchange_oauth_code(code: str, redirect_uri: str) -> dict[str, Any]:
    client_id = (settings.GOOGLE_CLIENT_ID or "").strip()
    client_secret = (settings.GOOGLE_CLIENT_SECRET or "").strip()
    data = urllib.parse.urlencode(
        {
            "code": code,
            "client_id": client_id,
            "client_secret": client_secret,
            "redirect_uri": redirect_uri,
            "grant_type": "authorization_code",
        }
    ).encode("utf-8")
    req = urllib.request.Request(
        TOKEN_URL,
        data=data,
        headers={"Content-Type": "application/x-www-form-urlencoded"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=30, context=_ssl_context()) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        err_body = exc.read().decode("utf-8", errors="ignore")
        raise map_http_error(exc.code, err_body) from exc
