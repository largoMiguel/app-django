from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ("entities", "0001_initial"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ("pqrs", "0014_pqrs_assigned_secretarias_m2m"),
    ]

    operations = [
        migrations.CreateModel(
            name="InformePQRS",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("filename", models.CharField(max_length=255)),
                ("b2_key", models.CharField(max_length=500)),
                ("file_size", models.PositiveIntegerField(default=0)),
                ("fecha_inicio", models.DateField()),
                ("fecha_fin", models.DateField()),
                ("total_pqrs", models.PositiveIntegerField(default=0)),
                ("tasa_resolucion", models.DecimalField(decimal_places=1, default=0, max_digits=5)),
                ("used_ai", models.BooleanField(default=False)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("expires_at", models.DateTimeField(db_index=True)),
                (
                    "created_by",
                    models.ForeignKey(
                        blank=True,
                        db_column="created_by_id",
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="informes_pqrs_creados",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
                (
                    "entity",
                    models.ForeignKey(
                        db_column="entity_id",
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="informes_pqrs",
                        to="entities.entity",
                    ),
                ),
            ],
            options={
                "verbose_name": "Informe PQRS",
                "verbose_name_plural": "Informes PQRS",
                "db_table": "pqrs_informes",
                "ordering": ["-created_at", "-id"],
                "indexes": [
                    models.Index(fields=["entity", "-created_at"], name="pqrs_inf_entity_created_idx"),
                    models.Index(fields=["entity", "expires_at"], name="pqrs_inf_entity_exp_idx"),
                ],
            },
        ),
    ]
