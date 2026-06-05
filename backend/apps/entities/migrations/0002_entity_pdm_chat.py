from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("entities", "0001_initial"),
    ]

    operations = [
        migrations.AddField(
            model_name="entity",
            name="enable_pdm_chat",
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name="entity",
            name="pdm_chat_intro",
            field=models.TextField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="entity",
            name="pdm_chat_sugerencias",
            field=models.JSONField(blank=True, null=True),
        ),
    ]
