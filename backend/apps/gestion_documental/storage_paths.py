"""Rutas B2 — Gestión documental."""
from __future__ import annotations

import uuid

from django.utils.text import get_valid_filename


def instrumento_b2_key(entity_id: int, instrumento_id: int, filename: str) -> str:
    safe = get_valid_filename(filename) or "archivo"
    uid = uuid.uuid4().hex[:12]
    return f"entities/{entity_id}/gestion-documental/instrumentos/{instrumento_id}/{uid}_{safe}"


def documento_b2_key(entity_id: int, expediente_id: int, filename: str) -> str:
    safe = get_valid_filename(filename) or "documento"
    uid = uuid.uuid4().hex[:12]
    return f"entities/{entity_id}/gestion-documental/expedientes/{expediente_id}/{uid}_{safe}"


def acta_b2_key(entity_id: int, tipo: str, ref_id: int, filename: str) -> str:
    safe = get_valid_filename(filename) or "acta"
    uid = uuid.uuid4().hex[:12]
    return f"entities/{entity_id}/gestion-documental/{tipo}/{ref_id}/{uid}_{safe}"
