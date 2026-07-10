from django.db import migrations


class Migration(migrations.Migration):
    dependencies = [
        ("entities", "0002_entity_pdm_chat"),
    ]

    operations = [
        migrations.RemoveField(model_name="entity", name="report_code"),
        migrations.RemoveField(model_name="entity", name="report_version"),
        migrations.RemoveField(model_name="entity", name="header_text"),
        migrations.RemoveField(model_name="entity", name="footer_text"),
    ]
