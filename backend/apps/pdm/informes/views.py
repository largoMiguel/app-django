"""ViewSet para informes PDM institucionales."""
from __future__ import annotations

import datetime
import logging

from django.http import HttpResponse
from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.common.roles import is_platform_superadmin, user_roles
from apps.entities.models import Entity, Secretaria
from apps.pdm.models import InformePDM, InformePdmEstado
from apps.pdm.views import _ensure_user_can_manage_entity, _is_admin, _is_secretario

from .serializers import GenerarInformePdmSerializer, InformePdmSerializer
from .service import delete_informe, get_informe_file_bytes, has_active_informe, mark_stale_processing_informes

logger = logging.getLogger(__name__)


def _can_view_informes(user) -> bool:
    if is_platform_superadmin(user):
        return False
    roles = user_roles(user)
    return "admin" in roles or "secretario" in roles


class InformePdmViewSet(viewsets.GenericViewSet):
    serializer_class = InformePdmSerializer
    permission_classes = (IsAuthenticated,)

    def _entity(self) -> Entity:
        slug = self.kwargs.get("slug")
        entity = Entity.objects.filter(slug=slug).first()
        if not entity:
            raise ValidationError({"detail": "Entidad no encontrada."})
        _ensure_user_can_manage_entity(self.request.user, entity)
        if not entity.enable_pdm:
            raise PermissionDenied("El módulo PDM no está habilitado para esta entidad.")
        return entity

    def get_queryset(self):
        user = self.request.user
        entity = self._entity()
        now = timezone.now()
        qs = InformePDM.objects.filter(entity_id=entity.id, expires_at__gt=now).select_related(
            "created_by", "responsable_secretaria", "usuario_firmante"
        )
        if _is_secretario(user) and not _is_admin(user):
            qs = qs.filter(created_by_id=user.id)
        return qs.order_by("-created_at", "-id")

    def _authorize_view(self, user) -> None:
        if not _can_view_informes(user):
            raise PermissionDenied("No tienes permiso para ver informes PDM.")

    def _get_informe_or_404(self, pk: int) -> InformePDM:
        informe = self.get_queryset().filter(pk=pk).first()
        if not informe:
            raise ValidationError({"detail": "Informe no encontrado o expirado."})
        return informe

    def list(self, request, slug=None):
        self._authorize_view(request.user)
        entity = self._entity()
        InformePDM.purge_expired(entity_id=entity.id)
        mark_stale_processing_informes(entity.id)
        serializer = self.get_serializer(self.get_queryset(), many=True)
        return Response(serializer.data)

    def create(self, request, slug=None):
        self._authorize_view(request.user)
        entity = self._entity()
        user = request.user

        ser = GenerarInformePdmSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        data = ser.validated_data

        if not data.get("usuario_firmante_id"):
            raise ValidationError({"usuario_firmante_id": "El firmante es obligatorio."})

        from django.contrib.auth import get_user_model

        User = get_user_model()
        firmante = User.objects.filter(pk=data["usuario_firmante_id"], entity_id=entity.id).first()
        if not firmante:
            raise ValidationError({"usuario_firmante_id": "Usuario firmante no válido."})

        secretaria_id = data.get("responsable_secretaria_id")
        if _is_secretario(user) and not _is_admin(user):
            if not user.secretaria_id:
                raise PermissionDenied("Su usuario no tiene secretaría asignada.")
            secretaria_id = user.secretaria_id
        elif secretaria_id:
            if not Secretaria.objects.filter(pk=secretaria_id, entity_id=entity.id).exists():
                raise ValidationError({"responsable_secretaria_id": "Dependencia no válida."})

        mark_stale_processing_informes(entity.id)
        if has_active_informe(entity.id):
            return Response(
                {"detail": "Ya hay un informe en cola o generándose. Espere a que finalice."},
                status=status.HTTP_409_CONFLICT,
            )

        usar_ia = data.get("usar_ia", False) and entity.enable_ai_reports

        expires_at = timezone.now() + datetime.timedelta(days=7)
        informe = InformePDM.objects.create(
            entity=entity,
            created_by=user,
            anio=data["anio"],
            responsable_secretaria_id=secretaria_id,
            incluir_evidencias=data.get("incluir_evidencias", True),
            usar_ia=usar_ia,
            usuario_firmante=firmante,
            estado=InformePdmEstado.PENDIENTE,
            expires_at=expires_at,
        )

        from apps.pdm.tasks import generar_informe_pdm

        task = generar_informe_pdm.delay(informe.id)
        informe.celery_task_id = task.id or ""
        informe.save(update_fields=["celery_task_id"])

        return Response(self.get_serializer(informe).data, status=status.HTTP_201_CREATED)

    def destroy(self, request, slug=None, pk=None):
        self._authorize_view(request.user)
        delete_informe(self._get_informe_or_404(pk))
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=True, methods=["get"], url_path="download")
    def download(self, request, slug=None, pk=None):
        self._authorize_view(request.user)
        informe = self._get_informe_or_404(pk)
        if informe.estado != InformePdmEstado.COMPLETADO:
            raise ValidationError({"detail": "El informe aún no está disponible para descarga."})
        content = get_informe_file_bytes(informe)
        response = HttpResponse(content, content_type="application/pdf")
        response["Content-Disposition"] = f'attachment; filename="{informe.filename}"'
        return response
