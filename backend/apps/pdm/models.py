"""Modelos del módulo PDM (Plan de Desarrollo Municipal)."""
from __future__ import annotations

from django.conf import settings
from django.db import models

from apps.common.storages import pdm_file_storage


class ActividadEstado(models.TextChoices):
    PENDIENTE = "PENDIENTE", "Pendiente"
    EN_PROGRESO = "EN_PROGRESO", "En progreso"
    COMPLETADA = "COMPLETADA", "Completada"
    CANCELADA = "CANCELADA", "Cancelada"


class PdmProducto(models.Model):
    """Productos del plan indicativo PDM por entidad."""

    entity = models.ForeignKey(
        "entities.Entity",
        on_delete=models.CASCADE,
        related_name="pdm_productos",
        db_column="entity_id",
    )

    codigo_dane = models.CharField(max_length=20, blank=True, null=True)
    entidad_territorial = models.CharField(max_length=256, blank=True, null=True)
    nombre_plan = models.CharField(max_length=512, blank=True, null=True)
    codigo_indicador_producto = models.TextField(blank=True, null=True)
    codigo_producto = models.CharField(max_length=64, db_index=True)

    linea_estrategica = models.TextField(blank=True, null=True)
    codigo_sector = models.TextField(blank=True, null=True)
    sector_mga = models.TextField(blank=True, null=True)
    codigo_programa = models.TextField(blank=True, null=True)
    programa_mga = models.TextField(blank=True, null=True)
    codigo_producto_mga = models.TextField(blank=True, null=True)
    producto_mga = models.TextField(blank=True, null=True)
    codigo_indicador_producto_mga = models.TextField(blank=True, null=True)
    indicador_producto_mga = models.TextField(blank=True, null=True)
    personalizacion_indicador = models.TextField(blank=True, null=True)
    unidad_medida = models.TextField(blank=True, null=True)
    meta_cuatrienio = models.FloatField(blank=True, null=True)
    principal = models.CharField(max_length=10, blank=True, null=True)
    codigo_ods = models.CharField(max_length=50, blank=True, null=True)
    ods = models.TextField(blank=True, null=True)
    tipo_acumulacion = models.TextField(blank=True, null=True)
    bpin = models.CharField(max_length=50, blank=True, null=True)

    responsable_secretaria = models.ForeignKey(
        "entities.Secretaria",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="pdm_productos_responsable",
        db_column="responsable_secretaria_id",
    )
    responsable_secretaria_nombre = models.CharField(max_length=256, blank=True, null=True)

    programacion_2024 = models.FloatField(default=0)
    programacion_2025 = models.FloatField(default=0)
    programacion_2026 = models.FloatField(default=0)
    programacion_2027 = models.FloatField(default=0)

    presupuesto_2024 = models.JSONField(blank=True, null=True)
    presupuesto_2025 = models.JSONField(blank=True, null=True)
    presupuesto_2026 = models.JSONField(blank=True, null=True)
    presupuesto_2027 = models.JSONField(blank=True, null=True)

    total_2024 = models.FloatField(default=0)
    total_2025 = models.FloatField(default=0)
    total_2026 = models.FloatField(default=0)
    total_2027 = models.FloatField(default=0)

    created_at = models.DateTimeField(auto_now_add=True, null=True)
    updated_at = models.DateTimeField(auto_now=True, null=True)

    class Meta:
        db_table = "pdm_productos"
        verbose_name = "Producto PDM"
        verbose_name_plural = "Productos PDM"
        ordering = ["codigo_producto"]
        constraints = [
            models.UniqueConstraint(
                fields=("entity", "codigo_producto"),
                name="uq_pdm_producto_entity_codigo",
            )
        ]
        indexes = [
            models.Index(fields=("entity", "codigo_producto"), name="pdm_prod_entity_codigo_idx"),
            models.Index(fields=("entity", "responsable_secretaria"), name="pdm_prod_entity_sec_idx"),
        ]


class PdmIniciativaSGR(models.Model):
    """Iniciativas SGR asociadas a una entidad en el contexto PDM."""

    entity = models.ForeignKey(
        "entities.Entity",
        on_delete=models.CASCADE,
        related_name="pdm_iniciativas_sgr",
        db_column="entity_id",
    )

    codigo_dane = models.CharField(max_length=20, blank=True, null=True)
    entidad_territorial = models.CharField(max_length=256, blank=True, null=True)
    nombre_plan = models.CharField(max_length=512, blank=True, null=True)
    consecutivo = models.CharField(max_length=128, db_index=True)
    linea_estrategica = models.TextField(blank=True, null=True)
    tipo_iniciativa = models.CharField(max_length=256, blank=True, null=True)
    sector_mga = models.CharField(max_length=256, blank=True, null=True)
    iniciativa_sgr = models.TextField(blank=True, null=True)
    recursos_sgr_indicativos = models.FloatField(default=0)
    bpin = models.CharField(max_length=50, blank=True, null=True)

    created_at = models.DateTimeField(auto_now_add=True, null=True)
    updated_at = models.DateTimeField(auto_now=True, null=True)

    class Meta:
        db_table = "pdm_iniciativas_sgr"
        verbose_name = "Iniciativa SGR"
        verbose_name_plural = "Iniciativas SGR"
        constraints = [
            models.UniqueConstraint(
                fields=("entity", "consecutivo"),
                name="uq_pdm_inic_sgr_entity_consec",
            )
        ]
        indexes = [
            models.Index(fields=("entity", "consecutivo"), name="pdm_inic_entity_consec_idx"),
        ]


class PdmActividad(models.Model):
    """Actividades operativas por producto y año."""

    entity = models.ForeignKey(
        "entities.Entity",
        on_delete=models.CASCADE,
        related_name="pdm_actividades",
        db_column="entity_id",
    )
    codigo_producto = models.CharField(max_length=64, db_index=True)
    anio = models.IntegerField(db_index=True)
    nombre = models.CharField(max_length=512)
    descripcion = models.TextField(blank=True, null=True)
    responsable_secretaria = models.ForeignKey(
        "entities.Secretaria",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="pdm_actividades_responsable",
        db_column="responsable_secretaria_id",
    )
    fecha_inicio = models.DateTimeField(blank=True, null=True)
    fecha_fin = models.DateTimeField(blank=True, null=True)
    meta_ejecutar = models.FloatField(default=0)
    estado = models.CharField(
        max_length=64,
        choices=ActividadEstado.choices,
        default=ActividadEstado.PENDIENTE,
    )
    created_at = models.DateTimeField(auto_now_add=True, null=True)
    updated_at = models.DateTimeField(auto_now=True, null=True)

    class Meta:
        db_table = "pdm_actividades"
        verbose_name = "Actividad PDM"
        verbose_name_plural = "Actividades PDM"
        ordering = ["anio", "id"]
        indexes = [
            models.Index(fields=("entity", "codigo_producto"), name="pdm_act_entity_prod_idx"),
            models.Index(fields=("entity", "anio"), name="pdm_act_entity_anio_idx"),
            models.Index(fields=("entity", "responsable_secretaria"), name="pdm_act_entity_sec_idx"),
        ]


def pdm_evidencia_archivo_upload_path(instance, filename: str) -> str:
    """Ruta: entities/<entity_id>/pdm/evidencias/<codigo>/<anio>/<filename>."""
    from .storage_paths import pdm_evidencia_archivo_path

    return pdm_evidencia_archivo_path(instance.evidencia, filename)


class PdmActividadEvidencia(models.Model):
    """Evidencia de cumplimiento asociada a una actividad."""

    actividad = models.OneToOneField(
        PdmActividad,
        on_delete=models.CASCADE,
        related_name="evidencia",
        db_column="actividad_id",
    )
    entity = models.ForeignKey(
        "entities.Entity",
        on_delete=models.CASCADE,
        related_name="pdm_evidencias",
        db_column="entity_id",
    )
    descripcion = models.TextField()
    url_evidencia = models.CharField(max_length=1024, blank=True, null=True)
    fecha_registro = models.DateTimeField(auto_now_add=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True, null=True)
    updated_at = models.DateTimeField(auto_now=True, null=True)

    class Meta:
        db_table = "pdm_actividades_evidencias"
        verbose_name = "Evidencia PDM"
        verbose_name_plural = "Evidencias PDM"
        indexes = [
            models.Index(fields=("entity", "actividad"), name="pdm_evid_entity_act_idx"),
        ]


class PdmEvidenciaArchivo(models.Model):
    """Imágenes de evidencia PDM (máx. 4 por evidencia)."""

    evidencia = models.ForeignKey(
        PdmActividadEvidencia,
        on_delete=models.CASCADE,
        related_name="archivos",
        db_column="evidencia_id",
    )
    archivo = models.FileField(
        upload_to=pdm_evidencia_archivo_upload_path,
        storage=pdm_file_storage,
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
        related_name="pdm_evidencia_archivos_subidos",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "pdm_evidencia_archivos"
        verbose_name = "Archivo evidencia PDM"
        verbose_name_plural = "Archivos evidencia PDM"
        ordering = ["created_at", "id"]
        indexes = [
            models.Index(fields=["evidencia"], name="pdm_evarch_evid_idx"),
        ]

    def __str__(self) -> str:
        return f"{self.evidencia_id} — {self.nombre_original or self.archivo.name}"


class PDMEjecucionPresupuestal(models.Model):
    """Carga de ejecución presupuestal por producto/fuente/año."""

    entity = models.ForeignKey(
        "entities.Entity",
        on_delete=models.CASCADE,
        related_name="pdm_ejecuciones",
        db_column="entity_id",
    )
    codigo_producto = models.CharField(max_length=64, db_index=True)
    descripcion_fte = models.CharField(max_length=500)
    pto_inicial = models.DecimalField(max_digits=18, decimal_places=2, default=0)
    adicion = models.DecimalField(max_digits=18, decimal_places=2, default=0)
    reduccion = models.DecimalField(max_digits=18, decimal_places=2, default=0)
    credito = models.DecimalField(max_digits=18, decimal_places=2, default=0)
    contracredito = models.DecimalField(max_digits=18, decimal_places=2, default=0)
    pto_definitivo = models.DecimalField(max_digits=18, decimal_places=2, default=0)
    pagos = models.DecimalField(max_digits=18, decimal_places=2, default=0)
    sector = models.CharField(max_length=100, blank=True, null=True)
    dependencia = models.CharField(max_length=200, blank=True, null=True)
    bpin = models.CharField(max_length=50, blank=True, null=True)
    anio = models.IntegerField(blank=True, null=True, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True, null=True)
    updated_at = models.DateTimeField(auto_now=True, null=True)

    class Meta:
        db_table = "pdm_ejecucion_presupuestal"
        verbose_name = "Ejecución presupuestal PDM"
        verbose_name_plural = "Ejecuciones presupuestales PDM"
        constraints = [
            models.UniqueConstraint(
                fields=("entity", "codigo_producto", "descripcion_fte", "anio"),
                name="uq_pdm_ejec_entity_prod_fte_anio",
            )
        ]
        indexes = [
            models.Index(fields=("entity", "codigo_producto", "anio"), name="pdm_ejec_entity_prod_anio_idx"),
            models.Index(fields=("entity", "anio"), name="pdm_ejec_entity_anio_idx"),
        ]


class PdmChatConversation(models.Model):
    """Conversación pública del chat IA del PDM."""

    entity = models.ForeignKey(
        "entities.Entity",
        on_delete=models.CASCADE,
        related_name="pdm_chat_conversations",
        db_column="entity_id",
    )
    session_uuid = models.UUIDField(db_index=True)
    ip_hash = models.CharField(max_length=64, blank=True, default="")
    user_agent = models.CharField(max_length=500, blank=True, default="")
    message_count = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "pdm_chat_conversations"
        verbose_name = "Conversación chat PDM"
        verbose_name_plural = "Conversaciones chat PDM"
        ordering = ["-updated_at"]
        indexes = [
            models.Index(fields=("entity", "created_at"), name="pdm_chat_conv_entity_idx"),
        ]


class PdmChatMessage(models.Model):
    """Mensaje individual en una conversación del chat PDM."""

    class Role(models.TextChoices):
        USER = "user", "Usuario"
        ASSISTANT = "assistant", "Asistente"

    conversation = models.ForeignKey(
        PdmChatConversation,
        on_delete=models.CASCADE,
        related_name="messages",
        db_column="conversation_id",
    )
    role = models.CharField(max_length=16, choices=Role.choices)
    content = models.TextField()
    meta = models.JSONField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "pdm_chat_messages"
        verbose_name = "Mensaje chat PDM"
        verbose_name_plural = "Mensajes chat PDM"
        ordering = ["created_at"]
        indexes = [
            models.Index(fields=("conversation", "created_at"), name="pdm_chat_msg_conv_idx"),
        ]


class PDMContratoRPS(models.Model):
    """Contratos RPS importados por entidad y año."""

    entity = models.ForeignKey(
        "entities.Entity",
        on_delete=models.CASCADE,
        related_name="pdm_contratos_rps",
        db_column="entity_id",
    )
    codigo_producto = models.TextField(db_index=True)
    no_crp = models.CharField(max_length=100)
    concepto = models.TextField(blank=True, null=True)
    valor = models.DecimalField(max_digits=18, decimal_places=2, default=0)
    anio = models.IntegerField(db_index=True)
    contratista = models.CharField(max_length=500, blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True, null=True)
    updated_at = models.DateTimeField(auto_now=True, null=True)

    class Meta:
        db_table = "pdm_contratos_rps"
        verbose_name = "Contrato RPS PDM"
        verbose_name_plural = "Contratos RPS PDM"
        indexes = [
            models.Index(fields=("entity", "codigo_producto", "anio"), name="pdm_ctr_entity_prod_anio_idx"),
            models.Index(fields=("entity", "anio"), name="pdm_ctr_entity_anio_idx"),
        ]
