"""Catálogo de tipos de informe Planes Institucionales."""
from __future__ import annotations

from apps.planes.models import InformePlanTipo

TIPOS_INFORME_HABILITADOS = frozenset({InformePlanTipo.SEGUIMIENTO_D612})


def tipo_informe_habilitado(tipo: str) -> bool:
    return tipo in TIPOS_INFORME_HABILITADOS


def storage_slug_for_tipo(tipo: str) -> str:
    if tipo == InformePlanTipo.SEGUIMIENTO_D612:
        return "seguimiento"
    return "seguimiento"
