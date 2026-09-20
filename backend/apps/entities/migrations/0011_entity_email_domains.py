from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("entities", "0010_entity_enable_pic"),
    ]

    operations = [
        migrations.AddField(
            model_name="entity",
            name="email_domains",
            field=models.CharField(
                blank=True,
                default="",
                help_text="Dominios institucionales (CSV) para resolver entidad desde Gmail Add-on.",
                max_length=500,
            ),
        ),
    ]
