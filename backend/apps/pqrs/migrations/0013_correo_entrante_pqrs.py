# Generated manually for CorreoEntrantePQRS

import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("entities", "0001_initial"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ("pqrs", "0012_resync_correo_alerta"),
    ]

    operations = [
        migrations.CreateModel(
            name="CorreoEntrantePQRS",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("message_id", models.CharField(db_index=True, max_length=500, unique=True)),
                ("remitente", models.CharField(db_index=True, max_length=255)),
                (
                    "estado",
                    models.CharField(
                        choices=[
                            ("procesado", "Procesado"),
                            ("ignorado_no_registrado", "Remitente no registrado"),
                            ("ignorado_sin_entidad", "Usuario sin entidad"),
                            ("ignorado_no_govco", "Dominio no gov.co"),
                            ("ignorado_duplicado", "Duplicado"),
                            ("error", "Error"),
                        ],
                        default="error",
                        max_length=40,
                    ),
                ),
                ("motivo", models.TextField(blank=True, default="")),
                ("asunto", models.CharField(blank=True, default="", max_length=500)),
                ("recibido_at", models.DateTimeField(blank=True, null=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                (
                    "entity",
                    models.ForeignKey(
                        blank=True,
                        db_column="entity_id",
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="correos_entrantes_pqrs",
                        to="entities.entity",
                    ),
                ),
                (
                    "pqrs",
                    models.ForeignKey(
                        blank=True,
                        db_column="pqrs_id",
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="correos_entrantes",
                        to="pqrs.pqrs",
                    ),
                ),
                (
                    "remitente_user",
                    models.ForeignKey(
                        blank=True,
                        db_column="remitente_user_id",
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="correos_entrantes_pqrs",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={
                "verbose_name": "Correo entrante PQRS",
                "verbose_name_plural": "Correos entrantes PQRS",
                "db_table": "pqrs_correos_entrantes",
                "ordering": ["-created_at", "-id"],
            },
        ),
        migrations.AddIndex(
            model_name="correoentrantepqrs",
            index=models.Index(fields=["remitente", "-created_at"], name="pqrs_ce_rem_fecha_idx"),
        ),
        migrations.AddIndex(
            model_name="correoentrantepqrs",
            index=models.Index(
                fields=["estado", "-created_at"],
                name="pqrs_ce_est_fecha_idx",
            ),
        ),
    ]
