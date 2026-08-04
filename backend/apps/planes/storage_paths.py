"""Rutas de almacenamiento para evidencias de Planes Institucionales."""
from __future__ import annotations

import os
import re

from .models import PlanEvidencia


def _safe_path_segment(value: str) -> str:
    cleaned = re.sub(r"[^\w\-.]+", "_", str(value or "").strip())
    return cleaned[:120] or "plan"


def planes_evidencia_prefix(evidencia: PlanEvidencia) -> str:
    """Prefijo: entities/<entity_id>/planes/evidencias/<codigo>/<anio>/T<trimestre>."""
    actividad = evidencia.actividad
    plan = actividad.plan
    codigo = _safe_path_segment(plan.catalogo.codigo if plan.catalogo_id else plan.nombre)
    return (
        f"entities/{evidencia.entity_id}/planes/evidencias/"
        f"{codigo}/{actividad.anio}/T{actividad.trimestre}"
    )


def planes_evidencia_archivo_path(evidencia: PlanEvidencia, filename: str) -> str:
    safe_name = os.path.basename(filename)
    return f"{planes_evidencia_prefix(evidencia)}/{safe_name}"
