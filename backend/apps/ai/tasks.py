"""Tareas Celery para IA: embeddings, alertas, reportes, OCR."""
from __future__ import annotations

import logging

from celery import shared_task
from django.utils import timezone

logger = logging.getLogger(__name__)


@shared_task(bind=True, max_retries=2, default_retry_delay=60)
def index_pqrs_embedding(self, pqrs_id: int):
    """Indexa PQRS en pgvector."""
    from apps.pqrs.models import PQRS
    from apps.ai.models import ContentEmbedding
    from apps.ai.services.embeddings import index_text

    try:
        pqrs = PQRS.objects.select_related("entity").get(id=pqrs_id)
    except PQRS.DoesNotExist:
        return

    texto = f"{pqrs.asunto}\n{pqrs.descripcion}"
    if pqrs.respuesta:
        index_text(
            pqrs.entity_id,
            ContentEmbedding.ContentType.PQRS_RESPUESTA,
            pqrs.id,
            pqrs.respuesta,
            {"numero_radicado": pqrs.numero_radicado},
        )

    index_text(
        pqrs.entity_id,
        ContentEmbedding.ContentType.PQRS_DESCRIPCION,
        pqrs.id,
        texto,
        {"numero_radicado": pqrs.numero_radicado, "tipo": pqrs.tipo_solicitud},
    )


@shared_task(bind=True, max_retries=2)
def index_pdm_evidencia_embedding(self, evidencia_id: int):
    """Indexa evidencia PDM."""
    from apps.pdm.models import PdmActividadEvidencia
    from apps.ai.models import ContentEmbedding
    from apps.ai.services.embeddings import index_text

    try:
        evidencia = PdmActividadEvidencia.objects.select_related(
            "actividad"
        ).get(id=evidencia_id)
    except PdmActividadEvidencia.DoesNotExist:
        return

    actividad = evidencia.actividad
    from apps.pdm.models import PdmProducto
    producto = PdmProducto.objects.filter(
        codigo_producto=actividad.codigo_producto,
    ).first()
    if not producto:
        return

    texto = f"{actividad.nombre}\n{evidencia.descripcion or ''}"
    index_text(
        producto.entity_id,
        ContentEmbedding.ContentType.PDM_EVIDENCIA,
        evidencia.id,
        texto,
        {"codigo_producto": actividad.codigo_producto},
    )


@shared_task
def compute_all_sla_risk_scores():
    """Calcula scores SLA para todas las entidades y crea alertas."""
    from apps.entities.models import Entity
    from apps.ai.models import AIAlert
    from apps.ai.services.pqrs_compliance import compute_sla_risk_scores

    for entity in Entity.objects.filter(enable_pqrs=True):
        risks = compute_sla_risk_scores(entity.id)
        for risk in risks[:20]:
            if risk["risk_score"] >= 50:
                AIAlert.objects.update_or_create(
                    entity_id=entity.id,
                    alert_type=AIAlert.AlertType.PQRS_SLA_RISK,
                    object_type="pqrs",
                    object_id=risk["pqrs_id"],
                    defaults={
                        "severity": (
                            AIAlert.Severity.CRITICAL if risk["risk_score"] >= 80
                            else AIAlert.Severity.HIGH if risk["risk_score"] >= 60
                            else AIAlert.Severity.MEDIUM
                        ),
                        "title": f"Riesgo SLA: {risk['numero_radicado']}",
                        "message": "; ".join(risk["factors"]),
                        "score": risk["risk_score"],
                        "metadata": risk,
                        "is_dismissed": False,
                    },
                )


@shared_task
def detect_all_pdm_anomalies():
    """Detecta anomalías PDM para todas las entidades."""
    from apps.entities.models import Entity
    from apps.ai.models import AIAlert
    from apps.ai.services.pdm_anomalies import detect_pdm_anomalies

    for entity in Entity.objects.filter(enable_pdm=True):
        anomalies = detect_pdm_anomalies(entity.id)
        for anomaly in anomalies[:15]:
            if anomaly.get("score", 0) >= 50:
                AIAlert.objects.update_or_create(
                    entity_id=entity.id,
                    alert_type=AIAlert.AlertType.PDM_ANOMALY,
                    title=anomaly["title"],
                    defaults={
                        "severity": (
                            AIAlert.Severity.HIGH if anomaly.get("severity") == "high"
                            else AIAlert.Severity.MEDIUM
                        ),
                        "message": anomaly["message"],
                        "score": anomaly.get("score"),
                        "object_type": "pdm_producto",
                        "metadata": anomaly,
                        "is_dismissed": False,
                    },
                )


@shared_task
def reindex_all_embeddings(entity_id: int | None = None):
    """Reindexa embeddings de PQRS (toda la entidad o todas las entidades)."""
    from apps.pqrs.models import PQRS

    qs = PQRS.objects.all().order_by("-id")
    if entity_id:
        qs = qs.filter(entity_id=entity_id)
    pqrs_ids = qs.values_list("id", flat=True)[:2000]
    logger.info("Reindexando %d PQRS (entity_id=%s)", len(pqrs_ids), entity_id)
    for pqrs_id in pqrs_ids:
        index_pqrs_embedding.delay(pqrs_id)


@shared_task(bind=True, max_retries=2)
def generate_pdm_report_task(self, entity_id: int, anio: int, user_id: int | None = None):
    """Genera reporte narrativo PDM en background."""
    from apps.ai.services.reports import generate_pdm_narrative_report
    from apps.ai.models import AIAlert

    report = generate_pdm_narrative_report(entity_id, anio=anio)
    AIAlert.objects.create(
        entity_id=entity_id,
        alert_type=AIAlert.AlertType.INSIGHT,
        severity=AIAlert.Severity.LOW,
        title=f"Informe PDM {anio} generado",
        message=report["narrative"][:500],
        metadata={"full_report": report, "type": "pdm_narrative_report"},
    )
    return report


@shared_task(bind=True, max_retries=2)
def ocr_pqrs_archivo(self, archivo_id: int):
    """OCR de archivo PQRS escaneado."""
    from apps.pqrs.models import PQRSArchivo
    from apps.ai.services.ocr import extract_text_from_image, extract_text_from_pdf_scanned
    from apps.pqrs.services.ai import extract_text_from_file

    try:
        archivo = PQRSArchivo.objects.select_related("pqrs").get(id=archivo_id)
    except PQRSArchivo.DoesNotExist:
        return

    archivo.archivo.open("rb")
    content = archivo.archivo.read()
    archivo.archivo.close()

    name = (archivo.nombre_original or "").lower()
    text = extract_text_from_file(archivo.nombre_original or "", content)
    if not text and name.endswith((".jpg", ".jpeg", ".png", ".tiff", ".bmp")):
        text = extract_text_from_image(content)
    if not text and name.endswith(".pdf"):
        text = extract_text_from_pdf_scanned(content)

    if text and archivo.pqrs_id:
        from apps.ai.models import ContentEmbedding
        from apps.ai.services.embeddings import index_text
        index_text(
            archivo.pqrs.entity_id,
            ContentEmbedding.ContentType.PQRS_DESCRIPCION,
            archivo.pqrs_id,
            text,
            {"source": "ocr", "archivo_id": archivo_id},
        )
    return {"archivo_id": archivo_id, "text_length": len(text)}
