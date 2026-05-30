"""Migra datos legacy y elimina campos obsoletos de PQRS."""
from __future__ import annotations

import os

from django.conf import settings
from django.db import migrations


def _normalize_media_relative(path: str) -> str:
    path = path.strip().lstrip("/")
    if path.startswith("media/"):
        path = path[6:]
    return path


def migrate_legacy_fields(apps, schema_editor):
    PQRS = apps.get_model("pqrs", "PQRS")
    PQRSArchivo = apps.get_model("pqrs", "PQRSArchivo")

    for pqrs in PQRS.objects.all().iterator():
        update_fields: list[str] = []

        if pqrs.tipo_documento and pqrs.tipo_documento.strip():
            if not pqrs.tipo_identificacion or pqrs.tipo_identificacion.strip() in ("", "CC"):
                pqrs.tipo_identificacion = pqrs.tipo_documento.strip()
                update_fields.append("tipo_identificacion")

        if update_fields:
            pqrs.save(update_fields=update_fields)

        legacy_path = (pqrs.archivo_adjunto or "").strip()
        if not legacy_path:
            continue
        if PQRSArchivo.objects.filter(pqrs_id=pqrs.id).exists():
            continue

        rel = _normalize_media_relative(legacy_path)
        full = os.path.join(settings.MEDIA_ROOT, rel)
        if not os.path.isfile(full):
            continue

        arch = PQRSArchivo(
            pqrs_id=pqrs.id,
            nombre_original=os.path.basename(rel),
            content_type="",
            size=os.path.getsize(full),
        )
        arch.archivo.name = rel
        arch.save()


def noop_reverse(apps, schema_editor):
    pass


class Migration(migrations.Migration):
    dependencies = [
        ("pqrs", "0004_pqrs_canal_llegada_choices"),
    ]

    operations = [
        migrations.RunPython(migrate_legacy_fields, noop_reverse),
        migrations.RemoveField(model_name="pqrs", name="tipo_documento"),
        migrations.RemoveField(model_name="pqrs", name="genero"),
        migrations.RemoveField(model_name="pqrs", name="archivo_adjunto"),
    ]
