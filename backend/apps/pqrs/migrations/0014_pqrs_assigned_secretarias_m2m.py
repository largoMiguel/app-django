"""M2M assigned_secretarias + tipo correo asignacion."""
from django.db import migrations, models


def backfill_assigned_secretarias(apps, schema_editor):
    PQRS = apps.get_model("pqrs", "PQRS")
    for pqrs in PQRS.objects.filter(assigned_to_id__isnull=False).iterator():
        pqrs.assigned_secretarias.add(pqrs.assigned_to_id)


class Migration(migrations.Migration):

    dependencies = [
        ("entities", "0001_initial"),
        ("pqrs", "0013_correo_entrante_pqrs"),
    ]

    operations = [
        migrations.AddField(
            model_name="pqrs",
            name="assigned_secretarias",
            field=models.ManyToManyField(
                blank=True,
                db_table="pqrs_secretarias_asignadas",
                help_text="Secretarías asignadas (puede ser más de una).",
                related_name="pqrs_asignadas_m2m",
                to="entities.secretaria",
            ),
        ),
        migrations.RunPython(backfill_assigned_secretarias, migrations.RunPython.noop),
        migrations.AlterField(
            model_name="pqrs",
            name="assigned_to",
            field=models.ForeignKey(
                blank=True,
                db_column="assigned_to_id",
                help_text="Secretaría principal (denormalizada; ver assigned_secretarias).",
                null=True,
                on_delete=models.deletion.SET_NULL,
                related_name="pqrs_asignadas",
                to="entities.secretaria",
            ),
        ),
    ]
