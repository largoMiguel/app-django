"""Servicios: pairing, inferencia de punch, almacenamiento de fotos."""
from __future__ import annotations

import base64
import binascii
import io
import logging
import uuid
from datetime import datetime, time, timedelta

from botocore.exceptions import ClientError
from django.conf import settings
from django.core.cache import cache
from django.db import transaction
from django.utils import timezone
from PIL import Image
from rest_framework.exceptions import ValidationError

from apps.common.b2_client import get_b2_client
from apps.common.file_delivery import signed_asistencia_url
from apps.common.storages import asistencia_file_storage

from .device_auth import generate_device_token, generate_pairing_code, hash_token
from .models import (
    SECUENCIA_2,
    SECUENCIA_4,
    EquipoRegistro,
    Funcionario,
    RegistroAsistencia,
    TipoRegistro,
)

logger = logging.getLogger(__name__)

PAIRING_TTL_MINUTES = 15
MAX_PHOTO_BYTES = 1_572_864  # 1.5 MB
PUNCH_COOLDOWN_SECONDS = 30
BOGOTA_TZ = timezone.get_default_timezone()


def _today_bounds() -> tuple[datetime, datetime]:
    now = timezone.localtime(timezone.now())
    start = timezone.make_aware(datetime.combine(now.date(), time.min), BOGOTA_TZ)
    end = start + timedelta(days=1)
    return start, end


def secuencia_for_entity(entity) -> list[str]:
    if getattr(entity, "asistencias_por_dia", 2) == 4:
        return [t.value for t in SECUENCIA_4]
    return [t.value for t in SECUENCIA_2]


def label_for_tipo(tipo: str) -> str:
    labels = dict(TipoRegistro.choices)
    return labels.get(tipo, tipo.replace("_", " ").title())


def registros_tipos_hoy(funcionario: Funcionario) -> list[str]:
    start, end = _today_bounds()
    return list(
        RegistroAsistencia.objects.filter(
            funcionario=funcionario,
            fecha_hora__gte=start,
            fecha_hora__lt=end,
        )
        .order_by("fecha_hora")
        .values_list("tipo", flat=True)
    )


def infer_next_tipo(entity, funcionario: Funcionario) -> str:
    registros_hoy = registros_tipos_hoy(funcionario)
    secuencia = secuencia_for_entity(entity)
    if len(registros_hoy) >= len(secuencia):
        raise ValidationError({"detail": "Jornada completa para hoy."})
    return secuencia[len(registros_hoy)]


def punch_progress(entity, funcionario: Funcionario, last_tipo: str | None = None) -> dict:
    """Estado de jornada tras un registro (o actual)."""
    tipos = registros_tipos_hoy(funcionario)
    secuencia = secuencia_for_entity(entity)
    count = len(tipos)
    completa = count >= len(secuencia)
    siguiente = None if completa else secuencia[count]
    return {
        "marcaciones_hoy": count,
        "marcaciones_totales": len(secuencia),
        "jornada_completa": completa,
        "ultimo_tipo": last_tipo or (tipos[-1] if tipos else None),
        "ultimo_tipo_label": label_for_tipo(last_tipo or tipos[-1]) if (last_tipo or tipos) else None,
        "siguiente_tipo": siguiente,
        "siguiente_tipo_label": label_for_tipo(siguiente) if siguiente else None,
    }


def issue_pairing_code(equipo: EquipoRegistro) -> str:
    code = generate_pairing_code()
    equipo.pairing_code_hash = hash_token(code)
    equipo.pairing_code_expires_at = timezone.now() + timedelta(minutes=PAIRING_TTL_MINUTES)
    equipo.save(update_fields=["pairing_code_hash", "pairing_code_expires_at", "updated_at"])
    return code


def pair_equipo(code: str) -> tuple[EquipoRegistro, str]:
    code = (code or "").strip()
    if not code:
        raise ValidationError({"pairing_code": "Código requerido."})
    code_hash = hash_token(code)
    equipo = (
        EquipoRegistro.objects.select_related("entity")
        .filter(
            pairing_code_hash=code_hash,
            is_active=True,
            pairing_code_expires_at__gte=timezone.now(),
        )
        .first()
    )
    if equipo is None:
        raise ValidationError({"pairing_code": "Código inválido o expirado."})
    entity = equipo.entity
    if not entity.is_active or not entity.enable_asistencia:
        raise ValidationError({"detail": "Asistencia no habilitada para esta entidad."})

    raw_token = generate_device_token()
    equipo.device_token_hash = hash_token(raw_token)
    equipo.pairing_code_hash = ""
    equipo.pairing_code_expires_at = None
    equipo.paired_at = timezone.now()
    equipo.last_seen_at = timezone.now()
    equipo.save(
        update_fields=[
            "device_token_hash",
            "pairing_code_hash",
            "pairing_code_expires_at",
            "paired_at",
            "last_seen_at",
            "updated_at",
        ]
    )
    return equipo, raw_token


def revoke_device_token(equipo: EquipoRegistro) -> None:
    equipo.device_token_hash = ""
    equipo.pairing_code_hash = ""
    equipo.pairing_code_expires_at = None
    equipo.save(
        update_fields=[
            "device_token_hash",
            "pairing_code_hash",
            "pairing_code_expires_at",
            "updated_at",
        ]
    )


def _decode_photo(foto_base64: str) -> bytes:
    raw = (foto_base64 or "").strip()
    if not raw:
        raise ValidationError({"foto_base64": "La foto es obligatoria."})
    if raw.startswith("data:"):
        _, _, raw = raw.partition(",")
    try:
        data = base64.b64decode(raw, validate=True)
    except (binascii.Error, ValueError) as exc:
        raise ValidationError({"foto_base64": "Imagen inválida."}) from exc
    if len(data) > MAX_PHOTO_BYTES:
        raise ValidationError({"foto_base64": "La imagen supera el tamaño máximo (1.5 MB)."})
    try:
        img = Image.open(io.BytesIO(data))
        img.verify()
    except Exception as exc:
        raise ValidationError({"foto_base64": "No se pudo procesar la imagen."}) from exc
    return data


def upload_foto(entity_id: int, funcionario_id: int, foto_base64: str) -> str:
    data = _decode_photo(foto_base64)
    date_part = timezone.localtime(timezone.now()).strftime("%Y%m%d")
    key = f"{entity_id}/{funcionario_id}/{date_part}/{uuid.uuid4()}.jpg"
    storage = asistencia_file_storage()
    storage.save(key, io.BytesIO(data))
    return key


def _punch_lock_key(funcionario_id: int) -> str:
    return f"asistencia:punch:{funcionario_id}"


def register_punch(
    *,
    equipo: EquipoRegistro,
    cedula: str,
    foto_base64: str,
    idempotency_key: str,
    client_ts=None,
) -> tuple[RegistroAsistencia, str | None]:
    cedula = (cedula or "").strip()
    if not cedula:
        raise ValidationError({"cedula": "Cédula requerida."})
    idempotency_key = (idempotency_key or "").strip()
    if not idempotency_key or len(idempotency_key) > 64:
        raise ValidationError({"idempotency_key": "Clave de idempotencia inválida."})

    existing = RegistroAsistencia.objects.filter(idempotency_key=idempotency_key).select_related(
        "funcionario", "equipo"
    ).first()
    if existing:
        return existing, None

    entity = equipo.entity
    funcionario = Funcionario.objects.filter(
        entity=entity, cedula=cedula, is_active=True
    ).first()
    if funcionario is None:
        raise ValidationError({"cedula": "Funcionario no encontrado o inactivo."})

    lock_key = _punch_lock_key(funcionario.id)
    if not cache.add(lock_key, "1", timeout=PUNCH_COOLDOWN_SECONDS):
        raise ValidationError({"detail": "Espere unos segundos antes de registrar de nuevo."})

    try:
        with transaction.atomic():
            locked = Funcionario.objects.select_for_update().get(pk=funcionario.pk)
            tipo = infer_next_tipo(entity, locked)
            foto_key = upload_foto(entity.id, locked.id, foto_base64)
            registro = RegistroAsistencia.objects.create(
                entity=entity,
                funcionario=locked,
                equipo=equipo,
                tipo=tipo,
                foto_key=foto_key,
                idempotency_key=idempotency_key,
                client_ts=client_ts,
            )
    except ValidationError:
        cache.delete(lock_key)
        raise
    except Exception:
        cache.delete(lock_key)
        raise

    new_token = generate_device_token()
    equipo.device_token_hash = hash_token(new_token)
    equipo.last_seen_at = timezone.now()
    equipo.save(update_fields=["device_token_hash", "last_seen_at", "updated_at"])
    return registro, new_token


def foto_url_for_registro(registro: RegistroAsistencia) -> str | None:
    if not registro.foto_key:
        return None
    try:
        return signed_asistencia_url(registro.foto_key)
    except RuntimeError:
        storage = asistencia_file_storage()
        return storage.url(registro.foto_key)


def compute_stats(entity) -> dict:
    start, end = _today_bounds()
    qs_hoy = RegistroAsistencia.objects.filter(
        entity=entity, fecha_hora__gte=start, fecha_hora__lt=end
    )
    entradas = qs_hoy.filter(tipo=TipoRegistro.ENTRADA).count()
    salidas = qs_hoy.filter(tipo=TipoRegistro.SALIDA).count()
    total_funcionarios = Funcionario.objects.filter(entity=entity, is_active=True).count()
    week_start = start - timedelta(days=6)
    week_count = RegistroAsistencia.objects.filter(
        entity=entity, fecha_hora__gte=week_start, fecha_hora__lt=end
    ).count()
    return {
        "total_funcionarios": total_funcionarios,
        "total_registros": RegistroAsistencia.objects.filter(entity=entity).count(),
        "registros_hoy": qs_hoy.count(),
        "entradas_hoy": entradas,
        "salidas_hoy": salidas,
        "funcionarios_presentes": max(0, entradas - salidas),
        "promedio_asistencia_semanal": round(week_count / 7, 1),
        "asistencias_por_dia": entity.asistencias_por_dia,
    }


def purge_old_photos(*, keep_days: int = 15) -> dict[str, int]:
    """Borra del storage las fotos de registros más antiguos que keep_days y limpia foto_key."""
    cutoff = timezone.now() - timedelta(days=keep_days)
    qs = RegistroAsistencia.objects.filter(fecha_hora__lt=cutoff).exclude(foto_key="")

    deleted_files = 0
    cleared_records = 0
    storage = asistencia_file_storage()
    use_b2 = bool(settings.USE_B2_STORAGE)
    client = get_b2_client() if use_b2 else None
    bucket = settings.B2_BUCKET_ASISTENCIA

    batch_ids: list[int] = []
    for registro in qs.iterator(chunk_size=200):
        key = (registro.foto_key or "").lstrip("/")
        if key:
            try:
                if use_b2 and client is not None:
                    client.delete_object(Bucket=bucket, Key=key)
                else:
                    storage.delete(key)
                deleted_files += 1
            except ClientError as exc:
                logger.warning("No se pudo borrar foto asistencia %s: %s", key, exc)
            except Exception as exc:  # noqa: BLE001
                logger.warning("No se pudo borrar foto asistencia %s: %s", key, exc)
        batch_ids.append(registro.id)
        if len(batch_ids) >= 200:
            RegistroAsistencia.objects.filter(id__in=batch_ids).update(foto_key="")
            cleared_records += len(batch_ids)
            batch_ids = []

    if batch_ids:
        RegistroAsistencia.objects.filter(id__in=batch_ids).update(foto_key="")
        cleared_records += len(batch_ids)

    return {"deleted_files": deleted_files, "cleared_records": cleared_records}
