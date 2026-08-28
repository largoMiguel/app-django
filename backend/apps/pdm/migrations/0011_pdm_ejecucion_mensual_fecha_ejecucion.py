"""Ejecución mensual PIIP, fecha_ejecucion en actividades e InformePDM.mes."""
from __future__ import annotations

import datetime

from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


def _populate_fecha_ejecucion(apps, schema_editor):
    PdmActividad = apps.get_model("pdm", "PdmActividad")
    for act in PdmActividad.objects.all().iterator():
        anio = act.anio or datetime.date.today().year
        fin = act.fecha_fin
        inicio = act.fecha_inicio
        fecha = None
        if fin:
            fin_date = fin.date() if hasattr(fin, "date") else fin
            if fin_date != datetime.date(anio, 12, 31):
                fecha = fin_date
        if fecha is None and act.created_at:
            fecha = act.created_at.date()
        if fecha is None and inicio:
            fecha = inicio.date() if hasattr(inicio, "date") else inicio
        if fecha is None:
            fecha = datetime.date(anio, 1, 1)
        act.fecha_ejecucion = fecha
        act.save(update_fields=["fecha_ejecucion"])


class Migration(migrations.Migration):

    dependencies = [
        ("pdm", "0010_pdm_armonizacion"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="PDMEjecucionMensual",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("anio", models.IntegerField(db_index=True)),
                ("mes", models.PositiveSmallIntegerField(db_index=True)),
                ("codigo_producto", models.CharField(db_index=True, max_length=64)),
                ("codigo_producto_origen", models.CharField(blank=True, db_index=True, default="", max_length=64)),
                ("descripcion_fte", models.CharField(max_length=500)),
                ("pto_inicial", models.DecimalField(decimal_places=2, default=0, max_digits=18)),
                ("adicion", models.DecimalField(decimal_places=2, default=0, max_digits=18)),
                ("reduccion", models.DecimalField(decimal_places=2, default=0, max_digits=18)),
                ("credito", models.DecimalField(decimal_places=2, default=0, max_digits=18)),
                ("contracredito", models.DecimalField(decimal_places=2, default=0, max_digits=18)),
                ("pto_definitivo", models.DecimalField(decimal_places=2, default=0, max_digits=18)),
                ("registro", models.DecimalField(decimal_places=2, default=0, max_digits=18)),
                ("obligaciones", models.DecimalField(decimal_places=2, default=0, max_digits=18)),
                ("saldo_compromisos", models.DecimalField(decimal_places=2, default=0, max_digits=18)),
                ("pagos", models.DecimalField(decimal_places=2, default=0, max_digits=18)),
                ("sector", models.CharField(blank=True, max_length=100, null=True)),
                ("dependencia", models.CharField(blank=True, max_length=200, null=True)),
                ("bpin", models.CharField(blank=True, max_length=50, null=True)),
                ("created_at", models.DateTimeField(auto_now_add=True, null=True)),
                (
                    "entity",
                    models.ForeignKey(
                        db_column="entity_id",
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="pdm_ejecuciones_mensuales",
                        to="entities.entity",
                    ),
                ),
            ],
            options={
                "verbose_name": "Ejecución presupuestal mensual PDM",
                "verbose_name_plural": "Ejecuciones presupuestales mensuales PDM",
                "db_table": "pdm_ejecucion_mensual",
            },
        ),
        migrations.CreateModel(
            name="PDMEjecucionMensualCarga",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("anio", models.IntegerField(db_index=True)),
                ("mes", models.PositiveSmallIntegerField(db_index=True)),
                ("rango_desde", models.DateField()),
                ("rango_hasta", models.DateField()),
                ("titulo_archivo", models.TextField(blank=True, default="")),
                ("filename", models.CharField(blank=True, default="", max_length=255)),
                ("es_acumulado", models.BooleanField(default=False)),
                ("registros_insertados", models.PositiveIntegerField(default=0)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                (
                    "entity",
                    models.ForeignKey(
                        db_column="entity_id",
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="pdm_ejecuciones_mensuales_cargas",
                        to="entities.entity",
                    ),
                ),
                (
                    "uploaded_by",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="pdm_ejecuciones_mensuales_subidas",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={
                "verbose_name": "Carga ejecución mensual PDM",
                "verbose_name_plural": "Cargas ejecución mensual PDM",
                "db_table": "pdm_ejecucion_mensual_carga",
            },
        ),
        migrations.AddField(
            model_name="pdmactividad",
            name="fecha_ejecucion",
            field=models.DateField(blank=True, db_index=True, null=True),
        ),
        migrations.AddField(
            model_name="informepdm",
            name="mes",
            field=models.PositiveSmallIntegerField(blank=True, db_index=True, null=True),
        ),
        migrations.RunPython(_populate_fecha_ejecucion, migrations.RunPython.noop),
        migrations.RemoveField(
            model_name="pdmactividad",
            name="fecha_inicio",
        ),
        migrations.RemoveField(
            model_name="pdmactividad",
            name="fecha_fin",
        ),
        migrations.AddIndex(
            model_name="pdmejecucionmensual",
            index=models.Index(fields=("entity", "anio", "mes"), name="pdm_ejecm_ent_anio_mes_idx"),
        ),
        migrations.AddIndex(
            model_name="pdmejecucionmensual",
            index=models.Index(
                fields=("entity", "codigo_producto", "anio", "mes"),
                name="pdm_ejecm_ent_prod_am_idx",
            ),
        ),
        migrations.AddConstraint(
            model_name="pdmejecucionmensual",
            constraint=models.UniqueConstraint(
                fields=("entity", "anio", "mes", "codigo_producto_origen", "descripcion_fte"),
                name="uq_pdm_ejec_mensual_entity_mes_origen_fte",
            ),
        ),
        migrations.AddIndex(
            model_name="pdmejecucionmensualcarga",
            index=models.Index(fields=("entity", "anio"), name="pdm_ejecm_carga_anio_idx"),
        ),
        migrations.AddConstraint(
            model_name="pdmejecucionmensualcarga",
            constraint=models.UniqueConstraint(
                fields=("entity", "anio", "mes"),
                name="uq_pdm_ejec_mensual_carga_entity_anio_mes",
            ),
        ),
    ]
