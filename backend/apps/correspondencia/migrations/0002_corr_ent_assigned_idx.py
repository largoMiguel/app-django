from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("correspondencia", "0001_initial"),
    ]

    operations = [
        migrations.AddIndex(
            model_name="correspondencia",
            index=models.Index(
                fields=["entity", "assigned_to"],
                name="corr_ent_assigned_idx",
            ),
        ),
    ]
