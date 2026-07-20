"""Entity (municipio/organismo) — raíz de multi-tenancy + secretarías."""
from __future__ import annotations

from django.db import models
from django.utils.text import slugify


class Entity(models.Model):
    """Tabla `entities` (tabla 9). Una entidad = un municipio/organismo."""

    name = models.CharField(max_length=200, unique=True)
    code = models.CharField(max_length=50, unique=True)
    nit = models.CharField(max_length=50, blank=True, null=True, db_index=True)
    slug = models.CharField(max_length=100, unique=True)
    description = models.TextField(blank=True, null=True)
    address = models.CharField(max_length=300, blank=True, null=True)
    phone = models.CharField(max_length=50, blank=True, null=True)
    email = models.CharField(max_length=150, blank=True, null=True)
    logo_url = models.CharField(max_length=500, blank=True, null=True)
    horario_atencion = models.CharField(max_length=200, blank=True, null=True)
    tiempo_respuesta = models.CharField(max_length=100, blank=True, null=True)
    plan_name = models.CharField(max_length=500, blank=True, null=True)
    pdf_template_url = models.CharField(max_length=500, blank=True, null=True)

    is_active = models.BooleanField(default=True)
    enable_pqrs = models.BooleanField(default=True)
    enable_users_admin = models.BooleanField(default=True)
    enable_reports_pdf = models.BooleanField(default=False)
    enable_ai_reports = models.BooleanField(default=False)
    enable_planes_institucionales = models.BooleanField(default=False)
    enable_contratacion = models.BooleanField(default=False)
    enable_pdm = models.BooleanField(default=False)
    enable_pdm_chat = models.BooleanField(default=False)
    pdm_chat_intro = models.TextField(blank=True, null=True)
    pdm_chat_sugerencias = models.JSONField(blank=True, null=True)
    enable_asistencia = models.BooleanField(default=True)
    asistencias_por_dia = models.PositiveSmallIntegerField(
        default=2,
        choices=((2, "2 (entrada y salida)"), (4, "4 (doble jornada)")),
    )
    enable_correspondencia = models.BooleanField(default=True)
    enable_presupuesto = models.BooleanField(default=True)

    created_at = models.DateTimeField(auto_now_add=True, null=True)
    updated_at = models.DateTimeField(auto_now=True, null=True)

    class Meta:
        db_table = "entities"
        verbose_name = "Entidad"
        verbose_name_plural = "Entidades"
        ordering = ["name"]

    def __str__(self) -> str:
        return self.name

    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = slugify(self.name)[:100]
        super().save(*args, **kwargs)

    @property
    def enabled_modules(self) -> list[str]:
        mods = []
        flags = {
            "pqrs": self.enable_pqrs,
            "users_admin": self.enable_users_admin,
            "reports_pdf": self.enable_reports_pdf,
            "ai_reports": self.enable_ai_reports,
            "planes_institucionales": self.enable_planes_institucionales,
            "contratacion": self.enable_contratacion,
            "pdm": self.enable_pdm,
            "pdm_chat": self.enable_pdm_chat,
            "asistencia": self.enable_asistencia,
            "correspondencia": self.enable_correspondencia,
            "presupuesto": self.enable_presupuesto,
        }
        for k, v in flags.items():
            if v:
                mods.append(k)
        return mods


class Secretaria(models.Model):
    """Tabla `secretarias` (tabla 23). Dependencia interna de la entidad."""

    entity = models.ForeignKey(
        Entity,
        on_delete=models.CASCADE,
        related_name="secretarias",
        db_column="entity_id",
    )
    nombre = models.CharField(max_length=200)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True, null=True)
    updated_at = models.DateTimeField(auto_now=True, null=True)

    class Meta:
        db_table = "secretarias"
        verbose_name = "Secretaría"
        verbose_name_plural = "Secretarías"
        unique_together = (("entity", "nombre"),)
        ordering = ["nombre"]

    def __str__(self) -> str:
        return f"{self.nombre} ({self.entity.name})"
