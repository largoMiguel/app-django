"""Filtros — módulo Asistencia."""
from __future__ import annotations

import django_filters
from django.db.models import Q

from .models import RegistroAsistencia


class RegistroAsistenciaFilterSet(django_filters.FilterSet):
    funcionario_id = django_filters.NumberFilter(field_name="funcionario_id")
    equipo_id = django_filters.NumberFilter(field_name="equipo_id")
    tipo = django_filters.CharFilter(field_name="tipo")
    fecha_desde = django_filters.DateTimeFilter(field_name="fecha_hora", lookup_expr="gte")
    fecha_hasta = django_filters.DateTimeFilter(field_name="fecha_hora", lookup_expr="lte")
    search = django_filters.CharFilter(method="filter_search")

    class Meta:
        model = RegistroAsistencia
        fields = ("funcionario_id", "equipo_id", "tipo", "fecha_desde", "fecha_hasta")

    def filter_search(self, queryset, name, value):
        value = (value or "").strip()
        if not value:
            return queryset
        return queryset.filter(
            Q(funcionario__cedula__icontains=value)
            | Q(funcionario__nombres__icontains=value)
            | Q(funcionario__apellidos__icontains=value)
        )
