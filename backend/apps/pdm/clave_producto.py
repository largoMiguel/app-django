"""Cálculo de clave_producto para productos PDM con indicadores repetidos."""
from __future__ import annotations

import re
from collections import Counter, defaultdict
from typing import Any


def _normalize(value: Any) -> str:
    if value is None:
        return ""
    return str(value).strip()


def _normalize_sispt(value: Any) -> str:
    text = _normalize(value).upper()
    text = re.sub(r"[^A-Z0-9]+", "", text)
    return text


def calcular_claves_producto(rows: list[dict[str, Any]]) -> dict[int, str]:
    """Asigna clave_producto única por fila del Excel (índice en la lista).

    - Una sola fila por codigo_producto → clave = codigo_producto
    - Varias filas → clave = {codigo}-{indicador_mga}
    - Colisión de indicador MGA → agrega SisPT → {codigo}-{indicador_mga}-{sispt}
    - Sin SisPT → ordinal -2, -3, ...
    """
    groups: dict[str, list[tuple[int, dict[str, Any]]]] = defaultdict(list)
    for idx, row in enumerate(rows):
        codigo = _normalize(row.get("codigo_producto"))
        if not codigo:
            continue
        groups[codigo].append((idx, row))

    result: dict[int, str] = {}
    for codigo, items in groups.items():
        if len(items) == 1:
            result[items[0][0]] = codigo
            continue

        indicador_counts = Counter(_normalize(row.get("codigo_indicador_producto_mga")) for _, row in items)
        used: set[str] = set()

        for idx, row in items:
            indicador = _normalize(row.get("codigo_indicador_producto_mga"))
            sispt = _normalize_sispt(row.get("codigo_indicador_producto"))
            base = f"{codigo}-{indicador}" if indicador else f"{codigo}-{idx + 1}"

            if indicador and indicador_counts[indicador] > 1:
                if sispt:
                    candidate = f"{base}-{sispt}"
                else:
                    candidate = base
            else:
                candidate = base

            if candidate not in used:
                result[idx] = candidate
                used.add(candidate)
                continue

            if sispt:
                candidate = f"{base}-{sispt}"
                if candidate not in used:
                    result[idx] = candidate
                    used.add(candidate)
                    continue

            ordinal = 2
            while True:
                candidate = f"{base}-{ordinal}"
                if candidate not in used:
                    result[idx] = candidate
                    used.add(candidate)
                    break
                ordinal += 1

    return result
