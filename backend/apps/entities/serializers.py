from rest_framework import serializers

from apps.common.roles import is_platform_superadmin

from .models import Entity, Secretaria


class EntitySerializer(serializers.ModelSerializer):
    enabled_modules = serializers.SerializerMethodField()

    class Meta:
        model = Entity
        fields = (
            "id",
            "name",
            "code",
            "nit",
            "slug",
            "description",
            "address",
            "phone",
            "email",
            "logo_url",
            "horario_atencion",
            "tiempo_respuesta",
            "plan_name",
            "pdf_template_url",
            "is_active",
            "enable_pqrs",
            "enable_users_admin",
            "enable_reports_pdf",
            "enable_ai_reports",
            "enable_planes_institucionales",
            "enable_contratacion",
            "enable_pdm",
            "enable_pdm_chat",
            "pdm_chat_intro",
            "pdm_chat_sugerencias",
            "enable_asistencia",
            "enable_correspondencia",
            "enable_presupuesto",
            "enabled_modules",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("enabled_modules", "created_at", "updated_at")

    def get_enabled_modules(self, obj):
        return obj.enabled_modules


class SecretariaSerializer(serializers.ModelSerializer):
    entity_name = serializers.CharField(source="entity.name", read_only=True)

    class Meta:
        model = Secretaria
        fields = ("id", "entity", "entity_name", "nombre", "is_active", "created_at")
        read_only_fields = ("entity_name", "created_at")

    def validate(self, attrs):
        attrs = super().validate(attrs)
        request = self.context.get("request")
        if self.instance and request and not is_platform_superadmin(request.user):
            attrs.pop("entity", None)
        return attrs
