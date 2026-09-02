"""Filtros — Gestión documental."""
from __future__ import annotations

import django_filters
from django.db.models import Q

from .models import Expediente, FuidRegistro, InstrumentoArchivistico, SerieDocumental, Transferencia


class InstrumentoFilterSet(django_filters.FilterSet):
    tipo = django_filters.CharFilter()
    estado = django_filters.CharFilter()
    vigencia = django_filters.NumberFilter()

    class Meta:
        model = InstrumentoArchivistico
        fields = ("tipo", "estado", "vigencia")


class SerieFilterSet(django_filters.FilterSet):
    search = django_filters.CharFilter(method="filter_search")
    es_subserie = django_filters.BooleanFilter()
    unidad = django_filters.NumberFilter(field_name="unidad_id")

    class Meta:
        model = SerieDocumental
        fields = ("es_subserie", "unidad", "is_active")

    def filter_search(self, queryset, name, value):
        if not value:
            return queryset
        return queryset.filter(Q(codigo__icontains=value) | Q(nombre__icontains=value))


class ExpedienteFilterSet(django_filters.FilterSet):
    search = django_filters.CharFilter(method="filter_search")
    etapa = django_filters.CharFilter()
    estado = django_filters.CharFilter()
    serie = django_filters.NumberFilter(field_name="serie_id")
    secretaria = django_filters.NumberFilter(field_name="secretaria_id")

    class Meta:
        model = Expediente
        fields = ("etapa", "estado", "serie", "secretaria")

    def filter_search(self, queryset, name, value):
        if not value:
            return queryset
        return queryset.filter(Q(codigo__icontains=value) | Q(titulo__icontains=value))


class FuidFilterSet(django_filters.FilterSet):
    search = django_filters.CharFilter(method="filter_search")

    class Meta:
        model = FuidRegistro
        fields = ()

    def filter_search(self, queryset, name, value):
        if not value:
            return queryset
        return queryset.filter(Q(unidad_documental__icontains=value) | Q(codigo__icontains=value))


class TransferenciaFilterSet(django_filters.FilterSet):
    tipo = django_filters.CharFilter()
    estado = django_filters.CharFilter()

    class Meta:
        model = Transferencia
        fields = ("tipo", "estado")
