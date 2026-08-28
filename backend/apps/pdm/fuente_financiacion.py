"""Normalización de fuentes de financiación al catálogo MGA/PIIP."""
from __future__ import annotations

import re
import unicodedata

FUENTES_PIIP_CANONICAS = [
    "Propios",
    "SGP - Salud",
    "SGP - Educación",
    "SGP - Propósito General Deporte",
    "SGP - Propósito General Cultura",
    "SGP - Propósito General Libre Inversión",
    "SGP - Propósito General Libre Destinación",
    "SGP - Alimentación Escolar",
    "SGP - Ribereños",
    "SGP - Agua Potable y Saneamiento Básico",
    "SGP - Primera Infancia",
    "Otros",
]

# Tabla de conversión MGA (código contable → categoría PIIP).
FUENTE_CODIGO_MGA: dict[str, str] = {
    "1.2.1.00": "Propios",
    "1.2.3.1.01": "Propios",
    "1.2.3.1.06": "Propios",
    "1.2.3.1.14": "Propios",
    "1.2.3.1.16": "Propios",
    "1.2.3.1.18": "Propios",
    "1.2.3.1.21": "Propios",
    "1.2.3.1.22": "Propios",
    "1.2.3.1.23": "Propios",
    "1.2.3.2.06": "Propios",
    "1.2.3.2.07": "Propios",
    "1.2.3.2.08": "Propios",
    "1.2.3.2.09": "Propios",
    "1.2.3.2.10": "SGP - Salud",
    "1.2.3.3.01": "Propios",
    "1.2.3.3.02": "Propios",
    "1.2.3.4.02": "Propios",
    "1.2.3.4.07": "SGP - Salud",
    "1.2.4.1.01": "SGP - Educación",
    "1.2.4.1.03": "SGP - Educación",
    "1.2.4.1.04": "SGP - Salud",
    "1.2.4.2.01": "SGP - Salud",
    "1.2.4.3.01": "SGP - Propósito General Deporte",
    "1.2.4.3.02": "SGP - Propósito General Cultura",
    "1.2.4.3.03": "SGP - Propósito General Libre Inversión",
    "1.2.4.3.04": "SGP - Propósito General Libre Destinación",
    "1.2.4.4.01": "SGP - Alimentación Escolar",
    "1.2.4.4.02": "SGP - Ribereños",
    "1.2.4.6.00": "SGP - Agua Potable y Saneamiento Básico",
    "1.3.2.2.08": "Propios",
    "1.3.2.2.10": "SGP - Propósito General Libre Destinación",
    "1.3.2.2.11": "SGP - Primera Infancia",
    "1.3.2.3.03": "Propios",
    "1.3.2.3.05": "Propios",
    "1.3.2.3.12": "SGP - Educación",
    "1.3.1.00": "Propios",
    "1.3.3.1.03": "SGP - Agua Potable y Saneamiento Básico",
    "1.3.3.2.00": "Propios",
    "1.3.3.3.11": "Propios",
    "1.3.3.3.15": "Propios",
    "1.3.3.3.17": "Propios",
    "1.3.3.3.18": "Propios",
    "1.3.3.3.19": "Propios",
    "1.3.3.3.20": "Propios",
    "1.3.3.3.21": "Propios",
    "1.3.3.4.08": "Propios",
    "1.3.3.4.15": "Propios",
    "1.3.3.4.22": "Propios",
    "1.3.5.1.04": "Otros",
    "1.3.5.4.05": "Propios",
    "1.3.5.4.022": "Propios",
    "1.3.5.4.08": "SGP - Salud",
    "1.3.3.7.07": "SGP - Salud",
    "1.3.3.7.08": "SGP - Propósito General Cultura",
    "1.3.3.7.09": "SGP - Propósito General Libre Inversión",
    "1.3.3.9.02": "SGP - Propósito General Libre Destinación",
    "1.3.3.9.08": "SGP - Ribereños",
}

_FUENTE_KEYWORDS: list[tuple[str, str]] = [
    ("propios", "Propios"),
    ("sgp salud", "SGP - Salud"),
    ("salud", "SGP - Salud"),
    ("sgp educacion", "SGP - Educación"),
    ("educacion", "SGP - Educación"),
    ("proposito general deporte", "SGP - Propósito General Deporte"),
    ("deporte", "SGP - Propósito General Deporte"),
    ("proposito general cultura", "SGP - Propósito General Cultura"),
    ("cultura", "SGP - Propósito General Cultura"),
    ("libre inversion", "SGP - Propósito General Libre Inversión"),
    ("libre destinacion", "SGP - Propósito General Libre Destinación"),
    ("alimentacion escolar", "SGP - Alimentación Escolar"),
    ("ribere", "SGP - Ribereños"),
    ("agua potable", "SGP - Agua Potable y Saneamiento Básico"),
    ("saneamiento basico", "SGP - Agua Potable y Saneamiento Básico"),
    ("primera infancia", "SGP - Primera Infancia"),
]


def _normalize_key(text: str) -> str:
    nfkd = unicodedata.normalize("NFKD", text)
    sin_acentos = "".join(c for c in nfkd if not unicodedata.combining(c))
    return re.sub(r"\s+", " ", sin_acentos.lower().strip())


_CANONICAL_BY_KEY = {_normalize_key(nombre): nombre for nombre in FUENTES_PIIP_CANONICAS}


def _looks_like_codigo_fuente(text: str) -> bool:
    value = (text or "").strip()
    if not value:
        return False
    return bool(re.match(r"^[\d.]+$", value))


def _lookup_codigo_fuente(codigo: str) -> str | None:
    return FUENTE_CODIGO_MGA.get(codigo.strip())


def _normalizar_por_texto(raw: str) -> str:
    key = _normalize_key(raw)
    if key in _CANONICAL_BY_KEY:
        return _CANONICAL_BY_KEY[key]

    for canon_key, canon_name in _CANONICAL_BY_KEY.items():
        if canon_key in key or key in canon_key:
            return canon_name

    for keyword, canon_name in _FUENTE_KEYWORDS:
        if keyword in key:
            return canon_name

    if raw.upper().startswith("SGP"):
        if "SALUD" in key:
            return "SGP - Salud"
        if "EDUCACION" in key:
            return "SGP - Educación"
        if "DEPORTE" in key:
            return "SGP - Propósito General Deporte"
        if "CULTURA" in key:
            return "SGP - Propósito General Cultura"
        if "LIBRE INVERSION" in key or "LIBRE INV" in key:
            return "SGP - Propósito General Libre Inversión"
        if "LIBRE DESTINACION" in key or "LIBRE DEST" in key:
            return "SGP - Propósito General Libre Destinación"
        if "ALIMENTACION" in key:
            return "SGP - Alimentación Escolar"
        if "RIBER" in key:
            return "SGP - Ribereños"
        if "AGUA" in key or "SANEAMIENTO" in key:
            return "SGP - Agua Potable y Saneamiento Básico"
        if "INFANCIA" in key:
            return "SGP - Primera Infancia"

    return "Otros"


def normalizar_fuente_financiacion(descripcion_fte: str | None) -> str:
    """Mapea código o descripción de ejecución al catálogo MGA/PIIP."""
    raw = (descripcion_fte or "").strip()
    if not raw:
        return "Otros"

    if _looks_like_codigo_fuente(raw):
        por_codigo = _lookup_codigo_fuente(raw)
        if por_codigo:
            return por_codigo

    return _normalizar_por_texto(raw)


def normalizar_fuente_piip(descripcion_fte: str | None) -> str:
    """Alias histórico usado por exportación PIIP."""
    return normalizar_fuente_financiacion(descripcion_fte)
