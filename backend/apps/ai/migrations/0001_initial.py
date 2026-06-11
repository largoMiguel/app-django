# Generated manually for pgvector + AI models
import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models
from pgvector.django import HnswIndex, VectorExtension, VectorField


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        ("entities", "0002_entity_pdm_chat"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        VectorExtension(),
        migrations.CreateModel(
            name="AIInteraction",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("feature", models.CharField(choices=[
                    ("pqrs_auto_create", "PQRS auto-create"),
                    ("pqrs_draft", "PQRS borrador respuesta"),
                    ("pqrs_compliance", "PQRS compliance"),
                    ("pdm_chat_public", "PDM chat público"),
                    ("pdm_copilot", "PDM copiloto interno"),
                    ("global_copilot", "Copiloto global"),
                    ("embedding", "Embedding"),
                    ("ocr", "OCR"),
                    ("report", "Reporte narrativo"),
                    ("anomaly", "Detección anomalías"),
                    ("semantic_search", "Búsqueda semántica"),
                ], db_index=True, max_length=40)),
                ("model", models.CharField(blank=True, max_length=80)),
                ("prompt_tokens", models.PositiveIntegerField(default=0)),
                ("completion_tokens", models.PositiveIntegerField(default=0)),
                ("total_tokens", models.PositiveIntegerField(default=0)),
                ("latency_ms", models.PositiveIntegerField(blank=True, null=True)),
                ("success", models.BooleanField(default=True)),
                ("error_message", models.TextField(blank=True)),
                ("metadata", models.JSONField(blank=True, default=dict)),
                ("created_at", models.DateTimeField(auto_now_add=True, db_index=True)),
                ("entity", models.ForeignKey(
                    blank=True, null=True,
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name="ai_interactions",
                    to="entities.entity",
                )),
                ("user", models.ForeignKey(
                    blank=True, null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    related_name="ai_interactions",
                    to=settings.AUTH_USER_MODEL,
                )),
            ],
            options={
                "db_table": "ai_interactions",
                "ordering": ["-created_at"],
            },
        ),
        migrations.CreateModel(
            name="PromptVersion",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("key", models.CharField(db_index=True, max_length=80)),
                ("version", models.PositiveSmallIntegerField(default=1)),
                ("content", models.TextField()),
                ("is_active", models.BooleanField(default=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
            ],
            options={
                "db_table": "ai_prompt_versions",
                "ordering": ["key", "-version"],
                "unique_together": {("key", "version")},
            },
        ),
        migrations.CreateModel(
            name="ContentEmbedding",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("content_type", models.CharField(choices=[
                    ("pqrs_descripcion", "PQRS descripción"),
                    ("pqrs_respuesta", "PQRS respuesta"),
                    ("pdm_evidencia", "PDM evidencia"),
                    ("pdm_producto", "PDM producto"),
                ], db_index=True, max_length=40)),
                ("object_id", models.PositiveIntegerField(db_index=True)),
                ("texto", models.TextField()),
                ("embedding", VectorField(dimensions=1536)),
                ("metadata", models.JSONField(blank=True, default=dict)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("entity", models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name="content_embeddings",
                    to="entities.entity",
                )),
            ],
            options={
                "db_table": "ai_content_embeddings",
                "unique_together": {("content_type", "object_id")},
            },
        ),
        migrations.CreateModel(
            name="AIAlert",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("alert_type", models.CharField(choices=[
                    ("pqrs_sla_risk", "PQRS riesgo SLA"),
                    ("pqrs_duplicate", "PQRS duplicada"),
                    ("pdm_anomaly", "PDM anomalía"),
                    ("pdm_forecast", "PDM pronóstico"),
                    ("insight", "Insight IA"),
                ], db_index=True, max_length=40)),
                ("severity", models.CharField(choices=[
                    ("low", "Baja"),
                    ("medium", "Media"),
                    ("high", "Alta"),
                    ("critical", "Crítica"),
                ], default="medium", max_length=20)),
                ("title", models.CharField(max_length=255)),
                ("message", models.TextField()),
                ("score", models.FloatField(blank=True, help_text="Score de confianza o riesgo 0-100", null=True)),
                ("object_type", models.CharField(blank=True, max_length=40)),
                ("object_id", models.PositiveIntegerField(blank=True, null=True)),
                ("metadata", models.JSONField(blank=True, default=dict)),
                ("is_read", models.BooleanField(db_index=True, default=False)),
                ("is_dismissed", models.BooleanField(db_index=True, default=False)),
                ("created_at", models.DateTimeField(auto_now_add=True, db_index=True)),
                ("entity", models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name="ai_alerts",
                    to="entities.entity",
                )),
            ],
            options={
                "db_table": "ai_alerts",
                "ordering": ["-created_at"],
            },
        ),
        migrations.CreateModel(
            name="CopilotConversation",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("copilot_type", models.CharField(choices=[
                    ("pdm", "PDM"),
                    ("global", "Global"),
                ], max_length=20)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("entity", models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name="copilot_conversations",
                    to="entities.entity",
                )),
                ("user", models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name="copilot_conversations",
                    to=settings.AUTH_USER_MODEL,
                )),
            ],
            options={
                "db_table": "ai_copilot_conversations",
                "ordering": ["-updated_at"],
            },
        ),
        migrations.CreateModel(
            name="CopilotMessage",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("role", models.CharField(max_length=20)),
                ("content", models.TextField()),
                ("sources", models.JSONField(blank=True, default=list)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("conversation", models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name="messages",
                    to="ai.copilotconversation",
                )),
            ],
            options={
                "db_table": "ai_copilot_messages",
                "ordering": ["created_at"],
            },
        ),
        migrations.AddIndex(
            model_name="aiinteraction",
            index=models.Index(fields=["entity", "feature", "-created_at"], name="ai_interact_entity_feat_idx"),
        ),
        migrations.AddIndex(
            model_name="aialert",
            index=models.Index(fields=["entity", "is_read", "-created_at"], name="ai_alerts_entity_read_idx"),
        ),
        migrations.AddIndex(
            model_name="contentembedding",
            index=HnswIndex(
                ef_construction=64,
                fields=["embedding"],
                m=16,
                name="ai_embed_hnsw_idx",
                opclasses=["vector_cosine_ops"],
            ),
        ),
    ]
