"""API Correspondencia — admin/secretario."""
from __future__ import annotations

from django.contrib.auth import get_user_model
from django.http import HttpResponse
from django.shortcuts import get_object_or_404
from rest_framework import permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.response import Response

from apps.common.pagination import StandardPageNumberPagination
from apps.common.roles import user_roles
from apps.entities.models import Entity, Secretaria

from .access import correspondencia_queryset, ensure_correspondencia_access, user_can_access_correspondencia
from .export import build_excel, build_pdf
from .filters import CorrespondenciaFilterSet
from .models import Correspondencia, CorrespondenciaAnexo, EstadoCorrespondencia
from .serializers import (
    AnexoUploadSerializer,
    AsignarSerializer,
    CambiarEstadoSerializer,
    CorrespondenciaAnexoSerializer,
    CorrespondenciaDetailSerializer,
    CorrespondenciaListSerializer,
    CorrespondenciaWriteSerializer,
    ResponderSerializer,
)
from .services import (
    asignar,
    cambiar_estado,
    compute_stats,
    crear_correspondencia,
    delete_anexo,
    responder,
    upload_anexo,
)

User = get_user_model()


def _entity_for_user(user) -> Entity:
    if not user.entity_id:
        raise PermissionDenied("Usuario sin entidad asignada.")
    return get_object_or_404(Entity, pk=user.entity_id)


class CorrespondenciaViewSet(viewsets.ModelViewSet):
    permission_classes = (permissions.IsAuthenticated,)
    pagination_class = StandardPageNumberPagination
    http_method_names = ["get", "post", "patch", "delete", "head", "options"]

    def initial(self, request, *args, **kwargs):
        super().initial(request, *args, **kwargs)
        entity = _entity_for_user(request.user)
        ensure_correspondencia_access(request.user, entity)
        self.entity = entity

    def get_queryset(self):
        return correspondencia_queryset(self.request.user, self.entity)

    def filter_queryset(self, queryset):
        return CorrespondenciaFilterSet(self.request.query_params, queryset=queryset).qs

    def get_serializer_class(self):
        if self.action == "retrieve":
            return CorrespondenciaDetailSerializer
        if self.action in {"create", "partial_update"}:
            return CorrespondenciaWriteSerializer
        return CorrespondenciaListSerializer

    def get_object(self):
        obj = get_object_or_404(self.get_queryset(), pk=self.kwargs["pk"])
        if not user_can_access_correspondencia(self.request.user, obj):
            raise PermissionDenied("Sin acceso a este radicado.")
        return obj

    def list(self, request, *args, **kwargs):
        qs = self.filter_queryset(self.get_queryset())
        page = self.paginate_queryset(qs)
        ser = CorrespondenciaListSerializer(page, many=True)
        return self.get_paginated_response(ser.data)

    def retrieve(self, request, *args, **kwargs):
        obj = self.get_object()
        obj = (
            Correspondencia.objects.filter(pk=obj.pk)
            .select_related("secretaria", "assigned_to", "created_by")
            .prefetch_related("anexos", "eventos__actor")
            .first()
        )
        return Response(CorrespondenciaDetailSerializer(obj).data)

    def create(self, request, *args, **kwargs):
        ser = CorrespondenciaWriteSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        secretaria = ser.resolve_secretaria(self.entity)

        # Secretarios solo radican en su secretaría
        roles = user_roles(request.user)
        if "secretario" in roles and "admin" not in roles:
            if not request.user.secretaria_id or secretaria.id != request.user.secretaria_id:
                raise PermissionDenied("Solo puede radicar en su secretaría.")

        assigned_to = None
        aid = ser.validated_data.get("assigned_to_id")
        if aid:
            assigned_to = User.objects.filter(pk=aid, entity=self.entity, is_active=True).first()
            if not assigned_to:
                raise ValidationError({"assigned_to_id": "Usuario inválido."})

        data = {**ser.validated_data, "secretaria": secretaria, "assigned_to": assigned_to}
        data.pop("secretaria_id", None)
        data.pop("assigned_to_id", None)
        obj = crear_correspondencia(entity=self.entity, user=request.user, data=data)
        return Response(
            CorrespondenciaDetailSerializer(
                Correspondencia.objects.filter(pk=obj.pk)
                .select_related("secretaria", "assigned_to", "created_by")
                .prefetch_related("anexos", "eventos__actor")
                .first()
            ).data,
            status=status.HTTP_201_CREATED,
        )

    def partial_update(self, request, *args, **kwargs):
        obj = self.get_object()
        if "admin" not in user_roles(request.user):
            raise PermissionDenied("Solo administradores pueden editar radicados.")
        ser = CorrespondenciaWriteSerializer(data=request.data, partial=True)
        # Re-validate with required fields from existing object for canal check
        payload = {
            "sentido": request.data.get("sentido", obj.sentido),
            "tipologia": request.data.get("tipologia", obj.tipologia),
            "remitente_nombre": request.data.get("remitente_nombre", obj.remitente_nombre),
            "destinatario_nombre": request.data.get(
                "destinatario_nombre", obj.destinatario_nombre
            ),
            "canal": request.data.get("canal", obj.canal),
            "contacto_email": request.data.get("contacto_email", obj.contacto_email),
            "contacto_direccion": request.data.get(
                "contacto_direccion", obj.contacto_direccion
            ),
            "asunto": request.data.get("asunto", obj.asunto),
            "descripcion": request.data.get("descripcion", obj.descripcion),
            "numero_folios": request.data.get("numero_folios", obj.numero_folios),
            "secretaria_id": request.data.get("secretaria_id", obj.secretaria_id),
            "dias_habiles_respuesta": request.data.get(
                "dias_habiles_respuesta", obj.dias_habiles_respuesta
            ),
            "remitente_documento": request.data.get(
                "remitente_documento", obj.remitente_documento
            ),
            "remitente_dependencia": request.data.get(
                "remitente_dependencia", obj.remitente_dependencia
            ),
            "destinatario_documento": request.data.get(
                "destinatario_documento", obj.destinatario_documento
            ),
            "destinatario_dependencia": request.data.get(
                "destinatario_dependencia", obj.destinatario_dependencia
            ),
        }
        ser = CorrespondenciaWriteSerializer(data=payload)
        ser.is_valid(raise_exception=True)
        secretaria = ser.resolve_secretaria(self.entity)
        for field in (
            "sentido",
            "tipologia",
            "remitente_nombre",
            "remitente_documento",
            "remitente_dependencia",
            "destinatario_nombre",
            "destinatario_documento",
            "destinatario_dependencia",
            "canal",
            "contacto_email",
            "contacto_direccion",
            "asunto",
            "descripcion",
            "numero_folios",
            "dias_habiles_respuesta",
        ):
            setattr(obj, field, ser.validated_data[field])
        obj.secretaria = secretaria
        from .services import compute_fecha_vencimiento

        obj.fecha_vencimiento = compute_fecha_vencimiento(
            obj.fecha_radicacion, obj.dias_habiles_respuesta
        )
        obj.save()
        return Response(CorrespondenciaDetailSerializer(obj).data)

    def destroy(self, request, *args, **kwargs):
        if "admin" not in user_roles(request.user):
            raise PermissionDenied("Solo administradores pueden eliminar radicados.")
        obj = self.get_object()
        obj.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=False, methods=["get"])
    def stats(self, request):
        qs = self.filter_queryset(self.get_queryset())
        return Response(compute_stats(qs))

    @action(detail=True, methods=["post"])
    def asignar(self, request, pk=None):
        obj = self.get_object()
        ser = AsignarSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        secretaria = Secretaria.objects.filter(
            pk=ser.validated_data["secretaria_id"],
            entity=self.entity,
            is_active=True,
        ).first()
        if not secretaria:
            raise ValidationError({"secretaria_id": "Secretaría inválida."})
        assigned_to = None
        aid = ser.validated_data.get("assigned_to_id")
        if aid:
            assigned_to = User.objects.filter(pk=aid, entity=self.entity, is_active=True).first()
            if not assigned_to:
                raise ValidationError({"assigned_to_id": "Usuario inválido."})
        if "secretario" in user_roles(request.user) and "admin" not in user_roles(request.user):
            if secretaria.id != request.user.secretaria_id:
                raise PermissionDenied("Solo puede asignar dentro de su secretaría.")
        asignar(obj, secretaria=secretaria, assigned_to=assigned_to, actor=request.user)
        return Response(CorrespondenciaDetailSerializer(self.get_object()).data)

    @action(detail=True, methods=["post"], url_path="cambiar-estado")
    def cambiar_estado_action(self, request, pk=None):
        obj = self.get_object()
        ser = CambiarEstadoSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        cambiar_estado(obj, ser.validated_data["estado"], request.user)
        return Response(CorrespondenciaDetailSerializer(self.get_object()).data)

    @action(detail=True, methods=["post"])
    def responder(self, request, pk=None):
        obj = self.get_object()
        ser = ResponderSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        responder(obj, ser.validated_data["respuesta_texto"], request.user)
        return Response(CorrespondenciaDetailSerializer(self.get_object()).data)

    @action(detail=True, methods=["post"], url_path="cerrar")
    def cerrar(self, request, pk=None):
        obj = self.get_object()
        cambiar_estado(obj, EstadoCorrespondencia.CERRADA, request.user)
        return Response(CorrespondenciaDetailSerializer(self.get_object()).data)

    @action(
        detail=True,
        methods=["get", "post"],
        parser_classes=(MultiPartParser, FormParser),
    )
    def anexos(self, request, pk=None):
        obj = self.get_object()
        if request.method == "GET":
            return Response(
                CorrespondenciaAnexoSerializer(obj.anexos.all(), many=True).data
            )
        ser = AnexoUploadSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        anexo = upload_anexo(
            obj,
            uploaded_file=ser.validated_data["file"],
            tipo=ser.validated_data["tipo"],
            uploaded_by=request.user,
        )
        return Response(CorrespondenciaAnexoSerializer(anexo).data, status=status.HTTP_201_CREATED)

    @action(
        detail=True,
        methods=["delete"],
        url_path=r"anexos/(?P<anexo_id>\d+)",
    )
    def eliminar_anexo(self, request, pk=None, anexo_id=None):
        obj = self.get_object()
        anexo = get_object_or_404(CorrespondenciaAnexo, pk=anexo_id, correspondencia=obj)
        delete_anexo(anexo, request.user)
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=False, methods=["get"])
    def export(self, request):
        qs = self.filter_queryset(self.get_queryset())[:5000]
        fmt = (request.query_params.get("format") or "xlsx").lower()
        if fmt == "pdf":
            data = build_pdf(qs)
            response = HttpResponse(data, content_type="application/pdf")
            response["Content-Disposition"] = 'attachment; filename="correspondencia.pdf"'
            return response
        data = build_excel(qs)
        response = HttpResponse(
            data,
            content_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        )
        response["Content-Disposition"] = 'attachment; filename="correspondencia.xlsx"'
        return response
