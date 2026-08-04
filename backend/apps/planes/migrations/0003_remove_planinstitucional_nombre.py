from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ("planes", "0002_seed_catalogo_decreto612"),
    ]

    operations = [
        migrations.AlterModelOptions(
            name="planinstitucional",
            options={
                "ordering": ["anio", "catalogo__orden"],
                "verbose_name": "Plan institucional",
                "verbose_name_plural": "Planes institucionales",
            },
        ),
        migrations.RemoveField(
            model_name="planinstitucional",
            name="nombre",
        ),
    ]
