"""Catálogo de tipos de informe PDM."""
from __future__ import annotations

from apps.pdm.models import InformePdmTipo

TIPOS_INFORME_HABILITADOS = frozenset({InformePdmTipo.AVANCE})


def tipo_informe_habilitado(tipo: str) -> bool:
    return tipo in TIPOS_INFORME_HABILITADOS


def storage_slug_for_tipo(tipo: str) -> str:
    if tipo == InformePdmTipo.GESTION:
        return "gestion"
    return "avance"
