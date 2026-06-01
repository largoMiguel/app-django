"""Evidencias PDM: archivos en media (como PQRS) y migración desde base64."""
from __future__ import annotations

import base64
import os
import re

from django.conf import settings
from django.core.files.base import ContentFile
from django.db import migrations, models
import django.db.models.deletion


def _upload_path(evidencia, filename: str) -> str:
    safe_name = os.path.basename(filename)
    return f"entities/{evidencia.entity_id}/pdm/evidencias/{evidencia.actividad_id}/{safe_name}"


def migrate_base64_imagenes(apps, schema_editor):
    PdmActividadEvidencia = apps.get_model("pdm", "PdmActividadEvidencia")
    PdmEvidenciaArchivo = apps.get_model("pdm", "PdmEvidenciaArchivo")

    for evidencia in PdmActividadEvidencia.objects.exclude(imagenes__isnull=True):
        imagenes = evidencia.imagenes
        if not isinstance(imagenes, list):
            continue
        for idx, item in enumerate(imagenes[:4]):
            if not item or not isinstance(item, str) or not item.startswith("data:"):
                continue
            try:
                header, b64 = item.split(",", 1)
            except ValueError:
                continue
            ext = "jpg"
            match = re.search(r"image/(\w+)", header)
            if match:
                ext = match.group(1).replace("jpeg", "jpg")
            try:
                content = base64.b64decode(b64)
            except Exception:
                continue
            filename = f"evidencia_{evidencia.id}_{idx}.{ext}"
            arch = PdmEvidenciaArchivo(
                evidencia_id=evidencia.id,
                nombre_original=filename,
                content_type=f"image/{ext}",
                size=len(content),
            )
            path = _upload_path(evidencia, filename)
            arch.archivo.save(path, ContentFile(content), save=False)
            arch.save()


class Migration(migrations.Migration):
    dependencies = [
        ("pdm", "0001_initial"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="PdmEvidenciaArchivo",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("archivo", models.FileField(max_length=500, upload_to="entities/0/pdm/evidencias/0/placeholder")),
                ("nombre_original", models.CharField(blank=True, default="", max_length=255)),
                ("content_type", models.CharField(blank=True, default="", max_length=120)),
                ("size", models.PositiveIntegerField(default=0)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                (
                    "evidencia",
                    models.ForeignKey(
                        db_column="evidencia_id",
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="archivos",
                        to="pdm.pdmactividadevidencia",
                    ),
                ),
                (
                    "uploaded_by",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="pdm_evidencia_archivos_subidos",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={
                "verbose_name": "Archivo evidencia PDM",
                "verbose_name_plural": "Archivos evidencia PDM",
                "db_table": "pdm_evidencia_archivos",
                "ordering": ["created_at", "id"],
            },
        ),
        migrations.AddIndex(
            model_name="pdmevidenciaarchivo",
            index=models.Index(fields=["evidencia"], name="pdm_evarch_evid_idx"),
        ),
        migrations.RunPython(migrate_base64_imagenes, migrations.RunPython.noop),
        migrations.RemoveField(model_name="pdmactividadevidencia", name="imagenes"),
        migrations.RemoveField(model_name="pdmactividadevidencia", name="imagenes_s3_urls"),
        migrations.RemoveField(model_name="pdmactividadevidencia", name="migrated_to_s3"),
    ]
