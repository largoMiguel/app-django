from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("pqrs", "0017_correo_entrante_respuesta_estados"),
    ]

    operations = [
        migrations.AddField(
            model_name="pqrscorreo",
            name="proveedor",
            field=models.CharField(
                default="zeptomail",
                help_text="zeptomail | gmail",
                max_length=20,
            ),
        ),
        migrations.AddField(
            model_name="pqrscorreo",
            name="gmail_message_id",
            field=models.CharField(blank=True, default="", max_length=255),
        ),
    ]
