from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("pqrs", "0005_remove_legacy_pqrs_fields"),
    ]

    operations = [
        migrations.AddIndex(
            model_name="pqrs",
            index=models.Index(fields=["entity", "estado"], name="pqrs_entity_estado_idx"),
        ),
    ]
