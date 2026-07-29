"""Serializers SECOP — respuestas API."""
from __future__ import annotations

from rest_framework import serializers


class SecopAnioQuerySerializer(serializers.Serializer):
    anio = serializers.IntegerField(min_value=2000, max_value=2100, required=False)


class SecopListQuerySerializer(SecopAnioQuerySerializer):
    page = serializers.IntegerField(min_value=1, required=False, default=1)
    page_size = serializers.IntegerField(min_value=1, max_value=100, required=False, default=15)
    search = serializers.CharField(required=False, allow_blank=True)
    estado = serializers.CharField(required=False, allow_blank=True)
    modalidad = serializers.CharField(required=False, allow_blank=True)
    tipo = serializers.CharField(required=False, allow_blank=True)
    tipo_registro = serializers.ChoiceField(
        choices=["contrato", "proceso", "all"],
        required=False,
        default="all",
    )
    proveedor = serializers.CharField(required=False, allow_blank=True)
    valor_min = serializers.FloatField(required=False)
    valor_max = serializers.FloatField(required=False)
    ordering = serializers.CharField(required=False, allow_blank=True, default="-valor")


class SecopAlertasQuerySerializer(SecopAnioQuerySerializer):
    fuente = serializers.CharField(required=False, allow_blank=True)
    severidad = serializers.ChoiceField(
        choices=["critica", "alta", "media", "baja"],
        required=False,
        allow_blank=True,
    )


class SecopDetalleQuerySerializer(serializers.Serializer):
    fuente = serializers.ChoiceField(choices=["secop1", "secop2"])
    id = serializers.CharField(max_length=200)
    anio = serializers.IntegerField(min_value=2000, max_value=2100)


class SecopExportQuerySerializer(SecopAnioQuerySerializer):
    fuente = serializers.ChoiceField(
        choices=["secop1", "secop2", "unificado", "alertas"],
        default="unificado",
    )


class SecopAIAnalisisSerializer(SecopAnioQuerySerializer):
    pass


class SecopAICopilotSerializer(SecopAnioQuerySerializer):
    message = serializers.CharField(max_length=4000)
    history = serializers.ListField(
        child=serializers.DictField(),
        required=False,
        default=list,
    )


class SecopAIContratoSerializer(SecopDetalleQuerySerializer):
    pass


class SecopRefrescarSerializer(SecopAnioQuerySerializer):
    anio = serializers.IntegerField(min_value=2000, max_value=2100, required=False)
