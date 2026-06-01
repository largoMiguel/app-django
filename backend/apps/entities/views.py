"""ViewSets para Entity y Secretaria."""
from __future__ import annotations

from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.common.pagination import StandardPageNumberPagination
from apps.common.roles import is_platform_superadmin
from .deletion import delete_entity_completely
from .models import Entity, Secretaria
from .permissions import IsEntityAdmin, IsSuperAdmin
from .serializers import EntitySerializer, SecretariaSerializer


class EntityViewSet(viewsets.ModelViewSet):
    """Gestión de entidades: solo superadmin."""

    queryset = Entity.objects.all()
    serializer_class = EntitySerializer
    permission_classes = (IsAuthenticated, IsSuperAdmin)
    filterset_fields = ("is_active", "enable_pqrs")
    search_fields = ("name", "code", "nit", "slug")
    ordering_fields = ("name", "created_at")
    pagination_class = StandardPageNumberPagination

    @action(detail=False, methods=["get"], url_path="mine", permission_classes=(IsAuthenticated,))
    def mine(self, request):
        """Devuelve la entidad del usuario autenticado (cualquier rol)."""
        user = request.user
        entity = getattr(user, "entity", None)
        if not entity:
            return Response({"detail": "Usuario sin entidad asignada"}, status=404)
        return Response(EntitySerializer(entity).data)

    def destroy(self, request, *args, **kwargs):
        entity = self.get_object()
        confirm = str(request.query_params.get("confirm", "")).strip()
        if confirm != entity.slug:
            raise ValidationError(
                {
                    "confirm": (
                        f"Confirme enviando ?confirm={entity.slug} "
                        "para eliminar la entidad y todos sus datos."
                    )
                }
            )
        delete_entity_completely(entity)
        return Response(status=status.HTTP_204_NO_CONTENT)


class SecretariaViewSet(viewsets.ModelViewSet):
    """Gestión de secretarías por entidad (admin o superadmin con filtro entity)."""

    serializer_class = SecretariaSerializer
    permission_classes = (IsAuthenticated, IsEntityAdmin)
    filterset_fields = ("entity", "is_active")
    search_fields = ("nombre",)
    ordering_fields = ("nombre",)
    pagination_class = StandardPageNumberPagination

    def get_queryset(self):
        user = self.request.user
        qs = Secretaria.objects.select_related("entity").all()
        if is_platform_superadmin(user):
            entity_id = self.request.query_params.get("entity") or self.request.query_params.get("entity_id")
            if not entity_id:
                return qs.none()
            return qs.filter(entity_id=entity_id)
        if user.entity_id:
            return qs.filter(entity_id=user.entity_id)
        return qs.none()

    def perform_create(self, serializer):
        user = self.request.user
        if is_platform_superadmin(user):
            serializer.save()
        else:
            serializer.save(entity_id=user.entity_id)

    def perform_update(self, serializer):
        user = self.request.user
        if is_platform_superadmin(user):
            serializer.save()
        else:
            serializer.save(entity_id=user.entity_id)
