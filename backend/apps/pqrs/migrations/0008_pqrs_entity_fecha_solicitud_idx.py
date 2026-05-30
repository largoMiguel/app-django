from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("pqrs", "0007_pqrs_performance_indexes"),
    ]

    operations = [
        migrations.AddIndex(
            model_name="pqrs",
            index=models.Index(
                fields=["entity", "fecha_solicitud"],
                name="pqrs_entity_fsol_idx",
            ),
        ),
    ]
