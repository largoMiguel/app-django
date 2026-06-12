"""Filtros de listado PQRS."""
from __future__ import annotations

from datetime import datetime

import django_filters
from django.utils import timezone

from .models import EstadoPQRS, PQRS
from .sla import pqrs_sla_alerta_q


class PQRSFilterSet(django_filters.FilterSet):
    pendientes = django_filters.BooleanFilter(method="filter_pendientes")
    alerta = django_filters.BooleanFilter(method="filter_alerta")
    correo_alerta = django_filters.BooleanFilter(field_name="correo_alerta")
    fecha_desde = django_filters.DateFilter(field_name="fecha_solicitud", lookup_expr="date__gte")
    fecha_hasta = django_filters.DateFilter(method="filter_fecha_hasta")
    assigned_to = django_filters.NumberFilter(method="filter_assigned_to")

    class Meta:
        model = PQRS
        fields = ("estado", "tipo_solicitud", "canal_llegada")

    def filter_assigned_to(self, queryset, name, value):
        if value is None:
            return queryset
        return queryset.filter(assigned_secretarias__id=value).distinct()

    def filter_pendientes(self, queryset, name, value):
        if value:
            return queryset.exclude(
                estado__in=(EstadoPQRS.RESPONDIDA, EstadoPQRS.CERRADA)
            )
        return queryset

    def filter_alerta(self, queryset, name, value):
        if not value:
            return queryset
        return queryset.filter(pqrs_sla_alerta_q())

    def filter_fecha_hasta(self, queryset, name, value):
        if not value:
            return queryset
        end = datetime.combine(value, datetime.max.time())
        if timezone.is_naive(end):
            end = timezone.make_aware(end)
        return queryset.filter(fecha_solicitud__lte=end)
