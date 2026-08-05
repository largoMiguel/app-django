"""Serializers para informes Planes Institucionales."""
from __future__ import annotations

from rest_framework import serializers

from apps.planes.models import InformePlan, InformePlanTipo, Trimestre

from .types import tipo_informe_habilitado


class GenerarInformePlanSerializer(serializers.Serializer):
    tipo = serializers.ChoiceField(choices=InformePlanTipo.choices, default=InformePlanTipo.SEGUIMIENTO_D612)
    anio = serializers.IntegerField()
    trimestre = serializers.IntegerField()
    plan_id = serializers.IntegerField(required=False, allow_null=True)
    responsable_secretaria_id = serializers.IntegerField(required=False, allow_null=True)
    incluir_evidencias = serializers.BooleanField(required=False, default=True)
    usar_ia = serializers.BooleanField(required=False, default=False)
    usuario_firmante_id = serializers.IntegerField()
    cargo_firmante = serializers.CharField(required=False, allow_blank=True, default="")

    def validate_anio(self, value: int) -> int:
        if value < 2020 or value > 2035:
            raise serializers.ValidationError("Año fuera de rango permitido (2020-2035).")
        return value

    def validate_trimestre(self, value: int) -> int:
        if value not in Trimestre.values:
            raise serializers.ValidationError("Trimestre inválido. Use 1, 2, 3 o 4.")
        return value

    def validate_tipo(self, value: str) -> str:
        if not tipo_informe_habilitado(value):
            raise serializers.ValidationError("Este tipo de informe aún no está disponible.")
        return value


class InformePlanSerializer(serializers.ModelSerializer):
    created_by_nombre = serializers.CharField(source="created_by.full_name", read_only=True, default="")
    responsable_secretaria_nombre = serializers.CharField(
        source="responsable_secretaria.nombre", read_only=True, default=""
    )
    usuario_firmante_nombre = serializers.CharField(source="usuario_firmante.full_name", read_only=True, default="")
    plan_nombre = serializers.SerializerMethodField()
    trimestre_label = serializers.SerializerMethodField()
    expires_in_days = serializers.SerializerMethodField()
    tipo_label = serializers.CharField(source="get_tipo_display", read_only=True)

    class Meta:
        model = InformePlan
        fields = (
            "id",
            "filename",
            "tipo",
            "tipo_label",
            "anio",
            "trimestre",
            "trimestre_label",
            "plan",
            "plan_nombre",
            "responsable_secretaria",
            "responsable_secretaria_nombre",
            "incluir_evidencias",
            "usar_ia",
            "usuario_firmante",
            "usuario_firmante_nombre",
            "cargo_firmante",
            "estado",
            "error_detail",
            "total_planes",
            "total_actividades",
            "avance_promedio",
            "file_size",
            "created_at",
            "started_at",
            "finished_at",
            "expires_at",
            "expires_in_days",
            "created_by_nombre",
        )
        read_only_fields = fields

    def get_plan_nombre(self, obj) -> str:
        if obj.plan_id and obj.plan:
            return obj.plan.catalogo.nombre
        return ""

    def get_trimestre_label(self, obj) -> str:
        try:
            return Trimestre(obj.trimestre).label
        except ValueError:
            return str(obj.trimestre)

    def get_expires_in_days(self, obj) -> int:
        from django.utils import timezone

        delta = obj.expires_at - timezone.now()
        return max(0, delta.days)
