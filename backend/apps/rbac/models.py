"""Roles RBAC.

Aprovechamos `django.contrib.auth.Group` como rol y `Permission` como
acción concreta sobre un modelo. El modelo `RoleMeta` añade descripción y
flag de "rol de sistema" para roles que no deben borrarse desde la UI.
"""
from __future__ import annotations

from django.contrib.auth.models import Group
from django.db import models


class RoleMeta(models.Model):
    group = models.OneToOneField(
        Group,
        on_delete=models.CASCADE,
        related_name="meta",
        primary_key=True,
    )
    entity = models.ForeignKey(
        "entities.Entity",
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="custom_roles",
        db_column="entity_id",
        help_text="Null = rol global del sistema; con entidad = rol custom de esa entidad.",
    )
    description = models.CharField(max_length=255, blank=True)
    is_system = models.BooleanField(
        default=False,
        help_text="Roles del sistema (admin, etc.) no se pueden borrar.",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Metadato de rol"
        verbose_name_plural = "Metadatos de roles"

    def __str__(self) -> str:
        return f"{self.group.name} meta"
