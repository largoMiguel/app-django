"""Renombra plan 9 del Decreto 612 a Programa de Transparencia y Ética Pública (PTEP)."""

from django.db import migrations

NOMBRE_ANTERIOR = "Plan Anticorrupción y de Atención al Ciudadano"
NOMBRE_NUEVO = "Programa de Transparencia y Ética Pública (PTEP)"


def rename_catalogo_ptep(apps, schema_editor):
    PlanCatalogo = apps.get_model("planes", "PlanCatalogo")
    PlanCatalogo.objects.filter(
        entity__isnull=True,
        codigo="anticorrupcion",
        es_decreto612=True,
    ).update(nombre=NOMBRE_NUEVO)


def revert_catalogo_ptep(apps, schema_editor):
    PlanCatalogo = apps.get_model("planes", "PlanCatalogo")
    PlanCatalogo.objects.filter(
        entity__isnull=True,
        codigo="anticorrupcion",
        es_decreto612=True,
        nombre=NOMBRE_NUEVO,
    ).update(nombre=NOMBRE_ANTERIOR)


class Migration(migrations.Migration):
    dependencies = [
        ("planes", "0007_resync_actividades_avance"),
    ]

    operations = [
        migrations.RunPython(rename_catalogo_ptep, revert_catalogo_ptep),
    ]
