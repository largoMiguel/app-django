from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("accounts", "0003_user_enabled_modules"),
    ]

    operations = [
        migrations.AddConstraint(
            model_name="user",
            constraint=models.CheckConstraint(
                check=~models.Q(role="secretario") | models.Q(secretaria__isnull=False),
                name="user_secretario_requires_secretaria",
            ),
        ),
    ]
