"""ViewSet para informes PQRS institucionales."""
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

from apps.common.modules import require_user_module
from apps.rbac.permissions import HasPermOrRole

from .access import pqrs_queryset_for_user
from .filters import PQRSFilterSet
from apps.common.pagination import StandardPageNumberPagination

from .models import InformePQRS, InformePQRSEstado, PQRS
from .tasks import generar_informe_pqrs_task
from .serializers import GenerarInformeSerializer, InformePQRSSerializer
from .services.informe_service import delete_informe, get_informe_file_bytes

logger = logging.getLogger(__name__)


def _can_view_informes(user) -> bool:
    from apps.common.roles import is_platform_superadmin, user_roles

    if is_platform_superadmin(user):
        return False
    roles = user_roles(user)
    return "admin" in roles or "secretario" in roles


def _can_manage_informes(user) -> bool:
    from apps.common.roles import is_platform_superadmin, user_roles

    if is_platform_superadmin(user):
        return False
    return "admin" in user_roles(user)


class InformePQRSViewSet(viewsets.GenericViewSet):
    serializer_class = InformePQRSSerializer
    permission_classes = (
        IsAuthenticated,
        HasPermOrRole(perms=("pqrs.view_pqrs",), roles=("admin", "secretario")),
    )

    def get_queryset(self):
        user = self.request.user
        if not user.entity_id:
            return InformePQRS.objects.none()
        now = timezone.now()
        return (
            InformePQRS.objects.filter(entity_id=user.entity_id, expires_at__gt=now)
            .select_related("created_by")
            .order_by("-created_at", "-id")
        )

    def _authorize_view(self, user) -> None:
        require_user_module(
            user,
            "reports_pdf",
            message="El módulo de reportes no está habilitado para tu usuario.",
        )
        if not _can_view_informes(user):
            raise PermissionDenied("No tienes permiso para ver informes PQRS.")

    def _authorize_manage(self, user) -> None:
        self._authorize_view(user)
        if not _can_manage_informes(user):
            raise PermissionDenied("Solo el administrador de la entidad puede gestionar informes PQRS.")

    def _get_informe_or_404(self, pk: int) -> InformePQRS:
        informe = self.get_queryset().filter(pk=pk).first()
        if not informe:
            raise ValidationError({"detail": "Informe no encontrado o expirado."})
        return informe

    def list(self, request):
        self._authorize_view(request.user)
        InformePQRS.purge_expired(entity_id=request.user.entity_id)
        qs = self.get_queryset()
        paginator = StandardPageNumberPagination()
        page = paginator.paginate_queryset(qs, request)
        serializer = self.get_serializer(page, many=True)
        return paginator.get_paginated_response(serializer.data)

    def create(self, request):
        self._authorize_manage(request.user)

        ser = GenerarInformeSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        data = ser.validated_data
        user = request.user
        entity = user.entity
        if not entity or not entity.enable_reports_pdf:
            raise PermissionDenied("El módulo de reportes PDF no está habilitado para esta entidad.")

        base_qs = pqrs_queryset_for_user(user, PQRS.objects.all())
        filter_data = {
            "fecha_desde": data["fecha_inicio"].isoformat(),
            "fecha_hasta": data["fecha_fin"].isoformat(),
        }
        if data.get("estado"):
            filter_data["estado"] = data["estado"]
        if data.get("tipo_solicitud"):
            filter_data["tipo_solicitud"] = data["tipo_solicitud"]
        if data.get("assigned_to"):
            filter_data["assigned_to"] = data["assigned_to"]

        filterset = PQRSFilterSet(data=filter_data, queryset=base_qs)

        if not filterset.qs.exists():
            raise ValidationError({"detail": "No se encontraron PQRS en el rango de fechas seleccionado."})

        expires_at = timezone.now() + datetime.timedelta(days=7)
        generation_params = {
            "estado": data.get("estado"),
            "tipo_solicitud": data.get("tipo_solicitud"),
            "assigned_to": data.get("assigned_to"),
            "usar_ia": data.get("usar_ia", True),
            "usuario_firmante_id": data.get("usuario_firmante_id"),
        }
        informe = InformePQRS.objects.create(
            entity=entity,
            created_by=user,
            filename="",
            b2_key="",
            fecha_inicio=data["fecha_inicio"],
            fecha_fin=data["fecha_fin"],
            expires_at=expires_at,
            estado=InformePQRSEstado.PENDIENTE,
            generation_params=generation_params,
        )
        task = generar_informe_pqrs_task.delay(informe.id)
        informe.celery_task_id = task.id or ""
        informe.save(update_fields=["celery_task_id"])

        return Response(self.get_serializer(informe).data, status=status.HTTP_201_CREATED)

    def destroy(self, request, pk=None):
        self._authorize_manage(request.user)
        delete_informe(self._get_informe_or_404(pk))
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=True, methods=["get"], url_path="download")
    def download(self, request, pk=None):
        self._authorize_view(request.user)
        informe = self._get_informe_or_404(pk)
        if informe.estado != InformePQRSEstado.COMPLETADO or not informe.b2_key:
            raise ValidationError({"detail": "El informe aún se está generando o falló."})
        content = get_informe_file_bytes(informe)
        response = HttpResponse(content, content_type="application/pdf")
        response["Content-Disposition"] = f'attachment; filename="{informe.filename}"'
        return response
