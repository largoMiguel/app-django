from django.db import migrations


def backfill_memberships(apps, schema_editor):
    User = apps.get_model("accounts", "User")
    UserEntityMembership = apps.get_model("accounts", "UserEntityMembership")
    for user in User.objects.exclude(entity_id__isnull=True).iterator():
        if UserEntityMembership.objects.filter(user_id=user.id, entity_id=user.entity_id).exists():
            continue
        UserEntityMembership.objects.create(
            user_id=user.id,
            entity_id=user.entity_id,
            role=user.role or "",
            secretaria_id=user.secretaria_id,
            enabled_modules=list(user.enabled_modules or []),
            is_active=user.is_active,
            is_default=True,
        )


def noop_reverse(apps, schema_editor):
    pass


class Migration(migrations.Migration):
    dependencies = [
        ("accounts", "0009_multi_entity_delegation"),
    ]

    operations = [
        migrations.RunPython(backfill_memberships, noop_reverse),
    ]
