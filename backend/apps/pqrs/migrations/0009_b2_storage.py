from django.db import migrations, models

import apps.common.storages
import apps.pqrs.models


class Migration(migrations.Migration):

    dependencies = [
        ("pqrs", "0008_pqrs_entity_fecha_solicitud_idx"),
    ]

    operations = [
        migrations.AlterField(
            model_name="pqrsarchivo",
            name="archivo",
            field=models.FileField(
                max_length=500,
                storage=apps.common.storages.pqrs_file_storage,
                upload_to=apps.pqrs.models.pqrs_archivo_upload_path,
            ),
        ),
    ]
