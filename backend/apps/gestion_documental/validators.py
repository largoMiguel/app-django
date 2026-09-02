"""Validación de archivos — Gestión documental."""
from __future__ import annotations

from rest_framework.exceptions import ValidationError

MAX_INSTRUMENTO_BYTES = 25 * 1024 * 1024
MAX_DOCUMENTO_BYTES = 25 * 1024 * 1024

ALLOWED_EXTENSIONS = {
    ".pdf",
    ".doc",
    ".docx",
    ".xls",
    ".xlsx",
    ".csv",
    ".txt",
    ".png",
    ".jpg",
    ".jpeg",
    ".webp",
    ".zip",
}


def _ext(name: str) -> str:
    if "." not in name:
        return ""
    return "." + name.rsplit(".", 1)[-1].lower()


def validate_archivo(name: str, size: int, *, max_bytes: int = MAX_DOCUMENTO_BYTES) -> None:
    ext = _ext(name)
    if ext not in ALLOWED_EXTENSIONS:
        raise ValidationError({"archivo": f"Formato no permitido ({ext or 'sin extensión'})."})
    if size <= 0:
        raise ValidationError({"archivo": "Archivo vacío."})
    if size > max_bytes:
        raise ValidationError({"archivo": f"Tamaño máximo {max_bytes // (1024 * 1024)} MB."})
