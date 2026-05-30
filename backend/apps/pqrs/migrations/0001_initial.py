from django.db import migrations, models
import django.db.models.deletion
import django.utils.timezone
from django.conf import settings


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        ("entities", "0001_initial"),
        ("accounts", "0002_entity_secretaria_role"),
    ]

    operations = [
        migrations.CreateModel(
            name="PQRS",
            fields=[
                ("id", models.BigAutoField(primary_key=True, serialize=False)),
                ("numero_radicado", models.CharField(db_index=True, max_length=64, unique=True)),
                ("tipo_identificacion", models.CharField(default="CC", max_length=50)),
                ("tipo_documento", models.CharField(blank=True, max_length=50, null=True)),
                ("medio_respuesta", models.CharField(default="email", max_length=50)),
                ("nombre_ciudadano", models.CharField(blank=True, max_length=200, null=True)),
                ("cedula_ciudadano", models.CharField(blank=True, max_length=50, null=True)),
                ("telefono_ciudadano", models.CharField(blank=True, max_length=50, null=True)),
                ("email_ciudadano", models.CharField(blank=True, max_length=150, null=True)),
                ("direccion_ciudadano", models.CharField(blank=True, max_length=300, null=True)),
                ("tipo_solicitud", models.CharField(
                    choices=[
                        ("peticion", "Petición"),
                        ("queja", "Queja"),
                        ("reclamo", "Reclamo"),
                        ("sugerencia", "Sugerencia"),
                        ("denuncia", "Denuncia"),
                        ("felicitacion", "Felicitación"),
                        ("solicitud_informacion", "Solicitud de información"),
                        ("copia", "Copia de documentos"),
                        ("otro", "Otro"),
                    ],
                    default="peticion",
                    max_length=50,
                )),
                ("tipo_persona", models.CharField(blank=True, max_length=50, null=True)),
                ("genero", models.CharField(blank=True, max_length=50, null=True)),
                ("asunto", models.CharField(max_length=255)),
                ("descripcion", models.TextField()),
                ("archivo_adjunto", models.CharField(blank=True, max_length=255, null=True)),
                ("estado", models.CharField(
                    choices=[
                        ("recibida", "Recibida"),
                        ("asignada", "Asignada"),
                        ("en_proceso", "En proceso"),
                        ("respondida", "Respondida"),
                        ("rechazada_asignacion", "Asignación rechazada"),
                        ("cerrada", "Cerrada"),
                    ],
                    default="recibida",
                    max_length=50,
                )),
                ("canal_llegada", models.CharField(
                    choices=[("web", "Web"), ("presencial", "Presencial"), ("email", "Email"), ("telefono", "Teléfono")],
                    default="web",
                    max_length=50,
                )),
                ("dias_respuesta", models.IntegerField(blank=True, null=True)),
                ("respuesta", models.TextField(blank=True, null=True)),
                ("archivo_respuesta", models.CharField(blank=True, max_length=255, null=True)),
                ("justificacion_asignacion", models.TextField(blank=True, null=True)),
                ("email_enviado", models.BooleanField(default=False)),
                ("email_error", models.CharField(blank=True, max_length=500, null=True)),
                ("fecha_solicitud", models.DateTimeField(default=django.utils.timezone.now, null=True)),
                ("fecha_cierre", models.DateTimeField(blank=True, null=True)),
                ("fecha_delegacion", models.DateTimeField(blank=True, null=True)),
                ("fecha_respuesta", models.DateTimeField(blank=True, null=True)),
                ("created_at", models.DateTimeField(auto_now_add=True, null=True)),
                ("updated_at", models.DateTimeField(auto_now=True, null=True)),
                ("entity", models.ForeignKey(
                    db_column="entity_id",
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name="pqrs",
                    to="entities.entity",
                )),
                ("created_by", models.ForeignKey(
                    blank=True, null=True,
                    db_column="created_by_id",
                    on_delete=django.db.models.deletion.SET_NULL,
                    related_name="pqrs_creadas",
                    to=settings.AUTH_USER_MODEL,
                )),
                ("assigned_to", models.ForeignKey(
                    blank=True, null=True,
                    db_column="assigned_to_id",
                    on_delete=django.db.models.deletion.SET_NULL,
                    related_name="pqrs_asignadas",
                    to="entities.secretaria",
                    help_text="Secretaría asignada (no usuario individual).",
                )),
            ],
            options={
                "verbose_name": "PQRS",
                "verbose_name_plural": "PQRS",
                "db_table": "pqrs",
                "ordering": ["-fecha_solicitud", "-id"],
            },
        ),
        migrations.AddIndex(
            model_name="pqrs",
            index=models.Index(fields=["estado"], name="pqrs_estado_idx"),
        ),
        migrations.AddIndex(
            model_name="pqrs",
            index=models.Index(fields=["tipo_solicitud"], name="pqrs_tipo_sol_idx"),
        ),
        migrations.AddIndex(
            model_name="pqrs",
            index=models.Index(fields=["canal_llegada"], name="pqrs_canal_idx"),
        ),
        migrations.CreateModel(
            name="AsignacionAuditoria",
            fields=[
                ("id", models.BigAutoField(primary_key=True, serialize=False)),
                ("accion", models.CharField(default="asignacion", max_length=30, help_text="asignacion | reasignacion | rechazo | respuesta")),
                ("justificacion", models.TextField(blank=True, null=True)),
                ("fecha_asignacion", models.DateTimeField(default=django.utils.timezone.now, null=True)),
                ("pqrs", models.ForeignKey(
                    db_column="pqrs_id",
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name="auditoria",
                    to="pqrs.pqrs",
                )),
                ("usuario_anterior", models.ForeignKey(
                    blank=True, null=True,
                    db_column="usuario_anterior_id",
                    on_delete=django.db.models.deletion.SET_NULL,
                    related_name="auditorias_como_anterior",
                    to=settings.AUTH_USER_MODEL,
                )),
                ("usuario_nuevo", models.ForeignKey(
                    blank=True, null=True,
                    db_column="usuario_nuevo_id",
                    on_delete=django.db.models.deletion.SET_NULL,
                    related_name="auditorias_como_nuevo",
                    to=settings.AUTH_USER_MODEL,
                )),
                ("secretaria_anterior", models.ForeignKey(
                    blank=True, null=True,
                    db_column="secretaria_anterior_id",
                    on_delete=django.db.models.deletion.SET_NULL,
                    related_name="auditorias_como_anterior",
                    to="entities.secretaria",
                )),
                ("secretaria_nueva", models.ForeignKey(
                    blank=True, null=True,
                    db_column="secretaria_nueva_id",
                    on_delete=django.db.models.deletion.SET_NULL,
                    related_name="auditorias_como_nueva",
                    to="entities.secretaria",
                )),
            ],
            options={
                "verbose_name": "Auditoría de asignación",
                "verbose_name_plural": "Auditorías de asignación",
                "db_table": "asignacion_auditoria",
                "ordering": ["-fecha_asignacion", "-id"],
            },
        ),
        migrations.AddIndex(
            model_name="asignacionauditoria",
            index=models.Index(fields=["pqrs"], name="asig_audit_pqrs_idx"),
        ),
        migrations.AddIndex(
            model_name="asignacionauditoria",
            index=models.Index(fields=["-fecha_asignacion"], name="asig_audit_fecha_idx"),
        ),
    ]
