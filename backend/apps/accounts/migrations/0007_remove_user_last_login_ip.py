from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ("accounts", "0006_drop_token_blacklist_tables"),
    ]

    operations = [
        migrations.RemoveField(
            model_name="user",
            name="last_login_ip",
        ),
    ]
