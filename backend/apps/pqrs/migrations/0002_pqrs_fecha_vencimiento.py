from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("pqrs", "0001_initial"),
    ]

    operations = [
        migrations.AddField(
            model_name="pqrs",
            name="fecha_vencimiento",
            field=models.DateTimeField(
                blank=True,
                null=True,
                help_text="Fecha límite de respuesta según Ley 1755/2015",
            ),
        ),
    ]
