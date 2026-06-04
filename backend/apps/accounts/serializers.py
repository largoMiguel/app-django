"""Serializers — current user profile."""
from __future__ import annotations

from django.contrib.auth import get_user_model
from rest_framework import serializers

from apps.common.modules import user_has_module
from apps.common.roles import user_roles

User = get_user_model()


class UserMeSerializer(serializers.ModelSerializer):
    roles = serializers.SerializerMethodField()
    permissions = serializers.SerializerMethodField()
    entity = serializers.SerializerMethodField()
    secretaria = serializers.SerializerMethodField()
    capabilities = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = (
            "id",
            "email",
            "full_name",
            "is_active",
            "is_staff",
            "is_superuser",
            "role",
            "roles",
            "permissions",
            "entity",
            "secretaria",
            "capabilities",
            "date_joined",
            "last_login",
        )
        read_only_fields = fields

    def get_roles(self, obj) -> list[str]:
        return obj.role_names

    def get_permissions(self, obj) -> list[str]:
        return sorted(obj.get_all_permissions())

    def get_entity(self, obj):
        if not obj.entity_id:
            return None
        e = obj.entity
        return {
            "id": e.id,
            "name": e.name,
            "code": e.code,
            "slug": e.slug,
            "enable_pqrs": e.enable_pqrs,
            "enable_users_admin": e.enable_users_admin,
            "enable_reports_pdf": e.enable_reports_pdf,
            "enable_ai_reports": e.enable_ai_reports,
            "enable_planes_institucionales": e.enable_planes_institucionales,
            "enable_contratacion": e.enable_contratacion,
            "enable_pdm": e.enable_pdm,
            "enable_asistencia": e.enable_asistencia,
            "enable_correspondencia": e.enable_correspondencia,
            "enable_presupuesto": e.enable_presupuesto,
            "enabled_modules": e.enabled_modules,
            "is_active": e.is_active,
            "logo_url": e.logo_url,
        }

    def get_secretaria(self, obj):
        if not obj.secretaria_id:
            return None
        return {"id": obj.secretaria.id, "nombre": obj.secretaria.nombre}

    def get_capabilities(self, obj):
        perms = set(obj.get_all_permissions())
        roles = {r.lower() for r in user_roles(obj)}
        is_admin = "admin" in roles
        is_secretario = "secretario" in roles
        is_ciudadano = "ciudadano" in roles
        return {
            "pqrs": {
                "view": "pqrs.view_pqrs" in perms,
                "create": "pqrs.add_pqrs" in perms,
                "change": "pqrs.change_pqrs" in perms,
                "delete": "pqrs.delete_pqrs" in perms,
                "assign": is_admin and "pqrs.change_pqrs" in perms,
                "respond": (is_admin or is_secretario) and "pqrs.change_pqrs" in perms,
                "close": is_admin and "pqrs.change_pqrs" in perms,
                "reopen": is_admin and "pqrs.change_pqrs" in perms,
            },
            "users_admin": user_has_module(obj, "users_admin"),
            "reports_pdf": user_has_module(obj, "reports_pdf"),
            "ai_reports": user_has_module(obj, "ai_reports") and (is_admin or is_ciudadano),
        }

    def to_representation(self, instance):
        data = super().to_representation(instance)
        data["enabled_modules"] = instance.enabled_modules or []
        return data
