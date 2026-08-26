# Generated manually for AI insight ignore support

import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("entities", "0001_initial"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ("ai", "0001_initial"),
    ]

    operations = [
        migrations.CreateModel(
            name="AIInsightIgnorado",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                (
                    "module",
                    models.CharField(
                        choices=[("pqrs", "PQRS"), ("pdm", "PDM")],
                        db_index=True,
                        max_length=20,
                    ),
                ),
                ("fingerprint", models.CharField(db_index=True, max_length=40)),
                ("title", models.CharField(blank=True, max_length=255)),
                ("created_at", models.DateTimeField(auto_now_add=True, db_index=True)),
                (
                    "created_by",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="ai_insights_ignorados",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
                (
                    "entity",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="ai_insights_ignorados",
                        to="entities.entity",
                    ),
                ),
            ],
            options={
                "db_table": "ai_insights_ignorados",
                "ordering": ["-created_at"],
            },
        ),
        migrations.AddConstraint(
            model_name="aiinsightignorado",
            constraint=models.UniqueConstraint(
                fields=("entity", "module", "fingerprint"),
                name="uq_ai_insight_ignorado_entity_module_fp",
            ),
        ),
    ]
