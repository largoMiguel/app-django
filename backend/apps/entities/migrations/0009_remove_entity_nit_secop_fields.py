from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ("entities", "0008_entity_secop_identity"),
    ]

    operations = [
        migrations.RemoveField(
            model_name="entity",
            name="nit_secop_i",
        ),
        migrations.RemoveField(
            model_name="entity",
            name="nit_secop_ii",
        ),
    ]
