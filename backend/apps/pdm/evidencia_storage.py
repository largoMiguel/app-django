"""Helpers para archivos de evidencia PDM."""
from __future__ import annotations

from django.core.files.base import ContentFile
from rest_framework.exceptions import ValidationError

from .models import PdmEvidenciaArchivo
from .validators import MAX_EVIDENCIA_ARCHIVOS, validate_evidencia_image


def _files_from_request(request) -> list:
    files = request.FILES.getlist("archivos") or request.FILES.getlist("archivos[]")
    if not files and "archivo" in request.FILES:
        files = [request.FILES["archivo"]]
    return list(files)


def _parse_archivos_eliminar(raw) -> list[int]:
    if raw is None or raw == "":
        return []
    if isinstance(raw, (list, tuple)):
        items = raw
    else:
        items = str(raw).split(",")
    ids: list[int] = []
    for item in items:
        item = str(item).strip()
        if not item:
            continue
        try:
            ids.append(int(item))
        except ValueError as exc:
            raise ValidationError({"archivos_eliminar": "IDs de archivo inválidos."}) from exc
    return ids


def attach_evidencia_archivos(evidencia, files: list, user) -> None:
    existentes = evidencia.archivos.count()
    disponibles = MAX_EVIDENCIA_ARCHIVOS - existentes
    if disponibles <= 0:
        raise ValidationError(
            {"archivos": f"Ya se alcanzó el límite de {MAX_EVIDENCIA_ARCHIVOS} imágenes."}
        )
    a_subir = files[:disponibles]
    if len(files) > disponibles:
        raise ValidationError(
            {"archivos": f"Solo puedes subir {disponibles} imagen(es) más (máx {MAX_EVIDENCIA_ARCHIVOS})."}
        )
    for f in a_subir:
        filename = getattr(f, "name", "imagen.jpg")
        content = f.read() if hasattr(f, "read") else b""
        size = getattr(f, "size", len(content)) or len(content)
        validate_evidencia_image(filename, size)
        try:
            f.seek(0)
        except Exception:  # noqa: BLE001
            pass
        arch = PdmEvidenciaArchivo(
            evidencia=evidencia,
            nombre_original=filename,
            content_type=getattr(f, "content_type", "") or "",
            size=size,
            uploaded_by=user if getattr(user, "is_authenticated", False) else None,
        )
        arch.archivo.save(filename, ContentFile(content), save=False)
        arch.save()


def remove_evidencia_archivos(evidencia, archivo_ids: list[int]) -> None:
    if not archivo_ids:
        return
    for arch in evidencia.archivos.filter(id__in=archivo_ids):
        if arch.archivo:
            arch.archivo.delete(save=False)
        arch.delete()


def sync_evidencia_archivos_from_request(evidencia, request, user) -> None:
    eliminar_ids = _parse_archivos_eliminar(request.data.get("archivos_eliminar"))
    remove_evidencia_archivos(evidencia, eliminar_ids)
    attach_evidencia_archivos(evidencia, _files_from_request(request), user)
