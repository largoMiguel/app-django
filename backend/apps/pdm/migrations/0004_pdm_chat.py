import uuid

from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ("entities", "0002_entity_pdm_chat"),
        ("pdm", "0003_ejecucion_codigo_producto_64"),
    ]

    operations = [
        migrations.CreateModel(
            name="PdmChatConversation",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("session_uuid", models.UUIDField(db_index=True, default=uuid.uuid4)),
                ("ip_hash", models.CharField(blank=True, default="", max_length=64)),
                ("user_agent", models.CharField(blank=True, default="", max_length=500)),
                ("message_count", models.PositiveIntegerField(default=0)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                (
                    "entity",
                    models.ForeignKey(
                        db_column="entity_id",
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="pdm_chat_conversations",
                        to="entities.entity",
                    ),
                ),
            ],
            options={
                "verbose_name": "Conversación chat PDM",
                "verbose_name_plural": "Conversaciones chat PDM",
                "db_table": "pdm_chat_conversations",
                "ordering": ["-updated_at"],
                "indexes": [
                    models.Index(fields=["entity", "created_at"], name="pdm_chat_conv_entity_idx"),
                ],
            },
        ),
        migrations.CreateModel(
            name="PdmChatMessage",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("role", models.CharField(choices=[("user", "Usuario"), ("assistant", "Asistente")], max_length=16)),
                ("content", models.TextField()),
                ("meta", models.JSONField(blank=True, null=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                (
                    "conversation",
                    models.ForeignKey(
                        db_column="conversation_id",
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="messages",
                        to="pdm.pdmchatconversation",
                    ),
                ),
            ],
            options={
                "verbose_name": "Mensaje chat PDM",
                "verbose_name_plural": "Mensajes chat PDM",
                "db_table": "pdm_chat_messages",
                "ordering": ["created_at"],
                "indexes": [
                    models.Index(fields=["conversation", "created_at"], name="pdm_chat_msg_conv_idx"),
                ],
            },
        ),
    ]
