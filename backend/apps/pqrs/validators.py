"""Validación de archivos subidos a PQRS."""
from __future__ import annotations

import os

from rest_framework.exceptions import ValidationError

MAX_UPLOAD_BYTES = 10 * 1024 * 1024  # 10 MB
ALLOWED_EXTENSIONS = {
    ".pdf",
    ".docx",
    ".txt",
    ".md",
    ".csv",
    ".png",
    ".jpg",
    ".jpeg",
    ".gif",
    ".webp",
}


def validate_uploaded_file(filename: str, size: int, *, field: str = "archivos") -> None:
    ext = os.path.splitext(filename or "")[1].lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise ValidationError(
            {field: f"Tipo de archivo no permitido ({ext or 'sin extensión'})."}
        )
    if size > MAX_UPLOAD_BYTES:
        raise ValidationError(
            {field: f"El archivo supera el límite de {MAX_UPLOAD_BYTES // (1024 * 1024)} MB."}
        )
