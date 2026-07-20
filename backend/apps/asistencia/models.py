"""Modelos del módulo de asistencia (talento humano)."""
from __future__ import annotations

from django.db import models


class TipoRegistro(models.TextChoices):
    ENTRADA = "entrada", "Entrada"
    SALIDA_ALMUERZO = "salida_almuerzo", "Salida al almuerzo"
    RETORNO_ALMUERZO = "retorno_almuerzo", "Retorno del almuerzo"
    SALIDA = "salida", "Salida"


SECUENCIA_2 = [TipoRegistro.ENTRADA, TipoRegistro.SALIDA]
SECUENCIA_4 = [
    TipoRegistro.ENTRADA,
    TipoRegistro.SALIDA_ALMUERZO,
    TipoRegistro.RETORNO_ALMUERZO,
    TipoRegistro.SALIDA,
]


class Funcionario(models.Model):
    entity = models.ForeignKey(
        "entities.Entity",
        on_delete=models.CASCADE,
        related_name="funcionarios",
        db_column="entity_id",
    )
    cedula = models.CharField(max_length=20)
    nombres = models.CharField(max_length=100)
    apellidos = models.CharField(max_length=100)
    email = models.EmailField(max_length=150, blank=True, default="")
    telefono = models.CharField(max_length=20, blank=True, default="")
    cargo = models.CharField(max_length=150, blank=True, default="")
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "asistencia_funcionarios"
        verbose_name = "Funcionario"
        verbose_name_plural = "Funcionarios"
        ordering = ["apellidos", "nombres"]
        constraints = [
            models.UniqueConstraint(
                fields=["entity", "cedula"],
                name="asistencia_funcionario_entity_cedula_uniq",
            ),
        ]
        indexes = [
            models.Index(fields=["entity", "is_active"]),
            models.Index(fields=["entity", "cedula"]),
        ]

    def __str__(self) -> str:
        return f"{self.nombres} {self.apellidos} ({self.cedula})"

    @property
    def nombre_completo(self) -> str:
        return f"{self.nombres} {self.apellidos}".strip()


class EquipoRegistro(models.Model):
    entity = models.ForeignKey(
        "entities.Entity",
        on_delete=models.CASCADE,
        related_name="equipos_asistencia",
        db_column="entity_id",
    )
    nombre = models.CharField(max_length=100)
    ubicacion = models.CharField(max_length=200, blank=True, default="")
    is_active = models.BooleanField(default=True)
    pairing_code_hash = models.CharField(max_length=128, blank=True, default="")
    pairing_code_expires_at = models.DateTimeField(null=True, blank=True)
    device_token_hash = models.CharField(max_length=128, blank=True, default="")
    paired_at = models.DateTimeField(null=True, blank=True)
    last_seen_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "asistencia_equipos"
        verbose_name = "Equipo de registro"
        verbose_name_plural = "Equipos de registro"
        ordering = ["nombre"]
        indexes = [
            models.Index(fields=["entity", "is_active"]),
            models.Index(fields=["device_token_hash"]),
        ]

    def __str__(self) -> str:
        return f"{self.nombre} ({self.entity.name})"


class RegistroAsistencia(models.Model):
    entity = models.ForeignKey(
        "entities.Entity",
        on_delete=models.CASCADE,
        related_name="registros_asistencia",
        db_column="entity_id",
    )
    funcionario = models.ForeignKey(
        Funcionario,
        on_delete=models.CASCADE,
        related_name="registros",
        db_column="funcionario_id",
    )
    equipo = models.ForeignKey(
        EquipoRegistro,
        on_delete=models.CASCADE,
        related_name="registros",
        db_column="equipo_id",
    )
    tipo = models.CharField(max_length=20, choices=TipoRegistro.choices)
    fecha_hora = models.DateTimeField(auto_now_add=True, db_index=True)
    foto_key = models.CharField(max_length=500)
    idempotency_key = models.CharField(max_length=64, unique=True)
    client_ts = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "asistencia_registros"
        verbose_name = "Registro de asistencia"
        verbose_name_plural = "Registros de asistencia"
        ordering = ["-fecha_hora"]
        indexes = [
            models.Index(fields=["entity", "fecha_hora"]),
            models.Index(fields=["funcionario", "fecha_hora"]),
            models.Index(fields=["entity", "tipo", "fecha_hora"]),
        ]

    def __str__(self) -> str:
        return f"{self.funcionario.cedula} — {self.tipo} @ {self.fecha_hora}"
