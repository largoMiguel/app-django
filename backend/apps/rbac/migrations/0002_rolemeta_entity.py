from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ("entities", "0001_initial"),
        ("rbac", "0001_initial"),
    ]

    operations = [
        migrations.AddField(
            model_name="rolemeta",
            name="entity",
            field=models.ForeignKey(
                blank=True,
                db_column="entity_id",
                help_text="Null = rol global del sistema; con entidad = rol custom de esa entidad.",
                null=True,
                on_delete=django.db.models.deletion.CASCADE,
                related_name="custom_roles",
                to="entities.entity",
            ),
        ),
    ]
