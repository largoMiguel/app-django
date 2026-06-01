"""Validación de archivos subidos a evidencias PDM."""
from __future__ import annotations

import os

from rest_framework.exceptions import ValidationError

MAX_EVIDENCIA_ARCHIVOS = 4
MAX_EVIDENCIA_UPLOAD_BYTES = 10 * 1024 * 1024  # 10 MB
ALLOWED_IMAGE_EXTENSIONS = {
    ".png",
    ".jpg",
    ".jpeg",
    ".gif",
    ".webp",
}


def validate_evidencia_image(filename: str, size: int, *, field: str = "archivos") -> None:
    ext = os.path.splitext(filename or "")[1].lower()
    if ext not in ALLOWED_IMAGE_EXTENSIONS:
        raise ValidationError(
            {field: f"Tipo de imagen no permitido ({ext or 'sin extensión'})."}
        )
    if size > MAX_EVIDENCIA_UPLOAD_BYTES:
        raise ValidationError(
            {field: f"La imagen supera el límite de {MAX_EVIDENCIA_UPLOAD_BYTES // (1024 * 1024)} MB."}
        )
