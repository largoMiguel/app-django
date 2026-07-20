"""URLs firmadas para entrega de archivos vía Cloudflare Worker."""
from __future__ import annotations

import hashlib
import hmac
import time
import urllib.parse

from django.conf import settings


def _sign_message(bucket: str, key: str, exp: int) -> str:
    normalized_key = key.lstrip("/")
    path = f"{bucket}/{normalized_key}"
    msg = f"{path}?exp={exp}".encode()
    return hmac.new(
        settings.FILE_DELIVERY_SIGNING_KEY.encode(),
        msg,
        hashlib.sha256,
    ).hexdigest()


def verify_signed_file_url(bucket: str, key: str, exp: str | int | None, sig: str | None) -> bool:
    if not settings.FILE_DELIVERY_SIGNING_KEY or not exp or not sig:
        return False
    try:
        exp_int = int(exp)
    except (TypeError, ValueError):
        return False
    if exp_int < int(time.time()):
        return False
    expected = _sign_message(bucket, key, exp_int)
    return hmac.compare_digest(expected, sig)


def signed_file_url(
    bucket: str,
    key: str,
    *,
    filename: str | None = None,
    ttl: int | None = None,
) -> str:
    """Genera URL temporal firmada para files.softone360.com/{bucket}/{key}."""
    if not settings.FILE_DELIVERY_SIGNING_KEY:
        raise RuntimeError("FILE_DELIVERY_SIGNING_KEY no configurada.")

    exp = int(time.time()) + (ttl or settings.FILE_DELIVERY_TTL)
    normalized_key = key.lstrip("/")
    path = f"{bucket}/{normalized_key}"
    sig = _sign_message(bucket, key, exp)

    qs: dict[str, str | int] = {"exp": exp, "sig": sig}
    if filename:
        qs["dl"] = filename

    base = settings.FILE_DELIVERY_BASE_URL.rstrip("/")
    return f"{base}/{path}?{urllib.parse.urlencode(qs)}"


def signed_pqrs_url(key: str, *, filename: str | None = None) -> str:
    return signed_file_url(settings.B2_BUCKET_PQRS, key, filename=filename)


def signed_pdm_url(key: str, *, filename: str | None = None) -> str:
    return signed_file_url(settings.B2_BUCKET_PDM, key, filename=filename)


def signed_asistencia_url(key: str, *, filename: str | None = None) -> str:
    return signed_file_url(settings.B2_BUCKET_ASISTENCIA, key, filename=filename)


def signed_correspondencia_url(key: str, *, filename: str | None = None) -> str:
    return signed_file_url(settings.B2_BUCKET_CORRESPONDENCIA, key, filename=filename)
