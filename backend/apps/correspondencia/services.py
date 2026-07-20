"""Servicios: radicados, SLA, anexos, eventos, stats."""
from __future__ import annotations

import logging
import uuid
from datetime import datetime

from django.db import transaction
from django.db.models import Count
from django.utils import timezone
from django.utils.text import get_valid_filename
from rest_framework.exceptions import ValidationError

from apps.common.file_delivery import signed_correspondencia_url
from apps.common.storages import correspondencia_file_storage
from apps.pqrs.models import sumar_dias_habiles

from .models import (
    DEFAULT_DIAS_HABILES,
    CanalCorrespondencia,
    Correspondencia,
    CorrespondenciaAnexo,
    CorrespondenciaEvento,
    EstadoCorrespondencia,
    TipoAnexo,
    TipoEventoCorrespondencia,
)

logger = logging.getLogger(__name__)

MAX_ANEXO_BYTES = 15 * 1024 * 1024  # 15 MB


def next_numero_radicado(entity_id: int, when: datetime | None = None) -> str:
    """Genera CORR-YYYYMMDD-NNNN único por entidad (secuencia del día)."""
    when = when or timezone.now()
    local = timezone.localtime(when)
    prefix = f"CORR-{local.strftime('%Y%m%d')}-"
    last = (
        Correspondencia.objects.filter(entity_id=entity_id, numero_radicado__startswith=prefix)
        .order_by("-numero_radicado")
        .values_list("numero_radicado", flat=True)
        .first()
    )
    seq = 1
    if last:
        try:
            seq = int(last.rsplit("-", 1)[-1]) + 1
        except ValueError:
            seq = 1
    return f"{prefix}{seq:04d}"


def compute_fecha_vencimiento(fecha_radicacion: datetime, dias: int) -> datetime:
    return sumar_dias_habiles(fecha_radicacion, dias)


def validate_canal_contacto(*, canal: str, email: str, direccion: str) -> None:
    email = (email or "").strip()
    direccion = (direccion or "").strip()
    if canal == CanalCorrespondencia.CORREO and not email:
        raise ValidationError({"contacto_email": "El correo es obligatorio para canal correo."})
    if canal == CanalCorrespondencia.FISICO and not direccion:
        raise ValidationError(
            {"contacto_direccion": "La dirección es obligatoria para canal físico."}
        )


def log_evento(
    correspondencia: Correspondencia,
    tipo: str,
    actor,
    detalle: dict | None = None,
) -> CorrespondenciaEvento:
    return CorrespondenciaEvento.objects.create(
        correspondencia=correspondencia,
        tipo=tipo,
        actor=actor if getattr(actor, "is_authenticated", False) else None,
        detalle=detalle or {},
    )


def anexo_b2_key(entity_id: int, correspondencia_id: int, tipo: str, filename: str) -> str:
    safe = get_valid_filename(filename) or "archivo"
    return f"{entity_id}/{correspondencia_id}/{tipo}/{uuid.uuid4().hex}_{safe}"


def upload_anexo(
    correspondencia: Correspondencia,
    *,
    uploaded_file,
    tipo: str,
    uploaded_by,
) -> CorrespondenciaAnexo:
    if tipo not in {c.value for c in TipoAnexo}:
        raise ValidationError({"tipo": "Tipo de anexo inválido."})
    name = get_valid_filename(getattr(uploaded_file, "name", "") or "archivo")
    size = int(getattr(uploaded_file, "size", 0) or 0)
    if size <= 0:
        raise ValidationError({"file": "Archivo vacío."})
    if size > MAX_ANEXO_BYTES:
        raise ValidationError({"file": "El archivo supera el tamaño máximo (15 MB)."})

    content_type = getattr(uploaded_file, "content_type", "") or ""
    key = anexo_b2_key(correspondencia.entity_id, correspondencia.id, tipo, name)
    storage = correspondencia_file_storage()
    storage.save(key, uploaded_file)

    anexo = CorrespondenciaAnexo.objects.create(
        correspondencia=correspondencia,
        tipo=tipo,
        nombre=name,
        b2_key=key,
        content_type=content_type,
        size=size,
        uploaded_by=uploaded_by,
    )
    log_evento(
        correspondencia,
        TipoEventoCorrespondencia.ANEXO,
        uploaded_by,
        {"anexo_id": anexo.id, "nombre": name, "tipo": tipo},
    )
    return anexo


def delete_anexo(anexo: CorrespondenciaAnexo, actor) -> None:
    key = (anexo.b2_key or "").lstrip("/")
    storage = correspondencia_file_storage()
    if key:
        try:
            storage.delete(key)
        except Exception as exc:  # noqa: BLE001
            logger.warning("No se pudo borrar anexo correspondencia %s: %s", key, exc)
    corr = anexo.correspondencia
    detalle = {"anexo_id": anexo.id, "nombre": anexo.nombre, "accion": "eliminado"}
    anexo.delete()
    log_evento(corr, TipoEventoCorrespondencia.ANEXO, actor, detalle)


def anexo_url(anexo: CorrespondenciaAnexo) -> str | None:
    if not anexo.b2_key:
        return None
    try:
        return signed_correspondencia_url(anexo.b2_key, filename=anexo.nombre)
    except RuntimeError:
        storage = correspondencia_file_storage()
        try:
            return storage.url(anexo.b2_key)
        except Exception:  # noqa: BLE001
            return None


@transaction.atomic
def crear_correspondencia(*, entity, user, data: dict) -> Correspondencia:
    validate_canal_contacto(
        canal=data["canal"],
        email=data.get("contacto_email", ""),
        direccion=data.get("contacto_direccion", ""),
    )
    dias = int(data.get("dias_habiles_respuesta") or DEFAULT_DIAS_HABILES)
    fecha = data.get("fecha_radicacion") or timezone.now()
    obj = Correspondencia(
        entity=entity,
        numero_radicado=next_numero_radicado(entity.id, fecha),
        sentido=data["sentido"],
        tipologia=data.get("tipologia") or "oficio",
        fecha_radicacion=fecha,
        remitente_nombre=data["remitente_nombre"],
        remitente_documento=data.get("remitente_documento") or "",
        remitente_dependencia=data.get("remitente_dependencia") or "",
        destinatario_nombre=data["destinatario_nombre"],
        destinatario_documento=data.get("destinatario_documento") or "",
        destinatario_dependencia=data.get("destinatario_dependencia") or "",
        canal=data["canal"],
        contacto_email=data.get("contacto_email") or "",
        contacto_direccion=data.get("contacto_direccion") or "",
        asunto=data["asunto"],
        descripcion=data.get("descripcion") or "",
        numero_folios=int(data.get("numero_folios") or 1),
        secretaria=data["secretaria"],
        assigned_to=data.get("assigned_to"),
        estado=EstadoCorrespondencia.RADICADA,
        dias_habiles_respuesta=dias,
        fecha_vencimiento=compute_fecha_vencimiento(fecha, dias),
        created_by=user,
    )
    obj.save()
    log_evento(
        obj,
        TipoEventoCorrespondencia.CREACION,
        user,
        {"numero_radicado": obj.numero_radicado, "sentido": obj.sentido},
    )
    return obj


def cambiar_estado(obj: Correspondencia, nuevo_estado: str, actor) -> Correspondencia:
    if nuevo_estado not in {c.value for c in EstadoCorrespondencia}:
        raise ValidationError({"estado": "Estado inválido."})
    anterior = obj.estado
    if anterior == nuevo_estado:
        return obj
    obj.estado = nuevo_estado
    obj.save(update_fields=["estado", "updated_at"])
    log_evento(
        obj,
        TipoEventoCorrespondencia.CAMBIO_ESTADO,
        actor,
        {"desde": anterior, "hacia": nuevo_estado},
    )
    return obj


def asignar(
    obj: Correspondencia,
    *,
    secretaria,
    assigned_to=None,
    actor=None,
) -> Correspondencia:
    anterior = {
        "secretaria_id": obj.secretaria_id,
        "assigned_to_id": obj.assigned_to_id,
    }
    obj.secretaria = secretaria
    obj.assigned_to = assigned_to
    if obj.estado == EstadoCorrespondencia.RADICADA:
        obj.estado = EstadoCorrespondencia.EN_TRAMITE
    obj.save(update_fields=["secretaria", "assigned_to", "estado", "updated_at"])
    log_evento(
        obj,
        TipoEventoCorrespondencia.ASIGNACION,
        actor,
        {
            "anterior": anterior,
            "secretaria_id": secretaria.id,
            "assigned_to_id": assigned_to.id if assigned_to else None,
        },
    )
    return obj


def responder(obj: Correspondencia, texto: str, actor) -> Correspondencia:
    texto = (texto or "").strip()
    if not texto:
        raise ValidationError({"respuesta_texto": "La respuesta es obligatoria."})
    obj.respuesta_texto = texto
    obj.fecha_respuesta = timezone.now()
    obj.estado = EstadoCorrespondencia.RESPONDIDA
    obj.save(update_fields=["respuesta_texto", "fecha_respuesta", "estado", "updated_at"])
    log_evento(
        obj,
        TipoEventoCorrespondencia.RESPUESTA,
        actor,
        {"fecha_respuesta": obj.fecha_respuesta.isoformat()},
    )
    return obj


def compute_stats(qs) -> dict:
    today = timezone.localdate()
    now = timezone.now()
    base = qs
    hoy = base.filter(fecha_radicacion__date=today).count()
    en_tramite = base.filter(
        estado__in=[EstadoCorrespondencia.RADICADA, EstadoCorrespondencia.EN_TRAMITE]
    ).count()
    vencidas = base.filter(
        fecha_vencimiento__lt=now,
        estado__in=[EstadoCorrespondencia.RADICADA, EstadoCorrespondencia.EN_TRAMITE],
    ).count()
    por_sentido = {
        row["sentido"]: row["c"]
        for row in base.values("sentido").annotate(c=Count("id"))
    }
    por_estado = {
        row["estado"]: row["c"] for row in base.values("estado").annotate(c=Count("id"))
    }
    return {
        "hoy": hoy,
        "en_tramite": en_tramite,
        "vencidas": vencidas,
        "total": base.count(),
        "por_sentido": {
            "entrada": por_sentido.get("entrada", 0),
            "salida": por_sentido.get("salida", 0),
        },
        "por_estado": por_estado,
    }
