from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("pdm", "0002_pdm_evidencia_archivos"),
    ]

    operations = [
        migrations.AlterField(
            model_name="pdmejecucionpresupuestal",
            name="codigo_producto",
            field=models.CharField(db_index=True, max_length=64),
        ),
    ]
