"""API PIC — Plan de Intervenciones Colectivas."""
from __future__ import annotations

from django.contrib.auth import get_user_model
from django.http import HttpResponse
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.models import UserEntityMembership
from apps.common.pagination import StandardPageNumberPagination
from apps.common.roles import user_roles
from apps.entities.models import Entity, Secretaria

from .access import (
    actividades_queryset_for_user,
    ensure_pic_access,
    plan_queryset_for_user,
    user_can_access_actividad,
)
from .calculos import (
    calcular_valor_cobrado,
    disponible_ejecucion,
    total_ejecutado,
    trimestre_from_date,
)
from .evidencia_storage import attach_ejecucion_archivos
from .excel_import import (
    aplicar_cargos_a_actividades,
    aplicar_cargos_entity,
    encargados_pendientes_resumen,
    import_pic_excel,
    normalizar_etiqueta,
)
from .export import build_seguimiento_excel
from .filters import PicActividadFilterSet, PicCargoFilterSet
from .models import PicActividad, PicCargo, PicEjecucion, PicPlan
from .serializers import (
    PicActividadDetailSerializer,
    PicActividadListSerializer,
    PicActividadResponsablesSerializer,
    PicCargoSerializer,
    PicCargoWriteSerializer,
    PicEjecucionPreviewSerializer,
    PicEjecucionSerializer,
    PicEjecucionWriteSerializer,
    PicPlanSerializer,
    preview_valor_cobrado,
)
from .stats import compute_pic_stats

User = get_user_model()


def _entity_for_user(user) -> Entity:
    if not user.entity_id:
        raise PermissionDenied("Usuario sin entidad asignada.")
    return get_object_or_404(Entity, pk=user.entity_id)


def _is_admin(user) -> bool:
    return "admin" in user_roles(user)


def _is_secretario(user) -> bool:
    return "secretario" in user_roles(user)


class PicBaseMixin:
    permission_classes = (permissions.IsAuthenticated,)

    def initial(self, request, *args, **kwargs):
        super().initial(request, *args, **kwargs)
        self.entity = _entity_for_user(request.user)
        ensure_pic_access(request.user, self.entity)


class PicPlanView(PicBaseMixin, APIView):
    def get(self, request):
        anio = request.query_params.get("anio")
        if anio and str(anio).isdigit():
            plan = PicPlan.objects.filter(entity=self.entity, anio=int(anio)).first()
            if not plan:
                return Response({"detail": "No hay plan PIC para esta vigencia."}, status=404)
            if not _is_admin(request.user):
                if not plan_queryset_for_user(request.user, self.entity).filter(pk=plan.pk).exists():
                    raise PermissionDenied("Sin acceso a este plan.")
            return Response(PicPlanSerializer(plan).data)
        qs = plan_queryset_for_user(request.user, self.entity).order_by("-anio")
        return Response(PicPlanSerializer(qs, many=True).data)


class PicPlanUploadView(PicBaseMixin, APIView):
    parser_classes = (MultiPartParser, FormParser)

    def post(self, request):
        if not _is_admin(request.user):
            raise PermissionDenied("Solo admin puede cargar el Excel PIC.")
        archivo = request.FILES.get("file")
        if not archivo:
            raise ValidationError({"file": "Archivo requerido."})
        ext = (archivo.name or "").lower().rsplit(".", 1)[-1]
        if ext not in {"xlsx", "xls"}:
            raise ValidationError({"file": "Formato inválido. Use .xlsx o .xls."})
        anio_raw = request.data.get("anio") or request.query_params.get("anio")
        if not anio_raw or not str(anio_raw).isdigit():
            raise ValidationError({"anio": "Año de vigencia requerido."})
        anio = int(anio_raw)
        reasignar = str(request.data.get("reasignar_encargados", "")).lower() in {"1", "true", "yes"}
        content = archivo.read()
        result = import_pic_excel(
            self.entity,
            anio,
            content,
            archivo.name,
            request.user,
            reasignar_encargados=reasignar,
        )
        if not result.get("ok"):
            raise ValidationError({"errores": result.get("errores", [])})
        return Response(result, status=status.HTTP_200_OK)


class PicPlanDeleteView(PicBaseMixin, APIView):
    def delete(self, request, anio: int):
        if not _is_admin(request.user):
            raise PermissionDenied("Solo admin puede eliminar un plan PIC.")
        plan = get_object_or_404(PicPlan, entity=self.entity, anio=anio)
        if plan.actividades.filter(ejecuciones__isnull=False).exists():
            raise ValidationError({"detail": "No se puede eliminar: hay actividades con ejecuciones."})
        plan.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class PicStatsView(PicBaseMixin, APIView):
    def get(self, request):
        anio_raw = request.query_params.get("anio")
        anio = int(anio_raw) if anio_raw and str(anio_raw).isdigit() else timezone.now().year
        return Response(compute_pic_stats(request.user, self.entity, anio=anio))


class PicExportView(PicBaseMixin, APIView):
    def get(self, request):
        if not (_is_admin(request.user) or _is_secretario(request.user)):
            raise PermissionDenied("Solo admin o secretario pueden exportar.")
        anio_raw = request.query_params.get("anio")
        if not anio_raw or not str(anio_raw).isdigit():
            raise ValidationError({"anio": "Año requerido."})
        anio = int(anio_raw)
        trimestre_raw = request.query_params.get("trimestre")
        trimestre = int(trimestre_raw) if trimestre_raw and str(trimestre_raw).isdigit() else None
        buf, filename = build_seguimiento_excel(
            request.user,
            self.entity,
            anio=anio,
            trimestre=trimestre,
        )
        response = HttpResponse(
            buf.getvalue(),
            content_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        )
        response["Content-Disposition"] = f'attachment; filename="{filename}"'
        return response


class PicActividadViewSet(PicBaseMixin, viewsets.ReadOnlyModelViewSet):
    pagination_class = StandardPageNumberPagination
    parser_classes = (MultiPartParser, FormParser, JSONParser)

    def get_queryset(self):
        return actividades_queryset_for_user(self.request.user, self.entity)

    def filter_queryset(self, queryset):
        return PicActividadFilterSet(self.request.query_params, queryset=queryset).qs

    def get_serializer_class(self):
        if self.action == "retrieve":
            return PicActividadDetailSerializer
        return PicActividadListSerializer

    def get_object(self):
        obj = get_object_or_404(self.get_queryset(), pk=self.kwargs["pk"])
        if not user_can_access_actividad(self.request.user, self.entity, obj):
            raise PermissionDenied("Sin acceso a esta actividad.")
        return obj

    @action(detail=True, methods=["patch"], url_path="responsables")
    def responsables(self, request, pk=None):
        if not (_is_admin(request.user) or _is_secretario(request.user)):
            raise PermissionDenied("Solo admin o secretario pueden asignar responsables.")
        act = self.get_object()
        ser = PicActividadResponsablesSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        user_ids = ser.validated_data["responsables"]
        if user_ids:
            valid = UserEntityMembership.objects.filter(
                entity=self.entity,
                user_id__in=user_ids,
                is_active=True,
            ).values_list("user_id", flat=True)
            if set(user_ids) - set(valid):
                raise ValidationError({"responsables": "Uno o más usuarios no pertenecen a la entidad."})
            act.responsables.set(user_ids)
        else:
            act.responsables.clear()
        sec_id = ser.validated_data.get("responsable_secretaria_id")
        if sec_id is not None:
            if sec_id and not Secretaria.objects.filter(entity=self.entity, pk=sec_id).exists():
                raise ValidationError({"responsable_secretaria_id": "Secretaría inválida."})
            act.responsable_secretaria_id = sec_id or None
            act.save(update_fields=["responsable_secretaria_id", "updated_at"])
        return Response(PicActividadDetailSerializer(act, context={"request": request}).data)

    @action(detail=True, methods=["get", "post"], url_path="ejecuciones")
    def ejecuciones(self, request, pk=None):
        act = self.get_object()
        if request.method == "GET":
            qs = act.ejecuciones.prefetch_related("archivos").order_by("-fecha_ejecucion", "-id")
            return Response(PicEjecucionSerializer(qs, many=True, context={"request": request}).data)

        ser = PicEjecucionWriteSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        cantidad = ser.validated_data["cantidad_ejecutada"]
        fecha = ser.validated_data["fecha_ejecucion"]
        disp = disponible_ejecucion(act)
        if cantidad > disp:
            raise ValidationError(
                {"cantidad_ejecutada": f"Solo quedan {disp} unidad(es) disponibles (máx {act.total_programado})."}
            )
        try:
            tri = trimestre_from_date(fecha, act.plan.anio)
        except ValueError as exc:
            raise ValidationError({"fecha_ejecucion": str(exc)}) from exc

        files = list(request.FILES.getlist("archivos") or request.FILES.getlist("archivos[]"))
        if not files and "archivo" in request.FILES:
            files = [request.FILES["archivo"]]
        if not files:
            raise ValidationError({"archivos": "Debe adjuntar al menos un PDF de evidencia."})

        acum = total_ejecutado(act)
        valor = calcular_valor_cobrado(act, acum, cantidad)
        ej = PicEjecucion.objects.create(
            entity=self.entity,
            actividad=act,
            fecha_ejecucion=fecha,
            trimestre=tri,
            cantidad_ejecutada=cantidad,
            descripcion=ser.validated_data.get("descripcion", ""),
            valor_cobrado=valor,
            registrado_por=request.user,
        )
        attach_ejecucion_archivos(ej, files, request.user)
        ej.refresh_from_db()
        return Response(
            PicEjecucionSerializer(ej, context={"request": request}).data,
            status=status.HTTP_201_CREATED,
        )

    @action(detail=True, methods=["post"], url_path="preview-valor")
    def preview_valor(self, request, pk=None):
        act = self.get_object()
        ser = PicEjecucionPreviewSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        return Response(preview_valor_cobrado(act, ser.validated_data["cantidad_ejecutada"]))


class PicEjecucionViewSet(PicBaseMixin, viewsets.GenericViewSet):
    http_method_names = ["delete", "head", "options"]

    def get_queryset(self):
        act_ids = actividades_queryset_for_user(self.request.user, self.entity).values_list("id", flat=True)
        return PicEjecucion.objects.filter(entity=self.entity, actividad_id__in=act_ids)

    def destroy(self, request, pk=None):
        if not (_is_admin(request.user) or _is_secretario(request.user)):
            raise PermissionDenied("Solo admin o secretario pueden eliminar ejecuciones.")
        ej = get_object_or_404(self.get_queryset(), pk=pk)
        for arch in ej.archivos.all():
            if arch.archivo:
                arch.archivo.delete(save=False)
        ej.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class PicCargoViewSet(PicBaseMixin, viewsets.ModelViewSet):
    pagination_class = StandardPageNumberPagination
    http_method_names = ["get", "post", "patch", "delete", "head", "options"]

    def get_queryset(self):
        return PicCargo.objects.filter(entity=self.entity).prefetch_related("usuarios").order_by("etiqueta")

    def filter_queryset(self, queryset):
        return PicCargoFilterSet(self.request.query_params, queryset=queryset).qs

    def get_serializer_class(self):
        if self.action in {"create", "partial_update"}:
            return PicCargoWriteSerializer
        return PicCargoSerializer

    def list(self, request, *args, **kwargs):
        qs = self.filter_queryset(self.get_queryset())
        page = self.paginate_queryset(qs)
        ser = PicCargoSerializer(page, many=True)
        return self.get_paginated_response(ser.data)

    def create(self, request, *args, **kwargs):
        if not _is_admin(request.user):
            raise PermissionDenied("Solo admin puede gestionar cargos PIC.")
        ser = PicCargoWriteSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        norm = normalizar_etiqueta(ser.validated_data["etiqueta"])
        if PicCargo.objects.filter(entity=self.entity, etiqueta_norm=norm).exists():
            raise ValidationError({"etiqueta": "Ya existe un cargo con esta etiqueta."})
        cargo = PicCargo.objects.create(
            entity=self.entity,
            etiqueta=ser.validated_data["etiqueta"].strip(),
            etiqueta_norm=norm,
            secretaria_id=ser.validated_data.get("secretaria_id"),
        )
        self._set_usuarios(cargo, ser.validated_data.get("usuarios", []))
        aplicacion = aplicar_cargos_entity(self.entity)
        return Response(
            {**PicCargoSerializer(cargo).data, "aplicacion": aplicacion},
            status=status.HTTP_201_CREATED,
        )

    def partial_update(self, request, *args, **kwargs):
        if not _is_admin(request.user):
            raise PermissionDenied("Solo admin puede gestionar cargos PIC.")
        cargo = get_object_or_404(self.get_queryset(), pk=kwargs["pk"])
        ser = PicCargoWriteSerializer(data=request.data, partial=True)
        ser.is_valid(raise_exception=True)
        if "etiqueta" in ser.validated_data:
            norm = normalizar_etiqueta(ser.validated_data["etiqueta"])
            if PicCargo.objects.filter(entity=self.entity, etiqueta_norm=norm).exclude(pk=cargo.pk).exists():
                raise ValidationError({"etiqueta": "Ya existe un cargo con esta etiqueta."})
            cargo.etiqueta = ser.validated_data["etiqueta"].strip()
            cargo.etiqueta_norm = norm
        if "secretaria_id" in ser.validated_data:
            sec_id = ser.validated_data["secretaria_id"]
            if sec_id and not Secretaria.objects.filter(entity=self.entity, pk=sec_id).exists():
                raise ValidationError({"secretaria_id": "Secretaría inválida."})
            cargo.secretaria_id = sec_id
        cargo.save()
        if "usuarios" in ser.validated_data:
            self._set_usuarios(cargo, ser.validated_data["usuarios"])
        aplicacion = aplicar_cargos_entity(self.entity)
        return Response({**PicCargoSerializer(cargo).data, "aplicacion": aplicacion})

    def destroy(self, request, *args, **kwargs):
        if not _is_admin(request.user):
            raise PermissionDenied("Solo admin puede gestionar cargos PIC.")
        cargo = get_object_or_404(self.get_queryset(), pk=kwargs["pk"])
        cargo.delete()
        aplicar_cargos_entity(self.entity)
        return Response(status=status.HTTP_204_NO_CONTENT)

    def _set_usuarios(self, cargo: PicCargo, user_ids: list[int]) -> None:
        if not user_ids:
            cargo.usuarios.clear()
            return
        valid = UserEntityMembership.objects.filter(
            entity=self.entity,
            user_id__in=user_ids,
            is_active=True,
        ).values_list("user_id", flat=True)
        if set(user_ids) - set(valid):
            raise ValidationError({"usuarios": "Uno o más usuarios no pertenecen a la entidad."})
        cargo.usuarios.set(user_ids)

    @action(detail=False, methods=["post"], url_path="aplicar")
    def aplicar(self, request):
        if not _is_admin(request.user):
            raise PermissionDenied("Solo admin puede aplicar mapeo de cargos.")
        anio_raw = request.data.get("anio") or request.query_params.get("anio")
        if not anio_raw or not str(anio_raw).isdigit():
            raise ValidationError({"anio": "Año requerido."})
        plan = get_object_or_404(PicPlan, entity=self.entity, anio=int(anio_raw))
        result = aplicar_cargos_a_actividades(self.entity, plan)
        result["encargados_pendientes"] = encargados_pendientes_resumen(self.entity, plan)
        return Response(result)

    @action(detail=False, methods=["get"], url_path="pendientes")
    def pendientes(self, request):
        if not _is_admin(request.user):
            raise PermissionDenied("Solo admin puede ver encargados pendientes.")
        anio_raw = request.query_params.get("anio")
        if not anio_raw or not str(anio_raw).isdigit():
            raise ValidationError({"anio": "Año requerido."})
        plan = PicPlan.objects.filter(entity=self.entity, anio=int(anio_raw)).first()
        return Response({"encargados_pendientes": encargados_pendientes_resumen(self.entity, plan)})
