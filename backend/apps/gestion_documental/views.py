"""API — Gestión documental (SGDEA)."""
from __future__ import annotations

from django.contrib.auth import get_user_model
from django.db.models import Count
from django.http import HttpResponse
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.response import Response

from apps.common.pagination import StandardPageNumberPagination
from apps.common.roles import user_roles
from apps.entities.models import Entity, Secretaria

from .access import (
    ensure_gd_access,
    expedientes_queryset,
    instrumentos_queryset,
    series_queryset,
    user_can_access_expediente,
)
from .export import build_fuid_excel, build_transferencias_excel, build_trd_excel
from .filters import (
    ExpedienteFilterSet,
    FuidFilterSet,
    InstrumentoFilterSet,
    SerieFilterSet,
    TransferenciaFilterSet,
)
from .models import (
    Disposicion,
    DocumentoExpediente,
    Expediente,
    FuidRegistro,
    InstrumentoArchivistico,
    SerieDocumental,
    TipoEventoGD,
    Transferencia,
    UnidadAdministrativa,
)
from .serializers import (
    DisposicionSerializer,
    DocumentoExpedienteSerializer,
    ExpedienteDetailSerializer,
    ExpedienteListSerializer,
    ExpedienteWriteSerializer,
    FuidRegistroSerializer,
    InstrumentoListSerializer,
    InstrumentoWriteSerializer,
    SerieListSerializer,
    SerieWriteSerializer,
    TransferenciaListSerializer,
    TransferenciaWriteSerializer,
    UnidadAdministrativaSerializer,
)
from .services import (
    cerrar_expediente,
    ejecutar_transferencia,
    importar_series_excel,
    log_evento,
    next_codigo_expediente,
    upload_documento_expediente,
    upload_instrumento_archivo,
)
from .stats import compute_stats

User = get_user_model()


def _entity_for_user(user) -> Entity:
    if not user.entity_id:
        raise PermissionDenied("Usuario sin entidad asignada.")
    return get_object_or_404(Entity, pk=user.entity_id)


def _is_admin(user) -> bool:
    return "admin" in user_roles(user)


def _contratista_only(user) -> bool:
    roles = user_roles(user)
    return "contratista" in roles and "admin" not in roles and "secretario" not in roles


class GdBaseViewSet(viewsets.ModelViewSet):
    permission_classes = (permissions.IsAuthenticated,)
    pagination_class = StandardPageNumberPagination

    def initial(self, request, *args, **kwargs):
        super().initial(request, *args, **kwargs)
        self.entity = _entity_for_user(request.user)
        ensure_gd_access(request.user, self.entity)


class InstrumentoViewSet(GdBaseViewSet):
    http_method_names = ["get", "post", "patch", "delete", "head", "options"]
    parser_classes = (JSONParser, MultiPartParser, FormParser)

    def get_queryset(self):
        return instrumentos_queryset(self.request.user, self.entity)

    def get_serializer_class(self):
        if self.action in {"create", "partial_update"}:
            return InstrumentoWriteSerializer
        return InstrumentoListSerializer

    def filter_queryset(self, queryset):
        return InstrumentoFilterSet(self.request.query_params, queryset=queryset).qs

    def perform_create(self, serializer):
        if _contratista_only(self.request.user):
            raise PermissionDenied("Los contratistas no pueden crear instrumentos.")
        obj = serializer.save(entity=self.entity, created_by=self.request.user)
        log_evento(self.entity, TipoEventoGD.INSTRUMENTO, self.request.user, {"id": obj.id, "tipo": obj.tipo})

    @action(detail=True, methods=["post"], url_path="archivo")
    def upload_archivo(self, request, pk=None):
        if _contratista_only(request.user):
            raise PermissionDenied("Los contratistas no pueden subir instrumentos.")
        obj = self.get_object()
        archivo = request.FILES.get("archivo")
        if not archivo:
            raise ValidationError({"archivo": "Archivo requerido."})
        upload_instrumento_archivo(obj, archivo, request.user)
        return Response(InstrumentoListSerializer(obj).data)


class UnidadAdministrativaViewSet(GdBaseViewSet):
    serializer_class = UnidadAdministrativaSerializer
    http_method_names = ["get", "post", "patch", "delete", "head", "options"]

    def get_queryset(self):
        return UnidadAdministrativa.objects.filter(entity=self.entity).select_related("secretaria")

    def perform_create(self, serializer):
        if _contratista_only(self.request.user):
            raise PermissionDenied("Los contratistas no pueden crear unidades administrativas.")
        serializer.save(entity=self.entity)


class SerieViewSet(GdBaseViewSet):
    http_method_names = ["get", "post", "patch", "delete", "head", "options"]
    parser_classes = (JSONParser, MultiPartParser, FormParser)

    def get_queryset(self):
        return series_queryset(self.request.user, self.entity)

    def get_serializer_class(self):
        if self.action in {"create", "partial_update"}:
            return SerieWriteSerializer
        return SerieListSerializer

    def filter_queryset(self, queryset):
        return SerieFilterSet(self.request.query_params, queryset=queryset).qs

    def perform_create(self, serializer):
        if _contratista_only(self.request.user):
            raise PermissionDenied("Los contratistas no pueden crear series.")
        serializer.save(entity=self.entity)

    @action(detail=False, methods=["post"], url_path="importar")
    def importar(self, request):
        if not _is_admin(request.user):
            raise PermissionDenied("Solo administradores pueden importar series.")
        archivo = request.FILES.get("archivo")
        if not archivo:
            raise ValidationError({"archivo": "Archivo Excel requerido."})
        instrumento_id = request.data.get("instrumento_id")
        iid = int(instrumento_id) if instrumento_id else None
        result = importar_series_excel(self.entity, archivo, request.user, instrumento_id=iid)
        return Response(result)


class ExpedienteViewSet(GdBaseViewSet):
    http_method_names = ["get", "post", "patch", "delete", "head", "options"]
    parser_classes = (JSONParser, MultiPartParser, FormParser)

    def get_queryset(self):
        return expedientes_queryset(self.request.user, self.entity).annotate(
            documentos_count=Count("documentos")
        )

    def get_serializer_class(self):
        if self.action == "retrieve":
            return ExpedienteDetailSerializer
        if self.action in {"create", "partial_update"}:
            return ExpedienteWriteSerializer
        return ExpedienteListSerializer

    def filter_queryset(self, queryset):
        return ExpedienteFilterSet(self.request.query_params, queryset=queryset).qs

    def get_serializer_context(self):
        ctx = super().get_serializer_context()
        ctx["entity"] = self.entity
        return ctx

    def get_object(self):
        obj = get_object_or_404(self.get_queryset(), pk=self.kwargs["pk"])
        if not user_can_access_expediente(self.request.user, obj):
            raise PermissionDenied("Sin acceso a este expediente.")
        return obj

    def retrieve(self, request, *args, **kwargs):
        obj = (
            Expediente.objects.filter(pk=self.get_object().pk)
            .select_related("serie", "unidad", "secretaria", "responsable")
            .prefetch_related("documentos__uploaded_by")
            .first()
        )
        return Response(ExpedienteDetailSerializer(obj).data)

    def perform_create(self, serializer):
        data = serializer.validated_data
        codigo = data.get("codigo") or next_codigo_expediente(self.entity.id)
        secretaria = data.get("secretaria")
        if not secretaria and self.request.user.secretaria_id:
            secretaria = Secretaria.objects.filter(pk=self.request.user.secretaria_id).first()
        obj = serializer.save(
            entity=self.entity,
            codigo=codigo,
            secretaria=secretaria,
            created_by=self.request.user,
        )
        log_evento(self.entity, TipoEventoGD.CREACION, self.request.user, {"expediente_id": obj.id})

    @action(detail=True, methods=["post"], url_path="documentos")
    def upload_documento(self, request, pk=None):
        obj = self.get_object()
        if obj.estado == "cerrado" and _contratista_only(request.user):
            raise PermissionDenied("Expediente cerrado.")
        archivo = request.FILES.get("archivo")
        if not archivo:
            raise ValidationError({"archivo": "Archivo requerido."})
        doc = upload_documento_expediente(
            obj,
            archivo,
            request.user,
            tipo_documental=request.data.get("tipo_documental", ""),
            folio_inicio=request.data.get("folio_inicio") or None,
            folio_fin=request.data.get("folio_fin") or None,
            fecha_documento=request.data.get("fecha_documento") or None,
        )
        return Response(DocumentoExpedienteSerializer(doc).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["post"], url_path="cerrar")
    def cerrar(self, request, pk=None):
        if _contratista_only(request.user):
            raise PermissionDenied("Los contratistas no pueden cerrar expedientes.")
        obj = self.get_object()
        cerrar_expediente(obj, request.user)
        return Response(ExpedienteDetailSerializer(obj).data)


class FuidViewSet(GdBaseViewSet):
    serializer_class = FuidRegistroSerializer
    http_method_names = ["get", "post", "patch", "delete", "head", "options"]

    def get_queryset(self):
        return FuidRegistro.objects.filter(entity=self.entity).select_related("expediente")

    def filter_queryset(self, queryset):
        return FuidFilterSet(self.request.query_params, queryset=queryset).qs

    def perform_create(self, serializer):
        serializer.save(entity=self.entity)

    @action(detail=False, methods=["post"], url_path="generar-desde-expedientes")
    def generar_desde_expedientes(self, request):
        if _contratista_only(request.user):
            raise PermissionDenied("Sin permiso.")
        qs = expedientes_queryset(request.user, self.entity).select_related("serie", "serie__parent")
        created = 0
        for exp in qs:
            if FuidRegistro.objects.filter(entity=self.entity, expediente=exp).exists():
                continue
            serie = exp.serie
            subserie_nombre = ""
            serie_nombre = serie.nombre
            if serie.es_subserie and serie.parent:
                subserie_nombre = serie.nombre
                serie_nombre = serie.parent.nombre
            FuidRegistro.objects.create(
                entity=self.entity,
                expediente=exp,
                codigo=exp.codigo,
                serie_nombre=serie_nombre,
                subserie_nombre=subserie_nombre,
                unidad_documental=exp.titulo,
                fecha_inicial=exp.fecha_extrema_inicial,
                fecha_final=exp.fecha_extrema_final,
                soporte_fisico=exp.soporte in {"fisico", "hibrido"},
                soporte_electronico=exp.soporte in {"electronico", "hibrido"},
                folios=exp.folios,
            )
            created += 1
        return Response({"created": created})


class TransferenciaViewSet(GdBaseViewSet):
    http_method_names = ["get", "post", "patch", "delete", "head", "options"]

    def get_queryset(self):
        return Transferencia.objects.filter(entity=self.entity).annotate(
            expedientes_count=Count("expedientes")
        )

    def get_serializer_class(self):
        if self.action in {"create", "partial_update"}:
            return TransferenciaWriteSerializer
        return TransferenciaListSerializer

    def filter_queryset(self, queryset):
        return TransferenciaFilterSet(self.request.query_params, queryset=queryset).qs

    def perform_create(self, serializer):
        if not _is_admin(self.request.user) and "secretario" not in user_roles(self.request.user):
            raise PermissionDenied("Sin permiso para crear transferencias.")
        ids = serializer.validated_data.pop("expediente_ids", [])
        obj = serializer.save(entity=self.entity, created_by=self.request.user)
        if ids:
            exps = expedientes_queryset(self.request.user, self.entity).filter(pk__in=ids)
            obj.expedientes.set(exps)

    @action(detail=True, methods=["post"], url_path="ejecutar")
    def ejecutar(self, request, pk=None):
        if not _is_admin(request.user):
            raise PermissionDenied("Solo administradores pueden ejecutar transferencias.")
        obj = self.get_object()
        if not obj.expedientes.exists():
            raise ValidationError({"expedientes": "Debe incluir al menos un expediente."})
        ejecutar_transferencia(obj, request.user)
        return Response(TransferenciaListSerializer(obj).data)


class DisposicionViewSet(GdBaseViewSet):
    serializer_class = DisposicionSerializer
    http_method_names = ["get", "post", "head", "options"]

    def get_queryset(self):
        return Disposicion.objects.filter(entity=self.entity).prefetch_related("expedientes")

    def perform_create(self, serializer):
        if not _is_admin(self.request.user):
            raise PermissionDenied("Solo administradores pueden registrar disposiciones.")
        ids = serializer.validated_data.pop("expediente_ids", [])
        obj = serializer.save(entity=self.entity, created_by=self.request.user)
        if ids:
            exps = expedientes_queryset(self.request.user, self.entity).filter(pk__in=ids)
            obj.expedientes.set(exps)
        log_evento(self.entity, TipoEventoGD.DISPOSICION, self.request.user, {"id": obj.id})


class GestionDocumentalStatsViewSet(viewsets.ViewSet):
    permission_classes = (permissions.IsAuthenticated,)

    def list(self, request):
        entity = _entity_for_user(request.user)
        ensure_gd_access(request.user, entity)
        return Response(compute_stats(entity))


class GestionDocumentalExportViewSet(viewsets.ViewSet):
    permission_classes = (permissions.IsAuthenticated,)

    def list(self, request):
        entity = _entity_for_user(request.user)
        ensure_gd_access(request.user, entity)
        tipo = request.query_params.get("tipo", "fuid")
        if tipo == "trd":
            buf, filename = build_trd_excel(entity)
        elif tipo == "transferencias":
            buf, filename = build_transferencias_excel(entity)
        else:
            buf, filename = build_fuid_excel(entity)
        resp = HttpResponse(
            buf.getvalue(),
            content_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        )
        resp["Content-Disposition"] = f'attachment; filename="{filename}"'
        return resp

    @action(detail=False, methods=["get"], url_path="candidatos-disposicion")
    def candidatos_disposicion(self, request):
        entity = _entity_for_user(request.user)
        ensure_gd_access(request.user, entity)
        from datetime import timedelta

        hoy = timezone.localdate()
        candidatos = []
        for exp in expedientes_queryset(request.user, entity).select_related("serie"):
            if not exp.fecha_extrema_final or not exp.serie:
                continue
            limite = exp.fecha_extrema_final + timedelta(days=exp.serie.retencion_gestion_anios * 365)
            if limite <= hoy:
                candidatos.append(
                    {
                        "id": exp.id,
                        "codigo": exp.codigo,
                        "titulo": exp.titulo,
                        "disposicion_final": exp.serie.disposicion_final,
                        "fecha_limite": limite.isoformat(),
                    }
                )
        return Response({"candidatos": candidatos, "total": len(candidatos)})
