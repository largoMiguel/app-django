"""Endpoints del módulo PDM."""
from __future__ import annotations

from collections import defaultdict
from datetime import datetime, timedelta
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.db.models import Avg, Count
from django.db.models.functions import TruncDate
from django.http import HttpResponse
from django.db import transaction
from django.db.models import Sum
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import permissions, status
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.common.modules import require_user_module
from apps.common.pagination import StandardPageNumberPagination
from apps.common.roles import is_platform_superadmin, user_roles
from apps.entities.models import Entity, Secretaria
from django_filters.rest_framework import DjangoFilterBackend

from .access import (
    actividades_queryset_for_user,
    codigos_producto_for_user,
    ejecucion_queryset_for_user,
    productos_queryset_for_user,
    resolve_clave_producto,
    user_can_access_actividad,
    user_can_access_codigo_producto,
    user_can_access_producto,
)
from .ejecucion_resumen import resumen_ejecucion_entidad

User = get_user_model()
from .clave_producto import calcular_claves_producto
from .armonizacion import (
    ArmonizacionError,
    aplicar_armonizacion,
    codigo_efectivo,
    codigos_armonizados_para_producto,
    mapa_armonizacion,
    revertir_armonizacion,
    serializar_armonizacion,
)
from .contratos_parser import parse_contratos_rps
from .ejecucion_parser import _looks_like_codigo_fuente, parse_ejecucion_excel, rows_from_ejecucion_dataframe
from .evidencia_storage import (
    _files_from_request,
    attach_evidencia_archivos,
    sync_evidencia_archivos_from_request,
)
from .filters import PdmProductoFilterSet
from .metrics import (
    ANIOS_PDM,
    actividad_aggs_for_productos,
    ejecucion_for_productos,
    estado_producto_anio,
    producto_list_metrics,
    resumen_anio,
)
from .analytics import compute_pdm_analytics, compute_pdm_proyectos
from .bpin_view import DATOS_GOV_CO_PORTAL, consultar_bpines_externos
from .piip_export import build_piip_workbook, workbook_to_bytes
from .plan_accion_export import build_plan_accion_export
from .stats import compute_estado_stats, compute_pdm_stats_from_queryset, filter_options_from_productos, productos_for_stats
from .models import (
    ActividadEstado,
    PDMContratoRPS,
    PDMEjecucionPresupuestal,
    PdmActividad,
    PdmActividadEvidencia,
    PdmArmonizacionEjecucion,
    PdmChatConversation,
    PdmChatMessage,
    PdmIniciativaSGR,
    PdmProducto,
)
from .serializers import (
    PdmActividadEvidenciaSerializer,
    PdmActividadSerializer,
    PdmDataUploadSerializer,
    PdmProductoListSerializer,
    PdmProductoSerializer,
)

_PRESUPUESTO_JSON_FIELDS = (
    "presupuesto_2024",
    "presupuesto_2025",
    "presupuesto_2026",
    "presupuesto_2027",
)


def _productos_list_queryset(user, entity: Entity):
    return (
        productos_queryset_for_user(user, entity)
        .defer(*_PRESUPUESTO_JSON_FIELDS)
        .order_by("codigo_producto")
    )


def _entity_or_404(slug: str) -> Entity:
    return get_object_or_404(Entity, slug=slug)


def _ensure_user_can_manage_entity(user, entity: Entity) -> None:
    if is_platform_superadmin(user):
        raise PermissionDenied("El superadministrador no opera el módulo PDM.")
    if not user.entity_id or user.entity_id != entity.id:
        raise PermissionDenied("No tiene permisos para gestionar esta entidad.")
    require_user_module(user, "pdm", message="El módulo PDM no está habilitado para tu usuario.")


def _is_admin(user) -> bool:
    return "admin" in user_roles(user)


def _is_secretario(user) -> bool:
    return "secretario" in user_roles(user)


def _parse_iso_dt(raw):
    if not raw:
        return None
    try:
        return datetime.fromisoformat(str(raw).replace("Z", "+00:00"))
    except ValueError:
        return None


def _to_float(v):
    try:
        return float(v or 0)
    except Exception:
        return 0.0


def _attach_list_metrics(productos: list, entity_id: int, anio: int) -> None:
    from django.db.models import Count

    from .ejecucion_resumen import attach_ejecucion_anio_a_productos

    claves = [p.clave_producto for p in productos]
    aggs_map = actividad_aggs_for_productos(entity_id, claves)
    codigos = list({p.codigo_producto for p in productos})
    counts = dict(
        PdmProducto.objects.filter(entity_id=entity_id, codigo_producto__in=codigos)
        .values("codigo_producto")
        .annotate(total=Count("id"))
        .values_list("codigo_producto", "total")
    )
    for prod in productos:
        aggs_anio = aggs_map.get(prod.clave_producto, {})
        metrics = producto_list_metrics(prod, anio, aggs_anio)
        for key, value in metrics.items():
            setattr(prod, key, value)
        setattr(prod, "total_indicadores", counts.get(prod.codigo_producto, 1))
    attach_ejecucion_anio_a_productos(productos, entity_id, anio)


_META_FIELD_BY_ANIO = {
    2024: "programacion_2024",
    2025: "programacion_2025",
    2026: "programacion_2026",
    2027: "programacion_2027",
}


def _filter_productos_con_meta_anio(qs, anio: int):
    field = _META_FIELD_BY_ANIO.get(anio)
    if not field:
        return qs.none()
    return qs.filter(**{f"{field}__gt": 0})


def _filter_productos_by_estado(qs, entity_id: int, anio: int, estado: str):
    productos = list(qs)
    if not productos or not estado:
        return qs
    codigos = [p.clave_producto for p in productos]
    aggs_map = actividad_aggs_for_productos(entity_id, codigos)
    ids = [
        p.id
        for p in productos
        if estado_producto_anio(p, anio, aggs_map.get(p.clave_producto, {})) == estado
    ]
    return qs.filter(id__in=ids) if ids else qs.none()


class PdmStatusView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, slug: str):
        entity = _entity_or_404(slug)
        _ensure_user_can_manage_entity(request.user, entity)
        total_entidad = PdmProducto.objects.filter(entity=entity).count()
        visible = productos_queryset_for_user(request.user, entity).count()
        latest = (
            PdmProducto.objects.filter(entity=entity)
            .order_by("-created_at")
            .values_list("created_at", flat=True)
            .first()
        )
        return Response(
            {
                "tiene_datos": total_entidad > 0,
                "total_productos": visible,
                "total_productos_entidad": total_entidad,
                "fecha_ultima_carga": latest,
            }
        )


class PdmMetaView(APIView):
    """Metadatos ligeros: filtros, iniciativas SGR (sin productos completos)."""

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, slug: str):
        entity = _entity_or_404(slug)
        _ensure_user_can_manage_entity(request.user, entity)
        productos_qs = productos_queryset_for_user(request.user, entity)
        options = filter_options_from_productos(productos_qs)
        iniciativas = list(
            PdmIniciativaSGR.objects.filter(entity=entity).values(
                "consecutivo", "iniciativa_sgr", "recursos_sgr_indicativos", "bpin"
            )
        )
        return Response({**options, "iniciativas_sgr": iniciativas, "total_productos": productos_qs.count()})


class PdmStatsView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, slug: str):
        entity = _entity_or_404(slug)
        _ensure_user_can_manage_entity(request.user, entity)
        productos_qs = productos_queryset_for_user(request.user, entity)
        lineas_count = productos_qs.values("linea_estrategica").distinct().count()
        iniciativas_count = PdmIniciativaSGR.objects.filter(entity=entity).count()
        stats = compute_pdm_stats_from_queryset(productos_qs, iniciativas_count, lineas_count)
        anio_param = request.query_params.get("anio")
        try:
            anio = int(anio_param) if anio_param else datetime.now().year
        except (TypeError, ValueError):
            anio = datetime.now().year
        productos_estado = productos_for_stats(productos_qs)
        stats["estado_por_anio"] = compute_estado_stats(productos_estado, entity.id, anio)
        stats["anio_seguimiento"] = anio
        codigos_meta = list(
            _filter_productos_con_meta_anio(productos_qs, anio)
            .values_list("codigo_producto", flat=True)
            .distinct()
        )
        from .ejecucion_resumen import ejecucion_totales_productos

        stats["ejecucion_anio"] = ejecucion_totales_productos(entity.id, codigos_meta, anio)
        return Response(stats)


class PdmAnalisisView(APIView):
    """Analítica agregada para la vista de Análisis PDM."""

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, slug: str):
        entity = _entity_or_404(slug)
        _ensure_user_can_manage_entity(request.user, entity)
        productos_qs = productos_queryset_for_user(request.user, entity)

        anio_param = (request.query_params.get("anio") or "").strip().lower()
        anio: int | None
        if not anio_param or anio_param in ("all", "todos", "todos_los_anios"):
            anio = None
        else:
            try:
                anio = int(anio_param)
            except (TypeError, ValueError):
                anio = None

        secretaria_param = request.query_params.get("secretaria")
        if secretaria_param and _is_admin(request.user):
            try:
                productos_qs = productos_qs.filter(responsable_secretaria_id=int(secretaria_param))
            except (TypeError, ValueError):
                pass

        data = compute_pdm_analytics(
            productos_qs,
            entity.id,
            anio,
            include_por_secretaria=_is_admin(request.user),
        )
        return Response(data)


class PdmProyectosView(APIView):
    """Proyectos BPIN agrupados con productos del Plan Indicativo."""

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, slug: str):
        entity = _entity_or_404(slug)
        _ensure_user_can_manage_entity(request.user, entity)
        productos_qs = productos_queryset_for_user(request.user, entity)

        data = compute_pdm_proyectos(productos_qs, entity.id)
        bpines = [p["bpin"] for p in data["proyectos"]]
        datos_abiertos, error = consultar_bpines_externos(bpines)

        for proyecto in data["proyectos"]:
            bpin = proyecto["bpin"]
            externo = datos_abiertos.get(bpin)
            if externo and externo.get("nombreproyecto"):
                proyecto["nombre_proyecto"] = externo.get("nombreproyecto")
                proyecto["estado"] = externo.get("estadoproyecto")
                proyecto["sector"] = externo.get("sector")
                proyecto["datos_abiertos_ok"] = True
            else:
                proyecto["nombre_proyecto"] = None
                proyecto["estado"] = None
                proyecto["sector"] = None
                proyecto["datos_abiertos_ok"] = False

        data["datos_abiertos_error"] = error
        data["portal_url"] = DATOS_GOV_CO_PORTAL
        return Response(data)


class PdmProductosListView(APIView):
    """Listado paginado de productos con métricas por año."""

    permission_classes = [permissions.IsAuthenticated]
    pagination_class = StandardPageNumberPagination
    filter_backends = [DjangoFilterBackend]
    filterset_class = PdmProductoFilterSet

    def get(self, request, slug: str):
        entity = _entity_or_404(slug)
        _ensure_user_can_manage_entity(request.user, entity)
        anio_param = request.query_params.get("anio")
        try:
            anio = int(anio_param) if anio_param else datetime.now().year
        except (TypeError, ValueError):
            anio = datetime.now().year
        estado = (request.query_params.get("estado") or "").strip().upper()

        qs = _productos_list_queryset(request.user, entity)
        filterset = PdmProductoFilterSet(request.query_params, queryset=qs)
        qs = filterset.qs
        qs = _filter_productos_con_meta_anio(qs, anio)
        if estado:
            qs = _filter_productos_by_estado(qs, entity.id, anio, estado)

        paginator = self.pagination_class()
        page = paginator.paginate_queryset(qs, request, view=self)
        productos = list(page) if page is not None else list(qs)
        _attach_list_metrics(productos, entity.id, anio)
        data = PdmProductoListSerializer(productos, many=True).data
        if page is not None:
            return paginator.get_paginated_response(data)
        return Response({"count": len(data), "results": data})


class PdmProductoDetailView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, slug: str, clave_producto: str):
        entity = _entity_or_404(slug)
        _ensure_user_can_manage_entity(request.user, entity)
        if not user_can_access_producto(request.user, entity, clave_producto):
            raise PermissionDenied("No tiene permisos para ver este producto.")
        anio_param = request.query_params.get("anio")
        try:
            anio = int(anio_param) if anio_param else datetime.now().year
        except (TypeError, ValueError):
            anio = datetime.now().year

        producto = get_object_or_404(
            productos_queryset_for_user(request.user, entity),
            clave_producto=clave_producto,
        )
        actividades = (
            actividades_queryset_for_user(request.user, entity)
            .filter(clave_producto=clave_producto)
            .prefetch_related("evidencia__archivos")
            .order_by("anio", "id")
        )
        setattr(producto, "pdm_actividades_filtradas", list(actividades))

        claves = [producto.clave_producto]
        aggs_map = actividad_aggs_for_productos(entity.id, claves).get(producto.clave_producto, {})
        hermanos_qs = (
            productos_queryset_for_user(request.user, entity)
            .filter(codigo_producto=producto.codigo_producto)
            .exclude(clave_producto=producto.clave_producto)
        )
        setattr(
            producto,
            "indicadores_hermanos",
            list(
                hermanos_qs.values(
                    "clave_producto",
                    "codigo_indicador_producto_mga",
                    "indicador_producto_mga",
                )
            ),
        )
        setattr(
            producto,
            "total_indicadores",
            PdmProducto.objects.filter(entity=entity, codigo_producto=producto.codigo_producto).count(),
        )
        _attach_list_metrics([producto], entity.id, anio)
        setattr(
            producto,
            "resumen_por_anio",
            {str(y): resumen_anio(producto, y, aggs_map) for y in ANIOS_PDM},
        )
        setattr(
            producto,
            "codigos_armonizados",
            codigos_armonizados_para_producto(entity.id, producto.codigo_producto),
        )
        return Response(PdmProductoSerializer(producto).data)


class PdmUploadView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    parser_classes = [JSONParser]

    def post(self, request, slug: str):
        entity = _entity_or_404(slug)
        _ensure_user_can_manage_entity(request.user, entity)
        if not _is_admin(request.user):
            raise PermissionDenied("Solo admin puede cargar información PDM.")

        serializer = PdmDataUploadSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        payload = serializer.validated_data
        rows = payload["productos_plan_indicativo"]
        clave_map = calcular_claves_producto(rows)
        existing_products = list(PdmProducto.objects.filter(entity=entity))
        existing_by_clave = {p.clave_producto: p for p in existing_products}
        existing_by_sispt: dict[str, PdmProducto] = {}
        existing_by_legacy_codigo: dict[str, PdmProducto] = {}
        for prod in existing_products:
            sispt = str(prod.codigo_indicador_producto or "").strip()
            if sispt:
                existing_by_sispt[sispt] = prod
            if prod.clave_producto == prod.codigo_producto:
                existing_by_legacy_codigo[prod.codigo_producto] = prod

        claves_excel: set[str] = set()
        manual_fields = {"responsable_secretaria", "responsable_secretaria_nombre", "clave_producto"}

        with transaction.atomic():
            for idx, raw_item in enumerate(rows):
                codigo = str(raw_item.get("codigo_producto") or "").strip()
                if not codigo:
                    continue
                clave = clave_map.get(idx)
                if not clave:
                    continue
                item = {**raw_item, "codigo_producto": codigo, "clave_producto": clave}
                claves_excel.add(clave)

                sispt = str(raw_item.get("codigo_indicador_producto") or "").strip()
                prod = None
                if sispt and sispt in existing_by_sispt:
                    prod = existing_by_sispt[sispt]
                elif clave in existing_by_clave:
                    prod = existing_by_clave[clave]
                elif clave == codigo and codigo in existing_by_legacy_codigo:
                    prod = existing_by_legacy_codigo[codigo]

                if prod:
                    old_clave = prod.clave_producto
                    for field, value in item.items():
                        if field not in manual_fields:
                            setattr(prod, field, value)
                    prod.clave_producto = clave
                    prod.save()
                    if old_clave != clave:
                        existing_by_clave.pop(old_clave, None)
                        if existing_by_legacy_codigo.get(old_clave) is prod:
                            existing_by_legacy_codigo.pop(old_clave, None)
                        PdmActividad.objects.filter(entity=entity, clave_producto=old_clave).update(
                            clave_producto=clave
                        )
                else:
                    create_data = {k: v for k, v in item.items() if k not in manual_fields}
                    prod = PdmProducto.objects.create(
                        entity=entity,
                        clave_producto=clave,
                        **create_data,
                    )

                existing_by_clave[clave] = prod
                if sispt:
                    existing_by_sispt[sispt] = prod
                if clave == codigo:
                    existing_by_legacy_codigo[codigo] = prod

            claves_a_eliminar = list(
                PdmProducto.objects.filter(entity=entity)
                .exclude(clave_producto__in=claves_excel)
                .values_list("clave_producto", flat=True)
            )
            if claves_a_eliminar:
                PdmActividad.objects.filter(
                    entity=entity, clave_producto__in=claves_a_eliminar
                ).delete()
            PdmProducto.objects.filter(entity=entity).exclude(clave_producto__in=claves_excel).delete()

            PdmIniciativaSGR.objects.filter(entity=entity).delete()
            iniciativas_por_consecutivo: dict[str, dict] = {}
            for raw_inic in payload.get("iniciativas_sgr") or []:
                consecutivo = str(raw_inic.get("consecutivo") or "").strip()
                if consecutivo:
                    iniciativas_por_consecutivo[consecutivo] = {**raw_inic, "consecutivo": consecutivo}
            if iniciativas_por_consecutivo:
                PdmIniciativaSGR.objects.bulk_create(
                    [PdmIniciativaSGR(entity=entity, **i) for i in iniciativas_por_consecutivo.values()]
                )

        total = PdmProducto.objects.filter(entity=entity).count()
        return Response(
            {
                "tiene_datos": total > 0,
                "total_productos": total,
                "filas_recibidas": len(rows),
                "claves_procesadas": len(claves_excel),
                "fecha_ultima_carga": timezone.now(),
            }
        )


class PdmActividadCreateView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    parser_classes = [JSONParser]

    def post(self, request, slug: str):
        entity = _entity_or_404(slug)
        _ensure_user_can_manage_entity(request.user, entity)
        if not (_is_admin(request.user) or _is_secretario(request.user)):
            raise PermissionDenied("Sin permisos para crear actividades.")
        clave = str(request.data.get("clave_producto") or request.data.get("codigo_producto") or "").strip()
        clave = resolve_clave_producto(request.user, entity, clave) or clave
        if not clave or not user_can_access_producto(request.user, entity, clave):
            raise PermissionDenied("No tiene permisos para este producto.")
        payload = request.data.copy()
        payload["clave_producto"] = clave
        payload.pop("codigo_producto", None)
        payload["fecha_inicio"] = _parse_iso_dt(payload.get("fecha_inicio"))
        payload["fecha_fin"] = _parse_iso_dt(payload.get("fecha_fin"))
        if not _is_secretario(request.user):
            payload.pop("responsable_usuario", None)
            payload.pop("responsable_usuario_id", None)
        ser = PdmActividadSerializer(data=payload)
        ser.is_valid(raise_exception=True)
        actividad = PdmActividad.objects.create(entity=entity, **ser.validated_data)
        return Response(PdmActividadSerializer(actividad).data, status=status.HTTP_201_CREATED)


class PdmActividadesPorProductoView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, slug: str, clave_producto: str):
        entity = _entity_or_404(slug)
        _ensure_user_can_manage_entity(request.user, entity)
        if not user_can_access_producto(request.user, entity, clave_producto):
            raise PermissionDenied("No tiene permisos para este producto.")
        qs = actividades_queryset_for_user(request.user, entity).filter(clave_producto=clave_producto)
        anio = request.query_params.get("anio")
        if anio:
            qs = qs.filter(anio=anio)
        return Response(PdmActividadSerializer(qs.order_by("anio", "id"), many=True).data)


class PdmActividadDetailView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    parser_classes = [JSONParser]

    def put(self, request, slug: str, actividad_id: int):
        entity = _entity_or_404(slug)
        _ensure_user_can_manage_entity(request.user, entity)
        actividad = get_object_or_404(PdmActividad, id=actividad_id, entity=entity)
        if not user_can_access_actividad(request.user, entity, actividad):
            raise PermissionDenied("No tiene permisos para esta actividad.")
        payload = request.data.copy()
        payload.pop("clave_producto", None)
        payload.pop("codigo_producto", None)
        if "fecha_inicio" in payload:
            payload["fecha_inicio"] = _parse_iso_dt(payload.get("fecha_inicio"))
        if "fecha_fin" in payload:
            payload["fecha_fin"] = _parse_iso_dt(payload.get("fecha_fin"))
        if not _is_secretario(request.user):
            payload.pop("responsable_usuario", None)
            payload.pop("responsable_usuario_id", None)
        if payload.get("estado") == ActividadEstado.COMPLETADA:
            if not PdmActividadEvidencia.objects.filter(actividad_id=actividad.id).exists():
                raise ValidationError(
                    {"estado": "No se puede marcar como completada sin evidencia registrada."}
                )
        ser = PdmActividadSerializer(actividad, data=payload, partial=True)
        ser.is_valid(raise_exception=True)
        ser.save()
        return Response(ser.data)

    def delete(self, request, slug: str, actividad_id: int):
        entity = _entity_or_404(slug)
        _ensure_user_can_manage_entity(request.user, entity)
        actividad = get_object_or_404(PdmActividad, id=actividad_id, entity=entity)
        if not user_can_access_actividad(request.user, entity, actividad):
            raise PermissionDenied("No tiene permisos para esta actividad.")
        actividad.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class PdmEvidenciaView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def _serialize(self, evidencia, request):
        return PdmActividadEvidenciaSerializer(evidencia, context={"request": request}).data

    def post(self, request, slug: str, actividad_id: int):
        entity = _entity_or_404(slug)
        _ensure_user_can_manage_entity(request.user, entity)
        actividad = get_object_or_404(PdmActividad, id=actividad_id, entity=entity)
        if not user_can_access_actividad(request.user, entity, actividad):
            raise PermissionDenied("No tiene permisos para esta actividad.")
        if PdmActividadEvidencia.objects.filter(actividad=actividad).exists():
            raise ValidationError({"detail": "La actividad ya tiene evidencia registrada."})

        descripcion = str(request.data.get("descripcion") or "").strip()
        url_evidencia = str(request.data.get("url_evidencia") or "").strip() or None
        files = _files_from_request(request)
        if not descripcion:
            raise ValidationError({"descripcion": "Este campo es requerido."})
        if not url_evidencia and not files:
            raise ValidationError({"archivos": "Debe adjuntar al menos una imagen o una URL externa."})

        evidencia = PdmActividadEvidencia.objects.create(
            actividad=actividad,
            entity=entity,
            descripcion=descripcion,
            url_evidencia=url_evidencia,
        )
        attach_evidencia_archivos(evidencia, files, request.user)
        actividad.estado = ActividadEstado.COMPLETADA
        actividad.save(update_fields=["estado", "updated_at"])
        evidencia.refresh_from_db()
        return Response(self._serialize(evidencia, request), status=status.HTTP_201_CREATED)

    def get(self, request, slug: str, actividad_id: int):
        entity = _entity_or_404(slug)
        _ensure_user_can_manage_entity(request.user, entity)
        actividad = get_object_or_404(PdmActividad, id=actividad_id, entity=entity)
        if not user_can_access_actividad(request.user, entity, actividad):
            raise PermissionDenied("No tiene permisos para esta actividad.")
        evidencia = get_object_or_404(
            PdmActividadEvidencia.objects.prefetch_related("archivos"),
            actividad_id=actividad_id,
            entity=entity,
        )
        return Response(self._serialize(evidencia, request))

    def put(self, request, slug: str, actividad_id: int):
        entity = _entity_or_404(slug)
        _ensure_user_can_manage_entity(request.user, entity)
        actividad = get_object_or_404(PdmActividad, id=actividad_id, entity=entity)
        if not user_can_access_actividad(request.user, entity, actividad):
            raise PermissionDenied("No tiene permisos para esta actividad.")
        evidencia = get_object_or_404(
            PdmActividadEvidencia.objects.prefetch_related("archivos"),
            actividad_id=actividad_id,
            entity=entity,
        )

        if "descripcion" in request.data:
            descripcion = str(request.data.get("descripcion") or "").strip()
            if not descripcion:
                raise ValidationError({"descripcion": "Este campo es requerido."})
            evidencia.descripcion = descripcion
        if "url_evidencia" in request.data:
            evidencia.url_evidencia = str(request.data.get("url_evidencia") or "").strip() or None
        evidencia.save()

        sync_evidencia_archivos_from_request(evidencia, request, request.user)
        evidencia.refresh_from_db()
        if not (evidencia.url_evidencia or evidencia.archivos.exists()):
            raise ValidationError({"archivos": "Debe conservar al menos una imagen o una URL externa."})
        return Response(self._serialize(evidencia, request))

    def delete(self, request, slug: str, actividad_id: int):
        entity = _entity_or_404(slug)
        _ensure_user_can_manage_entity(request.user, entity)
        actividad = get_object_or_404(PdmActividad, id=actividad_id, entity=entity)
        if not user_can_access_actividad(request.user, entity, actividad):
            raise PermissionDenied("No tiene permisos para esta actividad.")
        evidencia = get_object_or_404(
            PdmActividadEvidencia.objects.prefetch_related("archivos"),
            actividad_id=actividad_id,
            entity=entity,
        )
        evidencia.delete()
        actividad.estado = ActividadEstado.PENDIENTE
        actividad.save(update_fields=["estado", "updated_at"])
        return Response(status=status.HTTP_204_NO_CONTENT)


class PdmAsignarResponsableView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def patch(self, request, slug: str, clave_producto: str):
        entity = _entity_or_404(slug)
        _ensure_user_can_manage_entity(request.user, entity)
        if not _is_admin(request.user):
            raise PermissionDenied("Solo admin puede asignar responsables.")
        secretaria_id = request.query_params.get("responsable_secretaria_id")
        if not secretaria_id:
            raise ValidationError({"responsable_secretaria_id": "Parámetro requerido."})
        producto = get_object_or_404(
            productos_queryset_for_user(request.user, entity),
            clave_producto=clave_producto,
        )
        secretaria = get_object_or_404(Secretaria, id=secretaria_id, entity=entity)
        producto.responsable_secretaria = secretaria
        producto.responsable_secretaria_nombre = secretaria.nombre
        producto.save(update_fields=["responsable_secretaria", "responsable_secretaria_nombre", "updated_at"])
        return Response({"success": True, "producto_codigo": producto.clave_producto, "responsable_secretaria_id": secretaria.id, "responsable_secretaria_nombre": secretaria.nombre})


class PdmAsignarResponsableUsuarioView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def patch(self, request, slug: str, clave_producto: str):
        from apps.accounts.models import UserEntityMembership

        entity = _entity_or_404(slug)
        _ensure_user_can_manage_entity(request.user, entity)
        roles = user_roles(request.user)
        if "secretario" not in roles:
            raise PermissionDenied("Solo secretario puede asignar contratistas.")
        usuario_id = request.query_params.get("responsable_usuario_id")
        producto = get_object_or_404(
            productos_queryset_for_user(request.user, entity),
            clave_producto=clave_producto,
        )
        if not request.user.secretaria_id or producto.responsable_secretaria_id != request.user.secretaria_id:
            raise PermissionDenied("Solo puede delegar productos de su secretaría.")

        if usuario_id in (None, "", "null", "none", "0"):
            producto.responsable_usuario = None
            producto.save(update_fields=["responsable_usuario", "updated_at"])
            return Response(
                {
                    "success": True,
                    "producto_codigo": producto.clave_producto,
                    "responsable_usuario_id": None,
                    "responsable_usuario_nombre": None,
                }
            )

        target = get_object_or_404(User, pk=usuario_id)
        membership = UserEntityMembership.objects.filter(
            user=target, entity=entity, is_active=True
        ).first()
        if membership is None:
            raise ValidationError({"responsable_usuario_id": "Usuario no pertenece a la entidad."})
        if membership.role != "contratista":
            raise PermissionDenied("Solo puede asignar contratistas.")
        if membership.secretaria_id != request.user.secretaria_id:
            raise PermissionDenied("Solo puede asignar contratistas de su secretaría.")
        producto.responsable_usuario = target
        producto.save(update_fields=["responsable_usuario", "updated_at"])
        return Response(
            {
                "success": True,
                "producto_codigo": producto.clave_producto,
                "responsable_usuario_id": target.id,
                "responsable_usuario_nombre": target.full_name or target.email,
            }
        )


class PdmEjecucionUploadView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]

    def post(self, request):
        require_user_module(request.user, "pdm", message="El módulo PDM no está habilitado para tu usuario.")
        if not _is_admin(request.user):
            raise PermissionDenied("Solo admin puede cargar ejecución presupuestal.")
        archivo = request.FILES.get("file")
        if not archivo:
            raise ValidationError({"file": "Archivo requerido."})
        if not archivo.name.lower().endswith((".csv", ".xlsx", ".xls")):
            raise ValidationError({"file": "Formato inválido."})
        anio_param = request.data.get("anio")
        try:
            target_year = int(anio_param) if anio_param not in (None, "") else timezone.now().year
        except (TypeError, ValueError) as exc:
            raise ValidationError({"anio": "Parámetro inválido."}) from exc

        content = archivo.read()
        try:
            df_filtrado, _ = parse_ejecucion_excel(content, archivo.name)
            rows_data, errores = rows_from_ejecucion_dataframe(df_filtrado, target_year)
        except ValueError as exc:
            raise ValidationError({"detail": str(exc)}) from exc

        with transaction.atomic():
            deleted = PDMEjecucionPresupuestal.objects.filter(entity_id=request.user.entity_id, anio=target_year).delete()[0]
            entity = Entity.objects.filter(id=request.user.entity_id).first()
            mapa = mapa_armonizacion(entity) if entity else {}
            rows = []
            for item in rows_data:
                codigo_raw = str(item["codigo_producto"] or "").strip()
                codigo_resuelto = (
                    codigo_efectivo(entity, codigo_raw, mapa) if entity else codigo_raw
                )
                rows.append(
                    PDMEjecucionPresupuestal(
                        entity_id=request.user.entity_id,
                        codigo_producto_origen=codigo_raw,
                        codigo_producto=codigo_resuelto,
                        descripcion_fte=item["descripcion_fte"],
                        pto_inicial=item["pto_inicial"],
                        adicion=item["adicion"],
                        reduccion=item["reduccion"],
                        credito=item["credito"],
                        contracredito=item["contracredito"],
                        pto_definitivo=item["pto_definitivo"],
                        pagos=item["pagos"],
                        sector=item.get("sector"),
                        dependencia=item.get("dependencia"),
                        bpin=item.get("bpin"),
                        anio=target_year,
                    )
                )
            if rows:
                PDMEjecucionPresupuestal.objects.bulk_create(rows)

        return Response(
            {
                "success": True,
                "message": f"Archivo procesado exitosamente para el año {target_year}. {len(rows)} registros únicos insertados.",
                "registros_procesados": len(df_filtrado),
                "registros_insertados": len(rows),
                "registros_eliminados": deleted,
                "errores": errores[:10],
            }
        )


def _ejecucion_qs_for_user(user):
    if not user.entity_id:
        return PDMEjecucionPresupuestal.objects.none()
    entity = Entity.objects.filter(id=user.entity_id).first()
    if not entity:
        return PDMEjecucionPresupuestal.objects.none()
    return ejecucion_queryset_for_user(user, entity)


class PdmEjecucionResumenAnualEntidadView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        require_user_module(request.user, "pdm", message="El módulo PDM no está habilitado para tu usuario.")
        entity = get_object_or_404(Entity, id=request.user.entity_id)
        return Response(resumen_ejecucion_entidad(request.user, entity))


class PdmEjecucionProductoView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, codigo_producto: str):
        require_user_module(request.user, "pdm", message="El módulo PDM no está habilitado para tu usuario.")
        entity = get_object_or_404(Entity, id=request.user.entity_id)
        if not user_can_access_codigo_producto(request.user, entity, codigo_producto):
            raise PermissionDenied("No tiene permisos para este producto.")
        qs = _ejecucion_qs_for_user(request.user).filter(codigo_producto=codigo_producto)
        anio = request.query_params.get("anio")
        if anio:
            qs = qs.filter(anio=anio)
        if not qs.exists():
            return Response({"detail": f"No se encontró información de ejecución para {codigo_producto}"}, status=status.HTTP_404_NOT_FOUND)
        sum_fields = (
            "pto_inicial",
            "adicion",
            "reduccion",
            "credito",
            "contracredito",
            "pto_definitivo",
            "pagos",
        )
        aggregated = (
            qs.values("descripcion_fte")
            .annotate(
                pto_inicial=Sum("pto_inicial"),
                adicion=Sum("adicion"),
                reduccion=Sum("reduccion"),
                credito=Sum("credito"),
                contracredito=Sum("contracredito"),
                pto_definitivo=Sum("pto_definitivo"),
                pagos=Sum("pagos"),
            )
            .order_by("descripcion_fte")
        )
        fuentes_detalle = []
        for row in aggregated:
            key = row["descripcion_fte"] or "Sin Fuente"
            item = {
                "nombre": key,
                "codigo_fuente": key if _looks_like_codigo_fuente(key) else None,
                **{field: _to_float(row[field]) for field in sum_fields},
            }
            fuentes_detalle.append(item)
        totales = defaultdict(float)
        for f in fuentes_detalle:
            for key in sum_fields:
                totales[key] += f[key]
        codigos_armonizados = codigos_armonizados_para_producto(entity.id, codigo_producto)
        return Response(
            {
                "codigo_producto": codigo_producto,
                "codigos_armonizados": codigos_armonizados,
                "fuentes": [f["nombre"] for f in fuentes_detalle],
                "fuentes_detalle": fuentes_detalle,
                "totales": dict(totales),
            }
        )


def _require_pdm_admin(user) -> None:
    require_user_module(user, "pdm", message="El módulo PDM no está habilitado para tu usuario.")
    if not _is_admin(user):
        raise PermissionDenied("Solo admin puede gestionar armonizaciones de ejecución.")


class PdmArmonizacionListCreateView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        _require_pdm_admin(request.user)
        entity = get_object_or_404(Entity, id=request.user.entity_id)
        items = [
            serializar_armonizacion(arm)
            for arm in PdmArmonizacionEjecucion.objects.filter(entity=entity).select_related("created_by").order_by(
                "-created_at"
            )
        ]
        return Response(items)

    def post(self, request):
        _require_pdm_admin(request.user)
        entity = get_object_or_404(Entity, id=request.user.entity_id)
        codigo_origen = str(request.data.get("codigo_origen") or "").strip()
        codigo_destino = str(request.data.get("codigo_destino") or "").strip()
        nota = str(request.data.get("nota") or "").strip()
        try:
            payload = aplicar_armonizacion(
                entity,
                codigo_origen,
                codigo_destino,
                nota=nota,
                created_by=request.user,
            )
        except ArmonizacionError as exc:
            raise ValidationError({"detail": str(exc)}) from exc
        return Response(payload, status=status.HTTP_201_CREATED)


class PdmArmonizacionDetailView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def delete(self, request, armonizacion_id: int):
        _require_pdm_admin(request.user)
        entity = get_object_or_404(Entity, id=request.user.entity_id)
        try:
            payload = revertir_armonizacion(entity, armonizacion_id)
        except ArmonizacionError as exc:
            raise ValidationError({"detail": str(exc)}) from exc
        return Response(payload)


class PdmArmonizacionCandidatosView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        _require_pdm_admin(request.user)
        entity = get_object_or_404(Entity, id=request.user.entity_id)
        search = str(request.query_params.get("search") or "").strip()
        qs = productos_queryset_for_user(request.user, entity).order_by("codigo_producto", "clave_producto")
        if search:
            from django.db.models import Q

            qs = qs.filter(
                Q(codigo_producto__icontains=search)
                | Q(clave_producto__icontains=search)
                | Q(producto_mga__icontains=search)
                | Q(indicador_producto_mga__icontains=search)
                | Q(linea_estrategica__icontains=search)
                | Q(codigo_indicador_producto__icontains=search)
            )
        qs = qs[:50]
        results = [
            {
                "clave_producto": p.clave_producto,
                "codigo_producto": p.codigo_producto,
                "producto_mga": p.producto_mga or "",
                "indicador_producto_mga": p.indicador_producto_mga or "",
                "linea_estrategica": p.linea_estrategica or "",
            }
            for p in qs
        ]
        return Response(results)


class PdmContratosUploadView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]

    def post(self, request, slug: str):
        entity = _entity_or_404(slug)
        _ensure_user_can_manage_entity(request.user, entity)
        if not _is_admin(request.user):
            raise PermissionDenied("Solo admin puede cargar contratos.")
        archivo = request.FILES.get("file")
        if not archivo:
            raise ValidationError({"file": "Archivo requerido."})
        content = archivo.read()
        anio = int(request.query_params.get("anio") or timezone.now().year)
        grouped = parse_contratos_rps(content, archivo.name, anio)
        rows = grouped.to_dict("records")
        existing_map = {
            (c.anio, c.codigo_producto, c.no_crp): c
            for c in PDMContratoRPS.objects.filter(entity=entity, anio=anio)
        }
        to_create: list[PDMContratoRPS] = []
        to_update: list[PDMContratoRPS] = []
        creados = 0
        actualizados = 0
        with transaction.atomic():
            for r in rows:
                row_anio = int(r["AÑO"])
                codigo_producto = str(r["PRODUCTO"])
                no_crp = str(r["NO CRP"])
                concepto = str(r["CONCEPTO"]) or None
                valor = Decimal(str(_to_float(r["VALOR"])))
                contratista = str(r["CONTRATISTA"]) or None
                key = (row_anio, codigo_producto, no_crp)
                existing = existing_map.get(key)
                if existing is None:
                    to_create.append(
                        PDMContratoRPS(
                            entity=entity,
                            anio=row_anio,
                            codigo_producto=codigo_producto,
                            no_crp=no_crp,
                            concepto=concepto,
                            valor=valor,
                            contratista=contratista,
                        )
                    )
                    creados += 1
                else:
                    existing.concepto = concepto
                    existing.valor = valor
                    existing.contratista = contratista
                    to_update.append(existing)
                    actualizados += 1
            if to_create:
                PDMContratoRPS.objects.bulk_create(to_create)
            if to_update:
                PDMContratoRPS.objects.bulk_update(to_update, fields=["concepto", "valor", "contratista", "updated_at"])
        contratos = list(PDMContratoRPS.objects.filter(entity=entity, anio=anio).order_by("codigo_producto", "no_crp"))
        return Response(
            {
                "mensaje": f"{len(grouped)} filas procesadas: {creados} nuevos, {actualizados} actualizados (año {anio})",
                "registros_insertados": creados,
                "registros_actualizados": actualizados,
                "registros_eliminados": 0,
                "errores": [],
                "procesados": len(grouped),
                "contratos_agrupados": len(contratos),
                "contratos": [
                    {
                        "id": c.id,
                        "no_crp": c.no_crp,
                        "codigo_producto": c.codigo_producto,
                        "concepto": c.concepto,
                        "valor": _to_float(c.valor),
                        "contratista": c.contratista,
                        "anio": c.anio,
                    }
                    for c in contratos
                ],
            }
        )


class PdmExportPiipView(APIView):
    """Exporta Excel PIIP del año seleccionado (descarga directa, sin persistir)."""

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, slug: str):
        entity = _entity_or_404(slug)
        _ensure_user_can_manage_entity(request.user, entity)
        if not _is_admin(request.user):
            raise PermissionDenied("Solo admin puede exportar PIIP.")

        anio_param = request.query_params.get("anio")
        try:
            anio = int(anio_param) if anio_param else datetime.now().year
        except (TypeError, ValueError):
            anio = datetime.now().year

        wb = build_piip_workbook(entity, request.user, anio)
        content = workbook_to_bytes(wb)
        filename = f"PIIP_{entity.slug}_{anio}.xlsx"
        response = HttpResponse(
            content,
            content_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        )
        response["Content-Disposition"] = f'attachment; filename="{filename}"'
        return response


class PdmExportPlanAccionView(APIView):
    """Exporta Excel Plan de Acción del año seleccionado (descarga directa, sin persistir)."""

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, slug: str):
        entity = _entity_or_404(slug)
        _ensure_user_can_manage_entity(request.user, entity)
        if not (_is_admin(request.user) or _is_secretario(request.user)):
            raise PermissionDenied("Solo admin o secretario pueden exportar el plan de acción.")

        anio_param = request.query_params.get("anio")
        try:
            anio = int(anio_param) if anio_param else datetime.now().year
        except (TypeError, ValueError):
            anio = datetime.now().year
        if anio not in ANIOS_PDM:
            raise ValidationError({"anio": f"Año no válido. Use uno de: {', '.join(map(str, ANIOS_PDM))}."})

        secretaria_id = request.query_params.get("responsable_secretaria")
        secretaria_id_int = None
        if secretaria_id:
            try:
                secretaria_id_int = int(secretaria_id)
            except (TypeError, ValueError):
                raise ValidationError({"responsable_secretaria": "ID de dependencia no válido."})
            if not Secretaria.objects.filter(pk=secretaria_id_int, entity_id=entity.id).exists():
                raise ValidationError({"responsable_secretaria": "Dependencia no válida."})

        if _is_secretario(request.user) and not _is_admin(request.user):
            if not request.user.secretaria_id:
                raise PermissionDenied("Su usuario no tiene secretaría asignada.")
            secretaria_id_int = request.user.secretaria_id

        content, filename = build_plan_accion_export(
            entity,
            request.user,
            anio,
            responsable_secretaria_id=secretaria_id_int,
        )
        response = HttpResponse(
            content,
            content_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        )
        response["Content-Disposition"] = f'attachment; filename="{filename}"'
        return response


class PdmContratosView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, slug: str):
        entity = _entity_or_404(slug)
        _ensure_user_can_manage_entity(request.user, entity)
        qs = PDMContratoRPS.objects.filter(entity=entity)
        if not _is_admin(request.user):
            codigos = codigos_producto_for_user(request.user, entity)
            qs = qs.filter(codigo_producto__in=codigos) if codigos else qs.none()
        anio = request.query_params.get("anio")
        codigo = request.query_params.get("codigo_producto")
        if anio:
            qs = qs.filter(anio=anio)
        if codigo:
            codigo = str(codigo).strip()
            if not user_can_access_codigo_producto(request.user, entity, codigo):
                raise PermissionDenied("No tiene permisos para este producto.")
            qs = qs.filter(codigo_producto=codigo)
        qs = qs.order_by("codigo_producto", "no_crp")
        contratos_rows = list(
            qs.values("id", "no_crp", "codigo_producto", "concepto", "valor", "contratista", "anio")
        )
        total_contratado = _to_float(qs.aggregate(total=Sum("valor"))["total"])
        contratos = [
            {
                "id": c["id"],
                "no_crp": c["no_crp"],
                "codigo_producto": c["codigo_producto"],
                "concepto": c["concepto"],
                "valor": _to_float(c["valor"]),
                "contratista": c["contratista"],
                "anio": c["anio"],
            }
            for c in contratos_rows
        ]
        return Response(
            {
                "contratos": contratos,
                "total_contratado": total_contratado,
                "cantidad_contratos": len(contratos),
                "anio": int(anio) if anio else (contratos[0]["anio"] if contratos else 0),
            }
        )


class PdmChatAnalyticsView(APIView):
    """Analítica del chat IA público del PDM (admin de la entidad o superadmin)."""

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, slug: str):
        entity = _entity_or_404(slug)
        if is_platform_superadmin(request.user):
            pass
        else:
            _ensure_user_can_manage_entity(request.user, entity)
        if not entity.enable_pdm_chat:
            raise PermissionDenied("El chat IA del PDM no está habilitado para esta entidad.")

        since = timezone.now() - timedelta(days=30)
        conv_qs = PdmChatConversation.objects.filter(entity=entity, created_at__gte=since)
        msg_qs = PdmChatMessage.objects.filter(
            conversation__entity=entity,
            created_at__gte=since,
        )

        total_conversations = conv_qs.count()
        total_messages = msg_qs.count()
        avg_messages = conv_qs.aggregate(avg=Avg("message_count"))["avg"] or 0

        por_dia = list(
            conv_qs.annotate(dia=TruncDate("created_at"))
            .values("dia")
            .annotate(conversaciones=Count("id"))
            .order_by("dia")
        )

        ultimas_preguntas = list(
            msg_qs.filter(role=PdmChatMessage.Role.USER)
            .order_by("-created_at")[:20]
            .values("content", "created_at")
        )

        return Response({
            "total_conversaciones": total_conversations,
            "total_mensajes": total_messages,
            "promedio_mensajes_por_conversacion": round(float(avg_messages), 1),
            "conversaciones_por_dia": [
                {"fecha": str(r["dia"]), "conversaciones": r["conversaciones"]}
                for r in por_dia
            ],
            "ultimas_preguntas": [
                {"pregunta": r["content"][:200], "fecha": r["created_at"]}
                for r in ultimas_preguntas
            ],
            "periodo_dias": 30,
        })

