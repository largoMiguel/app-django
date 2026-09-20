"""Cifrado Fernet para refresh tokens OAuth."""
from __future__ import annotations

import base64
import hashlib

from cryptography.fernet import Fernet, InvalidToken
from django.conf import settings


def _fernet() -> Fernet:
    raw = (getattr(settings, "GOOGLE_TOKEN_ENCRYPTION_KEY", "") or "").strip()
    if not raw:
        raise RuntimeError("GOOGLE_TOKEN_ENCRYPTION_KEY no configurada.")
    try:
        key = raw.encode("ascii")
        base64.urlsafe_b64decode(key + b"=" * (-len(key) % 4))
        return Fernet(key)
    except Exception:
        digest = hashlib.sha256(raw.encode("utf-8")).digest()
        return Fernet(base64.urlsafe_b64encode(digest))


def encrypt_refresh_token(plain: str) -> bytes:
    if not plain:
        raise ValueError("refresh_token vacío.")
    return _fernet().encrypt(plain.encode("utf-8"))


def decrypt_refresh_token(cipher: bytes) -> str:
    try:
        return _fernet().decrypt(cipher).decode("utf-8")
    except InvalidToken as exc:
        raise ValueError("No se pudo descifrar el refresh token.") from exc
