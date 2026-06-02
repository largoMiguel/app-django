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


def codigos_referencia_plan_entidad(entity: Entity) -> set[str]:
    """Todos los códigos/alias de productos del plan de la entidad (sin cruzar otras entidades)."""
    codigos: set[str] = set()
    for row in PdmProducto.objects.filter(entity=entity).values(*PRODUCTO_KEY_FIELDS):
        for field in PRODUCTO_KEY_FIELDS:
            value = str(row.get(field) or "").strip()
            if value:
                codigos.add(value)
    return codigos


def resolver_codigo_producto_pdm(entity: Entity, codigo_raw: str) -> str:
    """Resuelve el código del Excel de ejecución al codigo_producto canónico del plan PDM."""
    codigo_raw = str(codigo_raw or "").strip()
    if not codigo_raw:
        return codigo_raw

    qs = PdmProducto.objects.filter(entity=entity)
    if qs.filter(codigo_producto=codigo_raw).exists():
        return codigo_raw

    matches: list[str] = []
    for lookup_field in PRODUCTO_KEY_FIELDS[1:]:
        hits = qs.filter(**{lookup_field: codigo_raw}).values_list("codigo_producto", flat=True).distinct()
        matches.extend(str(hit).strip() for hit in hits if hit)

    unique = list(dict.fromkeys(matches))
    if len(unique) == 1:
        return unique[0]
    return codigo_raw
