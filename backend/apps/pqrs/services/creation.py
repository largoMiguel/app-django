"""Creación de PQRS (manual, IA, correo entrante)."""
from __future__ import annotations

import logging
from datetime import datetime
from typing import Any

from django.core.files.base import ContentFile
from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from apps.entities.models import Entity, Secretaria
from apps.pqrs.models import (
    DIAS_RESPUESTA_LEY1755,
    CanalLlegada,
    EstadoPQRS,
    PQRS,
    AsignacionAuditoria,
    PQRSArchivo,
    sumar_dias_habiles,
)
from apps.pqrs.services.ai import normalize_ia_contact_fields
from apps.pqrs.validators import validate_uploaded_file

logger = logging.getLogger(__name__)

MAX_ARCHIVOS = PQRSArchivo.MAX_ARCHIVOS


def create_text_pdf(texto: str, asunto: str, radicado: str) -> bytes:
    """Genera un PDF con el texto completo del ciudadano."""
    from fpdf import FPDF

    def _safe(s: str) -> str:
        return s.encode("latin-1", errors="replace").decode("latin-1")

    pdf = FPDF(orientation="P", unit="mm", format="A4")
    pdf.set_auto_page_break(auto=True, margin=15)
    pdf.add_page()

    pdf.set_font("Helvetica", "B", 13)
    pdf.cell(0, 10, _safe(f"Radicado: {radicado}"), new_x="LMARGIN", new_y="NEXT", align="C")
    pdf.set_font("Helvetica", "B", 11)
    pdf.multi_cell(0, 7, _safe(asunto))
    pdf.ln(3)
    pdf.set_draw_color(180, 180, 180)
    pdf.line(10, pdf.get_y(), 200, pdf.get_y())
    pdf.ln(5)

    pdf.set_font("Helvetica", size=10)
    pdf.multi_cell(0, 6, _safe(texto))
    return bytes(pdf.output())


def attach_archivos_from_uploads(pqrs: PQRS, files: list, user) -> None:
    """Adjunta archivos desde objetos upload de Django/DRF."""
    existentes = pqrs.archivos.count()
    disponibles = MAX_ARCHIVOS - existentes
    if disponibles <= 0:
        raise ValidationError({"archivos": f"Ya se alcanzó el límite de {MAX_ARCHIVOS} archivos."})
    a_subir = files[:disponibles]
    if len(files) > disponibles:
        raise ValidationError(
            {"archivos": f"Solo puedes subir {disponibles} archivo(s) más (máx {MAX_ARCHIVOS})."}
        )
    for f in a_subir:
        filename = getattr(f, "name", "archivo")
        content = f.read() if hasattr(f, "read") else b""
        size = getattr(f, "size", len(content)) or len(content)
        validate_uploaded_file(filename, size)
        try:
            f.seek(0)
        except Exception:  # noqa: BLE001
            pass
        _save_archivo(
            pqrs,
            filename=filename,
            content=content,
            size=size,
            content_type=getattr(f, "content_type", "") or "",
            user=user,
        )


def attach_archivos_from_bytes(
    pqrs: PQRS,
    files: list[tuple[str, bytes]],
    user,
    *,
    content_types: dict[str, str] | None = None,
) -> None:
    """Adjunta archivos desde tuplas (nombre, bytes)."""
    content_types = content_types or {}
    existentes = pqrs.archivos.count()
    disponibles = MAX_ARCHIVOS - existentes
    if disponibles <= 0:
        return
    for filename, content in files[:disponibles]:
        size = len(content)
        try:
            validate_uploaded_file(filename, size)
        except ValidationError:
            logger.warning("Adjunto omitido en PQRS %s: %s", pqrs.numero_radicado, filename)
            continue
        _save_archivo(
            pqrs,
            filename=filename,
            content=content,
            size=size,
            content_type=content_types.get(filename, ""),
            user=user,
        )


def _save_archivo(
    pqrs: PQRS,
    *,
    filename: str,
    content: bytes,
    size: int,
    content_type: str,
    user,
) -> None:
    arch = PQRSArchivo(
        pqrs=pqrs,
        nombre_original=filename,
        content_type=content_type,
        size=size,
        uploaded_by=user if getattr(user, "is_authenticated", False) else None,
    )
    arch.archivo.save(filename, ContentFile(content), save=False)
    arch.save()


def _asignar_secretaria(
    pqrs: PQRS,
    secretaria: Secretaria,
    *,
    user,
    justificacion: str,
    accion: str = "asignacion",
) -> None:
    pqrs.assigned_to = secretaria
    pqrs.estado = EstadoPQRS.ASIGNADA
    pqrs.fecha_delegacion = timezone.now()
    pqrs.justificacion_asignacion = justificacion
    pqrs.save(
        update_fields=[
            "assigned_to",
            "estado",
            "fecha_delegacion",
            "justificacion_asignacion",
            "updated_at",
        ]
    )
    AsignacionAuditoria.objects.create(
        pqrs=pqrs,
        secretaria_nueva=secretaria,
        usuario_nuevo=user if getattr(user, "is_authenticated", False) else None,
        accion=accion,
        justificacion=justificacion,
    )


def crear_pqrs_desde_ia(
    entity: Entity,
    extraido: dict[str, Any],
    *,
    created_by=None,
    texto: str = "",
    files_uploads: list | None = None,
    files_bytes: list[tuple[str, bytes]] | None = None,
    canal_llegada: str = CanalLlegada.WEB,
    fecha_base: datetime | None = None,
    auditoria_creacion: str = "PQRS creada automáticamente por IA (OpenAI).",
    secretaria_fallback: Secretaria | None = None,
    generar_pdf_texto: bool = True,
) -> PQRS:
    """Crea PQRS estructurada por IA, con asignación automática opcional."""
    extraido = normalize_ia_contact_fields(dict(extraido))
    tipo = extraido["tipo_solicitud"]
    dias = DIAS_RESPUESTA_LEY1755.get(tipo, 15)
    fecha_base = fecha_base or timezone.now()
    if isinstance(fecha_base, datetime) and timezone.is_naive(fecha_base):
        fecha_base = timezone.make_aware(fecha_base, timezone.get_current_timezone())

    with transaction.atomic():
        numero = PQRS.generar_radicado(entity.id)
        pqrs = PQRS.objects.create(
            entity=entity,
            created_by=created_by,
            numero_radicado=numero,
            tipo_solicitud=tipo,
            asunto=extraido["asunto"],
            descripcion=extraido["descripcion"],
            tipo_persona=extraido.get("tipo_persona"),
            tipo_identificacion=extraido.get("tipo_identificacion") or "CC",
            cedula_ciudadano=extraido.get("cedula_ciudadano"),
            nombre_ciudadano=extraido.get("nombre_ciudadano"),
            email_ciudadano=extraido.get("email_ciudadano"),
            telefono_ciudadano=extraido.get("telefono_ciudadano"),
            direccion_ciudadano=extraido.get("direccion_ciudadano"),
            medio_respuesta=extraido["medio_respuesta"],
            canal_llegada=canal_llegada,
            estado=EstadoPQRS.RECIBIDA,
            dias_respuesta=dias,
            fecha_solicitud=fecha_base,
            fecha_vencimiento=sumar_dias_habiles(fecha_base, dias),
        )

        sec_id = extraido.get("secretaria_id")
        secretaria = None
        if sec_id:
            secretaria = Secretaria.objects.filter(
                pk=sec_id, entity_id=entity.id, is_active=True
            ).first()
        if not secretaria and secretaria_fallback and secretaria_fallback.is_active:
            secretaria = secretaria_fallback

        if secretaria:
            just = extraido.get("secretaria_justificacion") or ""
            if secretaria.id != sec_id:
                just = just or f"Asignación automática a {secretaria.nombre}"
            _asignar_secretaria(
                pqrs,
                secretaria,
                user=created_by,
                justificacion=f"[IA] {just}".strip(),
            )

        AsignacionAuditoria.objects.create(
            pqrs=pqrs,
            usuario_nuevo=created_by if getattr(created_by, "is_authenticated", False) else None,
            accion="creacion_ia",
            justificacion=auditoria_creacion,
        )

        if generar_pdf_texto and texto:
            pdf_bytes = create_text_pdf(texto, extraido["asunto"], numero)
            _save_archivo(
                pqrs,
                filename=f"solicitud_{numero}.pdf",
                content=pdf_bytes,
                size=len(pdf_bytes),
                content_type="application/pdf",
                user=created_by,
            )

        if files_uploads:
            attach_archivos_from_uploads(pqrs, files_uploads, created_by)
        if files_bytes:
            attach_archivos_from_bytes(pqrs, files_bytes, created_by)

    return pqrs
