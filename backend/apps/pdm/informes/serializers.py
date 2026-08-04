"""Serializers para informes PDM."""
from __future__ import annotations

from rest_framework import serializers

from apps.pdm.metrics import ANIOS_PDM
from apps.pdm.models import InformePDM


class GenerarInformePdmSerializer(serializers.Serializer):
    anio = serializers.IntegerField()
    responsable_secretaria_id = serializers.IntegerField(required=False, allow_null=True)
    incluir_evidencias = serializers.BooleanField(required=False, default=True)
    usar_ia = serializers.BooleanField(required=False, default=False)
    usuario_firmante_id = serializers.IntegerField()

    def validate_anio(self, value: int) -> int:
        if value not in ANIOS_PDM:
            raise serializers.ValidationError(f"Año inválido. Use uno de: {ANIOS_PDM}.")
        return value


class InformePdmSerializer(serializers.ModelSerializer):
    created_by_nombre = serializers.CharField(source="created_by.full_name", read_only=True, default="")
    responsable_secretaria_nombre = serializers.CharField(
        source="responsable_secretaria.nombre", read_only=True, default=""
    )
    usuario_firmante_nombre = serializers.CharField(source="usuario_firmante.full_name", read_only=True, default="")
    expires_in_days = serializers.SerializerMethodField()

    class Meta:
        model = InformePDM
        fields = (
            "id",
            "filename",
            "anio",
            "responsable_secretaria",
            "responsable_secretaria_nombre",
            "incluir_evidencias",
            "usar_ia",
            "usuario_firmante",
            "usuario_firmante_nombre",
            "estado",
            "error_detail",
            "total_productos",
            "avance_fisico",
            "avance_financiero",
            "file_size",
            "created_at",
            "started_at",
            "finished_at",
            "expires_at",
            "expires_in_days",
            "created_by_nombre",
        )
        read_only_fields = fields

    def get_expires_in_days(self, obj) -> int:
        from django.utils import timezone

        delta = obj.expires_at - timezone.now()
        return max(0, delta.days)
