from django.db import migrations, models

import apps.common.storages
import apps.pdm.models


class Migration(migrations.Migration):

    dependencies = [
        ("pdm", "0004_pdm_chat"),
    ]

    operations = [
        migrations.AlterField(
            model_name="pdmevidenciaarchivo",
            name="archivo",
            field=models.FileField(
                max_length=500,
                storage=apps.common.storages.pdm_file_storage,
                upload_to=apps.pdm.models.pdm_evidencia_archivo_upload_path,
            ),
        ),
    ]
