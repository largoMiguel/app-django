"""Generación y almacenamiento de informes PQRS en B2."""
from __future__ import annotations

import datetime
import logging
from io import BytesIO

from django.conf import settings
from django.contrib.auth import get_user_model
from django.utils import timezone

from apps.common.b2_client import get_b2_client
from apps.common.storages import pqrs_storage_for_paths
from apps.pqrs.models import EstadoPQRS, InformePQRS, PQRS

from .report_ai import PQRSReportAIService, build_fallback_analysis
from .report_generator import PQRSReportGenerator

logger = logging.getLogger(__name__)
User = get_user_model()

OPEN_STATES = {
    EstadoPQRS.RECIBIDA,
    EstadoPQRS.ASIGNADA,
    EstadoPQRS.RECHAZADA_ASIGNACION,
}


def pqrs_to_dict(pqrs: PQRS) -> dict:
    dias_respuesta = None
    if pqrs.fecha_respuesta and pqrs.fecha_solicitud:
        dias_respuesta = (pqrs.fecha_respuesta - pqrs.fecha_solicitud).days
    return {
        "id": pqrs.id,
        "numero_radicado": pqrs.numero_radicado,
        "tipo_solicitud": pqrs.tipo_solicitud,
        "estado": pqrs.estado,
        "fecha_solicitud": pqrs.fecha_solicitud.isoformat() if pqrs.fecha_solicitud else None,
        "fecha_respuesta": pqrs.fecha_respuesta.isoformat() if pqrs.fecha_respuesta else None,
        "dias_respuesta": dias_respuesta,
        "asunto": pqrs.asunto,
        "assigned_to": {"full_name": pqrs.assigned_to.nombre} if pqrs.assigned_to else None,
    }


def build_report_analytics(pqrs_list: list[dict]) -> dict:
    total = len(pqrs_list)
    pendientes = len([p for p in pqrs_list if p["estado"] in OPEN_STATES])
    en_proceso = len([p for p in pqrs_list if p["estado"] == EstadoPQRS.EN_PROCESO])
    resueltas = len([p for p in pqrs_list if p["estado"] == EstadoPQRS.RESPONDIDA])
    cerradas = len([p for p in pqrs_list if p["estado"] == EstadoPQRS.CERRADA])

    tipos_pqrs: dict[str, int] = {}
    for pqrs in pqrs_list:
        tipo = pqrs["tipo_solicitud"]
        tipos_pqrs[tipo] = tipos_pqrs.get(tipo, 0) + 1

    tiempo_promedio = 0
    tiempos = [p["dias_respuesta"] for p in pqrs_list if p.get("dias_respuesta") and p["dias_respuesta"] > 0]
    if tiempos:
        tiempo_promedio = round(sum(tiempos) / len(tiempos))

    return {
        "totalPqrs": total,
        "pendientes": pendientes,
        "enProceso": en_proceso,
        "resueltas": resueltas,
        "cerradas": cerradas,
        "tasaResolucion": round(((resueltas + cerradas) / total * 100), 1) if total > 0 else 0,
        "tiempoPromedioRespuesta": tiempo_promedio,
        "tiposPqrs": tipos_pqrs,
    }


def _resolve_ai_analysis(
    *,
    usar_ia: bool,
    entity,
    analytics: dict,
    fecha_inicio: str,
    fecha_fin: str,
    pqrs_list: list[dict],
) -> tuple[dict, bool]:
    if usar_ia and entity.enable_ai_reports:
        try:
            service = PQRSReportAIService()
            return service.analizar_pqrs(
                analytics=analytics,
                entity_name=entity.name,
                fecha_inicio=fecha_inicio,
                fecha_fin=fecha_fin,
                pqrs_list=pqrs_list,
            ), True
        except Exception:
            logger.exception("Error generando análisis IA para informe PQRS")
    return build_fallback_analysis(analytics, entity.name, fecha_inicio, fecha_fin), False


def generate_informe_pqrs(
    *,
    entity,
    user,
    pqrs_queryset,
    fecha_inicio: datetime.date,
    fecha_fin: datetime.date,
    usar_ia: bool = True,
    usuario_firmante_id: int | None = None,
) -> InformePQRS:
    InformePQRS.purge_expired(entity_id=entity.id)

    pqrs_qs = (
        pqrs_queryset.select_related("assigned_to")
        .order_by("-fecha_solicitud", "-id")
    )
    if not pqrs_qs.exists():
        raise ValueError("No se encontraron PQRS en el rango de fechas seleccionado.")

    pqrs_list = [pqrs_to_dict(p) for p in pqrs_qs]
    analytics = build_report_analytics(pqrs_list)
    ai_analysis, used_ai = _resolve_ai_analysis(
        usar_ia=usar_ia,
        entity=entity,
        analytics=analytics,
        fecha_inicio=fecha_inicio.isoformat(),
        fecha_fin=fecha_fin.isoformat(),
        pqrs_list=pqrs_list,
    )

    usuario_firmante = None
    if usuario_firmante_id:
        usuario_firmante = User.objects.filter(pk=usuario_firmante_id, entity_id=entity.id).first()

    generator = PQRSReportGenerator(
        entity=entity,
        pqrs_list=pqrs_list,
        analytics=analytics,
        ai_analysis=ai_analysis,
        fecha_inicio=fecha_inicio.isoformat(),
        fecha_fin=fecha_fin.isoformat(),
        usuario_firmante=usuario_firmante,
    )
    pdf_buffer: BytesIO = generator.generate_pdf()
    pdf_content = pdf_buffer.read()

    timestamp = timezone.now().strftime("%Y%m%d_%H%M%S")
    filename = f"informe_pqrs_{fecha_inicio}_{fecha_fin}.pdf"
    b2_key = f"informes/{entity.id}/informe_{fecha_inicio}_{fecha_fin}_{timestamp}.pdf"

    storage = pqrs_storage_for_paths()
    storage.save(b2_key, BytesIO(pdf_content))

    expires_at = timezone.now() + datetime.timedelta(days=7)
    informe = InformePQRS.objects.create(
        entity=entity,
        created_by=user,
        filename=filename,
        b2_key=b2_key,
        file_size=len(pdf_content),
        fecha_inicio=fecha_inicio,
        fecha_fin=fecha_fin,
        total_pqrs=analytics["totalPqrs"],
        tasa_resolucion=analytics["tasaResolucion"],
        used_ai=used_ai,
        expires_at=expires_at,
    )
    return informe


def delete_informe(informe: InformePQRS) -> None:
    from apps.common.storage_cleanup import delete_pqrs_storage_key

    key = (informe.b2_key or "").lstrip("/")
    if key:
        delete_pqrs_storage_key(key)
        if not settings.USE_B2_STORAGE:
            storage = pqrs_storage_for_paths()
            if storage.exists(key):
                storage.delete(key)
    informe.delete()


def get_informe_file_bytes(informe: InformePQRS) -> bytes:
    if settings.USE_B2_STORAGE:
        client = get_b2_client()
        resp = client.get_object(Bucket=settings.B2_BUCKET_PQRS, Key=informe.b2_key)
        return resp["Body"].read()
    storage = pqrs_storage_for_paths()
    with storage.open(informe.b2_key, "rb") as fh:
        return fh.read()
