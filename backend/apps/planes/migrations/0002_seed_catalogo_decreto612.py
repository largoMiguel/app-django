"""Siembra idempotente del catálogo Decreto 612 (12 planes globales)."""
from __future__ import annotations

from django.db import migrations

CATALOGO_D612 = [
    (1, "pinar", "Plan Institucional de Archivos de la Entidad (PINAR)"),
    (2, "adquisiciones", "Plan Anual de Adquisiciones"),
    (3, "vacantes", "Plan Anual de Vacantes"),
    (4, "prevision_rrhh", "Plan de Previsión de Recursos Humanos"),
    (5, "talento_humano", "Plan Estratégico de Talento Humano"),
    (6, "capacitacion", "Plan Institucional de Capacitación"),
    (7, "incentivos", "Plan de Incentivos Institucionales"),
    (8, "sst", "Plan de Trabajo Anual en Seguridad y Salud en el Trabajo"),
    (9, "anticorrupcion", "Plan Anticorrupción y de Atención al Ciudadano"),
    (10, "peti", "Plan Estratégico de Tecnologías de la Información y las Comunicaciones (PETI)"),
    (
        11,
        "tratamiento_riesgos_si",
        "Plan de Tratamiento de Riesgos de Seguridad y Privacidad de la Información",
    ),
    (12, "seguridad_privacidad_si", "Plan de Seguridad y Privacidad de la Información"),
]


def seed_catalogo(apps, schema_editor):
    PlanCatalogo = apps.get_model("planes", "PlanCatalogo")
    for orden, codigo, nombre in CATALOGO_D612:
        PlanCatalogo.objects.get_or_create(
            codigo=codigo,
            entity=None,
            defaults={
                "nombre": nombre,
                "orden": orden,
                "es_decreto612": True,
                "descripcion": "Plan exigido por el Decreto 612 de 2018.",
                "is_active": True,
            },
        )


def unseed_catalogo(apps, schema_editor):
    PlanCatalogo = apps.get_model("planes", "PlanCatalogo")
    codigos = [item[1] for item in CATALOGO_D612]
    PlanCatalogo.objects.filter(entity__isnull=True, codigo__in=codigos, es_decreto612=True).delete()


class Migration(migrations.Migration):
    dependencies = [
        ("planes", "0001_initial"),
    ]

    operations = [
        migrations.RunPython(seed_catalogo, unseed_catalogo),
    ]
