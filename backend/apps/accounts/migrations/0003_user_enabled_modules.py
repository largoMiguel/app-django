from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("accounts", "0002_entity_secretaria_role"),
    ]

    operations = [
        migrations.AddField(
            model_name="user",
            name="enabled_modules",
            field=models.JSONField(
                blank=True,
                default=list,
                help_text=(
                    "Módulos específicos habilitados para este usuario "
                    "(subset de la entidad). Para secretarios."
                ),
            ),
        ),
    ]
