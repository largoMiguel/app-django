"""Serializer y ViewSet para gestión de usuarios (admin de entidad)."""
from __future__ import annotations

import secrets

from django.contrib.auth import get_user_model
from django.db import IntegrityError, models, transaction
from rest_framework import serializers, viewsets
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.common.modules import require_user_module
from apps.common.pagination import StandardPageNumberPagination
from apps.common.roles import is_platform_superadmin, user_roles
from apps.entities.models import Entity, Secretaria
from apps.entities.permissions import IsUserManager
from apps.accounts.memberships import (
    sync_groups_from_memberships,
    sync_user_flags_from_memberships,
    upsert_membership,
)
from apps.accounts.models import UserEntityMembership
from apps.accounts.services.clerk import (
    ClerkServiceError,
    ban_user,
    create_invitation,
    create_user as clerk_create_user,
    delete_user,
    find_user_by_email,
    unban_user,
    update_user_email,
    update_user_name,
)

User = get_user_model()


def _supervisor_for_secretaria(entity, secretaria):
    """Secretario activo de la secretaría, si existe."""
    if entity is None or secretaria is None:
        return None
    membership = (
        UserEntityMembership.objects.filter(
            entity=entity,
            secretaria=secretaria,
            role="secretario",
            is_active=True,
        )
        .select_related("user")
        .first()
    )
    return membership.user if membership else None


def _resolve_contratista_supervisor(*, actor, entity, secretaria, role: str, explicit_supervisor=None):
    if role != "contratista":
        return None
    roles = user_roles(actor)
    if "secretario" in roles and "admin" not in roles and not is_platform_superadmin(actor):
        return actor
    if explicit_supervisor is not None:
        return explicit_supervisor
    return _supervisor_for_secretaria(entity, secretaria)


class UserAdminSerializer(serializers.ModelSerializer):
    email = serializers.EmailField(validators=[])
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

    membership_added = serializers.BooleanField(read_only=True, default=False)
    supervisor = serializers.PrimaryKeyRelatedField(
        queryset=User.objects.all(),
        required=False,
        allow_null=True,
        write_only=True,
    )
    supervisor_name = serializers.SerializerMethodField()

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
            "supervisor",
            "supervisor_name",
            "membership_added",
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
            "supervisor_name",
            "membership_added",
            "date_joined",
            "last_login",
            "is_staff",
            "is_superuser",
        )

    def _context_entity_id(self) -> int | None:
        raw = self.context.get("entity_id")
        if raw is None:
            return None
        try:
            return int(raw)
        except (TypeError, ValueError):
            return None

    def _resolve_entity_membership(self, obj) -> UserEntityMembership | None:
        membership = getattr(obj, "_entity_membership", None)
        if membership is not None:
            return membership
        entity_id = self._context_entity_id()
        if entity_id:
            prefetched = getattr(obj, "_entity_memberships_for_context", None)
            if prefetched:
                return prefetched[0] if prefetched else None
            return (
                UserEntityMembership.objects.filter(
                    user=obj, entity_id=entity_id, is_active=True
                )
                .select_related("entity", "secretaria", "supervisor")
                .first()
            )
        if obj.entity_id:
            return (
                UserEntityMembership.objects.filter(
                    user=obj, entity_id=obj.entity_id, is_active=True
                )
                .select_related("entity", "secretaria", "supervisor")
                .first()
            )
        return None

    def get_supervisor_name(self, obj) -> str | None:
        membership = self._resolve_entity_membership(obj)
        if membership and membership.supervisor_id:
            sup = membership.supervisor
            return sup.full_name or sup.email
        return None

    def to_representation(self, instance):
        membership = self._resolve_entity_membership(instance)
        if membership:
            instance._entity_membership = membership
            instance.entity = membership.entity
            instance.entity_id = membership.entity_id
            instance.role = membership.role or ""
            instance.secretaria = membership.secretaria
            instance.secretaria_id = membership.secretaria_id
            instance.enabled_modules = list(membership.enabled_modules or [])
        data = super().to_representation(instance)
        if self.context.get("membership_added"):
            data["membership_added"] = True
        return data

    def get_roles(self, obj) -> list[str]:
        membership = self._resolve_entity_membership(obj)
        if membership and membership.role:
            return [membership.role]
        return obj.role_names

    def validate_email(self, value: str) -> str:
        email = value.strip().lower()
        if self.instance is not None:
            conflict = User.objects.filter(email__iexact=email).exclude(pk=self.instance.pk).exists()
            if conflict:
                raise serializers.ValidationError("Ya existe un usuario con este email.")
        return email

    def validate_role(self, value: str) -> str:
        if value not in {"superadmin", "admin", "secretario", "contratista", "ciudadano", ""}:
            raise serializers.ValidationError("Rol inválido.")
        return value

    def _actor_is_secretario_only(self, actor) -> bool:
        roles = user_roles(actor)
        return "secretario" in roles and "admin" not in roles and not is_platform_superadmin(actor)

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
            if actor and self._actor_is_secretario_only(actor):
                allowed = set(getattr(actor, "enabled_modules", None) or [])
            if not requested.issubset(allowed):
                invalid = sorted(requested - allowed)
                raise serializers.ValidationError(
                    {"enabled_modules": f"Módulos no habilitados: {', '.join(invalid)}"}
                )
        role = data.get("role") or (self.instance.role if self.instance else "")
        if actor and self._actor_is_secretario_only(actor) and role != "contratista":
            raise serializers.ValidationError({"role": "Secretario solo puede gestionar contratistas."})
        return data

    def _resolve_secretaria(self, validated_data, *, actor, role: str):
        nueva_sec_nombre = (validated_data.pop("nueva_secretaria_nombre", "") or "").strip()
        entity = validated_data.get("entity") or actor.entity
        if role in {"secretario", "contratista"}:
            sec = validated_data.get("secretaria")
            if self._actor_is_secretario_only(actor):
                if not actor.secretaria_id:
                    raise ValidationError({"secretaria": "Secretario sin secretaría asignada."})
                validated_data["secretaria"] = actor.secretaria
                return actor.secretaria
            if nueva_sec_nombre:
                if not entity:
                    raise ValidationError({"entity": "Requerida para crear secretaría."})
                sec, _ = Secretaria.objects.get_or_create(entity=entity, nombre=nueva_sec_nombre)
                validated_data["secretaria"] = sec
            elif not sec:
                raise ValidationError({"secretaria": f"Requerida para rol {role}."})
            elif sec.entity_id != (entity.id if entity else sec.entity_id):
                raise ValidationError({"secretaria": "No pertenece a la entidad."})
        return validated_data.get("secretaria")

    def create(self, validated_data):
        request = self.context["request"]
        actor = request.user

        password = validated_data.pop("password", None) or secrets.token_urlsafe(10)
        supervisor = validated_data.pop("supervisor", None)
        role = validated_data.get("role") or ""
        email = validated_data["email"].strip().lower()

        if not is_platform_superadmin(actor):
            if not actor.entity_id:
                raise PermissionDenied("Sin entidad asignada.")
            if self._actor_is_secretario_only(actor):
                if role != "contratista":
                    raise ValidationError({"role": "Secretario solo puede crear contratistas."})
                supervisor = actor
                validated_data["entity"] = actor.entity
            elif role not in {"admin", "secretario", "contratista", "ciudadano"}:
                raise ValidationError({"role": "Admin solo puede crear admin/secretario/contratista/ciudadano."})
            else:
                validated_data["entity"] = actor.entity
            validated_data["is_superuser"] = False
            validated_data["is_staff"] = role == "admin"
        else:
            validated_data["is_superuser"] = role == "superadmin"
            validated_data["is_staff"] = role in {"superadmin", "admin"}

        secretaria = self._resolve_secretaria(validated_data, actor=actor, role=role)
        entity = validated_data.get("entity")
        supervisor = _resolve_contratista_supervisor(
            actor=actor,
            entity=entity,
            secretaria=secretaria,
            role=role,
            explicit_supervisor=supervisor,
        )

        existing = User.objects.filter(email__iexact=email).first()
        if existing:
            if entity and UserEntityMembership.objects.filter(
                user=existing, entity=entity, is_active=True
            ).exists():
                raise ValidationError({"email": "El usuario ya pertenece a esta entidad."})
            upsert_membership(
                user=existing,
                entity=entity,
                role=role,
                secretaria=secretaria,
                enabled_modules=validated_data.get("enabled_modules") or [],
                supervisor=supervisor if role == "contratista" else None,
                is_default=not UserEntityMembership.objects.filter(user=existing, is_active=True).exists(),
            )
            if validated_data.get("full_name") and validated_data["full_name"].strip():
                existing.full_name = validated_data["full_name"].strip()
                existing.save(update_fields=["full_name"])
            if "is_active" in validated_data:
                existing.is_active = validated_data["is_active"]
                existing.save(update_fields=["is_active"])
            self.context["membership_added"] = True
            if not existing.clerk_id:
                clerk_user = find_user_by_email(email)
                if clerk_user:
                    existing.clerk_id = clerk_user.id
                    existing.save(update_fields=["clerk_id"])
            sync_groups_from_memberships(existing)
            sync_user_flags_from_memberships(existing)
            return existing

        with transaction.atomic():
            invite = validated_data.pop("invite", False)
            clerk_id = None
            clerk_existing = None
            full_name = validated_data.get("full_name", "")
            entity_id = entity.id if entity else None

            try:
                clerk_existing = find_user_by_email(email)
                if clerk_existing:
                    clerk_id = clerk_existing.id
                elif invite:
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
                user = User(email=email, full_name=full_name)
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
                sync_groups_from_memberships(user)
                sync_user_flags_from_memberships(user)
                if entity:
                    upsert_membership(
                        user=user,
                        entity=entity,
                        role=role,
                        secretaria=secretaria,
                        enabled_modules=validated_data.get("enabled_modules") or [],
                        supervisor=supervisor if role == "contratista" else None,
                        is_default=True,
                    )
            except Exception:
                if clerk_id and not clerk_existing:
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

        target_entity_id = self._context_entity_id()
        if target_entity_id is None and not is_super:
            target_entity_id = actor.entity_id
        if target_entity_id is None:
            target_entity_id = instance.entity_id

        if not is_super:
            has_membership = UserEntityMembership.objects.filter(
                user=instance,
                entity_id=target_entity_id,
                is_active=True,
            ).exists()
            if not has_membership:
                raise PermissionDenied("No puedes editar usuarios de otra entidad.")

        password = validated_data.pop("password", None)
        validated_data.pop("invite", None)
        supervisor = validated_data.pop("supervisor", None)
        nueva_sec_nombre = (validated_data.pop("nueva_secretaria_nombre", "") or "").strip()

        membership_fields = {}
        for field in ("role", "secretaria", "entity", "enabled_modules"):
            if field in validated_data:
                membership_fields[field] = validated_data.pop(field)

        role = membership_fields.get("role", None)
        if role is None:
            existing_membership = self._resolve_entity_membership(instance)
            role = existing_membership.role if existing_membership else instance.role

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
            if role == "superadmin":
                raise ValidationError({"role": "No autorizado."})
            validated_data.pop("is_superuser", None)
            validated_data.pop("is_staff", None)
            membership_fields["entity"] = actor.entity
            target_entity_id = actor.entity_id

        entity = membership_fields.get("entity")
        if entity is None and target_entity_id:
            entity = Entity.objects.filter(pk=target_entity_id).first()

        secretaria = membership_fields.get("secretaria", None)
        if role in {"secretario", "contratista"}:
            if nueva_sec_nombre:
                if not entity:
                    raise ValidationError({"entity": "Requerida para crear secretaría."})
                secretaria, _ = Secretaria.objects.get_or_create(entity=entity, nombre=nueva_sec_nombre)
            elif secretaria is None:
                existing_membership = self._resolve_entity_membership(instance)
                secretaria = existing_membership.secretaria if existing_membership else instance.secretaria
            if not secretaria:
                raise ValidationError({"secretaria": f"Requerida para rol {role}."})
            if entity and secretaria.entity_id != entity.id:
                raise ValidationError({"secretaria": "No pertenece a la entidad."})
        elif role not in {"secretario", "contratista"}:
            secretaria = None

        supervisor = _resolve_contratista_supervisor(
            actor=actor,
            entity=entity,
            secretaria=secretaria,
            role=role or "",
            explicit_supervisor=supervisor,
        )

        existing_membership = self._resolve_entity_membership(instance)
        enabled_modules = membership_fields.get("enabled_modules")
        if enabled_modules is None:
            if existing_membership:
                enabled_modules = list(existing_membership.enabled_modules or [])
            else:
                enabled_modules = list(instance.enabled_modules or [])

        for k, v in validated_data.items():
            setattr(instance, k, v)
        instance.save()

        if entity:
            upsert_membership(
                user=instance,
                entity=entity,
                role=role or "",
                secretaria=secretaria,
                enabled_modules=enabled_modules,
                supervisor=supervisor if role == "contratista" else None,
            )

        sync_groups_from_memberships(instance)
        sync_user_flags_from_memberships(instance)

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

        return instance


class UserViewSet(viewsets.ModelViewSet):
    serializer_class = UserAdminSerializer
    permission_classes = (IsAuthenticated, IsUserManager)
    # entity/role/secretaria se resuelven por membresía en get_queryset(), no por FK cacheado en User
    filterset_fields = ("is_active",)
    search_fields = ("email", "full_name")
    ordering_fields = ("date_joined", "email", "full_name")
    pagination_class = StandardPageNumberPagination

    def initial(self, request, *args, **kwargs):
        super().initial(request, *args, **kwargs)
        user = request.user
        if is_platform_superadmin(user):
            return
        roles = user_roles(user)
        if "admin" in roles:
            require_user_module(
                user,
                "users_admin",
                message="El módulo de administración de usuarios está deshabilitado.",
            )

    def get_serializer_context(self):
        ctx = super().get_serializer_context()
        actor = self.request.user
        entity_id = self.request.query_params.get("entity") or self.request.query_params.get("entity_id")
        if entity_id is None and not is_platform_superadmin(actor) and actor.entity_id:
            entity_id = actor.entity_id
        if entity_id is not None:
            ctx["entity_id"] = entity_id
        return ctx

    def _resolve_entity_id(self, actor) -> int | None:
        raw = self.request.query_params.get("entity") or self.request.query_params.get("entity_id")
        if raw is None and not is_platform_superadmin(actor) and actor.entity_id:
            raw = actor.entity_id
        if raw is None:
            return None
        try:
            return int(raw)
        except (TypeError, ValueError):
            return None

    def _apply_membership_query_filters(self, qs, *, entity_id: int | None):
        role_filter = (self.request.query_params.get("role") or "").strip()
        if role_filter:
            mem_qs = UserEntityMembership.objects.filter(is_active=True, role=role_filter)
            if entity_id is not None:
                mem_qs = mem_qs.filter(entity_id=entity_id)
            qs = qs.filter(id__in=mem_qs.values_list("user_id", flat=True))

        secretaria_filter = self.request.query_params.get("secretaria")
        if secretaria_filter:
            try:
                secretaria_id = int(secretaria_filter)
            except (TypeError, ValueError):
                pass
            else:
                mem_qs = UserEntityMembership.objects.filter(
                    is_active=True, secretaria_id=secretaria_id
                )
                if entity_id is not None:
                    mem_qs = mem_qs.filter(entity_id=entity_id)
                qs = qs.filter(id__in=mem_qs.values_list("user_id", flat=True))
        return qs

    def get_queryset(self):
        actor = self.request.user
        qs = User.objects.select_related("entity", "secretaria").prefetch_related("groups").all()
        entity_id = self._resolve_entity_id(actor)
        if entity_id:
            qs = qs.prefetch_related(
                models.Prefetch(
                    "memberships",
                    queryset=UserEntityMembership.objects.filter(
                        entity_id=entity_id, is_active=True
                    ).select_related("entity", "secretaria", "supervisor"),
                    to_attr="_entity_memberships_for_context",
                )
            )
        if is_platform_superadmin(actor):
            if entity_id:
                user_ids = UserEntityMembership.objects.filter(
                    entity_id=entity_id, is_active=True
                ).values_list("user_id", flat=True)
                qs = qs.filter(id__in=user_ids)
            else:
                detail_actions = {"retrieve", "update", "partial_update", "destroy"}
                if self.action not in detail_actions:
                    return qs
            return self._apply_membership_query_filters(qs, entity_id=entity_id)
        if not actor.entity_id:
            return qs.none()
        roles = user_roles(actor)
        if "secretario" in roles and "admin" not in roles:
            supervised = UserEntityMembership.objects.filter(
                entity_id=actor.entity_id,
                supervisor_id=actor.id,
                role="contratista",
                is_active=True,
            ).values_list("user_id", flat=True)
            qs = qs.filter(id__in=supervised)
        else:
            user_ids = UserEntityMembership.objects.filter(
                entity_id=actor.entity_id, is_active=True
            ).values_list("user_id", flat=True)
            qs = qs.filter(id__in=user_ids)
        return self._apply_membership_query_filters(qs, entity_id=entity_id or actor.entity_id)

    @action(detail=False, methods=["get"], url_path="lookup-email")
    def lookup_email(self, request):
        """Comprueba si un email ya existe y en qué entidades tiene membresía."""
        email = (request.query_params.get("email") or "").strip().lower()
        if not email:
            raise ValidationError({"email": "Email requerido."})
        user = User.objects.filter(email__iexact=email).first()
        if user is None:
            return Response({"exists": False})
        memberships = (
            UserEntityMembership.objects.filter(user=user, is_active=True)
            .select_related("entity")
            .order_by("entity__name")
        )
        return Response(
            {
                "exists": True,
                "email": user.email,
                "full_name": user.full_name,
                "memberships": [
                    {
                        "entity_id": m.entity_id,
                        "entity_name": m.entity.name,
                        "role": m.role,
                    }
                    for m in memberships
                ],
            }
        )

    def _resolve_target_entity_id(self, request, actor) -> int | None:
        raw = request.query_params.get("entity") or request.query_params.get("entity_id")
        if raw:
            try:
                return int(raw)
            except (TypeError, ValueError) as exc:
                raise ValidationError({"entity": "Identificador de entidad inválido."}) from exc
        if not is_platform_superadmin(actor) and actor.entity_id:
            return actor.entity_id
        ctx = self.get_serializer_context().get("entity_id")
        if ctx is not None:
            try:
                return int(ctx)
            except (TypeError, ValueError):
                return None
        return None

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        actor = request.user
        if instance.pk == actor.pk:
            raise ValidationError("No puedes eliminarte a ti mismo.")

        purge = request.query_params.get("purge", "").lower() in {"true", "1", "yes"}
        entity_id = self._resolve_target_entity_id(request, actor)

        if not purge and entity_id is not None:
            membership = UserEntityMembership.objects.filter(
                user=instance, entity_id=entity_id, is_active=True
            ).first()
            if membership is None:
                raise ValidationError({"detail": "El usuario no pertenece a esta entidad."})
            membership.is_active = False
            membership.save(update_fields=["is_active", "updated_at"])
            if not UserEntityMembership.objects.filter(user=instance, is_active=True).exists():
                instance.is_active = False
                instance.save(update_fields=["is_active"])
                if instance.clerk_id:
                    try:
                        ban_user(instance.clerk_id)
                    except ClerkServiceError:
                        pass
            else:
                sync_groups_from_memberships(instance)
                sync_user_flags_from_memberships(instance)
            return Response(status=204)

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
