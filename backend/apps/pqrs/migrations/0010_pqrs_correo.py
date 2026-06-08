# Generated manually for PQRSCorreo model

import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("pqrs", "0009_b2_storage"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="PQRSCorreo",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                (
                    "tipo",
                    models.CharField(
                        choices=[("radicacion", "Radicación"), ("respuesta", "Respuesta")],
                        max_length=20,
                    ),
                ),
                ("asunto", models.CharField(max_length=255)),
                ("cuerpo_resumen", models.TextField(blank=True, default="")),
                ("request_id", models.CharField(blank=True, db_index=True, max_length=128, null=True)),
                (
                    "estado",
                    models.CharField(
                        choices=[
                            ("pendiente", "Pendiente"),
                            ("enviado", "Enviado"),
                            ("entregado", "Entregado"),
                            ("rebote_temporal", "Rebote temporal"),
                            ("rebotado", "Rebotado"),
                            ("error", "Error"),
                        ],
                        default="pendiente",
                        max_length=20,
                    ),
                ),
                ("error", models.CharField(blank=True, max_length=500, null=True)),
                ("destinatarios", models.JSONField(blank=True, default=list)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                (
                    "enviado_por",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="pqrs_correos_enviados",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
                (
                    "pqrs",
                    models.ForeignKey(
                        db_column="pqrs_id",
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="correos",
                        to="pqrs.pqrs",
                    ),
                ),
            ],
            options={
                "verbose_name": "Correo PQRS",
                "verbose_name_plural": "Correos PQRS",
                "db_table": "pqrs_correos",
                "ordering": ["-created_at", "-id"],
            },
        ),
        migrations.AddIndex(
            model_name="pqrscorreo",
            index=models.Index(fields=["pqrs", "-created_at"], name="pqrs_correo_pqrs_created_idx"),
        ),
        migrations.AddIndex(
            model_name="pqrscorreo",
            index=models.Index(fields=["request_id"], name="pqrs_correo_request_id_idx"),
        ),
    ]
