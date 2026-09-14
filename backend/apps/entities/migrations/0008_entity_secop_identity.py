from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("entities", "0007_initial_gestion_documental"),
    ]

    operations = [
        migrations.AddField(
            model_name="entity",
            name="secop_i_codigo_entidad",
            field=models.CharField(
                blank=True,
                help_text="Código(s) de entidad SECOP I en datos.gov.co; varios separados por coma.",
                max_length=500,
                null=True,
            ),
        ),
        migrations.AddField(
            model_name="entity",
            name="secop_i_nombre_entidad",
            field=models.CharField(
                blank=True,
                help_text="Nombre(s) exacto(s) de entidad SECOP I; varios separados por coma.",
                max_length=500,
                null=True,
            ),
        ),
        migrations.AddField(
            model_name="entity",
            name="secop_ii_codigo_entidad",
            field=models.CharField(
                blank=True,
                help_text="Código(s) de entidad SECOP II en datos.gov.co; varios separados por coma.",
                max_length=500,
                null=True,
            ),
        ),
        migrations.AddField(
            model_name="entity",
            name="secop_ii_nombre_entidad",
            field=models.CharField(
                blank=True,
                help_text="Nombre(s) exacto(s) de entidad SECOP II; varios separados por coma.",
                max_length=500,
                null=True,
            ),
        ),
    ]
