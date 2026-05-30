from __future__ import annotations

from django.contrib.auth.models import Group, Permission
from rest_framework import serializers

from apps.common.roles import is_platform_superadmin

from .models import RoleMeta

ALLOWED_ENTITY_ROLE_APPS = {"pqrs", "accounts"}


class PermissionSerializer(serializers.ModelSerializer):
    codename_full = serializers.SerializerMethodField()

    class Meta:
        model = Permission
        fields = ("id", "name", "codename", "codename_full", "content_type")

    def get_codename_full(self, obj) -> str:
        return f"{obj.content_type.app_label}.{obj.codename}"


class RoleSerializer(serializers.ModelSerializer):
    description = serializers.CharField(
        source="meta.description", required=False, allow_blank=True
    )
    is_system = serializers.BooleanField(source="meta.is_system", read_only=True)
    entity = serializers.PrimaryKeyRelatedField(
        source="meta.entity", read_only=True, default=None
    )
    permissions = serializers.PrimaryKeyRelatedField(
        many=True, queryset=Permission.objects.all(), required=False
    )
    permissions_detail = PermissionSerializer(
        source="permissions", many=True, read_only=True
    )
    user_count = serializers.IntegerField(read_only=True)

    class Meta:
        model = Group
        fields = (
            "id",
            "name",
            "description",
            "is_system",
            "entity",
            "permissions",
            "permissions_detail",
            "user_count",
        )

    def validate_permissions(self, value):
        request = self.context.get("request")
        actor = getattr(request, "user", None)
        if actor is None or is_platform_superadmin(actor):
            return value
        invalid = [
            perm for perm in value
            if perm.content_type.app_label not in ALLOWED_ENTITY_ROLE_APPS
        ]
        if invalid:
            invalid_labels = sorted(
                {f"{p.content_type.app_label}.{p.codename}" for p in invalid}
            )
            raise serializers.ValidationError(
                "No autorizado para asignar permisos fuera de PQRS/usuarios: "
                + ", ".join(invalid_labels)
            )
        return value

    def create(self, validated_data):
        meta_data = validated_data.pop("meta", {})
        permissions = validated_data.pop("permissions", [])
        group = Group.objects.create(**validated_data)
        if permissions:
            group.permissions.set(permissions)
        RoleMeta.objects.create(
            group=group,
            description=meta_data.get("description", ""),
            is_system=meta_data.get("is_system", False),
            entity=meta_data.get("entity"),
        )
        return group

    def update(self, instance, validated_data):
        meta_data = validated_data.pop("meta", {})
        permissions = validated_data.pop("permissions", None)
        instance.name = validated_data.get("name", instance.name)
        instance.save()
        if permissions is not None:
            instance.permissions.set(permissions)
        meta, _ = RoleMeta.objects.get_or_create(group=instance)
        for k, v in meta_data.items():
            setattr(meta, k, v)
        meta.save()
        return instance


class AssignRoleSerializer(serializers.Serializer):
    user_id = serializers.IntegerField()
    role_ids = serializers.ListField(child=serializers.IntegerField())
