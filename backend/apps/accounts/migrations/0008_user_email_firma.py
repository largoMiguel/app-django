from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("accounts", "0007_remove_user_last_login_ip"),
    ]

    operations = [
        migrations.AddField(
            model_name="user",
            name="email_firma",
            field=models.TextField(
                blank=True,
                default="",
                help_text="Pie de página / firma incluida al responder PQRS por correo.",
            ),
        ),
    ]
