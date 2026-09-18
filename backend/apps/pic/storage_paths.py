"""Rutas de almacenamiento B2 — PIC."""
from __future__ import annotations

import re
import uuid

from .models import PicEjecucion


def _safe_filename(filename: str) -> str:
    base = re.sub(r"[^\w.\-]", "_", filename or "archivo.pdf")
    if not base.lower().endswith(".pdf"):
        base = f"{base}.pdf"
    return f"{uuid.uuid4().hex[:12]}_{base}"


def pic_ejecucion_prefix(ejecucion: PicEjecucion) -> str:
    act = ejecucion.actividad
    return (
        f"entities/{ejecucion.entity_id}/pic/{act.plan.anio}/"
        f"actividad-{act.numero}/T{ejecucion.trimestre}"
    )


def pic_ejecucion_archivo_path(ejecucion: PicEjecucion, filename: str) -> str:
    return f"{pic_ejecucion_prefix(ejecucion)}/{_safe_filename(filename)}"
