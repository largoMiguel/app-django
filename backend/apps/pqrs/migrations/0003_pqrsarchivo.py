from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion

import apps.pqrs.models


class Migration(migrations.Migration):

    dependencies = [
        ("pqrs", "0002_pqrs_fecha_vencimiento"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="PQRSArchivo",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("archivo", models.FileField(max_length=500, upload_to=apps.pqrs.models.pqrs_archivo_upload_path)),
                ("nombre_original", models.CharField(blank=True, default="", max_length=255)),
                ("content_type", models.CharField(blank=True, default="", max_length=120)),
                ("size", models.PositiveIntegerField(default=0)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                (
                    "pqrs",
                    models.ForeignKey(
                        db_column="pqrs_id",
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="archivos",
                        to="pqrs.pqrs",
                    ),
                ),
                (
                    "uploaded_by",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="pqrs_archivos_subidos",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={
                "verbose_name": "Archivo PQRS",
                "verbose_name_plural": "Archivos PQRS",
                "db_table": "pqrs_archivos",
                "ordering": ["created_at", "id"],
                "indexes": [models.Index(fields=["pqrs"], name="pqrs_archiv_pqrs_id_idx")],
            },
        ),
    ]
