# Generated manually for async informe generation
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("pqrs", "0018_pqrscorreo_proveedor_gmail"),
    ]

    operations = [
        migrations.AddField(
            model_name="informepqrs",
            name="celery_task_id",
            field=models.CharField(blank=True, default="", max_length=255),
        ),
        migrations.AddField(
            model_name="informepqrs",
            name="error_detail",
            field=models.TextField(blank=True, default=""),
        ),
        migrations.AddField(
            model_name="informepqrs",
            name="estado",
            field=models.CharField(
                choices=[
                    ("PENDIENTE", "En cola"),
                    ("PROCESANDO", "Generando"),
                    ("COMPLETADO", "Completado"),
                    ("ERROR", "Error"),
                ],
                db_index=True,
                default="COMPLETADO",
                max_length=20,
            ),
        ),
        migrations.AddField(
            model_name="informepqrs",
            name="generation_params",
            field=models.JSONField(blank=True, default=dict),
        ),
        migrations.AlterField(
            model_name="informepqrs",
            name="b2_key",
            field=models.CharField(blank=True, default="", max_length=500),
        ),
        migrations.AlterField(
            model_name="informepqrs",
            name="filename",
            field=models.CharField(blank=True, default="", max_length=255),
        ),
    ]
