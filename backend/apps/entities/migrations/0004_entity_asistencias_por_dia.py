# Generated manually for asistencia module

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("entities", "0003_remove_entity_report_template_fields"),
    ]

    operations = [
        migrations.AddField(
            model_name="entity",
            name="asistencias_por_dia",
            field=models.PositiveSmallIntegerField(
                choices=[(2, "2 (entrada y salida)"), (4, "4 (doble jornada)")],
                default=2,
            ),
        ),
    ]
