"""Modelos — Planes Institucionales (Decreto 612 de 2018)."""
from __future__ import annotations

from django.conf import settings
from django.db import models

from apps.common.storages import planes_file_storage


class PlanEstado(models.TextChoices):
    BORRADOR = "BORRADOR", "Borrador"
    PUBLICADO = "PUBLICADO", "Publicado"
    EN_EJECUCION = "EN_EJECUCION", "En ejecución"
    CERRADO = "CERRADO", "Cerrado"


class ActividadEstado(models.TextChoices):
    PENDIENTE = "PENDIENTE", "Pendiente"
    EN_PROGRESO = "EN_PROGRESO", "En progreso"
    COMPLETADA = "COMPLETADA", "Completada"
    CANCELADA = "CANCELADA", "Cancelada"


class Trimestre(models.IntegerChoices):
    I = 1, "Trimestre I"
    II = 2, "Trimestre II"
    III = 3, "Trimestre III"
    IV = 4, "Trimestre IV"


class PlanCatalogo(models.Model):
    """Catálogo de planes: globales (Decreto 612) o propios por entidad."""

    entity = models.ForeignKey(
        "entities.Entity",
        on_delete=models.CASCADE,
        related_name="planes_catalogo",
        db_column="entity_id",
        null=True,
        blank=True,
    )
    codigo = models.CharField(max_length=64, db_index=True)
    nombre = models.CharField(max_length=512)
    orden = models.PositiveSmallIntegerField(default=0)
    es_decreto612 = models.BooleanField(default=False)
    descripcion = models.TextField(blank=True, default="")
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True, null=True)
    updated_at = models.DateTimeField(auto_now=True, null=True)

    class Meta:
        db_table = "planes_catalogo"
        verbose_name = "Catálogo de plan institucional"
        verbose_name_plural = "Catálogo de planes institucionales"
        ordering = ["orden", "nombre"]
        constraints = [
            models.UniqueConstraint(
                fields=("entity", "codigo"),
                name="uq_planes_catalogo_entity_codigo",
            ),
            models.UniqueConstraint(
                fields=("codigo",),
                condition=models.Q(entity__isnull=True),
                name="uq_planes_catalogo_global_codigo",
            ),
        ]

    def __str__(self) -> str:
        return self.nombre


class PlanInstitucional(models.Model):
    """Plan institucional de una entidad para una vigencia (año)."""

    entity = models.ForeignKey(
        "entities.Entity",
        on_delete=models.CASCADE,
        related_name="planes_institucionales",
        db_column="entity_id",
    )
    catalogo = models.ForeignKey(
        PlanCatalogo,
        on_delete=models.PROTECT,
        related_name="planes",
        db_column="catalogo_id",
    )
    anio = models.IntegerField(db_index=True)
    nombre = models.CharField(max_length=512)
    objetivo = models.TextField(blank=True, default="")
    responsable_secretaria = models.ForeignKey(
        "entities.Secretaria",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="planes_responsable",
        db_column="responsable_secretaria_id",
    )
    responsable_secretaria_nombre = models.CharField(max_length=256, blank=True, default="")
    responsable_usuario = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="planes_responsable_usuario",
        db_column="responsable_usuario_id",
    )
    fecha_publicacion = models.DateField(null=True, blank=True)
    url_publicacion = models.CharField(max_length=1024, blank=True, default="")
    estado = models.CharField(
        max_length=32,
        choices=PlanEstado.choices,
        default=PlanEstado.BORRADOR,
    )
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="planes_creados",
        db_column="created_by_id",
    )
    created_at = models.DateTimeField(auto_now_add=True, null=True)
    updated_at = models.DateTimeField(auto_now=True, null=True)

    class Meta:
        db_table = "planes_institucionales"
        verbose_name = "Plan institucional"
        verbose_name_plural = "Planes institucionales"
        ordering = ["anio", "catalogo__orden", "nombre"]
        constraints = [
            models.UniqueConstraint(
                fields=("entity", "catalogo", "anio"),
                name="uq_plan_entity_catalogo_anio",
            ),
        ]
        indexes = [
            models.Index(fields=("entity", "anio"), name="plan_entity_anio_idx"),
            models.Index(fields=("entity", "responsable_secretaria"), name="plan_entity_sec_idx"),
        ]

    def __str__(self) -> str:
        return f"{self.nombre} ({self.anio})"


class PlanActividad(models.Model):
    """Actividad o componente de un plan por trimestre."""

    entity = models.ForeignKey(
        "entities.Entity",
        on_delete=models.CASCADE,
        related_name="planes_actividades",
        db_column="entity_id",
    )
    plan = models.ForeignKey(
        PlanInstitucional,
        on_delete=models.CASCADE,
        related_name="actividades",
        db_column="plan_id",
    )
    anio = models.IntegerField(db_index=True)
    trimestre = models.PositiveSmallIntegerField(choices=Trimestre.choices, db_index=True)
    nombre = models.CharField(max_length=512)
    descripcion = models.TextField(blank=True, default="")
    meta = models.CharField(max_length=512, blank=True, default="")
    indicador = models.CharField(max_length=512, blank=True, default="")
    fecha_inicio = models.DateField(null=True, blank=True)
    fecha_fin = models.DateField(null=True, blank=True)
    responsable_secretaria = models.ForeignKey(
        "entities.Secretaria",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="planes_actividades_responsable",
        db_column="responsable_secretaria_id",
    )
    responsable_usuario = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="planes_actividades_responsable_usuario",
        db_column="responsable_usuario_id",
    )
    estado = models.CharField(
        max_length=64,
        choices=ActividadEstado.choices,
        default=ActividadEstado.PENDIENTE,
    )
    avance = models.PositiveSmallIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True, null=True)
    updated_at = models.DateTimeField(auto_now=True, null=True)

    class Meta:
        db_table = "planes_actividades"
        verbose_name = "Actividad de plan institucional"
        verbose_name_plural = "Actividades de planes institucionales"
        ordering = ["trimestre", "fecha_inicio", "id"]
        indexes = [
            models.Index(fields=("entity", "plan"), name="plan_act_entity_plan_idx"),
            models.Index(fields=("entity", "anio", "trimestre"), name="plan_act_entity_anio_tri_idx"),
            models.Index(fields=("entity", "responsable_secretaria"), name="plan_act_entity_sec_idx"),
        ]

    def __str__(self) -> str:
        return self.nombre


def plan_evidencia_archivo_upload_path(instance, filename: str) -> str:
    from .storage_paths import planes_evidencia_archivo_path

    return planes_evidencia_archivo_path(instance.evidencia, filename)


class PlanEvidencia(models.Model):
    """Evidencia de cumplimiento asociada a una actividad."""

    actividad = models.OneToOneField(
        PlanActividad,
        on_delete=models.CASCADE,
        related_name="evidencia",
        db_column="actividad_id",
    )
    entity = models.ForeignKey(
        "entities.Entity",
        on_delete=models.CASCADE,
        related_name="planes_evidencias",
        db_column="entity_id",
    )
    descripcion = models.TextField()
    url_evidencia = models.CharField(max_length=1024, blank=True, null=True)
    fecha_registro = models.DateTimeField(auto_now_add=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True, null=True)
    updated_at = models.DateTimeField(auto_now=True, null=True)

    class Meta:
        db_table = "planes_evidencias"
        verbose_name = "Evidencia de plan"
        verbose_name_plural = "Evidencias de planes"
        indexes = [
            models.Index(fields=("entity", "actividad"), name="plan_evid_entity_act_idx"),
        ]


class PlanEvidenciaArchivo(models.Model):
    """Archivos adjuntos de evidencia (máx. 5 por evidencia)."""

    evidencia = models.ForeignKey(
        PlanEvidencia,
        on_delete=models.CASCADE,
        related_name="archivos",
        db_column="evidencia_id",
    )
    archivo = models.FileField(
        upload_to=plan_evidencia_archivo_upload_path,
        storage=planes_file_storage,
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
        related_name="planes_evidencia_archivos_subidos",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "planes_evidencia_archivos"
        verbose_name = "Archivo evidencia plan"
        verbose_name_plural = "Archivos evidencia plan"
        ordering = ["created_at", "id"]
        indexes = [
            models.Index(fields=["evidencia"], name="plan_evarch_evid_idx"),
        ]

    def __str__(self) -> str:
        return f"{self.evidencia_id} — {self.nombre_original or self.archivo.name}"
