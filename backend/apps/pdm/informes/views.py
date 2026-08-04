"""ViewSet para informes PDM institucionales."""
from __future__ import annotations

import datetime
import logging

from django.http import HttpResponse
from django.utils import timezone
from django.contrib.auth import get_user_model
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.common.roles import is_platform_superadmin, user_roles
from apps.entities.models import Entity, Secretaria
from apps.pdm.models import InformePDM, InformePdmEstado, InformePdmTipo
from apps.pdm.views import _ensure_user_can_manage_entity, _is_admin, _is_secretario

from .serializers import GenerarInformePdmSerializer, InformePdmSerializer
from .service import delete_informe, get_informe_file_bytes, has_active_informe, mark_stale_processing_informes

logger = logging.getLogger(__name__)
User = get_user_model()


def _firmantes_queryset(entity: Entity, secretaria_id: int | None):
    from apps.accounts.models import UserEntityMembership

    mem = UserEntityMembership.objects.filter(entity_id=entity.id, is_active=True)
    if secretaria_id:
        mem = mem.filter(secretaria_id=secretaria_id)
    return User.objects.filter(id__in=mem.values_list("user_id", flat=True)).order_by("full_name", "email")


def _firmante_belongs_to_secretaria(firmante, entity_id: int, secretaria_id: int) -> bool:
    from apps.accounts.models import UserEntityMembership

    return UserEntityMembership.objects.filter(
        user_id=firmante.id,
        entity_id=entity_id,
        secretaria_id=secretaria_id,
        is_active=True,
    ).exists()


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
        tipo = self.request.query_params.get("tipo")
        if tipo:
            qs = qs.filter(tipo=tipo)
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

        firmante = User.objects.filter(pk=data["usuario_firmante_id"], entity_id=entity.id).first()
        if not firmante:
            raise ValidationError({"usuario_firmante_id": "Usuario firmante no válido."})

        secretaria_id = data.get("responsable_secretaria_id")
        if _is_secretario(user) and not _is_admin(user):
            if not user.secretaria_id:
                raise PermissionDenied("Su usuario no tiene secretaría asignada.")
            secretaria_id = user.secretaria_id
            if not _firmante_belongs_to_secretaria(firmante, entity.id, secretaria_id):
                raise ValidationError(
                    {"usuario_firmante_id": "El firmante debe pertenecer a su dependencia."}
                )
        elif secretaria_id:
            if not Secretaria.objects.filter(pk=secretaria_id, entity_id=entity.id).exists():
                raise ValidationError({"responsable_secretaria_id": "Dependencia no válida."})
            if not _firmante_belongs_to_secretaria(firmante, entity.id, secretaria_id):
                raise ValidationError(
                    {"usuario_firmante_id": "El firmante debe pertenecer a la dependencia seleccionada."}
                )

        tipo = data.get("tipo", InformePdmTipo.AVANCE)

        mark_stale_processing_informes(entity.id)
        if has_active_informe(entity.id, tipo=tipo):
            return Response(
                {"detail": "Ya hay un informe de este tipo en cola o generándose. Espere a que finalice."},
                status=status.HTTP_409_CONFLICT,
            )

        usar_ia = data.get("usar_ia", False) and entity.enable_ai_reports

        expires_at = timezone.now() + datetime.timedelta(days=7)
        informe = InformePDM.objects.create(
            entity=entity,
            created_by=user,
            tipo=tipo,
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

    @action(detail=False, methods=["get"], url_path="firmantes")
    def firmantes(self, request, slug=None):
        self._authorize_view(request.user)
        entity = self._entity()
        user = request.user

        secretaria_id = request.query_params.get("secretaria_id")
        if _is_secretario(user) and not _is_admin(user):
            if not user.secretaria_id:
                raise PermissionDenied("Su usuario no tiene secretaría asignada.")
            secretaria_id = user.secretaria_id
        elif secretaria_id:
            try:
                secretaria_id = int(secretaria_id)
            except (TypeError, ValueError) as exc:
                raise ValidationError({"secretaria_id": "Identificador inválido."}) from exc
            if not Secretaria.objects.filter(pk=secretaria_id, entity_id=entity.id).exists():
                raise ValidationError({"secretaria_id": "Dependencia no válida."})
        else:
            secretaria_id = None

        rows = _firmantes_queryset(entity, secretaria_id)
        return Response(
            [{"id": u.id, "full_name": u.full_name or u.email, "email": u.email} for u in rows]
        )

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
