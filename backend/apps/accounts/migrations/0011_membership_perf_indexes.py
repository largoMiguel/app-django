from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("accounts", "0010_backfill_memberships"),
    ]

    operations = [
        migrations.AddIndex(
            model_name="userentitymembership",
            index=models.Index(fields=["user", "is_active"], name="uem_user_active_idx"),
        ),
        migrations.AddIndex(
            model_name="userentitymembership",
            index=models.Index(
                fields=["entity", "role", "is_active"],
                name="uem_entity_role_active_idx",
            ),
        ),
    ]
