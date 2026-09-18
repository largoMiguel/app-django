"""Filtros — PIC."""
from __future__ import annotations

import django_filters
from django.db.models import Q

from .models import PicActividad, PicCargo


class PicActividadFilterSet(django_filters.FilterSet):
    anio = django_filters.NumberFilter(field_name="plan__anio")
    trimestre = django_filters.NumberFilter(method="filter_trimestre")
    responsable_usuario = django_filters.NumberFilter(field_name="responsables__id")
    responsable_secretaria = django_filters.NumberFilter(field_name="responsable_secretaria_id")
    search = django_filters.CharFilter(method="filter_search")

    class Meta:
        model = PicActividad
        fields = ("anio", "trimestre", "responsable_usuario", "responsable_secretaria", "search")

    def filter_search(self, queryset, name, value):
        if not value:
            return queryset
        return queryset.filter(
            Q(actividad__icontains=value)
            | Q(encargado_texto__icontains=value)
            | Q(eje_estrategico__icontains=value)
        )

    def filter_trimestre(self, queryset, name, value):
        if not value:
            return queryset
        try:
            tri = int(value)
        except (TypeError, ValueError):
            return queryset
        field_map = {1: "prog_t1", 2: "prog_t2", 3: "prog_t3", 4: "prog_t4"}
        f = field_map.get(tri)
        if f:
            return queryset.filter(**{f"{f}__gt": 0})
        return queryset


class PicCargoFilterSet(django_filters.FilterSet):
    search = django_filters.CharFilter(method="filter_search")

    class Meta:
        model = PicCargo
        fields = ("search",)

    def filter_search(self, queryset, name, value):
        if not value:
            return queryset
        return queryset.filter(
            Q(etiqueta__icontains=value) | Q(etiqueta_norm__icontains=value)
        )
