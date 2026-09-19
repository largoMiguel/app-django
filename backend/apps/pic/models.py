"""Modelos — PIC (Plan de Intervenciones Colectivas)."""
from __future__ import annotations

from decimal import Decimal

from django.conf import settings
from django.db import models

from apps.common.storages import pic_file_storage


class Trimestre(models.IntegerChoices):
    I = 1, "Trimestre I"
    II = 2, "Trimestre II"
    III = 3, "Trimestre III"
    IV = 4, "Trimestre IV"


class PicPlan(models.Model):
    """Plan PIC cargado por vigencia (año)."""

    entity = models.ForeignKey(
        "entities.Entity",
        on_delete=models.CASCADE,
        related_name="pic_planes",
        db_column="entity_id",
    )
    anio = models.IntegerField(db_index=True)
    archivo_nombre = models.CharField(max_length=512, blank=True, default="")
    uploaded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="pic_planes_subidos",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "pic_planes"
        verbose_name = "Plan PIC"
        verbose_name_plural = "Planes PIC"
        constraints = [
            models.UniqueConstraint(
                fields=("entity", "anio"),
                name="uq_pic_plan_entity_anio",
            ),
        ]
        indexes = [
            models.Index(fields=("entity", "anio"), name="pic_plan_entity_anio_idx"),
        ]

    def __str__(self) -> str:
        return f"PIC {self.anio} — {self.entity_id}"


class PicCargo(models.Model):
    """Mapeo cargo del Excel → usuarios responsables."""

    entity = models.ForeignKey(
        "entities.Entity",
        on_delete=models.CASCADE,
        related_name="pic_cargos",
        db_column="entity_id",
    )
    etiqueta = models.CharField(max_length=256)
    etiqueta_norm = models.CharField(max_length=256, db_index=True)
    secretaria = models.ForeignKey(
        "entities.Secretaria",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="pic_cargos",
        db_column="secretaria_id",
    )
    usuarios = models.ManyToManyField(
        settings.AUTH_USER_MODEL,
        related_name="pic_cargos_asignados",
        blank=True,
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "pic_cargos"
        verbose_name = "Cargo PIC"
        verbose_name_plural = "Cargos PIC"
        constraints = [
            models.UniqueConstraint(
                fields=("entity", "etiqueta_norm"),
                name="uq_pic_cargo_entity_etiqueta",
            ),
        ]

    def __str__(self) -> str:
        return self.etiqueta


class PicActividad(models.Model):
    """Actividad del plan PIC."""

    entity = models.ForeignKey(
        "entities.Entity",
        on_delete=models.CASCADE,
        related_name="pic_actividades",
        db_column="entity_id",
    )
    plan = models.ForeignKey(
        PicPlan,
        on_delete=models.CASCADE,
        related_name="actividades",
        db_column="plan_id",
    )
    numero = models.PositiveIntegerField(db_index=True)
    eje_estrategico = models.TextField(blank=True, default="")
    linea_operativa = models.TextField(blank=True, default="")
    encargado_texto = models.CharField(max_length=256, blank=True, default="")
    actividad = models.TextField()
    soportes = models.TextField(blank=True, default="")
    unidad_medida = models.CharField(max_length=256, blank=True, default="")
    total_programado = models.PositiveIntegerField(default=0)
    prog_t1 = models.PositiveIntegerField(default=0)
    prog_t2 = models.PositiveIntegerField(default=0)
    prog_t3 = models.PositiveIntegerField(default=0)
    prog_t4 = models.PositiveIntegerField(default=0)
    valor_total = models.DecimalField(max_digits=16, decimal_places=2, default=Decimal("0"))
    valor_unitario = models.DecimalField(max_digits=16, decimal_places=2, default=Decimal("0"))
    responsable_secretaria = models.ForeignKey(
        "entities.Secretaria",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="pic_actividades_responsable",
        db_column="responsable_secretaria_id",
    )
    responsables = models.ManyToManyField(
        settings.AUTH_USER_MODEL,
        related_name="pic_actividades_asignadas",
        blank=True,
    )
    fila_excel = models.PositiveIntegerField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "pic_actividades"
        verbose_name = "Actividad PIC"
        verbose_name_plural = "Actividades PIC"
        ordering = ["numero"]
        constraints = [
            models.UniqueConstraint(
                fields=("entity", "plan", "numero"),
                name="uq_pic_actividad_entity_plan_numero",
            ),
        ]
        indexes = [
            models.Index(fields=("entity", "plan"), name="pic_act_entity_plan_idx"),
            models.Index(fields=("entity", "plan", "numero"), name="pic_act_entity_num_idx"),
        ]

    def __str__(self) -> str:
        return f"PIC #{self.numero} — {self.actividad[:60]}"


def pic_ejecucion_archivo_upload_path(instance, filename: str) -> str:
    from .storage_paths import pic_ejecucion_archivo_path

    return pic_ejecucion_archivo_path(instance.ejecucion, filename)


class PicEjecucion(models.Model):
    """Registro de ejecución de una actividad PIC."""

    entity = models.ForeignKey(
        "entities.Entity",
        on_delete=models.CASCADE,
        related_name="pic_ejecuciones",
        db_column="entity_id",
    )
    actividad = models.ForeignKey(
        PicActividad,
        on_delete=models.CASCADE,
        related_name="ejecuciones",
        db_column="actividad_id",
    )
    fecha_ejecucion = models.DateField(db_index=True)
    trimestre = models.PositiveSmallIntegerField(choices=Trimestre.choices, db_index=True)
    cantidad_ejecutada = models.PositiveIntegerField()
    descripcion = models.TextField(blank=True, default="")
    valor_cobrado = models.DecimalField(max_digits=16, decimal_places=2, default=Decimal("0"))
    registrado_por = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="pic_ejecuciones_registradas",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "pic_ejecuciones"
        verbose_name = "Ejecución PIC"
        verbose_name_plural = "Ejecuciones PIC"
        ordering = ["-fecha_ejecucion", "-id"]
        indexes = [
            models.Index(fields=("entity", "actividad"), name="pic_ejec_entity_act_idx"),
            models.Index(fields=("entity", "trimestre"), name="pic_ejec_entity_tri_idx"),
        ]

    def __str__(self) -> str:
        return f"Ejecución PIC act.{self.actividad_id} — {self.fecha_ejecucion}"


class PicEjecucionArchivo(models.Model):
    """Archivos PDF de evidencia de ejecución (máx. 5 por ejecución)."""

    ejecucion = models.ForeignKey(
        PicEjecucion,
        on_delete=models.CASCADE,
        related_name="archivos",
        db_column="ejecucion_id",
    )
    archivo = models.FileField(
        upload_to=pic_ejecucion_archivo_upload_path,
        storage=pic_file_storage,
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
        related_name="pic_ejecucion_archivos_subidos",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "pic_ejecucion_archivos"
        verbose_name = "Archivo ejecución PIC"
        verbose_name_plural = "Archivos ejecución PIC"
        ordering = ["created_at", "id"]
        indexes = [
            models.Index(fields=["ejecucion"], name="pic_evarch_ejec_idx"),
        ]

    def __str__(self) -> str:
        return f"{self.ejecucion_id} — {self.nombre_original or self.archivo.name}"
