"""Recalcula avance/estado de actividades con evidencias existentes."""

from django.db import migrations


def resync_avance(apps, schema_editor):
    PlanActividad = apps.get_model("planes", "PlanActividad")
    PlanEvidencia = apps.get_model("planes", "PlanEvidencia")

    from apps.planes.evidencia_sync import sync_actividad_from_evidencias

    actividad_ids = (
        PlanEvidencia.objects.order_by()
        .values_list("actividad_id", flat=True)
        .distinct()
    )
    for actividad in PlanActividad.objects.filter(id__in=actividad_ids).iterator():
        sync_actividad_from_evidencias(actividad)


class Migration(migrations.Migration):
    dependencies = [
        ("planes", "0006_informe_plan"),
    ]

    operations = [
        migrations.RunPython(resync_avance, migrations.RunPython.noop),
    ]
