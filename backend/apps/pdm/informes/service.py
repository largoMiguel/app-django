"""Orquestación de generación y almacenamiento de informes PDM."""
from __future__ import annotations

import base64
import datetime
import logging
from io import BytesIO

from django.conf import settings
from django.contrib.auth import get_user_model
from django.utils import timezone
from PIL import Image, ImageOps

from apps.common.b2_client import get_b2_client
from apps.common.storages import pdm_storage_for_paths
from apps.pdm.access import productos_queryset_for_user
from apps.pdm.analytics import compute_pdm_analytics
from apps.pdm.models import InformePDM, InformePdmEstado, InformePdmTipo, PdmActividad, PdmProducto

from .types import storage_slug_for_tipo
from apps.pdm.stats import compute_estado_stats, compute_pdm_stats_from_queryset, productos_for_stats

from .report_ai import PdmReportAIService, build_fallback_analysis
from .report_generator import PDMReportGenerator

logger = logging.getLogger(__name__)
User = get_user_model()

STALE_PROCESSING_MINUTES = 30
EVIDENCIA_IMG_PX = (480, 480)
EVIDENCIA_JPEG_QUALITY = 82


def _normalize_evidencia_image(raw: bytes) -> str:
    """Redimensiona cualquier evidencia a un tamaño fijo (cuadrado)."""
    out = BytesIO()
    with Image.open(BytesIO(raw)) as img:
        img = img.convert("RGB")
        img = ImageOps.fit(img, EVIDENCIA_IMG_PX, method=Image.Resampling.LANCZOS)
        img.save(out, format="JPEG", quality=EVIDENCIA_JPEG_QUALITY, optimize=True)
    encoded = base64.b64encode(out.getvalue()).decode("ascii")
    return f"data:image/jpeg;base64,{encoded}"


def mark_stale_processing_informes(entity_id: int) -> int:
    """Marca como ERROR informes atascados en PROCESANDO."""
    cutoff = timezone.now() - datetime.timedelta(minutes=STALE_PROCESSING_MINUTES)
    qs = InformePDM.objects.filter(
        entity_id=entity_id,
        estado=InformePdmEstado.PROCESANDO,
        started_at__lt=cutoff,
    )
    updated = 0
    for informe in qs:
        informe.estado = InformePdmEstado.ERROR
        informe.error_detail = "Tiempo de generación excedido (worker no respondió)."
        informe.finished_at = timezone.now()
        informe.save(update_fields=["estado", "error_detail", "finished_at"])
        updated += 1
    return updated


def has_active_informe(entity_id: int, tipo: str = InformePdmTipo.AVANCE) -> bool:
    mark_stale_processing_informes(entity_id)
    return InformePDM.objects.filter(
        entity_id=entity_id,
        tipo=tipo,
        estado__in=[InformePdmEstado.PENDIENTE, InformePdmEstado.PROCESANDO],
    ).exists()


def _resolve_ai_analysis(
    *,
    usar_ia: bool,
    entity,
    analytics: dict,
    anio: int,
    secretaria_nombre: str | None,
) -> dict:
    if usar_ia and entity.enable_ai_reports:
        try:
            service = PdmReportAIService()
            return service.analizar_pdm(analytics, entity.name, anio, secretaria_nombre)
        except Exception:
            logger.exception("Error generando análisis IA para informe PDM")
    return build_fallback_analysis(analytics, entity.name, anio, secretaria_nombre)


def _prepare_actividades(
    entity_id: int,
    claves: list[str],
    anio: int,
    incluir_evidencias: bool,
) -> list[PdmActividad]:
    actividades_qs = (
        PdmActividad.objects.filter(entity_id=entity_id, clave_producto__in=claves)
        .select_related("evidencia", "responsable_secretaria")
        .prefetch_related("evidencia__archivos")
        .order_by("clave_producto", "id")
    )
    if anio != 0:
        actividades_qs = actividades_qs.filter(anio=anio)

    actividades = list(actividades_qs)
    for act in actividades:
        act.tiene_evidencia = hasattr(act, "evidencia") and act.evidencia is not None
        if act.tiene_evidencia and incluir_evidencias:
            imagenes: list[str] = []
            for arch in act.evidencia.archivos.all():
                try:
                    with arch.archivo.open("rb") as fh:
                        imagenes.append(_normalize_evidencia_image(fh.read()))
                except Exception:
                    logger.warning("No se pudo cargar evidencia para actividad %s", act.id)
            act.evidencia.imagenes = imagenes
    return actividades


def _gather_report_data(informe: InformePDM) -> dict:
    entity = informe.entity
    user = informe.created_by
    anio = informe.anio
    productos_qs = productos_queryset_for_user(user, entity).select_related("responsable_secretaria")
    if informe.responsable_secretaria_id:
        productos_qs = productos_qs.filter(responsable_secretaria_id=informe.responsable_secretaria_id)

    productos = list(productos_qs.order_by("codigo_producto", "clave_producto"))
    if not productos:
        raise ValueError("No hay productos PDM para generar el informe con los filtros seleccionados.")

    claves = [p.clave_producto for p in productos]
    actividades = _prepare_actividades(entity.id, claves, anio, informe.incluir_evidencias)

    lineas_count = productos_qs.values("linea_estrategica").distinct().count()
    iniciativas_count = 0
    stats = compute_pdm_stats_from_queryset(productos_qs, iniciativas_count, lineas_count)
    estado_stats = compute_estado_stats(productos, entity.id, anio)
    analytics = compute_pdm_analytics(productos_qs, entity.id, anio, include_por_secretaria=True)

    secretaria_nombre = None
    if informe.responsable_secretaria_id:
        secretaria_nombre = informe.responsable_secretaria.nombre

    ai_analysis = _resolve_ai_analysis(
        usar_ia=informe.usar_ia,
        entity=entity,
        analytics=analytics,
        anio=anio,
        secretaria_nombre=secretaria_nombre,
    )

    pres = analytics.get("presupuesto", {})
    pct_fin = 0.0
    if pres.get("pto_definitivo"):
        pct_fin = round((pres.get("pagos", 0) / pres["pto_definitivo"]) * 100, 1)

    filtros: dict = {}
    if secretaria_nombre:
        filtros["secretarias"] = [secretaria_nombre]

    return {
        "productos": productos,
        "actividades": actividades,
        "stats": stats,
        "estado_stats": estado_stats,
        "analytics": analytics,
        "ai_analysis": ai_analysis,
        "secretaria_nombre": secretaria_nombre,
        "filtros": filtros,
        "avance_fisico": analytics.get("avance_global", 0),
        "avance_financiero": pct_fin,
        "total_productos": analytics.get("total_productos", 0),
    }


def generate_informe_pdm_pdf(informe: InformePDM) -> bytes:
    data = _gather_report_data(informe)
    generator = PDMReportGenerator(
        entity=informe.entity,
        productos=data["productos"],
        actividades=data["actividades"],
        anio=informe.anio,
        filtros=data["filtros"],
        usar_ia=informe.usar_ia and informe.entity.enable_ai_reports,
        incluir_evidencias=informe.incluir_evidencias,
        ai_analysis=data["ai_analysis"],
        analytics=data["analytics"],
    )
    pdf_buffer = generator.generate_pdf()
    informe.total_productos = data["total_productos"]
    informe.avance_fisico = data["avance_fisico"]
    informe.avance_financiero = data["avance_financiero"]
    return pdf_buffer.read()


def run_informe_pdm_generation(informe_id: int) -> None:
    informe = InformePDM.objects.select_related("entity", "created_by", "usuario_firmante", "responsable_secretaria").get(
        pk=informe_id
    )
    informe.estado = InformePdmEstado.PROCESANDO
    informe.started_at = timezone.now()
    informe.error_detail = ""
    informe.save(update_fields=["estado", "started_at", "error_detail"])

    try:
        pdf_content = generate_informe_pdm_pdf(informe)
        timestamp = timezone.now().strftime("%Y%m%d_%H%M%S")
        sec_suffix = f"_sec{informe.responsable_secretaria_id}" if informe.responsable_secretaria_id else ""
        tipo_slug = storage_slug_for_tipo(informe.tipo)
        filename = f"informe_{tipo_slug}_pdm_{informe.anio}{sec_suffix}.pdf"
        b2_key = f"informes/{informe.entity_id}/{tipo_slug}/informe_{tipo_slug}_pdm_{informe.anio}{sec_suffix}_{timestamp}.pdf"

        storage = pdm_storage_for_paths()
        storage.save(b2_key, BytesIO(pdf_content))

        informe.filename = filename
        informe.b2_key = b2_key
        informe.file_size = len(pdf_content)
        informe.estado = InformePdmEstado.COMPLETADO
        informe.finished_at = timezone.now()
        informe.save(
            update_fields=[
                "filename",
                "b2_key",
                "file_size",
                "estado",
                "finished_at",
                "total_productos",
                "avance_fisico",
                "avance_financiero",
            ]
        )
    except Exception as exc:
        logger.exception("Error generando informe PDM %s", informe_id)
        informe.estado = InformePdmEstado.ERROR
        informe.error_detail = str(exc)[:2000]
        informe.finished_at = timezone.now()
        informe.save(update_fields=["estado", "error_detail", "finished_at"])
        raise


def delete_informe(informe: InformePDM) -> None:
    from apps.common.storage_cleanup import delete_pdm_storage_key

    key = (informe.b2_key or "").lstrip("/")
    if key:
        delete_pdm_storage_key(key)
        if not settings.USE_B2_STORAGE:
            storage = pdm_storage_for_paths()
            if storage.exists(key):
                storage.delete(key)
    informe.delete()


def get_informe_file_bytes(informe: InformePDM) -> bytes:
    if settings.USE_B2_STORAGE:
        client = get_b2_client()
        resp = client.get_object(Bucket=settings.B2_BUCKET_PDM, Key=informe.b2_key)
        return resp["Body"].read()
    storage = pdm_storage_for_paths()
    with storage.open(informe.b2_key, "rb") as fh:
        return fh.read()
