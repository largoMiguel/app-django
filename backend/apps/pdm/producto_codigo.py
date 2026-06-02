"""Resolución de códigos de producto PDM para vincular ejecución presupuestal."""
from __future__ import annotations

from apps.entities.models import Entity

from .models import PdmProducto

PRODUCTO_KEY_FIELDS = (
    "codigo_producto",
    "codigo_producto_mga",
    "codigo_indicador_producto",
    "codigo_indicador_producto_mga",
    "bpin",
)


def producto_lookup_keys(producto: dict) -> set[str]:
    keys: set[str] = set()
    for field in PRODUCTO_KEY_FIELDS:
        val = producto.get(field)
        if val is not None and str(val).strip():
            keys.add(str(val).strip())
    return keys


def producto_keys_from_queryset(qs) -> set[str]:
    keys: set[str] = set()
    for row in qs.values(*PRODUCTO_KEY_FIELDS):
        keys.update(producto_lookup_keys(row))
    return keys


def producto_key_to_label_map(qs, label_field: str, default_label: str) -> dict[str, str]:
    """Mapea cualquier clave de producto al valor de línea/sector del producto PDM."""
    mapping: dict[str, str] = {}
    for row in qs.values(*PRODUCTO_KEY_FIELDS, label_field):
        label = row.get(label_field) or default_label
        for key in producto_lookup_keys(row):
            mapping[key] = label
    return mapping


def resolver_codigo_producto_pdm(entity: Entity, codigo_raw: str) -> str:
    """Resuelve el código del Excel de ejecución al codigo_producto canónico del plan PDM."""
    codigo_raw = str(codigo_raw or "").strip()
    if not codigo_raw:
        return codigo_raw

    qs = PdmProducto.objects.filter(entity=entity)
    for lookup_field in PRODUCTO_KEY_FIELDS:
        hit = qs.filter(**{lookup_field: codigo_raw}).values_list("codigo_producto", flat=True).first()
        if hit:
            return str(hit).strip()
    return codigo_raw
