"""Orquestación de generación y almacenamiento de informes Planes Institucionales."""
from __future__ import annotations

import base64
import datetime
import logging
from collections import defaultdict
from io import BytesIO

from django.conf import settings
from django.utils import timezone
from PIL import Image, ImageOps

from apps.common.b2_client import get_b2_client
from apps.common.storages import planes_storage_for_paths
from apps.planes.access import actividades_queryset_for_user, planes_queryset_for_user
from apps.planes.evidencia_sync import compute_avance_pct, total_ejecutado
from apps.planes.models import InformePlan, InformePlanEstado, PlanCatalogo, PlanInstitucional
from apps.planes.stats import compute_plan_stats

from .report_ai import PlanesReportAIService, build_fallback_analysis
from .report_generator import PlanesReportGenerator
from .types import storage_slug_for_tipo

logger = logging.getLogger(__name__)

STALE_PROCESSING_MINUTES = 30
EVIDENCIA_IMG_PX = (480, 480)
EVIDENCIA_JPEG_QUALITY = 82


def _normalize_evidencia_image(raw: bytes) -> str:
    out = BytesIO()
    with Image.open(BytesIO(raw)) as img:
        img = img.convert("RGB")
        img = ImageOps.fit(img, EVIDENCIA_IMG_PX, method=Image.Resampling.LANCZOS)
        img.save(out, format="JPEG", quality=EVIDENCIA_JPEG_QUALITY, optimize=True)
    encoded = base64.b64encode(out.getvalue()).decode("ascii")
    return f"data:image/jpeg;base64,{encoded}"


def mark_stale_processing_informes(entity_id: int) -> int:
    cutoff = timezone.now() - datetime.timedelta(minutes=STALE_PROCESSING_MINUTES)
    qs = InformePlan.objects.filter(
        entity_id=entity_id,
        estado=InformePlanEstado.PROCESANDO,
        started_at__lt=cutoff,
    )
    updated = 0
    for informe in qs:
        informe.estado = InformePlanEstado.ERROR
        informe.error_detail = "Tiempo de generación excedido (worker no respondió)."
        informe.finished_at = timezone.now()
        informe.save(update_fields=["estado", "error_detail", "finished_at"])
        updated += 1
    return updated


def has_active_informe(entity_id: int, tipo: str) -> bool:
    mark_stale_processing_informes(entity_id)
    return InformePlan.objects.filter(
        entity_id=entity_id,
        tipo=tipo,
        estado__in=[InformePlanEstado.PENDIENTE, InformePlanEstado.PROCESANDO],
    ).exists()


def _prepare_actividades_evidencias(actividades, incluir_evidencias: bool) -> None:
    for act in actividades:
        act.total_ejecutado_val = float(total_ejecutado(act))
        act.avance_calculado = compute_avance_pct(act)
        act.tiene_evidencia = act.evidencias.exists()
        act.imagenes_evidencia: list[str] = []
        if incluir_evidencias and act.tiene_evidencia:
            for ev in act.evidencias.all():
                for arch in ev.archivos.all():
                    ct = (arch.content_type or "").lower()
                    if not ct.startswith("image/"):
                        continue
                    try:
                        with arch.archivo.open("rb") as fh:
                            act.imagenes_evidencia.append(_normalize_evidencia_image(fh.read()))
                    except Exception:
                        logger.warning("No se pudo cargar evidencia imagen actividad %s", act.id)


def _resolve_ai_analysis(
    *,
    usar_ia: bool,
    entity,
    analytics: dict,
    anio: int,
    trimestre: int,
    trimestre_label: str,
    secretaria_nombre: str | None,
) -> dict:
    if usar_ia and entity.enable_ai_reports:
        try:
            service = PlanesReportAIService()
            return service.analizar_planes(
                analytics, entity.name, anio, trimestre, trimestre_label, secretaria_nombre
            )
        except Exception:
            logger.exception("Error generando análisis IA para informe Planes")
    return build_fallback_analysis(analytics, entity.name, anio, trimestre_label, secretaria_nombre)


def _gather_report_data(informe: InformePlan) -> dict:
    entity = informe.entity
    user = informe.created_by
    anio = informe.anio
    trimestre = informe.trimestre

    planes_qs = planes_queryset_for_user(user, entity).filter(anio=anio)
    if informe.plan_id:
        planes_qs = planes_qs.filter(pk=informe.plan_id)
    if informe.responsable_secretaria_id:
        planes_qs = planes_qs.filter(responsable_secretaria_id=informe.responsable_secretaria_id)

    planes = list(planes_qs.order_by("catalogo__orden", "id"))
    if not planes:
        raise ValueError("No hay planes institucionales para generar el informe con los filtros seleccionados.")

    act_qs = (
        actividades_queryset_for_user(user, entity)
        .filter(anio=anio, trimestre=trimestre, plan_id__in=[p.id for p in planes])
        .order_by("plan__catalogo__orden", "plan_id", "id")
    )
    actividades = list(act_qs)
    if not actividades:
        raise ValueError("No hay actividades para el trimestre seleccionado con los filtros indicados.")

    _prepare_actividades_evidencias(actividades, informe.incluir_evidencias)

    stats = compute_plan_stats(user, entity, anio=anio)
    if informe.plan_id:
        stats["planes_total"] = len(planes)
    if informe.responsable_secretaria_id:
        stats["planes_sin_responsable"] = sum(1 for p in planes if not p.responsable_secretaria_id)

    d612_catalog_ids = set(
        PlanCatalogo.objects.filter(entity__isnull=True, es_decreto612=True, is_active=True).values_list("id", flat=True)
    )
    planes_d612_creados = PlanInstitucional.objects.filter(
        entity=entity, anio=anio, catalogo_id__in=d612_catalog_ids
    ).count()
    stats["planes_d612_creados"] = planes_d612_creados
    stats["actividades_sin_evidencia"] = sum(1 for a in actividades if not a.tiene_evidencia)

    secretaria_nombre = None
    if informe.responsable_secretaria_id:
        secretaria_nombre = informe.responsable_secretaria.nombre

    from apps.planes.informes.narrativa import trimestre_label

    tri_label = trimestre_label(trimestre)
    ai_analysis = _resolve_ai_analysis(
        usar_ia=informe.usar_ia,
        entity=entity,
        analytics=stats,
        anio=anio,
        trimestre=trimestre,
        trimestre_label=tri_label,
        secretaria_nombre=secretaria_nombre,
    )

    actividades_por_plan: dict[int, list] = defaultdict(list)
    for act in actividades:
        actividades_por_plan[act.plan_id].append(act)

    avance_promedio = 0.0
    if actividades:
        avance_promedio = round(sum(a.avance_calculado for a in actividades) / len(actividades), 1)

    firmante_nombre = ""
    cargo_firmante = informe.cargo_firmante or ""
    if informe.usuario_firmante_id:
        firmante_nombre = informe.usuario_firmante.full_name or informe.usuario_firmante.email
        if not cargo_firmante:
            cargo_firmante = secretaria_nombre or "Funcionario responsable"

    return {
        "planes": planes,
        "actividades": actividades,
        "actividades_por_plan": dict(actividades_por_plan),
        "stats": stats,
        "ai_analysis": ai_analysis,
        "secretaria_nombre": secretaria_nombre,
        "trimestre_label": tri_label,
        "firmante_nombre": firmante_nombre,
        "cargo_firmante": cargo_firmante,
        "total_planes": len(planes),
        "total_actividades": len(actividades),
        "avance_promedio": avance_promedio,
    }


def generate_informe_plan_pdf(informe: InformePlan) -> bytes:
    data = _gather_report_data(informe)
    generator = PlanesReportGenerator(
        entity=informe.entity,
        informe=informe,
        planes=data["planes"],
        actividades_por_plan=data["actividades_por_plan"],
        anio=informe.anio,
        trimestre=informe.trimestre,
        trimestre_label=data["trimestre_label"],
        secretaria_nombre=data["secretaria_nombre"],
        stats=data["stats"],
        ai_analysis=data["ai_analysis"],
        firmante_nombre=data["firmante_nombre"],
        cargo_firmante=data["cargo_firmante"],
        incluir_evidencias=informe.incluir_evidencias,
    )
    pdf_buffer = generator.generate_pdf()
    informe.total_planes = data["total_planes"]
    informe.total_actividades = data["total_actividades"]
    informe.avance_promedio = data["avance_promedio"]
    return pdf_buffer.read()


def run_informe_plan_generation(informe_id: int) -> None:
    informe = InformePlan.objects.select_related(
        "entity", "created_by", "usuario_firmante", "responsable_secretaria", "plan", "plan__catalogo"
    ).get(pk=informe_id)
    informe.estado = InformePlanEstado.PROCESANDO
    informe.started_at = timezone.now()
    informe.error_detail = ""
    informe.save(update_fields=["estado", "started_at", "error_detail"])

    try:
        pdf_content = generate_informe_plan_pdf(informe)
        timestamp = timezone.now().strftime("%Y%m%d_%H%M%S")
        sec_suffix = f"_sec{informe.responsable_secretaria_id}" if informe.responsable_secretaria_id else ""
        plan_suffix = f"_plan{informe.plan_id}" if informe.plan_id else ""
        tipo_slug = storage_slug_for_tipo(informe.tipo)
        filename = f"informe_{tipo_slug}_d612_{informe.anio}_T{informe.trimestre}{sec_suffix}.pdf"
        b2_key = (
            f"informes/{informe.entity_id}/{tipo_slug}/"
            f"informe_{tipo_slug}_d612_{informe.anio}_T{informe.trimestre}{sec_suffix}{plan_suffix}_{timestamp}.pdf"
        )

        storage = planes_storage_for_paths()
        storage.save(b2_key, BytesIO(pdf_content))

        informe.filename = filename
        informe.b2_key = b2_key
        informe.file_size = len(pdf_content)
        informe.estado = InformePlanEstado.COMPLETADO
        informe.finished_at = timezone.now()
        informe.save(
            update_fields=[
                "filename",
                "b2_key",
                "file_size",
                "estado",
                "finished_at",
                "total_planes",
                "total_actividades",
                "avance_promedio",
            ]
        )
    except Exception as exc:
        logger.exception("Error generando informe Planes %s", informe_id)
        informe.estado = InformePlanEstado.ERROR
        informe.error_detail = str(exc)[:2000]
        informe.finished_at = timezone.now()
        informe.save(update_fields=["estado", "error_detail", "finished_at"])
        raise


def delete_informe(informe: InformePlan) -> None:
    from apps.common.storage_cleanup import delete_planes_storage_key

    key = (informe.b2_key or "").lstrip("/")
    if key:
        delete_planes_storage_key(key)
        if not settings.USE_B2_STORAGE:
            storage = planes_storage_for_paths()
            if storage.exists(key):
                storage.delete(key)
    informe.delete()


def get_informe_file_bytes(informe: InformePlan) -> bytes:
    if settings.USE_B2_STORAGE:
        client = get_b2_client()
        resp = client.get_object(Bucket=settings.B2_BUCKET_PLANES, Key=informe.b2_key)
        return resp["Body"].read()
    storage = planes_storage_for_paths()
    with storage.open(informe.b2_key, "rb") as fh:
        return fh.read()
