"""Correspondencia oficial — entrada/salida, SLA días hábiles, anexos B2."""
from __future__ import annotations

from django.conf import settings
from django.db import models
from django.utils import timezone


class SentidoCorrespondencia(models.TextChoices):
    ENTRADA = "entrada", "Entrada"
    SALIDA = "salida", "Salida"


class CanalCorrespondencia(models.TextChoices):
    FISICO = "fisico", "Físico"
    CORREO = "correo", "Correo electrónico"
    DIGITAL = "digital", "Digital"


class TipologiaCorrespondencia(models.TextChoices):
    OFICIO = "oficio", "Oficio"
    MEMORANDO = "memorando", "Memorando"
    CIRCULAR = "circular", "Circular"
    DERECHO_PETICION = "derecho_peticion", "Derecho de petición"
    REMISION = "remision", "Remisión"
    OTRO = "otro", "Otro"


class EstadoCorrespondencia(models.TextChoices):
    RADICADA = "radicada", "Radicada"
    EN_TRAMITE = "en_tramite", "En trámite"
    RESPONDIDA = "respondida", "Respondida"
    CERRADA = "cerrada", "Cerrada"
    ARCHIVADA = "archivada", "Archivada"


class TipoAnexo(models.TextChoices):
    SOLICITUD = "solicitud", "Solicitud"
    RESPUESTA = "respuesta", "Respuesta"
    OTRO = "otro", "Otro"


class TipoEventoCorrespondencia(models.TextChoices):
    CREACION = "creacion", "Creación"
    CAMBIO_ESTADO = "cambio_estado", "Cambio de estado"
    ASIGNACION = "asignacion", "Asignación"
    ANEXO = "anexo", "Anexo"
    RESPUESTA = "respuesta", "Respuesta"
    OTRO = "otro", "Otro"


DIAS_HABILES_CHOICES = ((5, "5"), (10, "10"), (15, "15"), (30, "30"))
DEFAULT_DIAS_HABILES = 15


class Correspondencia(models.Model):
    entity = models.ForeignKey(
        "entities.Entity",
        on_delete=models.CASCADE,
        related_name="correspondencias",
        db_column="entity_id",
    )
    numero_radicado = models.CharField(max_length=40)
    sentido = models.CharField(max_length=20, choices=SentidoCorrespondencia.choices)
    tipologia = models.CharField(
        max_length=40,
        choices=TipologiaCorrespondencia.choices,
        default=TipologiaCorrespondencia.OFICIO,
    )
    fecha_radicacion = models.DateTimeField(default=timezone.now)

    remitente_nombre = models.CharField(max_length=250)
    remitente_documento = models.CharField(max_length=50, blank=True, default="")
    remitente_dependencia = models.CharField(max_length=250, blank=True, default="")

    destinatario_nombre = models.CharField(max_length=250)
    destinatario_documento = models.CharField(max_length=50, blank=True, default="")
    destinatario_dependencia = models.CharField(max_length=250, blank=True, default="")

    canal = models.CharField(max_length=20, choices=CanalCorrespondencia.choices)
    contacto_email = models.EmailField(blank=True, default="")
    contacto_direccion = models.CharField(max_length=400, blank=True, default="")

    asunto = models.CharField(max_length=500)
    descripcion = models.TextField(blank=True, default="")
    numero_folios = models.PositiveIntegerField(default=1)

    secretaria = models.ForeignKey(
        "entities.Secretaria",
        on_delete=models.PROTECT,
        related_name="correspondencias",
        db_column="secretaria_id",
    )
    assigned_to = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="correspondencias_asignadas",
        db_column="assigned_to_id",
    )

    estado = models.CharField(
        max_length=20,
        choices=EstadoCorrespondencia.choices,
        default=EstadoCorrespondencia.RADICADA,
    )
    dias_habiles_respuesta = models.PositiveSmallIntegerField(
        default=DEFAULT_DIAS_HABILES,
        choices=DIAS_HABILES_CHOICES,
    )
    fecha_vencimiento = models.DateTimeField()

    respuesta_texto = models.TextField(blank=True, default="")
    fecha_respuesta = models.DateTimeField(null=True, blank=True)

    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="correspondencias_creadas",
        db_column="created_by_id",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "correspondencia"
        verbose_name = "Correspondencia"
        verbose_name_plural = "Correspondencias"
        ordering = ["-fecha_radicacion", "-id"]
        constraints = [
            models.UniqueConstraint(
                fields=["entity", "numero_radicado"],
                name="uniq_correspondencia_entity_radicado",
            ),
        ]
        indexes = [
            models.Index(fields=["entity", "fecha_radicacion"], name="corr_ent_fecha_idx"),
            models.Index(fields=["entity", "estado"], name="corr_ent_estado_idx"),
            models.Index(fields=["entity", "sentido"], name="corr_ent_sentido_idx"),
            models.Index(fields=["entity", "secretaria"], name="corr_ent_sec_idx"),
        ]

    def __str__(self) -> str:
        return f"{self.numero_radicado} ({self.sentido})"

    def sla_status(self) -> str:
        """en_plazo | por_vencer | vencida | cerrado."""
        if self.estado in {
            EstadoCorrespondencia.RESPONDIDA,
            EstadoCorrespondencia.CERRADA,
            EstadoCorrespondencia.ARCHIVADA,
        }:
            return "cerrado"
        now = timezone.now()
        if self.fecha_vencimiento < now:
            return "vencida"
        delta = self.fecha_vencimiento - now
        if delta.days <= 2:
            return "por_vencer"
        return "en_plazo"


class CorrespondenciaAnexo(models.Model):
    correspondencia = models.ForeignKey(
        Correspondencia,
        on_delete=models.CASCADE,
        related_name="anexos",
        db_column="correspondencia_id",
    )
    tipo = models.CharField(max_length=20, choices=TipoAnexo.choices, default=TipoAnexo.SOLICITUD)
    nombre = models.CharField(max_length=255)
    b2_key = models.CharField(max_length=500)
    content_type = models.CharField(max_length=120, blank=True, default="")
    size = models.PositiveIntegerField(default=0)
    uploaded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="correspondencia_anexos",
        db_column="uploaded_by_id",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "correspondencia_anexos"
        ordering = ["-created_at"]

    def __str__(self) -> str:
        return self.nombre


class CorrespondenciaEvento(models.Model):
    correspondencia = models.ForeignKey(
        Correspondencia,
        on_delete=models.CASCADE,
        related_name="eventos",
        db_column="correspondencia_id",
    )
    tipo = models.CharField(max_length=30, choices=TipoEventoCorrespondencia.choices)
    detalle = models.JSONField(default=dict, blank=True)
    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="correspondencia_eventos",
        db_column="actor_id",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "correspondencia_eventos"
        ordering = ["-created_at"]

    def __str__(self) -> str:
        return f"{self.tipo} @ {self.created_at}"
