"""Filtros de listado PQRS."""
from __future__ import annotations

from datetime import datetime

import django_filters
from django.utils import timezone

from .models import EstadoPQRS, PQRS


class PQRSFilterSet(django_filters.FilterSet):
    pendientes = django_filters.BooleanFilter(method="filter_pendientes")
    alerta = django_filters.BooleanFilter(method="filter_alerta")
    fecha_desde = django_filters.DateFilter(field_name="fecha_solicitud", lookup_expr="date__gte")
    fecha_hasta = django_filters.DateFilter(method="filter_fecha_hasta")

    class Meta:
        model = PQRS
        fields = ("estado", "tipo_solicitud", "canal_llegada", "assigned_to")

    def filter_pendientes(self, queryset, name, value):
        if value:
            return queryset.exclude(
                estado__in=(EstadoPQRS.RESPONDIDA, EstadoPQRS.CERRADA)
            )
        return queryset

    def filter_alerta(self, queryset, name, value):
        if not value:
            return queryset
        return queryset.filter(correo_alerta=True)

    def filter_fecha_hasta(self, queryset, name, value):
        if not value:
            return queryset
        end = datetime.combine(value, datetime.max.time())
        if timezone.is_naive(end):
            end = timezone.make_aware(end)
        return queryset.filter(fecha_solicitud__lte=end)
