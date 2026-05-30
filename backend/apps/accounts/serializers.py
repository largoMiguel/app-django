"""Serializers — login/refresh, current user, registration."""
from __future__ import annotations

from django.contrib.auth import authenticate
from django.contrib.auth import get_user_model
from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer

from apps.common.modules import user_has_module
from apps.common.roles import user_roles

User = get_user_model()


class SoftOneTokenObtainPairSerializer(TokenObtainPairSerializer):
    """Embed user + role info in the access token."""

    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        token["email"] = user.email
        token["full_name"] = user.full_name
        token["roles"] = user.role_names
        token["role"] = user.role
        token["entity_id"] = user.entity_id
        token["secretaria_id"] = user.secretaria_id
        token["is_staff"] = user.is_staff
        token["permissions"] = sorted(user.get_all_permissions())
        return token

    def validate(self, attrs):
        email = (attrs.get(self.username_field) or "").strip().lower()
        password = attrs.get("password") or ""
        user = authenticate(
            request=self.context.get("request"),
            username=email,
            password=password,
        )
        if user is None:
            raise serializers.ValidationError(
                {"detail": "Credenciales inválidas."},
                code="authorization",
            )
        self.user = user
        if not user.is_active:
            raise serializers.ValidationError(
                "Tu cuenta está inhabilitada. Contacta al administrador."
            )
        if user.entity_id:
            entity = user.entity
            if entity and not entity.is_active:
                raise serializers.ValidationError(
                    "La entidad a la que perteneces está inactiva. Contacta al administrador."
                )
        refresh = self.get_token(user)
        return {
            "refresh": str(refresh),
            "access": str(refresh.access_token),
            "user": UserMeSerializer(user).data,
        }


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


class ChangePasswordSerializer(serializers.Serializer):
    old_password = serializers.CharField(write_only=True)
    new_password = serializers.CharField(write_only=True, min_length=10)

    def validate_old_password(self, value: str) -> str:
        user = self.context["request"].user
        if not user.check_password(value):
            raise serializers.ValidationError("La contraseña actual es incorrecta.")
        return value

    def save(self, **kwargs):
        user = self.context["request"].user
        user.set_password(self.validated_data["new_password"])
        user.save(update_fields=["password"])
        return user
