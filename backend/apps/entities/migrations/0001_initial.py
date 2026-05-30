from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    initial = True

    dependencies = []

    operations = [
        migrations.CreateModel(
            name="Entity",
            fields=[
                ("id", models.BigAutoField(primary_key=True, serialize=False)),
                ("name", models.CharField(max_length=200, unique=True)),
                ("code", models.CharField(max_length=50, unique=True)),
                ("nit", models.CharField(blank=True, db_index=True, max_length=50, null=True)),
                ("slug", models.CharField(max_length=100, unique=True)),
                ("description", models.TextField(blank=True, null=True)),
                ("address", models.CharField(blank=True, max_length=300, null=True)),
                ("phone", models.CharField(blank=True, max_length=50, null=True)),
                ("email", models.CharField(blank=True, max_length=150, null=True)),
                ("logo_url", models.CharField(blank=True, max_length=500, null=True)),
                ("horario_atencion", models.CharField(blank=True, max_length=200, null=True)),
                ("tiempo_respuesta", models.CharField(blank=True, max_length=100, null=True)),
                ("plan_name", models.CharField(blank=True, max_length=500, null=True)),
                ("report_code", models.CharField(blank=True, max_length=50, null=True)),
                ("report_version", models.CharField(blank=True, max_length=20, null=True)),
                ("header_text", models.TextField(blank=True, null=True)),
                ("footer_text", models.TextField(blank=True, null=True)),
                ("pdf_template_url", models.CharField(blank=True, max_length=500, null=True)),
                ("is_active", models.BooleanField(default=True)),
                ("enable_pqrs", models.BooleanField(default=True)),
                ("enable_users_admin", models.BooleanField(default=True)),
                ("enable_reports_pdf", models.BooleanField(default=False)),
                ("enable_ai_reports", models.BooleanField(default=False)),
                ("enable_planes_institucionales", models.BooleanField(default=False)),
                ("enable_contratacion", models.BooleanField(default=False)),
                ("enable_pdm", models.BooleanField(default=False)),
                ("enable_asistencia", models.BooleanField(default=True)),
                ("enable_correspondencia", models.BooleanField(default=True)),
                ("enable_presupuesto", models.BooleanField(default=True)),
                ("created_at", models.DateTimeField(auto_now_add=True, null=True)),
                ("updated_at", models.DateTimeField(auto_now=True, null=True)),
            ],
            options={
                "verbose_name": "Entidad",
                "verbose_name_plural": "Entidades",
                "db_table": "entities",
                "ordering": ["name"],
            },
        ),
        migrations.CreateModel(
            name="Secretaria",
            fields=[
                ("id", models.BigAutoField(primary_key=True, serialize=False)),
                ("nombre", models.CharField(max_length=200)),
                ("is_active", models.BooleanField(default=True)),
                ("created_at", models.DateTimeField(auto_now_add=True, null=True)),
                ("updated_at", models.DateTimeField(auto_now=True, null=True)),
                ("entity", models.ForeignKey(
                    db_column="entity_id",
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name="secretarias",
                    to="entities.entity",
                )),
            ],
            options={
                "verbose_name": "Secretar\u00eda",
                "verbose_name_plural": "Secretar\u00edas",
                "db_table": "secretarias",
                "ordering": ["nombre"],
                "unique_together": {("entity", "nombre")},
            },
        ),
    ]
