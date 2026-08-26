# Generated manually for armonización presupuesto ↔ PDM

from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


def backfill_codigo_producto_origen(apps, schema_editor):
    PDMEjecucionPresupuestal = apps.get_model("pdm", "PDMEjecucionPresupuestal")
    for row in PDMEjecucionPresupuestal.objects.all().iterator():
        if not row.codigo_producto_origen:
            row.codigo_producto_origen = row.codigo_producto or ""
            row.save(update_fields=["codigo_producto_origen"])


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ("pdm", "0009_pdm_clave_producto"),
    ]

    operations = [
        migrations.AddField(
            model_name="pdmejecucionpresupuestal",
            name="codigo_producto_origen",
            field=models.CharField(blank=True, db_index=True, default="", max_length=64),
        ),
        migrations.RunPython(backfill_codigo_producto_origen, migrations.RunPython.noop),
        migrations.RemoveConstraint(
            model_name="pdmejecucionpresupuestal",
            name="uq_pdm_ejec_entity_prod_fte_anio",
        ),
        migrations.AddConstraint(
            model_name="pdmejecucionpresupuestal",
            constraint=models.UniqueConstraint(
                fields=("entity", "codigo_producto_origen", "descripcion_fte", "anio"),
                name="uq_pdm_ejec_entity_origen_fte_anio",
            ),
        ),
        migrations.CreateModel(
            name="PdmArmonizacionEjecucion",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("codigo_origen", models.CharField(db_index=True, max_length=64)),
                ("codigo_destino", models.CharField(db_index=True, max_length=64)),
                ("clave_producto_destino", models.CharField(blank=True, default="", max_length=96)),
                ("nota", models.TextField(blank=True, default="")),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                (
                    "created_by",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="pdm_armonizaciones_creadas",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
                (
                    "entity",
                    models.ForeignKey(
                        db_column="entity_id",
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="pdm_armonizaciones_ejecucion",
                        to="entities.entity",
                    ),
                ),
            ],
            options={
                "verbose_name": "Armonización ejecución PDM",
                "verbose_name_plural": "Armonizaciones ejecución PDM",
                "db_table": "pdm_armonizacion_ejecucion",
            },
        ),
        migrations.AddIndex(
            model_name="pdmarmonizacionejecucion",
            index=models.Index(fields=("entity", "codigo_destino"), name="pdm_armon_entity_destino_idx"),
        ),
        migrations.AddConstraint(
            model_name="pdmarmonizacionejecucion",
            constraint=models.UniqueConstraint(
                fields=("entity", "codigo_origen"),
                name="uq_pdm_armonizacion_entity_origen",
            ),
        ),
    ]
