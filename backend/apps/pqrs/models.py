"""PQRS — Peticiones, Quejas, Reclamos y Sugerencias + auditoría de asignaciones."""
from __future__ import annotations

import datetime
import os

from apps.common.storages import pqrs_file_storage
from django.conf import settings
from django.db import models, transaction
from django.utils import timezone


def pqrs_archivo_upload_path(instance, filename: str) -> str:
    """Ruta: entities/<entity_id>/pqrs/<pqrs_id>/<filename>."""
    pqrs = instance.pqrs
    safe_name = os.path.basename(filename)
    return f"entities/{pqrs.entity_id}/pqrs/{pqrs.id}/{safe_name}"

# ─── Plazos Ley 1755 de 2015 (días hábiles) ─────────────────────────────────
DIAS_RESPUESTA_LEY1755: dict[str, int] = {
    "peticion": 15,
    "queja": 15,
    "reclamo": 15,
    "sugerencia": 15,
    "denuncia": 15,
    "felicitacion": 15,
    "solicitud_informacion": 10,
    "copia": 10,
    "otro": 15,
}


def _festivos_colombia(year: int) -> set[datetime.date]:
    """Calcula los festivos nacionales de Colombia para un año dado
    según la Ley 51 de 1983 (Ley Emiliani) y el Decreto 2663 de 1950."""

    def next_monday(d: datetime.date) -> datetime.date:
        """Si no es lunes, mueve al próximo lunes."""
        days_ahead = (7 - d.weekday()) % 7
        return d + datetime.timedelta(days=days_ahead)

    # --- Pascua (algoritmo anónimo gregoriano) ---
    a = year % 19
    b = year % 4
    c = year % 7
    d = (19 * a + 24) % 30
    e = (2 * b + 4 * c + 6 * d + 5) % 7
    easter_day = 22 + d + e
    if easter_day == 57:
        easter_day = 50
    if d == 29 and e == 6:
        easter_day = 49
    if easter_day > 31:
        easter = datetime.date(year, 4, easter_day - 31)
    else:
        easter = datetime.date(year, 3, easter_day)

    festivos: set[datetime.date] = {
        # Fijos (no trasladables)
        datetime.date(year, 1, 1),   # Año Nuevo
        datetime.date(year, 5, 1),   # Día del Trabajo
        datetime.date(year, 7, 20),  # Independencia
        datetime.date(year, 8, 7),   # Batalla de Boyacá
        datetime.date(year, 12, 8),  # Inmacula Concepción
        datetime.date(year, 12, 25), # Navidad
        # Relativos a Pascua (no trasladables)
        easter + datetime.timedelta(days=-3),  # Jueves Santo
        easter + datetime.timedelta(days=-2),  # Viernes Santo
        # Emiliani — se trasladan al lunes siguiente si no caen en lunes
        next_monday(datetime.date(year, 1, 6)),    # Reyes Magos
        next_monday(datetime.date(year, 3, 19)),   # San José
        next_monday(datetime.date(year, 6, 29)),   # San Pedro y San Pablo
        next_monday(datetime.date(year, 8, 15)),   # Asunción de la Virgen
        next_monday(datetime.date(year, 10, 12)),  # Día de la Raza
        next_monday(datetime.date(year, 11, 1)),   # Todos los Santos
        next_monday(datetime.date(year, 11, 11)),  # Independencia de Cartagena
        # Relativos a Pascua + Emiliani
        next_monday(easter + datetime.timedelta(days=43)),  # Ascensión
        next_monday(easter + datetime.timedelta(days=64)),  # Corpus Christi
        next_monday(easter + datetime.timedelta(days=71)),  # Sagrado Corazón
    }
    return festivos


_festivos_cache: dict[int, set[datetime.date]] = {}


def sumar_dias_habiles(fecha_inicio: datetime.datetime, dias: int) -> datetime.datetime:
    """Suma `dias` días hábiles (lunes–viernes, excluyendo festivos de Colombia)
    y devuelve el último instante de ese día hábil."""
    actual = fecha_inicio.date() if hasattr(fecha_inicio, "date") else fecha_inicio

    # Pre-cargar festivos para el año actual y el siguiente
    for yr in (actual.year, actual.year + 1):
        if yr not in _festivos_cache:
            _festivos_cache[yr] = _festivos_colombia(yr)

    sumados = 0
    while sumados < dias:
        actual += datetime.timedelta(days=1)
        # Cargar festivos del nuevo año si es necesario
        if actual.year not in _festivos_cache:
            _festivos_cache[actual.year] = _festivos_colombia(actual.year)
        if actual.weekday() < 5 and actual not in _festivos_cache[actual.year]:  # lun–vie, no festivo
            sumados += 1

    dt = datetime.datetime.combine(actual, datetime.time(23, 59, 59))
    return timezone.make_aware(dt, timezone.get_current_timezone())


class TipoSolicitud(models.TextChoices):
    PETICION = "peticion", "Petición"
    QUEJA = "queja", "Queja"
    RECLAMO = "reclamo", "Reclamo"
    SUGERENCIA = "sugerencia", "Sugerencia"
    DENUNCIA = "denuncia", "Denuncia"
    FELICITACION = "felicitacion", "Felicitación"
    SOLICITUD_INFORMACION = "solicitud_informacion", "Solicitud de información"
    COPIA = "copia", "Copia de documentos"
    OTRO = "otro", "Otro"


class EstadoPQRS(models.TextChoices):
    RECIBIDA = "recibida", "Recibida"
    ASIGNADA = "asignada", "Asignada"
    EN_PROCESO = "en_proceso", "En proceso"
    RESPONDIDA = "respondida", "Respondida"
    RECHAZADA_ASIGNACION = "rechazada_asignacion", "Asignación rechazada"
    CERRADA = "cerrada", "Cerrada"


class CanalLlegada(models.TextChoices):
    WEB = "web", "Portal web"
    PRESENCIAL = "presencial", "Presencial (ventanilla)"
    EMAIL = "email", "Correo electrónico"
    TELEFONO = "telefono", "Teléfono"
    CARTA = "carta", "Carta"
    BUZON = "buzon", "Buzón de sugerencias"
    ENTREGA_FISICA = "entrega_fisica", "Entrega física en oficina"


class PQRS(models.Model):
    """Tabla `pqrs` (tabla 21). Asignación se hace por SECRETARIA."""

    entity = models.ForeignKey(
        "entities.Entity",
        on_delete=models.CASCADE,
        related_name="pqrs",
        db_column="entity_id",
    )
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="pqrs_creadas",
        db_column="created_by_id",
    )
    assigned_to = models.ForeignKey(
        "entities.Secretaria",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="pqrs_asignadas",
        db_column="assigned_to_id",
        help_text="Secretaría asignada (no usuario individual).",
    )

    numero_radicado = models.CharField(max_length=64, unique=True, db_index=True)

    # Identificación del ciudadano
    tipo_identificacion = models.CharField(max_length=50, default="CC")
    medio_respuesta = models.CharField(max_length=50, default="email")

    nombre_ciudadano = models.CharField(max_length=200, blank=True, null=True)
    cedula_ciudadano = models.CharField(max_length=50, blank=True, null=True)
    telefono_ciudadano = models.CharField(max_length=50, blank=True, null=True)
    email_ciudadano = models.CharField(max_length=150, blank=True, null=True)
    direccion_ciudadano = models.CharField(max_length=300, blank=True, null=True)

    tipo_solicitud = models.CharField(
        max_length=50, choices=TipoSolicitud.choices, default=TipoSolicitud.PETICION
    )
    tipo_persona = models.CharField(max_length=50, blank=True, null=True)
    asunto = models.CharField(max_length=255)
    descripcion = models.TextField()

    estado = models.CharField(
        max_length=50, choices=EstadoPQRS.choices, default=EstadoPQRS.RECIBIDA
    )
    canal_llegada = models.CharField(
        max_length=50, choices=CanalLlegada.choices, default=CanalLlegada.WEB
    )
    dias_respuesta = models.IntegerField(blank=True, null=True)

    respuesta = models.TextField(blank=True, null=True)
    archivo_respuesta = models.CharField(max_length=255, blank=True, null=True)
    justificacion_asignacion = models.TextField(blank=True, null=True)

    email_enviado = models.BooleanField(default=False)
    email_error = models.CharField(max_length=500, blank=True, null=True)
    correo_alerta = models.BooleanField(
        default=False,
        db_index=True,
        help_text="True si algún correo PQRS tiene rebote, error o spam pendiente.",
    )

    fecha_solicitud = models.DateTimeField(default=timezone.now, null=True)
    fecha_cierre = models.DateTimeField(blank=True, null=True)
    fecha_delegacion = models.DateTimeField(blank=True, null=True)
    fecha_respuesta = models.DateTimeField(blank=True, null=True)
    fecha_vencimiento = models.DateTimeField(
        blank=True, null=True,
        help_text="Fecha límite de respuesta según Ley 1755/2015",
    )

    created_at = models.DateTimeField(auto_now_add=True, null=True)
    updated_at = models.DateTimeField(auto_now=True, null=True)

    class Meta:
        db_table = "pqrs"
        verbose_name = "PQRS"
        verbose_name_plural = "PQRS"
        ordering = ["-fecha_solicitud", "-id"]
        indexes = [
            models.Index(fields=["entity", "estado"], name="pqrs_entity_estado_idx"),
            models.Index(fields=["entity", "fecha_solicitud"], name="pqrs_entity_fsol_idx"),
            models.Index(fields=["entity", "fecha_vencimiento"], name="pqrs_entity_venc_idx"),
            models.Index(fields=["entity", "assigned_to"], name="pqrs_entity_asig_idx"),
            models.Index(fields=["assigned_to"], name="pqrs_assigned_to_idx"),
            models.Index(fields=["created_by"], name="pqrs_created_by_idx"),
            models.Index(fields=["fecha_vencimiento"], name="pqrs_fecha_venc_idx"),
            models.Index(fields=["estado"]),
            models.Index(fields=["tipo_solicitud"]),
            models.Index(fields=["canal_llegada"]),
        ]

    def __str__(self) -> str:
        return f"{self.numero_radicado} — {self.asunto[:40]}"

    @classmethod
    def generar_radicado(cls, entity_id: int) -> str:
        """Formato: PQRS-{entity_id}-{YYYYMMDD}-{NNN}."""
        hoy = timezone.localdate()
        prefix = f"PQRS-{entity_id}-{hoy.strftime('%Y%m%d')}"
        with transaction.atomic():
            ultimo = (
                cls.objects.select_for_update()
                .filter(entity_id=entity_id, numero_radicado__startswith=prefix)
                .order_by("-numero_radicado")
                .first()
            )
            if ultimo:
                try:
                    seq = int(ultimo.numero_radicado.split("-")[-1]) + 1
                except (ValueError, IndexError):
                    seq = 1
            else:
                seq = 1
        return f"{prefix}-{seq:03d}"


class AsignacionAuditoria(models.Model):
    """Tabla `asignacion_auditoria` (tabla 5). Historial de (re)asignaciones."""

    pqrs = models.ForeignKey(
        PQRS,
        on_delete=models.CASCADE,
        related_name="auditoria",
        db_column="pqrs_id",
    )
    # Mantenemos los campos originales (FK a usuarios) Y agregamos secretaría
    usuario_anterior = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="auditorias_como_anterior",
        db_column="usuario_anterior_id",
    )
    usuario_nuevo = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="auditorias_como_nuevo",
        db_column="usuario_nuevo_id",
    )
    secretaria_anterior = models.ForeignKey(
        "entities.Secretaria",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="auditorias_como_anterior",
        db_column="secretaria_anterior_id",
    )
    secretaria_nueva = models.ForeignKey(
        "entities.Secretaria",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="auditorias_como_nueva",
        db_column="secretaria_nueva_id",
    )
    accion = models.CharField(
        max_length=30,
        default="asignacion",
        help_text="asignacion | reasignacion | rechazo | respuesta",
    )
    justificacion = models.TextField(blank=True, null=True)
    fecha_asignacion = models.DateTimeField(default=timezone.now, null=True)

    class Meta:
        db_table = "asignacion_auditoria"
        verbose_name = "Auditoría de asignación"
        verbose_name_plural = "Auditorías de asignación"
        ordering = ["-fecha_asignacion", "-id"]
        indexes = [
            models.Index(fields=["pqrs"]),
            models.Index(fields=["-fecha_asignacion"]),
        ]


class PQRSArchivo(models.Model):
    """Archivos adjuntos del ciudadano para una PQRS (máx 4 por PQRS)."""

    MAX_ARCHIVOS = 4

    pqrs = models.ForeignKey(
        PQRS,
        on_delete=models.CASCADE,
        related_name="archivos",
        db_column="pqrs_id",
    )
    archivo = models.FileField(
        upload_to=pqrs_archivo_upload_path,
        storage=pqrs_file_storage,
        max_length=500,
    )
    nombre_original = models.CharField(max_length=255, blank=True, default="")
    content_type = models.CharField(max_length=120, blank=True, default="")
    size = models.PositiveIntegerField(default=0)
    uploaded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="pqrs_archivos_subidos",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "pqrs_archivos"
        verbose_name = "Archivo PQRS"
        verbose_name_plural = "Archivos PQRS"
        ordering = ["created_at", "id"]
        indexes = [
            models.Index(fields=["pqrs"]),
        ]

    def __str__(self) -> str:
        return f"{self.pqrs_id} — {self.nombre_original or self.archivo.name}"


class TipoCorreoPQRS(models.TextChoices):
    RADICACION = "radicacion", "Radicación"
    RESPUESTA = "respuesta", "Respuesta"


class EstadoCorreoPQRS(models.TextChoices):
    PENDIENTE = "pendiente", "Pendiente"
    ENVIADO = "enviado", "Enviado"
    ENTREGADO = "entregado", "Entregado"
    REBOTE_TEMPORAL = "rebote_temporal", "Rebote temporal"
    REBOTADO = "rebotado", "Rebotado"
    RECLAMACION_SPAM = "reclamacion_spam", "Marcado como spam"
    ERROR = "error", "Error"


class PQRSCorreo(models.Model):
    """Historial y estado de correos PQRS enviados vía ZeptoMail."""

    pqrs = models.ForeignKey(
        PQRS,
        on_delete=models.CASCADE,
        related_name="correos",
        db_column="pqrs_id",
    )
    tipo = models.CharField(max_length=20, choices=TipoCorreoPQRS.choices)
    asunto = models.CharField(max_length=255)
    cuerpo_resumen = models.TextField(blank=True, default="")
    request_id = models.CharField(max_length=128, blank=True, null=True, db_index=True)
    estado = models.CharField(
        max_length=20,
        choices=EstadoCorreoPQRS.choices,
        default=EstadoCorreoPQRS.PENDIENTE,
    )
    error = models.CharField(max_length=500, blank=True, null=True)
    destinatarios = models.JSONField(default=list, blank=True)
    enviado_por = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="pqrs_correos_enviados",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "pqrs_correos"
        verbose_name = "Correo PQRS"
        verbose_name_plural = "Correos PQRS"
        ordering = ["-created_at", "-id"]
        indexes = [
            models.Index(fields=["pqrs", "-created_at"]),
            models.Index(fields=["request_id"]),
        ]

    def __str__(self) -> str:
        return f"{self.pqrs_id} — {self.tipo} — {self.estado}"

