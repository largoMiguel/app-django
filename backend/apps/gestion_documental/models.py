"""Modelos SGDEA — Ley 594 / Acuerdo AGN 001 de 2024."""
from __future__ import annotations

from django.conf import settings
from django.db import models
from django.utils import timezone


class TipoInstrumento(models.TextChoices):
    CCD = "ccd", "Cuadro de Clasificación Documental (CCD)"
    TRD = "trd", "Tabla de Retención Documental (TRD)"
    TVD = "tvd", "Tabla de Valoración Documental (TVD)"
    PGD = "pgd", "Programa de Gestión Documental (PGD)"
    PINAR = "pinar", "Plan Institucional de Archivos (PINAR)"
    FUID = "fuid", "Formato Único de Inventario Documental (FUID)"
    SIC = "sic", "Sistema Integrado de Conservación (SIC)"
    BANCO_TERMINOLOGICO = "banco_terminologico", "Banco terminológico"
    MODELO_REQUISITOS = "modelo_requisitos", "Modelo de requisitos documentos electrónicos"
    DIAGNOSTICO = "diagnostico", "Diagnóstico integral de gestión documental"


class EstadoInstrumento(models.TextChoices):
    BORRADOR = "borrador", "Borrador"
    APROBADO_COMITE = "aprobado_comite", "Aprobado Comité Interno de Archivo"
    PRESENTADO_CONSEJO = "presentado_consejo", "Presentado al Consejo Territorial"
    CONVALIDADO = "convalidado", "Convalidado"
    INSCRITO_RUSD = "inscrito_rusd", "Inscrito en RUSD"
    VIGENTE = "vigente", "Vigente"


class DisposicionFinal(models.TextChoices):
    CT = "CT", "Conservación total"
    S = "S", "Selección"
    E = "E", "Eliminación"
    MD = "MD", "Microfilmación / digitalización"


class EtapaExpediente(models.TextChoices):
    GESTION = "gestion", "Archivo de gestión"
    CENTRAL = "central", "Archivo central"
    HISTORICO = "historico", "Archivo histórico"


class EstadoExpediente(models.TextChoices):
    ABIERTO = "abierto", "Abierto"
    CERRADO = "cerrado", "Cerrado"


class SoporteExpediente(models.TextChoices):
    FISICO = "fisico", "Físico"
    ELECTRONICO = "electronico", "Electrónico"
    HIBRIDO = "hibrido", "Híbrido"


class TipoTransferencia(models.TextChoices):
    PRIMARIA = "primaria", "Transferencia primaria"
    SECUNDARIA = "secundaria", "Transferencia secundaria"


class EstadoTransferencia(models.TextChoices):
    BORRADOR = "borrador", "Borrador"
    EJECUTADA = "ejecutada", "Ejecutada"


class TipoEventoGD(models.TextChoices):
    CREACION = "creacion", "Creación"
    CAMBIO_ESTADO = "cambio_estado", "Cambio de estado"
    DOCUMENTO = "documento", "Documento"
    TRANSFERENCIA = "transferencia", "Transferencia"
    DISPOSICION = "disposicion", "Disposición"
    INSTRUMENTO = "instrumento", "Instrumento archivístico"
    OTRO = "otro", "Otro"


class InstrumentoArchivistico(models.Model):
    entity = models.ForeignKey(
        "entities.Entity",
        on_delete=models.CASCADE,
        related_name="instrumentos_archivisticos",
        db_column="entity_id",
    )
    tipo = models.CharField(max_length=40, choices=TipoInstrumento.choices)
    vigencia = models.PositiveSmallIntegerField()
    version = models.CharField(max_length=50, blank=True, default="1.0")
    estado = models.CharField(
        max_length=30,
        choices=EstadoInstrumento.choices,
        default=EstadoInstrumento.BORRADOR,
    )
    titulo = models.CharField(max_length=300, blank=True, default="")
    acta_comite = models.CharField(max_length=100, blank=True, default="")
    fecha_aprobacion_comite = models.DateField(null=True, blank=True)
    fecha_convalidacion = models.DateField(null=True, blank=True)
    codigo_rusd = models.CharField(max_length=100, blank=True, default="")
    b2_key = models.CharField(max_length=500, blank=True, default="")
    nombre_archivo = models.CharField(max_length=255, blank=True, default="")
    content_type = models.CharField(max_length=120, blank=True, default="")
    size = models.PositiveIntegerField(default=0)
    notas = models.TextField(blank=True, default="")
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="instrumentos_gd_creados",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "gd_instrumentos"
        ordering = ["-vigencia", "-updated_at"]
        indexes = [
            models.Index(fields=["entity", "tipo", "estado"]),
            models.Index(fields=["entity", "vigencia"]),
        ]

    def __str__(self) -> str:
        return f"{self.get_tipo_display()} {self.vigencia} ({self.entity_id})"


class UnidadAdministrativa(models.Model):
    entity = models.ForeignKey(
        "entities.Entity",
        on_delete=models.CASCADE,
        related_name="unidades_administrativas_gd",
        db_column="entity_id",
    )
    codigo = models.CharField(max_length=30)
    nombre = models.CharField(max_length=250)
    secretaria = models.ForeignKey(
        "entities.Secretaria",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="unidades_administrativas_gd",
    )
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "gd_unidades_administrativas"
        unique_together = (("entity", "codigo"),)
        ordering = ["codigo"]
        indexes = [models.Index(fields=["entity", "is_active"])]

    def __str__(self) -> str:
        return f"{self.codigo} — {self.nombre}"


class SerieDocumental(models.Model):
    entity = models.ForeignKey(
        "entities.Entity",
        on_delete=models.CASCADE,
        related_name="series_documentales",
        db_column="entity_id",
    )
    unidad = models.ForeignKey(
        UnidadAdministrativa,
        on_delete=models.CASCADE,
        related_name="series",
        null=True,
        blank=True,
    )
    instrumento = models.ForeignKey(
        InstrumentoArchivistico,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="series",
    )
    parent = models.ForeignKey(
        "self",
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="subseries",
    )
    codigo = models.CharField(max_length=50)
    nombre = models.CharField(max_length=300)
    es_subserie = models.BooleanField(default=False)
    tipos_documentales = models.JSONField(default=list, blank=True)
    retencion_gestion_anios = models.PositiveSmallIntegerField(default=0)
    retencion_central_anios = models.PositiveSmallIntegerField(default=0)
    disposicion_final = models.CharField(
        max_length=5,
        choices=DisposicionFinal.choices,
        default=DisposicionFinal.CT,
    )
    procedimiento = models.TextField(blank=True, default="")
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "gd_series_documentales"
        ordering = ["codigo"]
        indexes = [
            models.Index(fields=["entity", "codigo"]),
            models.Index(fields=["entity", "is_active"]),
        ]

    def __str__(self) -> str:
        return f"{self.codigo} — {self.nombre}"


class Expediente(models.Model):
    entity = models.ForeignKey(
        "entities.Entity",
        on_delete=models.CASCADE,
        related_name="expedientes_gd",
        db_column="entity_id",
    )
    codigo = models.CharField(max_length=60)
    titulo = models.CharField(max_length=400)
    serie = models.ForeignKey(
        SerieDocumental,
        on_delete=models.PROTECT,
        related_name="expedientes",
    )
    unidad = models.ForeignKey(
        UnidadAdministrativa,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="expedientes",
    )
    secretaria = models.ForeignKey(
        "entities.Secretaria",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="expedientes_gd",
    )
    responsable = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="expedientes_gd_responsable",
    )
    etapa = models.CharField(
        max_length=20,
        choices=EtapaExpediente.choices,
        default=EtapaExpediente.GESTION,
    )
    estado = models.CharField(
        max_length=20,
        choices=EstadoExpediente.choices,
        default=EstadoExpediente.ABIERTO,
    )
    soporte = models.CharField(
        max_length=20,
        choices=SoporteExpediente.choices,
        default=SoporteExpediente.ELECTRONICO,
    )
    fecha_extrema_inicial = models.DateField(null=True, blank=True)
    fecha_extrema_final = models.DateField(null=True, blank=True)
    folios = models.PositiveIntegerField(default=0)
    notas = models.TextField(blank=True, default="")
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="expedientes_gd_creados",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "gd_expedientes"
        unique_together = (("entity", "codigo"),)
        ordering = ["-updated_at"]
        indexes = [
            models.Index(fields=["entity", "etapa"]),
            models.Index(fields=["entity", "estado"]),
            models.Index(fields=["entity", "secretaria"]),
        ]

    def __str__(self) -> str:
        return f"{self.codigo} — {self.titulo}"


class DocumentoExpediente(models.Model):
    expediente = models.ForeignKey(
        Expediente,
        on_delete=models.CASCADE,
        related_name="documentos",
    )
    entity = models.ForeignKey(
        "entities.Entity",
        on_delete=models.CASCADE,
        related_name="documentos_expediente_gd",
        db_column="entity_id",
    )
    nombre = models.CharField(max_length=255)
    tipo_documental = models.CharField(max_length=150, blank=True, default="")
    b2_key = models.CharField(max_length=500, blank=True, default="")
    content_type = models.CharField(max_length=120, blank=True, default="")
    size = models.PositiveIntegerField(default=0)
    sha256 = models.CharField(max_length=64, blank=True, default="")
    version = models.PositiveSmallIntegerField(default=1)
    folio_inicio = models.PositiveIntegerField(null=True, blank=True)
    folio_fin = models.PositiveIntegerField(null=True, blank=True)
    fecha_documento = models.DateField(null=True, blank=True)
    uploaded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="documentos_gd_subidos",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "gd_documentos_expediente"
        ordering = ["-created_at"]
        indexes = [models.Index(fields=["entity", "expediente"])]

    def __str__(self) -> str:
        return self.nombre


class FuidRegistro(models.Model):
    entity = models.ForeignKey(
        "entities.Entity",
        on_delete=models.CASCADE,
        related_name="fuid_registros",
        db_column="entity_id",
    )
    expediente = models.ForeignKey(
        Expediente,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="fuid_registros",
    )
    codigo = models.CharField(max_length=50, blank=True, default="")
    serie_nombre = models.CharField(max_length=300, blank=True, default="")
    subserie_nombre = models.CharField(max_length=300, blank=True, default="")
    unidad_documental = models.CharField(max_length=400)
    fecha_inicial = models.DateField(null=True, blank=True)
    fecha_final = models.DateField(null=True, blank=True)
    soporte_fisico = models.BooleanField(default=False)
    soporte_electronico = models.BooleanField(default=True)
    caja = models.CharField(max_length=50, blank=True, default="")
    carpeta = models.CharField(max_length=50, blank=True, default="")
    tomo = models.CharField(max_length=50, blank=True, default="")
    folios = models.PositiveIntegerField(default=0)
    ubicacion = models.CharField(max_length=300, blank=True, default="")
    notas = models.TextField(blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "gd_fuid_registros"
        ordering = ["-created_at"]
        indexes = [models.Index(fields=["entity", "created_at"])]

    def __str__(self) -> str:
        return self.unidad_documental


class Transferencia(models.Model):
    entity = models.ForeignKey(
        "entities.Entity",
        on_delete=models.CASCADE,
        related_name="transferencias_gd",
        db_column="entity_id",
    )
    tipo = models.CharField(max_length=20, choices=TipoTransferencia.choices)
    estado = models.CharField(
        max_length=20,
        choices=EstadoTransferencia.choices,
        default=EstadoTransferencia.BORRADOR,
    )
    acta = models.CharField(max_length=100, blank=True, default="")
    b2_key_acta = models.CharField(max_length=500, blank=True, default="")
    notas = models.TextField(blank=True, default="")
    expedientes = models.ManyToManyField(Expediente, related_name="transferencias")
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="transferencias_gd_creadas",
    )
    ejecutada_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "gd_transferencias"
        ordering = ["-created_at"]
        indexes = [models.Index(fields=["entity", "tipo", "estado"])]

    def __str__(self) -> str:
        return f"{self.get_tipo_display()} ({self.entity_id})"


class Disposicion(models.Model):
    entity = models.ForeignKey(
        "entities.Entity",
        on_delete=models.CASCADE,
        related_name="disposiciones_gd",
        db_column="entity_id",
    )
    disposicion_final = models.CharField(max_length=5, choices=DisposicionFinal.choices)
    acta = models.CharField(max_length=100, blank=True, default="")
    b2_key_acta = models.CharField(max_length=500, blank=True, default="")
    notas = models.TextField(blank=True, default="")
    expedientes = models.ManyToManyField(Expediente, related_name="disposiciones")
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="disposiciones_gd_creadas",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "gd_disposiciones"
        ordering = ["-created_at"]
        indexes = [models.Index(fields=["entity", "disposicion_final"])]

    def __str__(self) -> str:
        return f"Disposición {self.disposicion_final} ({self.entity_id})"


class EventoGD(models.Model):
    entity = models.ForeignKey(
        "entities.Entity",
        on_delete=models.CASCADE,
        related_name="eventos_gd",
        db_column="entity_id",
    )
    tipo = models.CharField(max_length=30, choices=TipoEventoGD.choices)
    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="eventos_gd",
    )
    detalle = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "gd_eventos"
        ordering = ["-created_at"]
        indexes = [models.Index(fields=["entity", "tipo", "created_at"])]

    def __str__(self) -> str:
        return f"{self.tipo} @ {self.created_at}"
