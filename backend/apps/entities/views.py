"""ViewSets para Entity y Secretaria."""
from __future__ import annotations

import logging

from django.core.files.base import ContentFile
from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.common.pagination import StandardPageNumberPagination
from apps.common.roles import is_platform_superadmin
from apps.common.storage_cleanup import delete_pqrs_storage_key
from apps.common.storages import pqrs_storage_for_paths
from .deletion import delete_entity_completely
from .models import Entity, Secretaria
from .permissions import IsEntityAdmin, IsSuperAdmin
from .serializers import EntitySerializer, SecretariaSerializer

logger = logging.getLogger(__name__)


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

    @action(
        detail=True,
        methods=["post", "delete"],
        url_path="pdf-template",
        parser_classes=(MultiPartParser, FormParser),
    )
    def pdf_template(self, request, pk=None):
        entity = self.get_object()
        if request.method == "DELETE":
            if entity.pdf_template_url:
                delete_pqrs_storage_key(entity.pdf_template_url)
                entity.pdf_template_url = None
                entity.save(update_fields=["pdf_template_url", "updated_at"])
            return Response({"has_template": False})

        upload = request.FILES.get("file")
        if not upload:
            raise ValidationError({"file": "Debes subir un archivo PDF."})
        if not upload.name.lower().endswith(".pdf"):
            raise ValidationError({"file": "Solo se aceptan archivos PDF."})
        if upload.content_type and upload.content_type not in ("application/pdf", "application/octet-stream"):
            raise ValidationError({"file": "El archivo debe ser PDF."})

        if entity.pdf_template_url:
            delete_pqrs_storage_key(entity.pdf_template_url)

        timestamp = timezone.now().strftime("%Y%m%d_%H%M%S")
        key = f"templates/{entity.id}/template_{timestamp}.pdf"
        storage = pqrs_storage_for_paths()
        storage.save(key, ContentFile(upload.read()))
        entity.pdf_template_url = key
        entity.save(update_fields=["pdf_template_url", "updated_at"])
        return Response(
            {
                "pdf_template_url": key,
                "filename": upload.name,
                "has_template": True,
            }
        )


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
