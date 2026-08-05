"""NIT específicos para consulta SECOP I y SECOP II."""
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("entities", "0005_multi_entity_delegation"),
    ]

    operations = [
        migrations.AddField(
            model_name="entity",
            name="nit_secop_i",
            field=models.CharField(
                blank=True,
                help_text="NIT(s) para SECOP I en datos.gov.co; varios separados por coma.",
                max_length=200,
                null=True,
            ),
        ),
        migrations.AddField(
            model_name="entity",
            name="nit_secop_ii",
            field=models.CharField(
                blank=True,
                help_text="NIT(s) para SECOP II en datos.gov.co; varios separados por coma.",
                max_length=200,
                null=True,
            ),
        ),
    ]
