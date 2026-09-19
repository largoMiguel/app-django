from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("entities", "0009_remove_entity_nit_secop_fields"),
    ]

    operations = [
        migrations.AddField(
            model_name="entity",
            name="enable_pic",
            field=models.BooleanField(default=False),
        ),
    ]
