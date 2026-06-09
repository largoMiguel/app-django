"""Rutas de almacenamiento PDM en B2 / media local."""
from __future__ import annotations

import os
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from .models import PdmActividad, PdmActividadEvidencia


def _safe_path_segment(value: str) -> str:
    return value.replace("/", "_").replace("\\", "_").strip() or "sin-codigo"


def pdm_evidencia_prefix(evidencia: PdmActividadEvidencia) -> str:
    """Prefijo: entities/<entity_id>/pdm/evidencias/<codigo_producto>/<anio>."""
    actividad = evidencia.actividad
    codigo = _safe_path_segment(actividad.codigo_producto)
    return f"entities/{evidencia.entity_id}/pdm/evidencias/{codigo}/{actividad.anio}"


def pdm_evidencia_legacy_prefix(evidencia: PdmActividadEvidencia) -> str:
    """Ruta legacy: entities/<entity_id>/pdm/evidencias/<actividad_id>."""
    return f"entities/{evidencia.entity_id}/pdm/evidencias/{evidencia.actividad_id}"


def pdm_evidencia_archivo_path(evidencia: PdmActividadEvidencia, filename: str) -> str:
    """Archivo: entities/<entity_id>/pdm/evidencias/<codigo>/<anio>/<archivo>."""
    safe_name = os.path.basename(filename)
    return f"{pdm_evidencia_prefix(evidencia)}/{safe_name}"
