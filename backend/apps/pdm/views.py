"""Endpoints del módulo PDM."""
from __future__ import annotations

import io
import re
from collections import defaultdict
from datetime import datetime
from decimal import Decimal

import pandas as pd
from django.db import transaction
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
    productos_queryset_for_user,
    user_can_access_actividad,
    user_can_access_producto,
)
from .contratos_parser import parse_contratos_rps
from .ejecucion_parser import _looks_like_codigo_fuente, parse_ejecucion_excel, rows_from_ejecucion_dataframe
from .evidencia_storage import (
    _files_from_request,
    attach_evidencia_archivos,
    sync_evidencia_archivos_from_request,
)
from .filters import PdmProductoFilterSet
from .metrics import ANIOS_PDM, actividad_aggs_for_productos, producto_list_metrics, resumen_anio
from .stats import compute_estado_stats, compute_pdm_stats, filter_options_from_productos
from .models import (
    ActividadEstado,
    PDMContratoRPS,
    PDMEjecucionPresupuestal,
    PdmActividad,
    PdmActividadEvidencia,
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
from .metrics import estado_producto_anio


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
    codigos = [p.codigo_producto for p in productos]
    aggs_map = actividad_aggs_for_productos(entity_id, codigos)
    for prod in productos:
        aggs_anio = aggs_map.get(prod.codigo_producto, {})
        metrics = producto_list_metrics(prod, anio, aggs_anio)
        for key, value in metrics.items():
            setattr(prod, key, value)


def _filter_productos_by_estado(qs, entity_id: int, anio: int, estado: str):
    productos = list(qs)
    if not productos or not estado:
        return qs
    codigos = [p.codigo_producto for p in productos]
    aggs_map = actividad_aggs_for_productos(entity_id, codigos)
    ids = [
        p.id
        for p in productos
        if estado_producto_anio(p, anio, aggs_map.get(p.codigo_producto, {}).get(anio)) == estado
    ]
    return qs.filter(id__in=ids) if ids else qs.none()


class PdmStatusView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, slug: str):
        entity = _entity_or_404(slug)
        _ensure_user_can_manage_entity(request.user, entity)
        qs = productos_queryset_for_user(request.user, entity)
        total = qs.count()
        latest = qs.order_by("-created_at").values_list("created_at", flat=True).first()
        return Response({"tiene_datos": total > 0, "total_productos": total, "fecha_ultima_carga": latest})


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
        productos = list(productos_qs)
        lineas_count = productos_qs.values("linea_estrategica").distinct().count()
        iniciativas_count = PdmIniciativaSGR.objects.filter(entity=entity).count()
        stats = compute_pdm_stats(productos, iniciativas_count, lineas_count)
        anio_param = request.query_params.get("anio")
        try:
            anio = int(anio_param) if anio_param else datetime.now().year
        except (TypeError, ValueError):
            anio = datetime.now().year
        stats["estado_por_anio"] = compute_estado_stats(productos, entity.id, anio)
        stats["anio_seguimiento"] = anio
        return Response(stats)


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

        qs = productos_queryset_for_user(request.user, entity).order_by("codigo_producto")
        filterset = PdmProductoFilterSet(request.query_params, queryset=qs)
        qs = filterset.qs
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

    def get(self, request, slug: str, codigo_producto: str):
        entity = _entity_or_404(slug)
        _ensure_user_can_manage_entity(request.user, entity)
        if not user_can_access_producto(request.user, entity, codigo_producto):
            raise PermissionDenied("No tiene permisos para ver este producto.")
        anio_param = request.query_params.get("anio")
        try:
            anio = int(anio_param) if anio_param else datetime.now().year
        except (TypeError, ValueError):
            anio = datetime.now().year

        producto = get_object_or_404(
            productos_queryset_for_user(request.user, entity),
            codigo_producto=codigo_producto,
        )
        actividades = (
            actividades_queryset_for_user(request.user, entity)
            .filter(codigo_producto=codigo_producto)
            .prefetch_related("evidencia__archivos")
            .order_by("anio", "id")
        )
        setattr(producto, "pdm_actividades_filtradas", list(actividades))

        codigos = [producto.codigo_producto]
        aggs_map = actividad_aggs_for_productos(entity.id, codigos).get(producto.codigo_producto, {})
        metrics = producto_list_metrics(producto, anio, aggs_map)
        for key, value in metrics.items():
            setattr(producto, key, value)
        setattr(
            producto,
            "resumen_por_anio",
            {str(y): resumen_anio(producto, y, aggs_map.get(y)) for y in ANIOS_PDM},
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
        existing = {p.codigo_producto: p for p in PdmProducto.objects.filter(entity=entity)}
        codigos_excel = set()
        manual_fields = {"responsable_secretaria", "responsable_secretaria_nombre"}

        with transaction.atomic():
            for raw_item in payload["productos_plan_indicativo"]:
                codigo = str(raw_item.get("codigo_producto") or "").strip()
                if not codigo:
                    continue
                item = {**raw_item, "codigo_producto": codigo}
                codigos_excel.add(codigo)
                if codigo in existing:
                    prod = existing[codigo]
                    for field, value in item.items():
                        if field not in manual_fields:
                            setattr(prod, field, value)
                    prod.save()
                else:
                    prod = PdmProducto.objects.create(entity=entity, **item)
                    existing[codigo] = prod
            for codigo, prod in existing.items():
                if codigo not in codigos_excel:
                    prod.delete()
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
        return Response({"tiene_datos": total > 0, "total_productos": total, "fecha_ultima_carga": timezone.now()})


class PdmActividadCreateView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    parser_classes = [JSONParser]

    def post(self, request, slug: str):
        entity = _entity_or_404(slug)
        _ensure_user_can_manage_entity(request.user, entity)
        if not (_is_admin(request.user) or _is_secretario(request.user)):
            raise PermissionDenied("Sin permisos para crear actividades.")
        codigo = str(request.data.get("codigo_producto") or "").strip()
        if not user_can_access_producto(request.user, entity, codigo):
            raise PermissionDenied("No tiene permisos para este producto.")
        payload = request.data.copy()
        payload["fecha_inicio"] = _parse_iso_dt(payload.get("fecha_inicio"))
        payload["fecha_fin"] = _parse_iso_dt(payload.get("fecha_fin"))
        ser = PdmActividadSerializer(data=payload)
        ser.is_valid(raise_exception=True)
        actividad = PdmActividad.objects.create(entity=entity, **ser.validated_data)
        return Response(PdmActividadSerializer(actividad).data, status=status.HTTP_201_CREATED)


class PdmActividadesPorProductoView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, slug: str, codigo_producto: str):
        entity = _entity_or_404(slug)
        _ensure_user_can_manage_entity(request.user, entity)
        if not user_can_access_producto(request.user, entity, codigo_producto):
            raise PermissionDenied("No tiene permisos para este producto.")
        qs = actividades_queryset_for_user(request.user, entity).filter(codigo_producto=codigo_producto)
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
        if "fecha_inicio" in payload:
            payload["fecha_inicio"] = _parse_iso_dt(payload.get("fecha_inicio"))
        if "fecha_fin" in payload:
            payload["fecha_fin"] = _parse_iso_dt(payload.get("fecha_fin"))
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


class PdmAsignarResponsableView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def patch(self, request, slug: str, codigo_producto: str):
        entity = _entity_or_404(slug)
        _ensure_user_can_manage_entity(request.user, entity)
        if not _is_admin(request.user):
            raise PermissionDenied("Solo admin puede asignar responsables.")
        secretaria_id = request.query_params.get("responsable_secretaria_id")
        if not secretaria_id:
            raise ValidationError({"responsable_secretaria_id": "Parámetro requerido."})
        producto = get_object_or_404(
            productos_queryset_for_user(request.user, entity),
            codigo_producto=codigo_producto,
        )
        secretaria = get_object_or_404(Secretaria, id=secretaria_id, entity=entity)
        producto.responsable_secretaria = secretaria
        producto.responsable_secretaria_nombre = secretaria.nombre
        producto.save(update_fields=["responsable_secretaria", "responsable_secretaria_nombre", "updated_at"])
        return Response({"success": True, "producto_codigo": producto.codigo_producto, "responsable_secretaria_id": secretaria.id, "responsable_secretaria_nombre": secretaria.nombre})


class PdmEjecucionUploadView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]

    def post(self, request):
        require_user_module(request.user, "pdm", message="El módulo PDM no está habilitado para tu usuario.")
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
            rows = [
                PDMEjecucionPresupuestal(
                    entity_id=request.user.entity_id,
                    codigo_producto=item["codigo_producto"],
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
                for item in rows_data
            ]
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
    qs = PDMEjecucionPresupuestal.objects.filter(entity_id=user.entity_id)
    if _is_secretario(user) and not _is_admin(user) and user.entity_id:
        entity = Entity.objects.filter(id=user.entity_id).first()
        if entity:
            codigos = codigos_producto_for_user(user, entity)
            qs = qs.filter(codigo_producto__in=codigos) if codigos else qs.none()
    return qs


class PdmEjecucionResumenAnualEntidadView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        require_user_module(request.user, "pdm", message="El módulo PDM no está habilitado para tu usuario.")
        qs = _ejecucion_qs_for_user(request.user)
        grouped = defaultdict(lambda: {"pto_definitivo": 0.0, "pagos": 0.0})
        for row in qs:
            if not row.anio:
                continue
            grouped[int(row.anio)]["pto_definitivo"] += _to_float(row.pto_definitivo)
            grouped[int(row.anio)]["pagos"] += _to_float(row.pagos)
        anios = [{"anio": y, "pto_definitivo": grouped[y]["pto_definitivo"], "pagos": grouped[y]["pagos"]} for y in (2024, 2025, 2026, 2027)]
        return Response({"anios": anios, "totales": {"pto_definitivo": sum(x["pto_definitivo"] for x in anios), "pagos": sum(x["pagos"] for x in anios)}})


class PdmEjecucionProductoView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, codigo_producto: str):
        require_user_module(request.user, "pdm", message="El módulo PDM no está habilitado para tu usuario.")
        entity = get_object_or_404(Entity, id=request.user.entity_id)
        if not user_can_access_producto(request.user, entity, codigo_producto):
            raise PermissionDenied("No tiene permisos para este producto.")
        qs = _ejecucion_qs_for_user(request.user).filter(codigo_producto=codigo_producto)
        anio = request.query_params.get("anio")
        if anio:
            qs = qs.filter(anio=anio)
        if not qs.exists():
            return Response({"detail": f"No se encontró información de ejecución para {codigo_producto}"}, status=status.HTTP_404_NOT_FOUND)
        by_fte = defaultdict(lambda: {"pto_inicial": 0.0, "adicion": 0.0, "reduccion": 0.0, "credito": 0.0, "contracredito": 0.0, "pto_definitivo": 0.0, "pagos": 0.0})
        for row in qs:
            key = row.descripcion_fte or "Sin Fuente"
            by_fte[key]["pto_inicial"] += _to_float(row.pto_inicial)
            by_fte[key]["adicion"] += _to_float(row.adicion)
            by_fte[key]["reduccion"] += _to_float(row.reduccion)
            by_fte[key]["credito"] += _to_float(row.credito)
            by_fte[key]["contracredito"] += _to_float(row.contracredito)
            by_fte[key]["pto_definitivo"] += _to_float(row.pto_definitivo)
            by_fte[key]["pagos"] += _to_float(row.pagos)
        fuentes_detalle = []
        for k, v in sorted(by_fte.items(), key=lambda x: x[0]):
            item = {"nombre": k, "codigo_fuente": k if _looks_like_codigo_fuente(k) else None, **v}
            fuentes_detalle.append(item)
        totales = defaultdict(float)
        for f in fuentes_detalle:
            for key in ("pto_inicial", "adicion", "reduccion", "credito", "contracredito", "pto_definitivo", "pagos"):
                totales[key] += f[key]
        return Response({"codigo_producto": codigo_producto, "fuentes": [f["nombre"] for f in fuentes_detalle], "fuentes_detalle": fuentes_detalle, "totales": dict(totales)})


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
        with transaction.atomic():
            eliminados = PDMContratoRPS.objects.filter(entity=entity, anio=anio).delete()[0]
            nuevos = [
                PDMContratoRPS(
                    entity=entity,
                    codigo_producto=str(r["PRODUCTO"]),
                    no_crp=str(r["NO CRP"]),
                    concepto=str(r["CONCEPTO"]) or None,
                    valor=Decimal(str(_to_float(r["VALOR"]))),
                    contratista=str(r["CONTRATISTA"]) or None,
                    anio=int(r["AÑO"]),
                )
                for _, r in grouped.iterrows()
            ]
            PDMContratoRPS.objects.bulk_create(nuevos)
        contratos = list(PDMContratoRPS.objects.filter(entity=entity, anio=anio).order_by("codigo_producto", "no_crp"))
        return Response(
            {
                "mensaje": f"{len(contratos)} contratos RPS guardados para año {anio}",
                "registros_insertados": len(contratos),
                "registros_eliminados": eliminados,
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


class PdmContratosView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, slug: str):
        entity = _entity_or_404(slug)
        _ensure_user_can_manage_entity(request.user, entity)
        qs = PDMContratoRPS.objects.filter(entity=entity)
        if _is_secretario(request.user) and not _is_admin(request.user):
            codigos = codigos_producto_for_user(request.user, entity)
            qs = qs.filter(codigo_producto__in=codigos) if codigos else qs.none()
        anio = request.query_params.get("anio")
        codigo = request.query_params.get("codigo_producto")
        if anio:
            qs = qs.filter(anio=anio)
        if codigo:
            codigo = str(codigo).strip()
            if not user_can_access_producto(request.user, entity, codigo):
                raise PermissionDenied("No tiene permisos para este producto.")
            qs = qs.filter(codigo_producto=codigo)
        contratos = list(qs.order_by("codigo_producto", "no_crp"))
        return Response({"contratos": [{"id": c.id, "no_crp": c.no_crp, "codigo_producto": c.codigo_producto, "concepto": c.concepto, "valor": _to_float(c.valor), "contratista": c.contratista, "anio": c.anio} for c in contratos], "total_contratado": sum(_to_float(c.valor) for c in contratos), "cantidad_contratos": len(contratos), "anio": int(anio) if anio else (contratos[0].anio if contratos else 0)})

