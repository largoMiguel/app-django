"""Orquestación de generación y almacenamiento de informes PDM."""
from __future__ import annotations

import datetime
import logging
from io import BytesIO

from django.conf import settings
from django.contrib.auth import get_user_model
from django.utils import timezone
from PIL import Image

from apps.common.b2_client import get_b2_client
from apps.common.storages import pdm_storage_for_paths
from apps.pdm.access import productos_queryset_for_user
from apps.pdm.analytics import compute_pdm_analytics
from apps.pdm.ejecucion_resumen import ejecucion_por_codigo
from apps.pdm.metrics import actividad_aggs_for_productos, resumen_anio
from apps.pdm.models import InformePDM, InformePdmEstado, PDMContratoRPS, PdmActividad, PdmProducto
from apps.pdm.stats import compute_estado_stats, compute_pdm_stats_from_queryset, productos_for_stats

from .report_ai import PdmReportAIService, build_fallback_analysis
from .report_generator import PdmReportGenerator

logger = logging.getLogger(__name__)
User = get_user_model()

STALE_PROCESSING_MINUTES = 30
MAX_EVIDENCIA_IMAGENES = 2
EVIDENCIA_MAX_WIDTH = 800


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


def has_active_informe(entity_id: int) -> bool:
    mark_stale_processing_informes(entity_id)
    return InformePDM.objects.filter(
        entity_id=entity_id,
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


def _resize_image_bytes(raw: bytes) -> BytesIO:
    buf = BytesIO()
    try:
        with Image.open(BytesIO(raw)) as img:
            img = img.convert("RGB")
            w, h = img.size
            if w > EVIDENCIA_MAX_WIDTH:
                ratio = EVIDENCIA_MAX_WIDTH / w
                img = img.resize((EVIDENCIA_MAX_WIDTH, int(h * ratio)), Image.Resampling.LANCZOS)
            img.save(buf, format="JPEG", quality=75, optimize=True)
    except Exception:
        buf = BytesIO(raw)
    buf.seek(0)
    return buf


def _load_evidencia_image(archivo_field) -> BytesIO | None:
    if not archivo_field:
        return None
    try:
        with archivo_field.open("rb") as fh:
            return _resize_image_bytes(fh.read())
    except Exception:
        logger.warning("No se pudo cargar evidencia: %s", archivo_field)
        return None


def _build_productos_detalle(
    productos: list[PdmProducto],
    entity_id: int,
    anio: int,
    incluir_evidencias: bool,
) -> list[dict]:
    codigos = [p.codigo_producto for p in productos]
    aggs_map = actividad_aggs_for_productos(entity_id, codigos)
    ejec_map = ejecucion_por_codigo(entity_id, codigos, anio)
    contratos_map: dict[str, list] = {}
    for ctr in PDMContratoRPS.objects.filter(entity_id=entity_id, anio=anio, codigo_producto__in=codigos):
        contratos_map.setdefault(str(ctr.codigo_producto).strip(), []).append(
            {
                "no_crp": ctr.no_crp,
                "concepto": ctr.concepto,
                "valor": float(ctr.valor or 0),
                "contratista": ctr.contratista,
            }
        )

    actividades_qs = (
        PdmActividad.objects.filter(entity_id=entity_id, anio=anio, codigo_producto__in=codigos)
        .select_related("evidencia")
        .prefetch_related("evidencia__archivos")
        .order_by("codigo_producto", "id")
    )
    actividades_by_codigo: dict[str, list] = {}
    for act in actividades_qs:
        evidencia_imgs: list[BytesIO] = []
        if incluir_evidencias and hasattr(act, "evidencia") and act.evidencia:
            for arch in act.evidencia.archivos.all()[:MAX_EVIDENCIA_IMAGENES]:
                img = _load_evidencia_image(arch.archivo)
                if img:
                    evidencia_imgs.append(img)
        actividades_by_codigo.setdefault(act.codigo_producto, []).append(
            {
                "nombre": act.nombre,
                "estado": act.estado,
                "meta_ejecutar": act.meta_ejecutar,
                "descripcion": act.descripcion,
                "informe": getattr(act.evidencia, "descripcion", None) if hasattr(act, "evidencia") and act.evidencia else None,
                "evidencia_imagenes": evidencia_imgs,
            }
        )

    detalle: list[dict] = []
    for p in productos:
        aggs = aggs_map.get(p.codigo_producto, {})
        resumen = resumen_anio(p, anio, aggs)
        ej = ejec_map.get(p.codigo_producto, {"pagos": 0.0})
        indicador = p.personalizacion_indicador or p.indicador_producto_mga or p.producto_mga or ""
        acts = actividades_by_codigo.get(p.codigo_producto, [])
        evidencia_imgs: list[BytesIO] = []
        if incluir_evidencias:
            for act in acts:
                for img in act.get("evidencia_imagenes", []):
                    if len(evidencia_imgs) >= MAX_EVIDENCIA_IMAGENES:
                        break
                    evidencia_imgs.append(img)
                if len(evidencia_imgs) >= MAX_EVIDENCIA_IMAGENES:
                    break
        responsable = p.responsable_secretaria_nombre or "Sin asignar"
        if not p.responsable_secretaria_nombre and p.responsable_usuario_id:
            responsable = "Usuario asignado"
        detalle.append(
            {
                "codigo_producto": p.codigo_producto,
                "indicador": indicador,
                "meta_programada": resumen.get("meta_programada", 0),
                "meta_ejecutada": resumen.get("meta_ejecutada", 0),
                "avance_pct": resumen.get("porcentaje_avance", 0),
                "recursos_ejecutados": ej.get("pagos", 0),
                "responsable": responsable,
                "actividades": [{k: v for k, v in a.items() if k != "evidencia_imagenes"} for a in acts],
                "contratos": contratos_map.get(p.codigo_producto, []),
                "evidencia_imagenes": evidencia_imgs,
            }
        )
    return detalle


def _gather_report_data(informe: InformePDM) -> dict:
    entity = informe.entity
    user = informe.created_by
    anio = informe.anio
    productos_qs = productos_queryset_for_user(user, entity)
    if informe.responsable_secretaria_id:
        productos_qs = productos_qs.filter(responsable_secretaria_id=informe.responsable_secretaria_id)
    productos = productos_for_stats(productos_qs)
    if not productos:
        raise ValueError("No hay productos PDM para generar el informe con los filtros seleccionados.")

    lineas_count = productos_qs.values("linea_estrategica").distinct().count()
    iniciativas_count = 0
    stats = compute_pdm_stats_from_queryset(productos_qs, iniciativas_count, lineas_count)
    estado_stats = compute_estado_stats(productos, entity.id, anio)
    analytics = compute_pdm_analytics(productos_qs, entity.id, anio, include_por_secretaria=True)

    secretaria_nombre = None
    if informe.responsable_secretaria_id:
        secretaria_nombre = informe.responsable_secretaria.nombre

    nombre_plan = next((p.nombre_plan for p in productos if p.nombre_plan), None)

    ai_analysis = _resolve_ai_analysis(
        usar_ia=informe.usar_ia,
        entity=entity,
        analytics=analytics,
        anio=anio,
        secretaria_nombre=secretaria_nombre,
    )

    productos_detalle = _build_productos_detalle(productos, entity.id, anio, informe.incluir_evidencias)

    pres = analytics.get("presupuesto", {})
    pct_fin = 0.0
    if pres.get("pto_definitivo"):
        pct_fin = round((pres.get("pagos", 0) / pres["pto_definitivo"]) * 100, 1)

    return {
        "stats": stats,
        "estado_stats": estado_stats,
        "analytics": analytics,
        "ai_analysis": ai_analysis,
        "productos_detalle": productos_detalle,
        "secretaria_nombre": secretaria_nombre,
        "nombre_plan": nombre_plan,
        "avance_fisico": analytics.get("avance_global", 0),
        "avance_financiero": pct_fin,
        "total_productos": analytics.get("total_productos", 0),
    }


def generate_informe_pdm_pdf(informe: InformePDM) -> bytes:
    data = _gather_report_data(informe)
    usuario_firmante = informe.usuario_firmante
    generator = PdmReportGenerator(
        entity=informe.entity,
        anio=informe.anio,
        analytics=data["analytics"],
        stats=data["stats"],
        estado_stats=data["estado_stats"],
        productos_detalle=data["productos_detalle"],
        ai_analysis=data["ai_analysis"],
        usuario_firmante=usuario_firmante,
        secretaria_nombre=data["secretaria_nombre"],
        nombre_plan=data["nombre_plan"],
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
        filename = f"informe_pdm_{informe.anio}{sec_suffix}.pdf"
        b2_key = f"informes/{informe.entity_id}/informe_pdm_{informe.anio}{sec_suffix}_{timestamp}.pdf"

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
