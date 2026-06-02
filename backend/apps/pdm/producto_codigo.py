"""Resolución de códigos de producto PDM al cargar ejecución presupuestal."""
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
