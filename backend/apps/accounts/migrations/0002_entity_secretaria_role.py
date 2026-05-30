"""Migración: agregar entity, secretaria, role, username al modelo User."""
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ("accounts", "0001_initial"),
        ("entities", "0001_initial"),
    ]

    operations = [
        migrations.AddField(
            model_name="user",
            name="entity",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="users",
                to="entities.entity",
                db_column="entity_id",
            ),
        ),
        migrations.AddField(
            model_name="user",
            name="secretaria",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="users",
                to="entities.secretaria",
                db_column="secretaria_id",
            ),
        ),
        migrations.AddField(
            model_name="user",
            name="role",
            field=models.CharField(
                blank=True,
                choices=[
                    ("superadmin", "Superadmin"),
                    ("admin", "Admin"),
                    ("secretario", "Secretario"),
                    ("ciudadano", "Ciudadano"),
                ],
                default="",
                max_length=20,
            ),
        ),
    ]
