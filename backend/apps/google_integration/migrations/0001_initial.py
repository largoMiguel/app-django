import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):
    initial = True

    dependencies = [
        ("entities", "0011_entity_email_domains"),
        ("pqrs", "0018_pqrscorreo_proveedor_gmail"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="GoogleEmailConnection",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("google_email", models.EmailField(db_index=True, max_length=254)),
                ("google_subject_id", models.CharField(blank=True, default="", max_length=128)),
                ("encrypted_refresh_token", models.BinaryField()),
                ("scopes", models.JSONField(blank=True, default=list)),
                (
                    "status",
                    models.CharField(
                        choices=[
                            ("activa", "Activa"),
                            ("requiere_reautorizacion", "Requiere reautorización"),
                            ("revocada", "Revocada"),
                        ],
                        db_index=True,
                        default="activa",
                        max_length=32,
                    ),
                ),
                ("connected_at", models.DateTimeField(auto_now_add=True)),
                ("last_used_at", models.DateTimeField(blank=True, null=True)),
                ("revoked_at", models.DateTimeField(blank=True, null=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                (
                    "entity",
                    models.ForeignKey(
                        db_column="entity_id",
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="google_email_connections",
                        to="entities.entity",
                    ),
                ),
                (
                    "user",
                    models.OneToOneField(
                        db_column="user_id",
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="google_email_connection",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={
                "verbose_name": "Conexión Gmail",
                "verbose_name_plural": "Conexiones Gmail",
                "db_table": "google_email_connections",
            },
        ),
        migrations.CreateModel(
            name="GoogleOAuthState",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("state", models.CharField(db_index=True, max_length=128, unique=True)),
                ("entity_id", models.IntegerField(blank=True, null=True)),
                ("expires_at", models.DateTimeField(db_index=True)),
                ("used_at", models.DateTimeField(blank=True, null=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                (
                    "user",
                    models.ForeignKey(
                        db_column="user_id",
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="google_oauth_states",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={
                "verbose_name": "Estado OAuth Google",
                "verbose_name_plural": "Estados OAuth Google",
                "db_table": "google_oauth_states",
            },
        ),
        migrations.CreateModel(
            name="PQRSGmailOrigin",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("provider", models.CharField(default="gmail", max_length=20)),
                ("gmail_account_email", models.EmailField(db_index=True, max_length=254)),
                ("gmail_message_id", models.CharField(max_length=255)),
                ("gmail_thread_id", models.CharField(blank=True, default="", max_length=255)),
                ("internet_message_id", models.CharField(blank=True, default="", max_length=500)),
                ("original_from", models.CharField(blank=True, default="", max_length=500)),
                ("original_to", models.TextField(blank=True, default="")),
                ("original_cc", models.TextField(blank=True, default="")),
                ("original_subject", models.CharField(blank=True, default="", max_length=500)),
                ("references_header", models.TextField(blank=True, default="")),
                ("in_reply_to_header", models.CharField(blank=True, default="", max_length=500)),
                ("text_body", models.TextField(blank=True, default="")),
                ("html_body", models.TextField(blank=True, default="")),
                ("received_at", models.DateTimeField(blank=True, null=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                (
                    "pqrs",
                    models.OneToOneField(
                        db_column="pqrs_id",
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="gmail_origin",
                        to="pqrs.pqrs",
                    ),
                ),
            ],
            options={
                "verbose_name": "Origen Gmail PQRS",
                "verbose_name_plural": "Orígenes Gmail PQRS",
                "db_table": "pqrs_gmail_origins",
            },
        ),
        migrations.CreateModel(
            name="GmailEnvioAuditoria",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("google_email", models.EmailField(max_length=254)),
                ("gmail_message_id", models.CharField(blank=True, default="", max_length=255)),
                ("gmail_thread_id", models.CharField(blank=True, default="", max_length=255)),
                ("destinatarios", models.JSONField(blank=True, default=list)),
                ("estado", models.CharField(db_index=True, max_length=32)),
                ("error", models.CharField(blank=True, default="", max_length=500)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                (
                    "entity",
                    models.ForeignKey(
                        blank=True,
                        db_column="entity_id",
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="gmail_envios",
                        to="entities.entity",
                    ),
                ),
                (
                    "pqrs",
                    models.ForeignKey(
                        db_column="pqrs_id",
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="gmail_envios",
                        to="pqrs.pqrs",
                    ),
                ),
                (
                    "user",
                    models.ForeignKey(
                        blank=True,
                        db_column="user_id",
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="gmail_envios",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={
                "verbose_name": "Auditoría envío Gmail",
                "verbose_name_plural": "Auditorías envío Gmail",
                "db_table": "gmail_envio_auditoria",
                "ordering": ["-created_at", "-id"],
            },
        ),
        migrations.AddConstraint(
            model_name="pqrsgmailorigin",
            constraint=models.UniqueConstraint(
                fields=("gmail_account_email", "gmail_message_id"),
                name="uniq_gmail_account_message",
            ),
        ),
    ]
