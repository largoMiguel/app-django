from django.db import migrations


class Migration(migrations.Migration):
    dependencies = [
        ("accounts", "0005_add_clerk_id"),
    ]

    operations = [
        migrations.RunSQL(
            sql="""
            DROP TABLE IF EXISTS token_blacklist_blacklistedtoken CASCADE;
            DROP TABLE IF EXISTS token_blacklist_outstandingtoken CASCADE;
            """,
            reverse_sql=migrations.RunSQL.noop,
        ),
    ]
