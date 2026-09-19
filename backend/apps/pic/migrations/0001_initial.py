import apps.common.storages
import apps.pic.models
import django.db.models.deletion
from decimal import Decimal
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        ("entities", "0010_entity_enable_pic"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="PicPlan",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("anio", models.IntegerField(db_index=True)),
                ("archivo_nombre", models.CharField(blank=True, default="", max_length=512)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                (
                    "entity",
                    models.ForeignKey(
                        db_column="entity_id",
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="pic_planes",
                        to="entities.entity",
                    ),
                ),
                (
                    "uploaded_by",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="pic_planes_subidos",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={
                "verbose_name": "Plan PIC",
                "verbose_name_plural": "Planes PIC",
                "db_table": "pic_planes",
            },
        ),
        migrations.CreateModel(
            name="PicCargo",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("etiqueta", models.CharField(max_length=256)),
                ("etiqueta_norm", models.CharField(db_index=True, max_length=256)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                (
                    "entity",
                    models.ForeignKey(
                        db_column="entity_id",
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="pic_cargos",
                        to="entities.entity",
                    ),
                ),
                (
                    "secretaria",
                    models.ForeignKey(
                        blank=True,
                        db_column="secretaria_id",
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="pic_cargos",
                        to="entities.secretaria",
                    ),
                ),
                (
                    "usuarios",
                    models.ManyToManyField(
                        blank=True,
                        related_name="pic_cargos_asignados",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={
                "verbose_name": "Cargo PIC",
                "verbose_name_plural": "Cargos PIC",
                "db_table": "pic_cargos",
            },
        ),
        migrations.CreateModel(
            name="PicActividad",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("numero", models.PositiveIntegerField(db_index=True)),
                ("eje_estrategico", models.TextField(blank=True, default="")),
                ("linea_operativa", models.TextField(blank=True, default="")),
                ("encargado_texto", models.CharField(blank=True, default="", max_length=256)),
                ("actividad", models.TextField()),
                ("soportes", models.TextField(blank=True, default="")),
                ("unidad_medida", models.CharField(blank=True, default="", max_length=256)),
                ("total_programado", models.PositiveIntegerField(default=0)),
                ("prog_t1", models.PositiveIntegerField(default=0)),
                ("prog_t2", models.PositiveIntegerField(default=0)),
                ("prog_t3", models.PositiveIntegerField(default=0)),
                ("prog_t4", models.PositiveIntegerField(default=0)),
                ("valor_total", models.DecimalField(decimal_places=2, default=Decimal("0"), max_digits=16)),
                ("valor_unitario", models.DecimalField(decimal_places=2, default=Decimal("0"), max_digits=16)),
                ("fila_excel", models.PositiveIntegerField(blank=True, null=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                (
                    "entity",
                    models.ForeignKey(
                        db_column="entity_id",
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="pic_actividades",
                        to="entities.entity",
                    ),
                ),
                (
                    "plan",
                    models.ForeignKey(
                        db_column="plan_id",
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="actividades",
                        to="pic.picplan",
                    ),
                ),
                (
                    "responsable_secretaria",
                    models.ForeignKey(
                        blank=True,
                        db_column="responsable_secretaria_id",
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="pic_actividades_responsable",
                        to="entities.secretaria",
                    ),
                ),
                (
                    "responsables",
                    models.ManyToManyField(
                        blank=True,
                        related_name="pic_actividades_asignadas",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={
                "verbose_name": "Actividad PIC",
                "verbose_name_plural": "Actividades PIC",
                "db_table": "pic_actividades",
                "ordering": ["numero"],
            },
        ),
        migrations.CreateModel(
            name="PicEjecucion",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("fecha_ejecucion", models.DateField(db_index=True)),
                (
                    "trimestre",
                    models.PositiveSmallIntegerField(
                        choices=[(1, "Trimestre I"), (2, "Trimestre II"), (3, "Trimestre III"), (4, "Trimestre IV")],
                        db_index=True,
                    ),
                ),
                ("cantidad_ejecutada", models.PositiveIntegerField()),
                ("descripcion", models.TextField(blank=True, default="")),
                ("valor_cobrado", models.DecimalField(decimal_places=2, default=Decimal("0"), max_digits=16)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                (
                    "actividad",
                    models.ForeignKey(
                        db_column="actividad_id",
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="ejecuciones",
                        to="pic.picactividad",
                    ),
                ),
                (
                    "entity",
                    models.ForeignKey(
                        db_column="entity_id",
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="pic_ejecuciones",
                        to="entities.entity",
                    ),
                ),
                (
                    "registrado_por",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="pic_ejecuciones_registradas",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={
                "verbose_name": "Ejecución PIC",
                "verbose_name_plural": "Ejecuciones PIC",
                "db_table": "pic_ejecuciones",
                "ordering": ["-fecha_ejecucion", "-id"],
            },
        ),
        migrations.CreateModel(
            name="PicEjecucionArchivo",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                (
                    "archivo",
                    models.FileField(
                        max_length=500,
                        storage=apps.common.storages.pic_file_storage,
                        upload_to=apps.pic.models.pic_ejecucion_archivo_upload_path,
                    ),
                ),
                ("nombre_original", models.CharField(blank=True, default="", max_length=255)),
                ("content_type", models.CharField(blank=True, default="", max_length=120)),
                ("size", models.PositiveIntegerField(default=0)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                (
                    "ejecucion",
                    models.ForeignKey(
                        db_column="ejecucion_id",
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="archivos",
                        to="pic.picejecucion",
                    ),
                ),
                (
                    "uploaded_by",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="pic_ejecucion_archivos_subidos",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={
                "verbose_name": "Archivo ejecución PIC",
                "verbose_name_plural": "Archivos ejecución PIC",
                "db_table": "pic_ejecucion_archivos",
                "ordering": ["created_at", "id"],
            },
        ),
        migrations.AddIndex(
            model_name="picplan",
            index=models.Index(fields=["entity", "anio"], name="pic_plan_entity_anio_idx"),
        ),
        migrations.AddConstraint(
            model_name="picplan",
            constraint=models.UniqueConstraint(fields=("entity", "anio"), name="uq_pic_plan_entity_anio"),
        ),
        migrations.AddConstraint(
            model_name="piccargo",
            constraint=models.UniqueConstraint(fields=("entity", "etiqueta_norm"), name="uq_pic_cargo_entity_etiqueta"),
        ),
        migrations.AddIndex(
            model_name="picactividad",
            index=models.Index(fields=["entity", "plan"], name="pic_act_entity_plan_idx"),
        ),
        migrations.AddIndex(
            model_name="picactividad",
            index=models.Index(fields=["entity", "plan", "numero"], name="pic_act_entity_num_idx"),
        ),
        migrations.AddConstraint(
            model_name="picactividad",
            constraint=models.UniqueConstraint(
                fields=("entity", "plan", "numero"),
                name="uq_pic_actividad_entity_plan_numero",
            ),
        ),
        migrations.AddIndex(
            model_name="picejecucion",
            index=models.Index(fields=["entity", "actividad"], name="pic_ejec_entity_act_idx"),
        ),
        migrations.AddIndex(
            model_name="picejecucion",
            index=models.Index(fields=["entity", "trimestre"], name="pic_ejec_entity_tri_idx"),
        ),
        migrations.AddIndex(
            model_name="picejecucionarchivo",
            index=models.Index(fields=["ejecucion"], name="pic_evarch_ejec_idx"),
        ),
    ]
