from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("pqrs", "0016_multi_entity_delegation"),
    ]

    operations = [
        migrations.AlterField(
            model_name="correoentrantepqrs",
            name="estado",
            field=models.CharField(
                choices=[
                    ("procesado", "Procesado"),
                    ("procesado_respuesta", "Respuesta registrada"),
                    ("ignorado_no_registrado", "Remitente no registrado"),
                    ("ignorado_sin_entidad", "Usuario sin entidad"),
                    ("ignorado_no_govco", "Dominio no gov.co"),
                    ("ignorado_duplicado", "Duplicado"),
                    ("ignorado_radicado_no_encontrado", "Radicado no encontrado"),
                    ("ignorado_ya_respondida", "PQRS ya respondida"),
                    ("error", "Error"),
                ],
                default="error",
                max_length=40,
            ),
        ),
    ]
