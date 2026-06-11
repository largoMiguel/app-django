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
from apps.common.roles import user_roles
from apps.pqrs.services.ai import normalize_ia_contact_fields
from apps.pqrs.validators import validate_inbound_attachment, validate_uploaded_file

logger = logging.getLogger(__name__)

MAX_ARCHIVOS = PQRSArchivo.MAX_ARCHIVOS


def create_text_pdf(texto: str, asunto: str, radicado: str) -> bytes:
    """Genera PDF plano (fallback si no hay metadatos de correo)."""
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


def _save_email_content_document(
    pqrs: PQRS,
    *,
    texto: str,
    asunto: str,
    radicado: str,
    user,
    email_meta: dict[str, Any] | None = None,
) -> None:
    from apps.pqrs.services.email_print import create_email_print_document

    meta = email_meta or {}
    content, filename, content_type = create_email_print_document(
        body=texto,
        subject=meta.get("subject") or asunto,
        radicado=radicado,
        from_name=meta.get("from_name") or "",
        from_email=meta.get("from_email") or "",
        to_emails=meta.get("to_emails") or [],
        date=meta.get("date"),
    )
    _save_archivo(
        pqrs,
        filename=filename,
        content=content,
        size=len(content),
        content_type=content_type,
        user=user,
    )


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
    limit_archivos: bool = True,
    skip_extension_check: bool = False,
) -> None:
    """Adjunta archivos desde tuplas (nombre, bytes)."""
    content_types = content_types or {}
    validate = validate_inbound_attachment if skip_extension_check else validate_uploaded_file
    if limit_archivos:
        existentes = pqrs.archivos.count()
        disponibles = MAX_ARCHIVOS - existentes
        if disponibles <= 0:
            return
        files_to_save = files[:disponibles]
    else:
        files_to_save = files
    for filename, content in files_to_save:
        size = len(content)
        try:
            validate(filename, size)
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


def _sync_assigned_to_principal(pqrs: PQRS, secretarias: list[Secretaria]) -> None:
    pqrs.assigned_to = secretarias[0] if secretarias else None


def sincronizar_asignaciones(
    pqrs: PQRS,
    secretarias: list[Secretaria],
    *,
    user,
    justificacion: str = "",
    notificar: bool = True,
) -> list[Secretaria]:
    """Sincroniza el M2M con la lista dada. Retorna secretarías recién agregadas."""
    secretarias = list(dict.fromkeys(secretarias))
    current_ids = set(pqrs.assigned_secretarias.values_list("id", flat=True))
    target_ids = {s.id for s in secretarias}
    agregadas = [s for s in secretarias if s.id not in current_ids]
    removidas_ids = current_ids - target_ids

    if removidas_ids:
        removidas = list(
            Secretaria.objects.filter(pk__in=removidas_ids).order_by("nombre", "id")
        )
        for sec in removidas:
            AsignacionAuditoria.objects.create(
                pqrs=pqrs,
                secretaria_anterior=sec,
                secretaria_nueva=None,
                usuario_nuevo=user if getattr(user, "is_authenticated", False) else None,
                accion="reasignacion",
                justificacion=justificacion or f"Secretaría {sec.nombre} removida de la asignación.",
            )

    pqrs.assigned_secretarias.set(secretarias)
    _sync_assigned_to_principal(pqrs, secretarias)

    if secretarias:
        pqrs.estado = EstadoPQRS.ASIGNADA
        pqrs.fecha_delegacion = timezone.now()
        pqrs.justificacion_asignacion = justificacion
    else:
        pqrs.estado = EstadoPQRS.RECIBIDA
        pqrs.fecha_delegacion = None
        pqrs.justificacion_asignacion = ""

    pqrs.save(
        update_fields=[
            "assigned_to",
            "estado",
            "fecha_delegacion",
            "justificacion_asignacion",
            "updated_at",
        ]
    )

    accion = "reasignacion" if current_ids else "asignacion"
    for sec in agregadas:
        AsignacionAuditoria.objects.create(
            pqrs=pqrs,
            secretaria_nueva=sec,
            usuario_nuevo=user if getattr(user, "is_authenticated", False) else None,
            accion=accion,
            justificacion=justificacion,
        )

    if notificar:
        from apps.pqrs.services.email import (
            enviar_notificacion_asignacion,
            secretarias_pendientes_notificacion_asignacion,
        )

        a_notificar = secretarias_pendientes_notificacion_asignacion(
            pqrs,
            secretarias,
            current_ids=current_ids,
            agregadas=agregadas,
        )
        for sec in a_notificar:
            try:
                enviar_notificacion_asignacion(
                    pqrs,
                    sec,
                    asignado_por=user,
                    justificacion=justificacion,
                )
            except Exception:  # noqa: BLE001
                logger.exception(
                    "Error notificando asignación PQRS %s a %s",
                    pqrs.numero_radicado,
                    sec.nombre,
                )

    return agregadas


def rechazar_asignacion_secretaria(
    pqrs: PQRS,
    secretaria: Secretaria,
    *,
    user,
    motivo: str,
) -> None:
    """El secretario rechaza solo su dependencia; las demás permanecen."""
    if not pqrs.assigned_secretarias.filter(pk=secretaria.id).exists():
        return

    pqrs.assigned_secretarias.remove(secretaria)
    restantes = list(pqrs.assigned_secretarias.order_by("nombre", "id"))
    _sync_assigned_to_principal(pqrs, restantes)

    AsignacionAuditoria.objects.create(
        pqrs=pqrs,
        secretaria_anterior=secretaria,
        secretaria_nueva=None,
        usuario_anterior=user if getattr(user, "is_authenticated", False) else None,
        accion="rechazo",
        justificacion=motivo,
    )

    if restantes:
        pqrs.estado = EstadoPQRS.ASIGNADA
        update_fields = ["assigned_to", "estado", "updated_at"]
    else:
        pqrs.estado = EstadoPQRS.RECHAZADA_ASIGNACION
        update_fields = ["assigned_to", "estado", "updated_at"]

    pqrs.save(update_fields=update_fields)


def crear_pqrs_desde_ia(
    entity: Entity,
    extraido: dict[str, Any],
    *,
    created_by=None,
    texto: str = "",
    files_uploads: list | None = None,
    files_bytes: list[tuple[str, bytes]] | None = None,
    files_content_types: dict[str, str] | None = None,
    canal_llegada: str = CanalLlegada.WEB,
    fecha_base: datetime | None = None,
    auditoria_creacion: str = "PQRS creada automáticamente por IA (OpenAI).",
    secretaria_fallback: Secretaria | None = None,
    generar_pdf_texto: bool = True,
    limit_archivos: bool | None = None,
    email_meta: dict[str, Any] | None = None,
) -> PQRS:
    """Crea PQRS estructurada por IA, con asignación automática opcional."""
    if limit_archivos is None:
        limit_archivos = canal_llegada != CanalLlegada.EMAIL
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

        roles = user_roles(created_by) if created_by else set()
        secretarias: list[Secretaria] = []
        just = ""

        if (
            "secretario" in roles
            and secretaria_fallback
            and secretaria_fallback.is_active
            and secretaria_fallback.entity_id == entity.id
        ):
            secretarias = [secretaria_fallback]
            just = f"Asignación automática a {secretaria_fallback.nombre} (remitente secretario)"
        else:
            sec_ids = extraido.get("secretaria_ids") or []
            if not sec_ids and extraido.get("secretaria_id"):
                sec_ids = [extraido["secretaria_id"]]
            secretarias = list(
                Secretaria.objects.filter(
                    pk__in=sec_ids, entity_id=entity.id, is_active=True
                ).order_by("nombre", "id")
            )
            just = extraido.get("secretaria_justificacion") or ""
            if not just and secretarias:
                nombres = ", ".join(s.nombre for s in secretarias)
                just = f"Asignación automática a {nombres}"

        if secretarias:
            sincronizar_asignaciones(
                pqrs,
                secretarias,
                user=created_by,
                justificacion=f"[IA] {just}".strip(),
                notificar=True,
            )

        AsignacionAuditoria.objects.create(
            pqrs=pqrs,
            usuario_nuevo=created_by if getattr(created_by, "is_authenticated", False) else None,
            accion="creacion_ia",
            justificacion=auditoria_creacion,
        )

        if generar_pdf_texto and texto:
            if email_meta:
                _save_email_content_document(
                    pqrs,
                    texto=texto,
                    asunto=extraido["asunto"],
                    radicado=numero,
                    user=created_by,
                    email_meta=email_meta,
                )
            else:
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
            attach_archivos_from_bytes(
                pqrs,
                files_bytes,
                created_by,
                content_types=files_content_types,
                limit_archivos=limit_archivos,
                skip_extension_check=canal_llegada == CanalLlegada.EMAIL,
            )

    return pqrs
