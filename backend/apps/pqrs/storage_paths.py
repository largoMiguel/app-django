"""Rutas de almacenamiento PQRS en B2 / media local."""
from __future__ import annotations

import os
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from .models import PQRS


def pqrs_radicado_prefix(pqrs: PQRS) -> str:
    """Prefijo: entities/<entity_id>/<numero_radicado>."""
    return f"entities/{pqrs.entity_id}/{pqrs.numero_radicado}"


def pqrs_solicitud_path(pqrs: PQRS, filename: str) -> str:
    """Adjuntos del ciudadano: entities/<entity_id>/<radicado>/solicitud/<archivo>."""
    safe_name = os.path.basename(filename)
    return f"{pqrs_radicado_prefix(pqrs)}/solicitud/{safe_name}"


def pqrs_respuesta_path(pqrs: PQRS, filename: str) -> str:
    """Adjunto de respuesta: entities/<entity_id>/<radicado>/respuesta/<archivo>."""
    safe_name = os.path.basename(filename)
    return f"{pqrs_radicado_prefix(pqrs)}/respuesta/{safe_name}"
