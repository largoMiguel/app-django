"""Serializer y ViewSet para gestión de usuarios (admin de entidad)."""
from __future__ import annotations

import secrets

from django.contrib.auth import get_user_model
from django.contrib.auth.models import Group
from django.db import IntegrityError, transaction
from rest_framework import serializers, viewsets
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.common.modules import require_user_module
from apps.common.pagination import StandardPageNumberPagination
from apps.common.roles import is_platform_superadmin
from apps.entities.models import Entity, Secretaria
from apps.entities.permissions import IsEntityAdmin
from apps.accounts.services.clerk import (
    ClerkServiceError,
    ban_user,
    create_invitation,
    create_user as clerk_create_user,
    delete_user,
    unban_user,
    update_user_email,
    update_user_name,
)

User = get_user_model()


class UserAdminSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, required=False, allow_blank=True, min_length=8)
    invite = serializers.BooleanField(
        write_only=True,
        required=False,
        default=False,
        help_text="Si true, Clerk envía invitación por email en lugar de crear password.",
    )
    roles = serializers.SerializerMethodField()
    entity_name = serializers.CharField(source="entity.name", read_only=True, default=None)
    secretaria_nombre = serializers.CharField(
        source="secretaria.nombre", read_only=True, default=None
    )
    # Permite que admin cree una secretaría inline al mismo tiempo
    nueva_secretaria_nombre = serializers.CharField(
        write_only=True, required=False, allow_blank=True
    )

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
            "entity",
            "entity_name",
            "secretaria",
            "secretaria_nombre",
            "nueva_secretaria_nombre",
            "enabled_modules",
            "password",
            "invite",
            "date_joined",
            "last_login",
        )
        read_only_fields = (
            "id",
            "roles",
            "entity_name",
            "secretaria_nombre",
            "date_joined",
            "last_login",
            "is_staff",
            "is_superuser",
        )

    def get_roles(self, obj) -> list[str]:
        return obj.role_names

    def validate_role(self, value: str) -> str:
        if value not in {"superadmin", "admin", "secretario", "ciudadano", ""}:
            raise serializers.ValidationError("Rol inválido.")
        return value

    def validate(self, attrs):
        data = super().validate(attrs)
        request = self.context.get("request")
        actor = getattr(request, "user", None)
        target_entity = data.get("entity")
        if target_entity is None and self.instance is not None:
            target_entity = getattr(self.instance, "entity", None)
        if target_entity is None and actor is not None and not is_platform_superadmin(actor):
            target_entity = actor.entity

        enabled_modules = data.get("enabled_modules")
        if enabled_modules is not None:
            allowed = set(getattr(target_entity, "enabled_modules", []) or [])
            requested = set(enabled_modules or [])
            if not requested.issubset(allowed):
                invalid = sorted(requested - allowed)
                raise serializers.ValidationError(
                    {"enabled_modules": f"Módulos no habilitados en la entidad: {', '.join(invalid)}"}
                )
        return data

    def _apply_groups(self, user: User, role: str) -> None:
        # Quitar grupos anteriores controlados y asignar solo el rol activo
        managed = {"superadmin", "admin", "secretario", "ciudadano"}
        current = set(user.groups.values_list("name", flat=True))
        to_remove = (current & managed) - {role}
        if to_remove:
            user.groups.remove(*Group.objects.filter(name__in=to_remove))
        if role:
            g, _ = Group.objects.get_or_create(name=role)
            user.groups.add(g)

    def _sync_role_flags(self, user: User, role: str, *, is_super: bool) -> None:
        if is_super:
            user.is_superuser = role == "superadmin"
            user.is_staff = role in {"superadmin", "admin"}
        else:
            user.is_superuser = False
            user.is_staff = role == "admin"
        if role != "secretario":
            user.secretaria = None

    def create(self, validated_data):
        request = self.context["request"]
        actor = request.user

        password = validated_data.pop("password", None) or secrets.token_urlsafe(10)
        nueva_sec_nombre = (validated_data.pop("nueva_secretaria_nombre", "") or "").strip()
        role = validated_data.get("role") or ""

        # Admin de entidad: forzar entity_id y limitar roles
        if not is_platform_superadmin(actor):
            if not actor.entity_id:
                raise PermissionDenied("Sin entidad asignada.")
            if role not in {"admin", "secretario", "ciudadano"}:
                raise ValidationError({"role": "Admin solo puede crear admin/secretario/ciudadano."})
            validated_data["entity"] = actor.entity
            validated_data["is_superuser"] = False
            validated_data["is_staff"] = role == "admin"
        else:
            # Superadmin puede crear cualquiera
            validated_data["is_superuser"] = role == "superadmin"
            validated_data["is_staff"] = role in {"superadmin", "admin"}

        # Secretario debe tener secretaría (existente o nueva)
        if role == "secretario":
            sec = validated_data.get("secretaria")
            entity = validated_data.get("entity") or (actor.entity if not is_platform_superadmin(actor) else None)
            if nueva_sec_nombre:
                if not entity:
                    raise ValidationError({"entity": "Requerida para crear secretaría."})
                sec, _ = Secretaria.objects.get_or_create(entity=entity, nombre=nueva_sec_nombre)
                validated_data["secretaria"] = sec
            elif not sec:
                raise ValidationError({"secretaria": "Requerida para rol secretario."})
            elif sec.entity_id != (entity.id if entity else sec.entity_id):
                raise ValidationError({"secretaria": "No pertenece a la entidad."})

        with transaction.atomic():
            invite = validated_data.pop("invite", False)
            clerk_id = None
            email = validated_data["email"].strip().lower()
            full_name = validated_data.get("full_name", "")
            entity = validated_data.get("entity")
            entity_id = entity.id if entity else None

            try:
                if invite:
                    create_invitation(
                        email=email,
                        full_name=full_name,
                        role=role,
                        entity_id=entity_id,
                    )
                else:
                    clerk_id = clerk_create_user(
                        email=email,
                        password=password,
                        full_name=full_name,
                    )
            except ClerkServiceError as exc:
                raise ValidationError({"detail": f"Error en Clerk: {exc}"}) from exc

            try:
                user = User(
                    email=email,
                    full_name=full_name,
                )
                user.set_unusable_password()
                if clerk_id:
                    user.clerk_id = clerk_id
                for field in (
                    "entity",
                    "secretaria",
                    "role",
                    "is_active",
                    "is_staff",
                    "is_superuser",
                    "enabled_modules",
                ):
                    if field in validated_data:
                        setattr(user, field, validated_data[field])
                user.save()
                self._apply_groups(user, role)
            except Exception:
                if clerk_id:
                    try:
                        delete_user(clerk_id)
                    except ClerkServiceError:
                        pass
                raise
        return user

    def update(self, instance: User, validated_data):
        request = self.context["request"]
        actor = request.user
        is_super = is_platform_superadmin(actor)

        # Admin no puede editar fuera de su entidad
        if not is_super and instance.entity_id != actor.entity_id:
            raise PermissionDenied("No puedes editar usuarios de otra entidad.")

        password = validated_data.pop("password", None)
        validated_data.pop("invite", None)
        nueva_sec_nombre = (validated_data.pop("nueva_secretaria_nombre", "") or "").strip()
        role = validated_data.get("role", instance.role)
        new_email = validated_data.get("email")
        new_full_name = validated_data.get("full_name")
        email_changed = (
            new_email is not None
            and new_email.strip().lower() != instance.email.lower()
        )
        full_name_changed = (
            new_full_name is not None
            and new_full_name.strip() != (instance.full_name or "").strip()
        )

        if not is_super:
            # Admin no puede convertir a superadmin ni alterar flags Django directamente
            if role == "superadmin":
                raise ValidationError({"role": "No autorizado."})
            validated_data.pop("is_superuser", None)
            validated_data.pop("is_staff", None)
            validated_data["entity"] = actor.entity

        if role == "secretario":
            sec = validated_data.get("secretaria", instance.secretaria)
            entity = validated_data.get("entity", instance.entity)
            if nueva_sec_nombre:
                if not entity:
                    raise ValidationError({"entity": "Requerida para crear secretaría."})
                sec, _ = Secretaria.objects.get_or_create(entity=entity, nombre=nueva_sec_nombre)
            if not sec:
                raise ValidationError({"secretaria": "Requerida para rol secretario."})
            if sec.entity_id != entity.id:
                raise ValidationError({"secretaria": "No pertenece a la entidad."})
            validated_data["secretaria"] = sec
        elif role != "secretario":
            validated_data["secretaria"] = None

        for k, v in validated_data.items():
            setattr(instance, k, v)
        self._sync_role_flags(instance, role or instance.role or "", is_super=is_super)
        instance.save()

        if instance.clerk_id:
            if password:
                try:
                    from apps.accounts.services.clerk import get_clerk_client
                    get_clerk_client().users.update(
                        user_id=instance.clerk_id,
                        password=password,
                    )
                except ClerkServiceError as exc:
                    raise ValidationError({"password": f"Error en Clerk: {exc}"}) from exc
            if full_name_changed:
                try:
                    update_user_name(clerk_id=instance.clerk_id, full_name=instance.full_name)
                except ClerkServiceError as exc:
                    raise ValidationError({"full_name": f"Error en Clerk: {exc}"}) from exc
            if email_changed:
                try:
                    update_user_email(clerk_id=instance.clerk_id, email=instance.email)
                except ClerkServiceError as exc:
                    raise ValidationError({"email": f"Error en Clerk: {exc}"}) from exc

        self._apply_groups(instance, role or "")
        return instance


class UserViewSet(viewsets.ModelViewSet):
    serializer_class = UserAdminSerializer
    permission_classes = (IsAuthenticated, IsEntityAdmin)
    filterset_fields = ("entity", "secretaria", "role", "is_active")
    search_fields = ("email", "full_name")
    ordering_fields = ("date_joined", "email", "full_name")
    pagination_class = StandardPageNumberPagination

    def initial(self, request, *args, **kwargs):
        super().initial(request, *args, **kwargs)
        user = request.user
        if is_platform_superadmin(user):
            return
        require_user_module(
            user,
            "users_admin",
            message="El módulo de administración de usuarios está deshabilitado.",
        )

    def get_queryset(self):
        actor = self.request.user
        qs = User.objects.select_related("entity", "secretaria").prefetch_related("groups").all()
        if is_platform_superadmin(actor):
            entity_id = self.request.query_params.get("entity") or self.request.query_params.get("entity_id")
            if entity_id:
                return qs.filter(entity_id=entity_id)
            detail_actions = {"retrieve", "update", "partial_update", "destroy"}
            if self.action in detail_actions:
                return qs
            return qs
        if actor.entity_id:
            return qs.filter(entity_id=actor.entity_id)
        return qs.none()

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        actor = request.user
        if instance.pk == actor.pk:
            raise ValidationError("No puedes eliminarte a ti mismo.")

        purge = request.query_params.get("purge", "").lower() in {"true", "1", "yes"}

        if purge:
            clerk_id = instance.clerk_id
            if clerk_id:
                try:
                    delete_user(clerk_id)
                except ClerkServiceError as exc:
                    raise ValidationError({"detail": f"Error en Clerk: {exc}"}) from exc
            try:
                instance.delete()
            except IntegrityError as exc:
                raise ValidationError(
                    {
                        "detail": (
                            "No se puede eliminar: el usuario tiene registros asociados "
                            "(PQRS, PDM, etc.). Desactívalo en su lugar."
                        )
                    }
                ) from exc
        else:
            instance.is_active = False
            instance.save(update_fields=["is_active"])
            if instance.clerk_id:
                try:
                    ban_user(instance.clerk_id)
                except ClerkServiceError:
                    pass

        return Response(status=204)
