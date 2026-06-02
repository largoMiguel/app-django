"""Filtros server-side para listado de productos PDM.

Filtros iexact/icontains sobre TextField no usan índices btree estándar;
en PostgreSQL conviene evaluar índices GIN/trigram si el volumen crece.
"""
from __future__ import annotations

import django_filters
from django.db.models import Q

from .models import PdmProducto


class PdmProductoFilterSet(django_filters.FilterSet):
    search = django_filters.CharFilter(method="filter_search")
    linea_estrategica = django_filters.CharFilter(field_name="linea_estrategica", lookup_expr="iexact")
    sector_mga = django_filters.CharFilter(field_name="sector_mga", lookup_expr="iexact")
    responsable_secretaria = django_filters.NumberFilter(field_name="responsable_secretaria_id")
    ods = django_filters.CharFilter(field_name="ods", lookup_expr="iexact")
    tipo_acumulacion = django_filters.CharFilter(field_name="tipo_acumulacion", lookup_expr="iexact")

    class Meta:
        model = PdmProducto
        fields = ("linea_estrategica", "sector_mga", "responsable_secretaria", "ods", "tipo_acumulacion")

    def filter_search(self, queryset, name, value):
        if not value:
            return queryset
        q = value.strip()
        return queryset.filter(
            Q(codigo_producto__icontains=q)
            | Q(producto_mga__icontains=q)
            | Q(indicador_producto_mga__icontains=q)
            | Q(personalizacion_indicador__icontains=q)
            | Q(linea_estrategica__icontains=q)
        )
