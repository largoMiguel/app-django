from django.db import migrations


def clear_legacy_pdf_templates(apps, schema_editor):
    Entity = apps.get_model("entities", "Entity")
    Entity.objects.filter(docx_template_url__iendswith=".pdf").update(
        docx_template_url=None
    )


class Migration(migrations.Migration):

    dependencies = [
        ("entities", "0011_entity_email_domains"),
    ]

    operations = [
        migrations.RenameField(
            model_name="entity",
            old_name="pdf_template_url",
            new_name="docx_template_url",
        ),
        migrations.RunPython(clear_legacy_pdf_templates, migrations.RunPython.noop),
    ]
