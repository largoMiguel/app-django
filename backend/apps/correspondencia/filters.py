"""Filtros Correspondencia."""
from __future__ import annotations

import django_filters
from django.db.models import Q
from django.utils import timezone

from .models import Correspondencia, EstadoCorrespondencia


class CorrespondenciaFilterSet(django_filters.FilterSet):
    sentido = django_filters.CharFilter(field_name="sentido")
    estado = django_filters.CharFilter(field_name="estado")
    secretaria = django_filters.NumberFilter(field_name="secretaria_id")
    tipología = django_filters.CharFilter(field_name="tipologia")
    tipologia = django_filters.CharFilter(field_name="tipologia")
    search = django_filters.CharFilter(method="filter_search")
    fecha_desde = django_filters.IsoDateTimeFilter(field_name="fecha_radicacion", lookup_expr="gte")
    fecha_hasta = django_filters.IsoDateTimeFilter(field_name="fecha_radicacion", lookup_expr="lte")
    vencidos = django_filters.BooleanFilter(method="filter_vencidos")
    sla = django_filters.CharFilter(method="filter_sla")

    class Meta:
        model = Correspondencia
        fields = ["sentido", "estado", "secretaria", "tipologia"]

    def filter_search(self, qs, name, value):
        value = (value or "").strip()
        if not value:
            return qs
        return qs.filter(
            Q(numero_radicado__icontains=value)
            | Q(asunto__icontains=value)
            | Q(remitente_nombre__icontains=value)
            | Q(destinatario_nombre__icontains=value)
            | Q(remitente_documento__icontains=value)
        )

    def filter_vencidos(self, qs, name, value):
        if value is None:
            return qs
        now = timezone.now()
        abiertos = Q(
            estado__in=[
                EstadoCorrespondencia.RADICADA,
                EstadoCorrespondencia.EN_TRAMITE,
            ]
        )
        if value:
            return qs.filter(abiertos, fecha_vencimiento__lt=now)
        return qs.exclude(abiertos, fecha_vencimiento__lt=now)

    def filter_sla(self, qs, name, value):
        from datetime import timedelta

        value = (value or "").strip()
        if not value:
            return qs
        now = timezone.now()
        abiertos = Q(
            estado__in=[
                EstadoCorrespondencia.RADICADA,
                EstadoCorrespondencia.EN_TRAMITE,
            ]
        )
        if value == "vencida":
            return qs.filter(abiertos, fecha_vencimiento__lt=now)
        if value == "por_vencer":
            return qs.filter(
                abiertos,
                fecha_vencimiento__gte=now,
                fecha_vencimiento__lte=now + timedelta(days=2),
            )
        if value == "en_plazo":
            return qs.filter(abiertos, fecha_vencimiento__gt=now + timedelta(days=2))
        if value == "cerrado":
            return qs.filter(
                estado__in=[
                    EstadoCorrespondencia.RESPONDIDA,
                    EstadoCorrespondencia.CERRADA,
                    EstadoCorrespondencia.ARCHIVADA,
                ]
            )
        return qs
