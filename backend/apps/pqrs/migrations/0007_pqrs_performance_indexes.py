from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("pqrs", "0006_pqrs_entity_estado_index"),
    ]

    operations = [
        migrations.AddIndex(
            model_name="pqrs",
            index=models.Index(fields=["entity", "fecha_vencimiento"], name="pqrs_entity_venc_idx"),
        ),
        migrations.AddIndex(
            model_name="pqrs",
            index=models.Index(fields=["entity", "assigned_to"], name="pqrs_entity_asig_idx"),
        ),
        migrations.AddIndex(
            model_name="pqrs",
            index=models.Index(fields=["assigned_to"], name="pqrs_assigned_to_idx"),
        ),
        migrations.AddIndex(
            model_name="pqrs",
            index=models.Index(fields=["created_by"], name="pqrs_created_by_idx"),
        ),
        migrations.AddIndex(
            model_name="pqrs",
            index=models.Index(fields=["fecha_vencimiento"], name="pqrs_fecha_venc_idx"),
        ),
    ]
