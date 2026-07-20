"""Endpoints autenticados — módulo Asistencia."""
from __future__ import annotations

from django.db.models import Q
from django.http import HttpResponse
from django.shortcuts import get_object_or_404
from rest_framework import permissions, status
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.common.pagination import StandardPageNumberPagination
from apps.common.roles import user_roles
from apps.entities.models import Entity

from .access import (
    ensure_asistencia_access,
    equipos_queryset,
    funcionarios_queryset,
    registros_queryset,
    user_can_delete_equipo,
    user_can_delete_funcionario,
)
from .export import build_registros_workbook
from .filters import RegistroAsistenciaFilterSet
from .models import EquipoRegistro, Funcionario
from .serializers import (
    EquipoPairingCodeSerializer,
    EquipoRegistroSerializer,
    FuncionarioSerializer,
    RegistroAsistenciaSerializer,
)
from .services import PAIRING_TTL_MINUTES, compute_stats, issue_pairing_code, revoke_device_token


def _entity_for_user(user) -> Entity:
    if not user.entity_id:
        raise PermissionDenied("Usuario sin entidad asignada.")
    return get_object_or_404(Entity, pk=user.entity_id)


def _ensure_manage(user, entity: Entity) -> None:
    ensure_asistencia_access(user, entity)
    role = user_roles(user)
    if "admin" not in role and "secretario" not in role:
        raise PermissionDenied("No tiene permisos para gestionar asistencia.")


class FuncionarioListCreateView(APIView):
    permission_classes = (permissions.IsAuthenticated,)

    def get(self, request):
        entity = _entity_for_user(request.user)
        _ensure_manage(request.user, entity)
        qs = funcionarios_queryset(request.user, entity)
        search = (request.query_params.get("search") or "").strip()
        if search:
            qs = qs.filter(
                Q(cedula__icontains=search)
                | Q(nombres__icontains=search)
                | Q(apellidos__icontains=search)
            )
        is_active = request.query_params.get("is_active")
        if is_active is not None:
            qs = qs.filter(is_active=is_active.lower() in {"1", "true", "yes"})
        paginator = StandardPageNumberPagination()
        page = paginator.paginate_queryset(qs, request)
        ser = FuncionarioSerializer(page, many=True)
        return paginator.get_paginated_response(ser.data)

    def post(self, request):
        entity = _entity_for_user(request.user)
        _ensure_manage(request.user, entity)
        ser = FuncionarioSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        cedula = ser.validated_data["cedula"].strip()
        if Funcionario.objects.filter(entity=entity, cedula=cedula).exists():
            raise ValidationError({"cedula": "Ya existe un funcionario con esta cédula."})
        funcionario = ser.save(entity=entity)
        return Response(FuncionarioSerializer(funcionario).data, status=status.HTTP_201_CREATED)


class FuncionarioDetailView(APIView):
    permission_classes = (permissions.IsAuthenticated,)

    def _get_obj(self, request, pk: int) -> Funcionario:
        entity = _entity_for_user(request.user)
        _ensure_manage(request.user, entity)
        return get_object_or_404(Funcionario, pk=pk, entity=entity)

    def get(self, request, pk: int):
        obj = self._get_obj(request, pk)
        return Response(FuncionarioSerializer(obj).data)

    def put(self, request, pk: int):
        obj = self._get_obj(request, pk)
        ser = FuncionarioSerializer(obj, data=request.data, partial=True)
        ser.is_valid(raise_exception=True)
        obj = ser.save()
        return Response(FuncionarioSerializer(obj).data)

    def delete(self, request, pk: int):
        obj = self._get_obj(request, pk)
        if not user_can_delete_funcionario(request.user):
            raise PermissionDenied("Solo administradores pueden eliminar funcionarios.")
        obj.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class EquipoListCreateView(APIView):
    permission_classes = (permissions.IsAuthenticated,)

    def get(self, request):
        entity = _entity_for_user(request.user)
        _ensure_manage(request.user, entity)
        qs = equipos_queryset(request.user, entity)
        is_active = request.query_params.get("is_active")
        if is_active is not None:
            qs = qs.filter(is_active=is_active.lower() in {"1", "true", "yes"})
        ser = EquipoRegistroSerializer(qs, many=True)
        return Response(ser.data)

    def post(self, request):
        entity = _entity_for_user(request.user)
        _ensure_manage(request.user, entity)
        ser = EquipoRegistroSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        equipo = ser.save(entity=entity)
        return Response(EquipoRegistroSerializer(equipo).data, status=status.HTTP_201_CREATED)


class EquipoDetailView(APIView):
    permission_classes = (permissions.IsAuthenticated,)

    def _get_obj(self, request, pk: int) -> EquipoRegistro:
        entity = _entity_for_user(request.user)
        _ensure_manage(request.user, entity)
        return get_object_or_404(EquipoRegistro, pk=pk, entity=entity)

    def get(self, request, pk: int):
        return Response(EquipoRegistroSerializer(self._get_obj(request, pk)).data)

    def put(self, request, pk: int):
        obj = self._get_obj(request, pk)
        ser = EquipoRegistroSerializer(obj, data=request.data, partial=True)
        ser.is_valid(raise_exception=True)
        obj = ser.save()
        return Response(EquipoRegistroSerializer(obj).data)

    def delete(self, request, pk: int):
        obj = self._get_obj(request, pk)
        if not user_can_delete_equipo(request.user):
            raise PermissionDenied("Solo administradores pueden eliminar equipos.")
        obj.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class EquipoPairingView(APIView):
    permission_classes = (permissions.IsAuthenticated,)

    def post(self, request, pk: int):
        entity = _entity_for_user(request.user)
        _ensure_manage(request.user, entity)
        equipo = get_object_or_404(EquipoRegistro, pk=pk, entity=entity)
        code = issue_pairing_code(equipo)
        return Response(
            EquipoPairingCodeSerializer(
                {"pairing_code": code, "expires_in_seconds": PAIRING_TTL_MINUTES * 60}
            ).data
        )


class EquipoRevokeView(APIView):
    permission_classes = (permissions.IsAuthenticated,)

    def post(self, request, pk: int):
        entity = _entity_for_user(request.user)
        _ensure_manage(request.user, entity)
        equipo = get_object_or_404(EquipoRegistro, pk=pk, entity=entity)
        revoke_device_token(equipo)
        return Response({"detail": "Token revocado."})


class RegistroListView(APIView):
    permission_classes = (permissions.IsAuthenticated,)

    def get(self, request):
        entity = _entity_for_user(request.user)
        _ensure_manage(request.user, entity)
        qs = registros_queryset(request.user, entity)
        filt = RegistroAsistenciaFilterSet(request.query_params, queryset=qs)
        qs = filt.qs
        paginator = StandardPageNumberPagination()
        page = paginator.paginate_queryset(qs, request)
        ser = RegistroAsistenciaSerializer(page, many=True)
        return paginator.get_paginated_response(ser.data)


class RegistroExportView(APIView):
    permission_classes = (permissions.IsAuthenticated,)

    def get(self, request):
        entity = _entity_for_user(request.user)
        _ensure_manage(request.user, entity)
        qs = registros_queryset(request.user, entity)
        filt = RegistroAsistenciaFilterSet(request.query_params, queryset=qs)
        qs = filt.qs[:5000]
        data = build_registros_workbook(qs)
        response = HttpResponse(
            data,
            content_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        )
        response["Content-Disposition"] = 'attachment; filename="asistencia.xlsx"'
        return response


class AsistenciaStatsView(APIView):
    permission_classes = (permissions.IsAuthenticated,)

    def get(self, request):
        entity = _entity_for_user(request.user)
        _ensure_manage(request.user, entity)
        return Response(compute_stats(entity))
