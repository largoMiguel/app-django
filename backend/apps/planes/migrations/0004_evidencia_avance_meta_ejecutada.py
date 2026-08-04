from django.db import migrations, models


def copy_avance_to_evidencia(apps, schema_editor):
    PlanActividad = apps.get_model("planes", "PlanActividad")
    PlanEvidencia = apps.get_model("planes", "PlanEvidencia")
    for ev in PlanEvidencia.objects.select_related("actividad").all():
        if ev.actividad_id and ev.avance == 0 and ev.actividad.avance:
            ev.avance = ev.actividad.avance
            ev.save(update_fields=["avance"])


class Migration(migrations.Migration):

    dependencies = [
        ("planes", "0003_remove_planinstitucional_nombre"),
    ]

    operations = [
        migrations.AddField(
            model_name="planevidencia",
            name="avance",
            field=models.PositiveSmallIntegerField(default=0),
        ),
        migrations.AddField(
            model_name="planevidencia",
            name="meta_ejecutada",
            field=models.CharField(blank=True, default="", max_length=512),
        ),
        migrations.RunPython(copy_avance_to_evidencia, migrations.RunPython.noop),
    ]
