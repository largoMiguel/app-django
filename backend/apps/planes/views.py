"""API Planes Institucionales — Decreto 612."""
from __future__ import annotations

from django.contrib.auth import get_user_model
from django.http import HttpResponse
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.response import Response

from apps.accounts.models import UserEntityMembership
from apps.common.pagination import StandardPageNumberPagination
from apps.common.roles import user_roles
from apps.entities.models import Entity, Secretaria

from .access import (
    actividades_queryset_for_user,
    ensure_planes_access,
    planes_queryset_for_user,
    user_can_access_actividad,
    user_can_access_plan,
)
from .evidencia_storage import sync_evidencia_archivos_from_request
from .export import build_trimestral_excel
from .filters import PlanActividadFilterSet, PlanCatalogoFilterSet, PlanFilterSet
from .models import PlanActividad, PlanCatalogo, PlanEvidencia, PlanInstitucional
from .serializers import (
    PlanActividadDetailSerializer,
    PlanActividadSerializer,
    PlanActividadWriteSerializer,
    PlanCatalogoSerializer,
    PlanCatalogoWriteSerializer,
    PlanDetailSerializer,
    PlanEvidenciaSerializer,
    PlanListSerializer,
    PlanWriteSerializer,
)
from .stats import attach_plan_list_metrics, build_cronograma, build_resumen_por_trimestre, compute_plan_stats

User = get_user_model()


def _entity_for_user(user) -> Entity:
    if not user.entity_id:
        raise PermissionDenied("Usuario sin entidad asignada.")
    return get_object_or_404(Entity, pk=user.entity_id)


def _is_admin(user) -> bool:
    return "admin" in user_roles(user)


def _is_secretario(user) -> bool:
    return "secretario" in user_roles(user)


def _contratista_only(user) -> bool:
    roles = user_roles(user)
    return "contratista" in roles and "admin" not in roles and "secretario" not in roles


class PlanCatalogoViewSet(viewsets.ModelViewSet):
    permission_classes = (permissions.IsAuthenticated,)
    serializer_class = PlanCatalogoSerializer
    http_method_names = ["get", "post", "head", "options"]
    pagination_class = StandardPageNumberPagination

    def initial(self, request, *args, **kwargs):
        super().initial(request, *args, **kwargs)
        entity = _entity_for_user(request.user)
        ensure_planes_access(request.user, entity)
        self.entity = entity

    def get_queryset(self):
        return PlanCatalogo.objects.filter(
            models_Q_entity_global_or_own(self.entity)
        ).filter(is_active=True).order_by("orden", "nombre")

    def filter_queryset(self, queryset):
        return PlanCatalogoFilterSet(self.request.query_params, queryset=queryset).qs

    def list(self, request, *args, **kwargs):
        qs = self.filter_queryset(self.get_queryset())
        page = self.paginate_queryset(qs)
        ser = PlanCatalogoSerializer(page, many=True)
        return self.get_paginated_response(ser.data)

    def create(self, request, *args, **kwargs):
        if not _is_admin(request.user):
            raise PermissionDenied("Solo admin puede crear planes propios en el catálogo.")
        ser = PlanCatalogoWriteSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        codigo = ser.validated_data["codigo"]
        if PlanCatalogo.objects.filter(entity=self.entity, codigo=codigo).exists():
            raise ValidationError({"codigo": "Ya existe un plan con este código en la entidad."})
        catalogo = PlanCatalogo.objects.create(
            entity=self.entity,
            codigo=codigo,
            nombre=ser.validated_data["nombre"],
            descripcion=ser.validated_data.get("descripcion", ""),
            orden=ser.validated_data.get("orden", 99),
            es_decreto612=False,
        )
        return Response(PlanCatalogoSerializer(catalogo).data, status=status.HTTP_201_CREATED)


def models_Q_entity_global_or_own(entity):
    from django.db.models import Q

    return Q(entity__isnull=True) | Q(entity=entity)


class PlanViewSet(viewsets.ModelViewSet):
    permission_classes = (permissions.IsAuthenticated,)
    pagination_class = StandardPageNumberPagination
    http_method_names = ["get", "post", "patch", "delete", "head", "options"]

    def initial(self, request, *args, **kwargs):
        super().initial(request, *args, **kwargs)
        entity = _entity_for_user(request.user)
        ensure_planes_access(request.user, entity)
        self.entity = entity

    def get_queryset(self):
        return planes_queryset_for_user(self.request.user, self.entity)

    def filter_queryset(self, queryset):
        return PlanFilterSet(self.request.query_params, queryset=queryset).qs

    def get_serializer_class(self):
        if self.action == "retrieve":
            return PlanDetailSerializer
        if self.action in {"create", "partial_update"}:
            return PlanWriteSerializer
        return PlanListSerializer

    def get_object(self):
        obj = get_object_or_404(self.get_queryset(), pk=self.kwargs["pk"])
        if not user_can_access_plan(self.request.user, self.entity, obj):
            raise PermissionDenied("Sin acceso a este plan.")
        return obj

    def list(self, request, *args, **kwargs):
        qs = self.filter_queryset(self.get_queryset())
        trimestre = request.query_params.get("trimestre")
        tri_int = int(trimestre) if trimestre and trimestre.isdigit() else None
        page = self.paginate_queryset(qs)
        if page is not None:
            attach_plan_list_metrics(page, request.user, self.entity, trimestre=tri_int)
            ser = PlanListSerializer(page, many=True)
            return self.get_paginated_response(ser.data)
        attach_plan_list_metrics(qs, request.user, self.entity, trimestre=tri_int)
        ser = PlanListSerializer(qs, many=True)
        return Response(ser.data)

    def retrieve(self, request, *args, **kwargs):
        obj = self.get_object()
        obj = (
            PlanInstitucional.objects.filter(pk=obj.pk)
            .select_related("catalogo", "responsable_secretaria", "responsable_usuario")
            .prefetch_related(
                "actividades__responsable_secretaria",
                "actividades__responsable_usuario",
                "actividades__evidencia__archivos",
            )
            .first()
        )
        actividades = list(
            actividades_queryset_for_user(request.user, self.entity).filter(plan=obj).order_by(
                "trimestre", "fecha_inicio", "id"
            )
        )
        obj.actividades = actividades
        obj.resumen_por_trimestre = build_resumen_por_trimestre(obj, actividades)
        return Response(PlanDetailSerializer(obj).data)

    def create(self, request, *args, **kwargs):
        if _contratista_only(request.user):
            raise PermissionDenied("Los contratistas no pueden crear planes.")
        ser = PlanWriteSerializer(data=request.data, context={"entity": self.entity})
        ser.is_valid(raise_exception=True)
        catalogo = get_object_or_404(PlanCatalogo, pk=ser.validated_data["catalogo_id"])
        secretaria = ser.resolve_secretaria(self.entity)
        if ser.validated_data.get("responsable_secretaria_id") and secretaria is None:
            raise ValidationError({"responsable_secretaria_id": "Secretaría inválida."})

        plan = PlanInstitucional.objects.create(
            entity=self.entity,
            catalogo=catalogo,
            anio=ser.validated_data["anio"],
            objetivo=ser.validated_data.get("objetivo", ""),
            responsable_secretaria=secretaria,
            responsable_secretaria_nombre=secretaria.nombre if secretaria else "",
            fecha_publicacion=ser.validated_data.get("fecha_publicacion"),
            url_publicacion=ser.validated_data.get("url_publicacion", ""),
            estado=ser.validated_data.get("estado", "BORRADOR"),
            created_by=request.user,
        )
        return Response(PlanDetailSerializer(plan).data, status=status.HTTP_201_CREATED)

    def partial_update(self, request, *args, **kwargs):
        if _contratista_only(request.user):
            raise PermissionDenied("Los contratistas no pueden editar planes.")
        plan = self.get_object()
        ser = PlanWriteSerializer(
            data=request.data,
            partial=True,
            context={"entity": self.entity, "instance": plan},
        )
        ser.is_valid(raise_exception=True)
        if "catalogo_id" in ser.validated_data:
            plan.catalogo = get_object_or_404(PlanCatalogo, pk=ser.validated_data["catalogo_id"])
        if "anio" in ser.validated_data:
            plan.anio = ser.validated_data["anio"]
        if "objetivo" in ser.validated_data:
            plan.objetivo = ser.validated_data["objetivo"]
        if "responsable_secretaria_id" in ser.validated_data:
            secretaria = ser.resolve_secretaria(self.entity)
            plan.responsable_secretaria = secretaria
            plan.responsable_secretaria_nombre = secretaria.nombre if secretaria else ""
        for field in ("fecha_publicacion", "url_publicacion", "estado"):
            if field in ser.validated_data:
                setattr(plan, field, ser.validated_data[field])
        plan.save()
        return Response(PlanDetailSerializer(plan).data)

    def destroy(self, request, *args, **kwargs):
        if not _is_admin(request.user):
            raise PermissionDenied("Solo admin puede eliminar planes.")
        return super().destroy(request, *args, **kwargs)

    @action(detail=False, methods=["get"], url_path="stats")
    def stats(self, request):
        anio = request.query_params.get("anio")
        anio_int = int(anio) if anio and str(anio).isdigit() else timezone.now().year
        return Response(compute_plan_stats(request.user, self.entity, anio=anio_int))

    @action(detail=False, methods=["get"], url_path="cronograma")
    def cronograma(self, request):
        anio = request.query_params.get("anio")
        anio_int = int(anio) if anio and str(anio).isdigit() else timezone.now().year
        return Response(build_cronograma(request.user, self.entity, anio=anio_int))

    @action(detail=False, methods=["get"], url_path="export")
    def export(self, request):
        anio = request.query_params.get("anio")
        if not anio or not str(anio).isdigit():
            raise ValidationError({"anio": "Parámetro anio requerido."})
        trimestre = request.query_params.get("trimestre")
        tri_int = int(trimestre) if trimestre and str(trimestre).isdigit() else None
        plan_id = request.query_params.get("plan")
        plan_int = int(plan_id) if plan_id and str(plan_id).isdigit() else None
        sec_id = request.query_params.get("responsable_secretaria")
        sec_int = int(sec_id) if sec_id and str(sec_id).isdigit() else None

        buf, filename = build_trimestral_excel(
            request.user,
            self.entity,
            anio=int(anio),
            trimestre=tri_int,
            plan_id=plan_int,
            responsable_secretaria_id=sec_int,
        )
        response = HttpResponse(
            buf.getvalue(),
            content_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        )
        response["Content-Disposition"] = f'attachment; filename="{filename}"'
        return response

    @action(detail=True, methods=["post"], url_path="responsable")
    def responsable(self, request, pk=None):
        if not _is_admin(request.user):
            raise PermissionDenied("Solo admin puede asignar responsables.")
        plan = self.get_object()
        secretaria_id = request.data.get("responsable_secretaria_id") or request.query_params.get(
            "responsable_secretaria_id"
        )
        if secretaria_id in (None, "", "null"):
            plan.responsable_secretaria = None
            plan.responsable_secretaria_nombre = ""
            plan.save(update_fields=["responsable_secretaria", "responsable_secretaria_nombre", "updated_at"])
            return Response({"success": True, "responsable_secretaria_id": None})

        secretaria = get_object_or_404(Secretaria, pk=secretaria_id, entity=self.entity)
        plan.responsable_secretaria = secretaria
        plan.responsable_secretaria_nombre = secretaria.nombre
        plan.save(update_fields=["responsable_secretaria", "responsable_secretaria_nombre", "updated_at"])
        return Response(
            {
                "success": True,
                "responsable_secretaria_id": secretaria.id,
                "responsable_secretaria_nombre": secretaria.nombre,
            }
        )


class PlanActividadViewSet(viewsets.ModelViewSet):
    permission_classes = (permissions.IsAuthenticated,)
    pagination_class = StandardPageNumberPagination
    http_method_names = ["get", "post", "patch", "delete", "head", "options"]
    parser_classes = (MultiPartParser, FormParser)

    def initial(self, request, *args, **kwargs):
        super().initial(request, *args, **kwargs)
        entity = _entity_for_user(request.user)
        ensure_planes_access(request.user, entity)
        self.entity = entity

    def get_queryset(self):
        return actividades_queryset_for_user(self.request.user, self.entity)

    def filter_queryset(self, queryset):
        return PlanActividadFilterSet(self.request.query_params, queryset=queryset).qs

    def get_serializer_class(self):
        if self.action == "retrieve":
            return PlanActividadDetailSerializer
        if self.action in {"create", "partial_update"}:
            return PlanActividadWriteSerializer
        return PlanActividadSerializer

    def get_object(self):
        obj = get_object_or_404(self.get_queryset(), pk=self.kwargs["pk"])
        if not user_can_access_actividad(self.request.user, self.entity, obj):
            raise PermissionDenied("Sin acceso a esta actividad.")
        return obj

    def list(self, request, *args, **kwargs):
        qs = self.filter_queryset(self.get_queryset())
        page = self.paginate_queryset(qs)
        ser = PlanActividadSerializer(page, many=True)
        return self.get_paginated_response(ser.data)

    def retrieve(self, request, *args, **kwargs):
        obj = self.get_object()
        return Response(PlanActividadDetailSerializer(obj, context={"request": request}).data)

    def create(self, request, *args, **kwargs):
        if _contratista_only(request.user):
            raise PermissionDenied("Los contratistas no pueden crear actividades.")
        ser = PlanActividadWriteSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        plan = get_object_or_404(
            planes_queryset_for_user(request.user, self.entity),
            pk=ser.validated_data["plan"].id if hasattr(ser.validated_data["plan"], "id") else ser.validated_data["plan"],
        )
        secretaria = ser.validated_data.get("responsable_secretaria")
        if secretaria and secretaria.entity_id != self.entity.id:
            raise ValidationError({"responsable_secretaria": "Secretaría inválida."})
        if _is_secretario(request.user) and not _is_admin(request.user):
            if secretaria and secretaria.id != request.user.secretaria_id:
                raise PermissionDenied("Solo puede asignar actividades a su secretaría.")
            if not secretaria and plan.responsable_secretaria_id != request.user.secretaria_id:
                raise PermissionDenied("Sin permisos para este plan.")

        responsable_usuario = ser.validated_data.get("responsable_usuario")
        if responsable_usuario and _contratista_only(request.user):
            raise PermissionDenied("Los contratistas no pueden asignar responsables.")

        actividad = PlanActividad.objects.create(
            entity=self.entity,
            plan=plan,
            anio=ser.validated_data.get("anio") or plan.anio,
            trimestre=ser.validated_data["trimestre"],
            nombre=ser.validated_data["nombre"],
            descripcion=ser.validated_data.get("descripcion", ""),
            meta=ser.validated_data.get("meta", ""),
            indicador=ser.validated_data.get("indicador", ""),
            fecha_inicio=ser.validated_data.get("fecha_inicio"),
            fecha_fin=ser.validated_data.get("fecha_fin"),
            responsable_secretaria=secretaria or plan.responsable_secretaria,
            responsable_usuario=responsable_usuario,
            estado=ser.validated_data.get("estado", "PENDIENTE"),
            avance=ser.validated_data.get("avance", 0),
        )
        return Response(PlanActividadSerializer(actividad).data, status=status.HTTP_201_CREATED)

    def partial_update(self, request, *args, **kwargs):
        actividad = self.get_object()
        if _contratista_only(request.user) and actividad.responsable_usuario_id != request.user.id:
            raise PermissionDenied("Sin permisos para editar esta actividad.")
        ser = PlanActividadWriteSerializer(actividad, data=request.data, partial=True)
        ser.is_valid(raise_exception=True)
        for field, value in ser.validated_data.items():
            if field == "plan":
                continue
            if field == "responsable_usuario" and _contratista_only(request.user):
                continue
            setattr(actividad, field, value)
        actividad.save()
        return Response(PlanActividadSerializer(actividad).data)

    def destroy(self, request, *args, **kwargs):
        if _contratista_only(request.user):
            raise PermissionDenied("Los contratistas no pueden eliminar actividades.")
        if _is_secretario(request.user) and not _is_admin(request.user):
            actividad = self.get_object()
            if actividad.plan.responsable_secretaria_id != request.user.secretaria_id:
                raise PermissionDenied("Sin permisos.")
        return super().destroy(request, *args, **kwargs)

    @action(detail=True, methods=["patch"], url_path="responsable-usuario")
    def responsable_usuario(self, request, pk=None):
        if not _is_secretario(request.user) and not _is_admin(request.user):
            raise PermissionDenied("Solo secretario o admin puede delegar contratistas.")
        actividad = self.get_object()
        if _is_secretario(request.user) and not _is_admin(request.user):
            if not request.user.secretaria_id:
                raise PermissionDenied("Secretario sin secretaría asignada.")
            if actividad.responsable_secretaria_id != request.user.secretaria_id:
                if actividad.plan.responsable_secretaria_id != request.user.secretaria_id:
                    raise PermissionDenied("Solo puede delegar actividades de su secretaría.")

        usuario_id = request.data.get("responsable_usuario_id") or request.query_params.get(
            "responsable_usuario_id"
        )
        if usuario_id in (None, "", "null", "none", "0"):
            actividad.responsable_usuario = None
            actividad.save(update_fields=["responsable_usuario", "updated_at"])
            return Response({"success": True, "responsable_usuario_id": None})

        target = get_object_or_404(User, pk=usuario_id)
        membership = UserEntityMembership.objects.filter(
            user=target, entity=self.entity, is_active=True
        ).first()
        if membership is None:
            raise ValidationError({"responsable_usuario_id": "Usuario no pertenece a la entidad."})
        if membership.role != "contratista":
            raise PermissionDenied("Solo puede asignar contratistas.")
        if _is_secretario(request.user) and not _is_admin(request.user):
            if membership.secretaria_id != request.user.secretaria_id:
                raise PermissionDenied("Solo puede asignar contratistas de su secretaría.")
        actividad.responsable_usuario = target
        actividad.save(update_fields=["responsable_usuario", "updated_at"])
        return Response(
            {
                "success": True,
                "responsable_usuario_id": target.id,
                "responsable_usuario_nombre": target.full_name or target.email,
            }
        )

    @action(
        detail=True,
        methods=["get", "post", "put", "delete"],
        url_path="evidencia",
        parser_classes=[MultiPartParser, FormParser],
    )
    def evidencia(self, request, pk=None):
        actividad = self.get_object()
        if request.method == "GET":
            evidencia = getattr(actividad, "evidencia", None)
            if evidencia is None:
                return Response(None)
            return Response(PlanEvidenciaSerializer(evidencia, context={"request": request}).data)

        if request.method == "DELETE":
            if not _is_admin(request.user):
                raise PermissionDenied("Solo admin puede eliminar evidencias.")
            evidencia = getattr(actividad, "evidencia", None)
            if evidencia:
                evidencia.delete()
            return Response(status=status.HTTP_204_NO_CONTENT)

        descripcion = str(request.data.get("descripcion") or "").strip()
        url_evidencia = str(request.data.get("url_evidencia") or "").strip() or None

        if request.method == "POST":
            if hasattr(actividad, "evidencia") and actividad.evidencia is not None:
                raise ValidationError({"detail": "La actividad ya tiene evidencia. Use PUT para actualizar."})
            if not descripcion:
                raise ValidationError({"descripcion": "Este campo es requerido."})
            evidencia = PlanEvidencia.objects.create(
                actividad=actividad,
                entity=self.entity,
                descripcion=descripcion,
                url_evidencia=url_evidencia,
            )
            sync_evidencia_archivos_from_request(evidencia, request, request.user)
            evidencia.refresh_from_db()
            if not (evidencia.url_evidencia or evidencia.archivos.exists()):
                evidencia.delete()
                raise ValidationError({"archivos": "Debe adjuntar al menos un archivo o una URL externa."})
            return Response(
                PlanEvidenciaSerializer(evidencia, context={"request": request}).data,
                status=status.HTTP_201_CREATED,
            )

        evidencia = get_object_or_404(
            PlanEvidencia.objects.prefetch_related("archivos"),
            actividad=actividad,
            entity=self.entity,
        )
        if "descripcion" in request.data:
            if not descripcion:
                raise ValidationError({"descripcion": "Este campo es requerido."})
            evidencia.descripcion = descripcion
        if "url_evidencia" in request.data:
            evidencia.url_evidencia = url_evidencia
        evidencia.save()
        sync_evidencia_archivos_from_request(evidencia, request, request.user)
        evidencia.refresh_from_db()
        if not (evidencia.url_evidencia or evidencia.archivos.exists()):
            raise ValidationError({"archivos": "Debe conservar al menos un archivo o una URL externa."})
        return Response(PlanEvidenciaSerializer(evidencia, context={"request": request}).data)
