# Generated manually for facial recognition enrollment

import django.db.models.deletion
import pgvector.django
import pgvector.django.indexes
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("asistencia", "0001_initial"),
    ]

    operations = [
        migrations.CreateModel(
            name="FuncionarioFaceTemplate",
            fields=[
                (
                    "id",
                    models.BigAutoField(
                        auto_created=True,
                        primary_key=True,
                        serialize=False,
                        verbose_name="ID",
                    ),
                ),
                (
                    "descriptor",
                    pgvector.django.VectorField(dimensions=128),
                ),
                ("foto_key", models.CharField(max_length=500)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                (
                    "funcionario",
                    models.ForeignKey(
                        db_column="funcionario_id",
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="face_templates",
                        to="asistencia.funcionario",
                    ),
                ),
            ],
            options={
                "verbose_name": "Plantilla facial",
                "verbose_name_plural": "Plantillas faciales",
                "db_table": "asistencia_face_templates",
                "ordering": ["-created_at"],
            },
        ),
        migrations.AddIndex(
            model_name="funcionariofacetemplate",
            index=models.Index(
                fields=["funcionario", "-created_at"],
                name="asistencia__funcion_8a0f1d_idx",
            ),
        ),
        migrations.AddIndex(
            model_name="funcionariofacetemplate",
            index=pgvector.django.indexes.HnswIndex(
                ef_construction=64,
                fields=["descriptor"],
                m=16,
                name="asist_face_hnsw_idx",
                opclasses=["vector_l2_ops"],
            ),
        ),
    ]
