from __future__ import annotations

from django.contrib.auth import get_user_model
from django.contrib.auth.models import Group, Permission
from django.db.models import Count, Q
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.common.pagination import StandardPageNumberPagination
from apps.common.roles import is_platform_superadmin
from apps.rbac.permissions import IsAdminRole, _role_names
from apps.rbac.serializers import AssignRoleSerializer, PermissionSerializer, RoleSerializer

User = get_user_model()

SYSTEM_ESCALATION_ROLES = {"superadmin"}


class RoleViewSet(viewsets.ModelViewSet):
    """CRUD de roles — custom por entidad; system roles sólo superadmin."""

    serializer_class = RoleSerializer
    permission_classes = (IsAuthenticated, IsAdminRole)
    pagination_class = StandardPageNumberPagination

    def get_queryset(self):
        qs = Group.objects.all().select_related("meta").prefetch_related("permissions")
        qs = qs.annotate(user_count=Count("user", distinct=True))
        actor = self.request.user
        if is_platform_superadmin(actor):
            return qs
        if actor.entity_id:
            return qs.filter(
                Q(meta__entity_id=actor.entity_id)
                | Q(meta__is_system=True)
                | Q(meta__isnull=True)
            )
        return qs.filter(Q(meta__is_system=True) | Q(meta__isnull=True))

    def _is_super(self, request) -> bool:
        return is_platform_superadmin(request.user)

    def _guard_system_role(self, instance, request) -> Response | None:
        meta = getattr(instance, "meta", None)
        if meta and meta.is_system and not self._is_super(request):
            return Response(
                {"detail": "Solo superadmin puede modificar roles del sistema."},
                status=status.HTTP_403_FORBIDDEN,
            )
        return None

    def _guard_role_ownership(self, instance, request) -> Response | None:
        if self._is_super(request):
            return None
        meta = getattr(instance, "meta", None)
        if not meta or meta.is_system or meta.entity_id is None:
            return Response(
                {"detail": "No puedes modificar roles globales del sistema."},
                status=status.HTTP_403_FORBIDDEN,
            )
        if meta.entity_id != request.user.entity_id:
            return Response(
                {"detail": "No puedes modificar roles de otra entidad."},
                status=status.HTTP_403_FORBIDDEN,
            )
        return None

    def perform_create(self, serializer):
        actor = self.request.user
        if self._is_super(actor):
            serializer.save()
        else:
            serializer.save(meta={"entity": actor.entity, "is_system": False})

    def update(self, request, *args, **kwargs):
        instance = self.get_object()
        blocked = self._guard_system_role(instance, request) or self._guard_role_ownership(instance, request)
        if blocked:
            return blocked
        return super().update(request, *args, **kwargs)

    def partial_update(self, request, *args, **kwargs):
        instance = self.get_object()
        blocked = self._guard_system_role(instance, request) or self._guard_role_ownership(instance, request)
        if blocked:
            return blocked
        return super().partial_update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        blocked = self._guard_system_role(instance, request) or self._guard_role_ownership(instance, request)
        if blocked:
            return blocked
        meta = getattr(instance, "meta", None)
        if meta and meta.is_system:
            return Response(
                {"detail": "No se puede borrar un rol del sistema."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        return super().destroy(request, *args, **kwargs)

    @action(
        detail=False,
        methods=["post"],
        url_path="assign",
        permission_classes=(IsAuthenticated, IsAdminRole),
    )
    def assign(self, request):
        """Asigna un set de roles a un usuario (reemplaza los actuales)."""
        serializer = AssignRoleSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        actor = request.user
        actor_roles = _role_names(actor)
        is_super = is_platform_superadmin(actor)

        user = User.objects.filter(pk=serializer.validated_data["user_id"]).first()
        if not user:
            return Response({"detail": "Usuario no existe."}, status=404)

        if not is_super:
            if not actor.entity_id or user.entity_id != actor.entity_id:
                raise PermissionDenied("Solo puedes asignar roles a usuarios de tu entidad.")

        groups = list(Group.objects.filter(pk__in=serializer.validated_data["role_ids"]))
        if len(groups) != len(set(serializer.validated_data["role_ids"])):
            return Response({"detail": "Uno o más roles no existen."}, status=400)

        group_names = {g.name.lower() for g in groups}
        if SYSTEM_ESCALATION_ROLES.intersection(group_names) and not is_super:
            return Response(
                {"detail": "No puedes asignar roles de superadministrador."},
                status=status.HTTP_403_FORBIDDEN,
            )

        user.groups.set(groups)
        primary = next(
            (name for name in ("superadmin", "admin", "secretario", "ciudadano") if name in group_names),
            groups[0].name if groups else "",
        )
        user.role = primary
        user.is_staff = primary in {"superadmin", "admin"}
        user.is_superuser = "superadmin" in group_names
        user.save(update_fields=["role", "is_staff", "is_superuser"])

        return Response({"detail": "ok", "roles": list(groups.values_list("name", flat=True))})


class PermissionViewSet(viewsets.ReadOnlyModelViewSet):
    """Catálogo de permisos disponibles (Django auth permissions)."""

    queryset = Permission.objects.all().select_related("content_type")
    serializer_class = PermissionSerializer
    permission_classes = (IsAuthenticated, IsAdminRole)
    filterset_fields = ("content_type__app_label", "content_type__model")
    search_fields = ("name", "codename")
    pagination_class = StandardPageNumberPagination
