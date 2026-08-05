"""Validación de archivos subidos a evidencias de Planes Institucionales."""
from __future__ import annotations

import os

from rest_framework.exceptions import ValidationError

MAX_EVIDENCIA_ARCHIVOS = 5
MAX_EVIDENCIA_UPLOAD_BYTES = 20 * 1024 * 1024  # 20 MB
ALLOWED_EVIDENCIA_EXTENSIONS = {
    ".pdf",
    ".doc",
    ".docx",
    ".xls",
    ".xlsx",
    ".png",
    ".jpg",
    ".jpeg",
    ".webp",
}


def validate_evidencia_archivo(filename: str, size: int, *, field: str = "archivos") -> None:
    ext = os.path.splitext(filename or "")[1].lower()
    if ext not in ALLOWED_EVIDENCIA_EXTENSIONS:
        raise ValidationError(
            {field: f"Tipo de archivo no permitido ({ext or 'sin extensión'})."}
        )
    if size > MAX_EVIDENCIA_UPLOAD_BYTES:
        raise ValidationError(
            {field: f"El archivo supera el límite de {MAX_EVIDENCIA_UPLOAD_BYTES // (1024 * 1024)} MB."}
        )
