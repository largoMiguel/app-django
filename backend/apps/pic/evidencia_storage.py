"""Helpers para archivos PDF de ejecución — PIC."""
from __future__ import annotations

from django.core.files.base import ContentFile
from rest_framework.exceptions import ValidationError

from .models import PicEjecucionArchivo
from .validators import MAX_EVIDENCIA_ARCHIVOS, validate_evidencia_archivo


def _files_from_request(request) -> list:
    files = request.FILES.getlist("archivos") or request.FILES.getlist("archivos[]")
    if not files and "archivo" in request.FILES:
        files = [request.FILES["archivo"]]
    return list(files)


def attach_ejecucion_archivos(ejecucion, files: list, user) -> None:
    if not files:
        return
    existentes = ejecucion.archivos.count()
    disponibles = MAX_EVIDENCIA_ARCHIVOS - existentes
    if disponibles <= 0:
        raise ValidationError(
            {"archivos": f"Ya se alcanzó el límite de {MAX_EVIDENCIA_ARCHIVOS} archivos PDF."}
        )
    a_subir = files[:disponibles]
    if len(files) > disponibles:
        raise ValidationError(
            {"archivos": f"Solo puedes subir {disponibles} archivo(s) más (máx {MAX_EVIDENCIA_ARCHIVOS})."}
        )
    for f in a_subir:
        filename = getattr(f, "name", "archivo.pdf")
        content = f.read() if hasattr(f, "read") else b""
        size = getattr(f, "size", len(content)) or len(content)
        validate_evidencia_archivo(filename, size)
        try:
            f.seek(0)
        except Exception:  # noqa: BLE001
            pass
        arch = PicEjecucionArchivo(
            ejecucion=ejecucion,
            nombre_original=filename,
            content_type=getattr(f, "content_type", "") or "application/pdf",
            size=size,
            uploaded_by=user if getattr(user, "is_authenticated", False) else None,
        )
        arch.archivo.save(filename, ContentFile(content), save=False)
        arch.save()
