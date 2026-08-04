"""Filtros para listados de Planes Institucionales."""
from __future__ import annotations

import django_filters
from django.db.models import Q

from .models import PlanActividad, PlanCatalogo, PlanInstitucional


class PlanFilterSet(django_filters.FilterSet):
    anio = django_filters.NumberFilter(field_name="anio")
    catalogo = django_filters.NumberFilter(field_name="catalogo_id")
    estado = django_filters.CharFilter(field_name="estado")
    responsable_secretaria = django_filters.NumberFilter(field_name="responsable_secretaria_id")
    search = django_filters.CharFilter(method="filter_search")

    class Meta:
        model = PlanInstitucional
        fields = ("anio", "catalogo", "estado", "responsable_secretaria")

    def filter_search(self, queryset, name, value):
        if not value:
            return queryset
        term = value.strip()
        return queryset.filter(
            Q(catalogo__nombre__icontains=term) | Q(catalogo__codigo__icontains=term)
        )


class PlanActividadFilterSet(django_filters.FilterSet):
    anio = django_filters.NumberFilter(field_name="anio")
    trimestre = django_filters.NumberFilter(field_name="trimestre")
    plan = django_filters.NumberFilter(field_name="plan_id")
    estado = django_filters.CharFilter(field_name="estado")
    responsable_secretaria = django_filters.NumberFilter(field_name="responsable_secretaria_id")
    search = django_filters.CharFilter(method="filter_search")

    class Meta:
        model = PlanActividad
        fields = ("anio", "trimestre", "plan", "estado", "responsable_secretaria")

    def filter_search(self, queryset, name, value):
        if not value:
            return queryset
        term = value.strip()
        return queryset.filter(Q(nombre__icontains=term) | Q(descripcion__icontains=term))


class PlanCatalogoFilterSet(django_filters.FilterSet):
    search = django_filters.CharFilter(method="filter_search")
    es_decreto612 = django_filters.BooleanFilter(field_name="es_decreto612")

    class Meta:
        model = PlanCatalogo
        fields = ("es_decreto612",)

    def filter_search(self, queryset, name, value):
        if not value:
            return queryset
        term = value.strip()
        return queryset.filter(Q(nombre__icontains=term) | Q(codigo__icontains=term))
