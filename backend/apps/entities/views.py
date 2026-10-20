"""ViewSets para Entity y Secretaria."""
from __future__ import annotations

import logging

from django.core.files.base import ContentFile
from django.db.models.deletion import ProtectedError
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
        url_path="docx-template",
        parser_classes=(MultiPartParser, FormParser),
    )
    def docx_template(self, request, pk=None):
        entity = self.get_object()
        if request.method == "DELETE":
            if entity.docx_template_url:
                delete_pqrs_storage_key(entity.docx_template_url)
                entity.docx_template_url = None
                entity.save(update_fields=["docx_template_url", "updated_at"])
            return Response({"has_template": False})

        upload = request.FILES.get("file")
        if not upload:
            raise ValidationError({"file": "Debes subir un archivo Word (.docx)."})
        if not upload.name.lower().endswith(".docx"):
            raise ValidationError({"file": "Solo se aceptan archivos .docx."})
        allowed_types = (
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            "application/octet-stream",
        )
        if upload.content_type and upload.content_type not in allowed_types:
            raise ValidationError({"file": "El archivo debe ser Word (.docx)."})

        if entity.docx_template_url:
            delete_pqrs_storage_key(entity.docx_template_url)

        raw = upload.read()
        from apps.common.docx_template import analyze_docx_fonts

        fonts, missing = analyze_docx_fonts(raw)

        timestamp = timezone.now().strftime("%Y%m%d_%H%M%S")
        key = f"templates/{entity.id}/template_{timestamp}.docx"
        storage = pqrs_storage_for_paths()
        storage.save(key, ContentFile(raw))
        entity.docx_template_url = key
        entity.save(update_fields=["docx_template_url", "updated_at"])
        return Response(
            {
                "docx_template_url": key,
                "filename": upload.name,
                "has_template": True,
                "fonts": fonts,
                "missing_fonts": missing,
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

    def perform_destroy(self, instance):
        try:
            instance.delete()
        except ProtectedError:
            raise ValidationError(
                {
                    "detail": (
                        "No se puede eliminar esta secretaría porque tiene registros "
                        "vinculados (por ejemplo correspondencia). Desactívela en su lugar."
                    )
                }
            ) from None
