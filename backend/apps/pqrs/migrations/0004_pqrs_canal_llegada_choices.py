"""Migración que registra los nuevos valores de CanalLlegada (no altera el esquema DB)."""
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("pqrs", "0003_pqrsarchivo"),
    ]

    operations = [
        migrations.AlterField(
            model_name="pqrs",
            name="canal_llegada",
            field=models.CharField(
                choices=[
                    ("web", "Portal web"),
                    ("presencial", "Presencial (ventanilla)"),
                    ("email", "Correo electrónico"),
                    ("telefono", "Teléfono"),
                    ("carta", "Carta"),
                    ("buzon", "Buzón de sugerencias"),
                    ("entrega_fisica", "Entrega física en oficina"),
                ],
                default="web",
                max_length=50,
            ),
        ),
    ]
