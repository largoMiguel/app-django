# Generated manually for asistencia module

import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        ("entities", "0004_entity_asistencias_por_dia"),
    ]

    operations = [
        migrations.CreateModel(
            name="Funcionario",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("cedula", models.CharField(max_length=20)),
                ("nombres", models.CharField(max_length=100)),
                ("apellidos", models.CharField(max_length=100)),
                ("email", models.EmailField(blank=True, default="", max_length=150)),
                ("telefono", models.CharField(blank=True, default="", max_length=20)),
                ("cargo", models.CharField(blank=True, default="", max_length=150)),
                ("is_active", models.BooleanField(default=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                (
                    "entity",
                    models.ForeignKey(
                        db_column="entity_id",
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="funcionarios",
                        to="entities.entity",
                    ),
                ),
            ],
            options={
                "verbose_name": "Funcionario",
                "verbose_name_plural": "Funcionarios",
                "db_table": "asistencia_funcionarios",
                "ordering": ["apellidos", "nombres"],
            },
        ),
        migrations.CreateModel(
            name="EquipoRegistro",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("nombre", models.CharField(max_length=100)),
                ("ubicacion", models.CharField(blank=True, default="", max_length=200)),
                ("is_active", models.BooleanField(default=True)),
                ("pairing_code_hash", models.CharField(blank=True, default="", max_length=128)),
                ("pairing_code_expires_at", models.DateTimeField(blank=True, null=True)),
                ("device_token_hash", models.CharField(blank=True, default="", max_length=128)),
                ("paired_at", models.DateTimeField(blank=True, null=True)),
                ("last_seen_at", models.DateTimeField(blank=True, null=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                (
                    "entity",
                    models.ForeignKey(
                        db_column="entity_id",
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="equipos_asistencia",
                        to="entities.entity",
                    ),
                ),
            ],
            options={
                "verbose_name": "Equipo de registro",
                "verbose_name_plural": "Equipos de registro",
                "db_table": "asistencia_equipos",
                "ordering": ["nombre"],
            },
        ),
        migrations.CreateModel(
            name="RegistroAsistencia",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                (
                    "tipo",
                    models.CharField(
                        choices=[
                            ("entrada", "Entrada"),
                            ("salida_almuerzo", "Salida al almuerzo"),
                            ("retorno_almuerzo", "Retorno del almuerzo"),
                            ("salida", "Salida"),
                        ],
                        max_length=20,
                    ),
                ),
                ("fecha_hora", models.DateTimeField(auto_now_add=True, db_index=True)),
                ("foto_key", models.CharField(max_length=500)),
                ("idempotency_key", models.CharField(max_length=64, unique=True)),
                ("client_ts", models.DateTimeField(blank=True, null=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                (
                    "entity",
                    models.ForeignKey(
                        db_column="entity_id",
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="registros_asistencia",
                        to="entities.entity",
                    ),
                ),
                (
                    "equipo",
                    models.ForeignKey(
                        db_column="equipo_id",
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="registros",
                        to="asistencia.equiporegistro",
                    ),
                ),
                (
                    "funcionario",
                    models.ForeignKey(
                        db_column="funcionario_id",
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="registros",
                        to="asistencia.funcionario",
                    ),
                ),
            ],
            options={
                "verbose_name": "Registro de asistencia",
                "verbose_name_plural": "Registros de asistencia",
                "db_table": "asistencia_registros",
                "ordering": ["-fecha_hora"],
            },
        ),
        migrations.AddConstraint(
            model_name="funcionario",
            constraint=models.UniqueConstraint(
                fields=("entity", "cedula"),
                name="asistencia_funcionario_entity_cedula_uniq",
            ),
        ),
        migrations.AddIndex(
            model_name="funcionario",
            index=models.Index(fields=["entity", "is_active"], name="asistencia_f_entity__8a0f0d_idx"),
        ),
        migrations.AddIndex(
            model_name="funcionario",
            index=models.Index(fields=["entity", "cedula"], name="asistencia_f_entity__f8b2c1_idx"),
        ),
        migrations.AddIndex(
            model_name="equiporegistro",
            index=models.Index(fields=["entity", "is_active"], name="asistencia_e_entity__a1b2c3_idx"),
        ),
        migrations.AddIndex(
            model_name="equiporegistro",
            index=models.Index(fields=["device_token_hash"], name="asistencia_e_device__d4e5f6_idx"),
        ),
        migrations.AddIndex(
            model_name="registroasistencia",
            index=models.Index(fields=["entity", "fecha_hora"], name="asistencia_r_entity__g7h8i9_idx"),
        ),
        migrations.AddIndex(
            model_name="registroasistencia",
            index=models.Index(fields=["funcionario", "fecha_hora"], name="asistencia_r_funcion_j0k1l2_idx"),
        ),
        migrations.AddIndex(
            model_name="registroasistencia",
            index=models.Index(fields=["entity", "tipo", "fecha_hora"], name="asistencia_r_entity__m3n4o5_idx"),
        ),
    ]
