"""Modelos de auditoría, embeddings, alertas y prompts de IA."""
from __future__ import annotations

from django.conf import settings
from django.db import models

from pgvector.django import HnswIndex, VectorField


class AIInteraction(models.Model):
    """Auditoría de cada llamada a IA (tokens, costo estimado, contexto)."""

    class Feature(models.TextChoices):
        PQRS_AUTO_CREATE = "pqrs_auto_create", "PQRS auto-create"
        PQRS_DRAFT = "pqrs_draft", "PQRS borrador respuesta"
        PQRS_COMPLIANCE = "pqrs_compliance", "PQRS compliance"
        PDM_CHAT_PUBLIC = "pdm_chat_public", "PDM chat público"
        PDM_COPILOT = "pdm_copilot", "PDM copiloto interno"
        GLOBAL_COPILOT = "global_copilot", "Copiloto global"
        EMBEDDING = "embedding", "Embedding"
        OCR = "ocr", "OCR"
        REPORT = "report", "Reporte narrativo"
        ANOMALY = "anomaly", "Detección anomalías"
        SEMANTIC_SEARCH = "semantic_search", "Búsqueda semántica"

    entity = models.ForeignKey(
        "entities.Entity",
        on_delete=models.CASCADE,
        related_name="ai_interactions",
        null=True,
        blank=True,
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="ai_interactions",
    )
    feature = models.CharField(max_length=40, choices=Feature.choices, db_index=True)
    model = models.CharField(max_length=80, blank=True)
    prompt_tokens = models.PositiveIntegerField(default=0)
    completion_tokens = models.PositiveIntegerField(default=0)
    total_tokens = models.PositiveIntegerField(default=0)
    latency_ms = models.PositiveIntegerField(null=True, blank=True)
    success = models.BooleanField(default=True)
    error_message = models.TextField(blank=True)
    metadata = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        db_table = "ai_interactions"
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["entity", "feature", "-created_at"]),
        ]

    def __str__(self) -> str:
        return f"{self.feature} @ {self.created_at:%Y-%m-%d %H:%M}"


class PromptVersion(models.Model):
    """Versionado de prompts del sistema."""

    key = models.CharField(max_length=80, db_index=True)
    version = models.PositiveSmallIntegerField(default=1)
    content = models.TextField()
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "ai_prompt_versions"
        unique_together = [("key", "version")]
        ordering = ["key", "-version"]

    def __str__(self) -> str:
        return f"{self.key} v{self.version}"


class ContentEmbedding(models.Model):
    """Embeddings vectoriales para búsqueda semántica y RAG."""

    class ContentType(models.TextChoices):
        PQRS_DESCRIPCION = "pqrs_descripcion", "PQRS descripción"
        PQRS_RESPUESTA = "pqrs_respuesta", "PQRS respuesta"
        PDM_EVIDENCIA = "pdm_evidencia", "PDM evidencia"
        PDM_PRODUCTO = "pdm_producto", "PDM producto"

    entity = models.ForeignKey(
        "entities.Entity",
        on_delete=models.CASCADE,
        related_name="content_embeddings",
    )
    content_type = models.CharField(max_length=40, choices=ContentType.choices, db_index=True)
    object_id = models.PositiveIntegerField(db_index=True)
    texto = models.TextField()
    embedding = VectorField(dimensions=1536)
    metadata = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "ai_content_embeddings"
        unique_together = [("content_type", "object_id")]
        indexes = [
            HnswIndex(
                name="ai_embed_hnsw_idx",
                fields=["embedding"],
                m=16,
                ef_construction=64,
                opclasses=["vector_cosine_ops"],
            ),
        ]

    def __str__(self) -> str:
        return f"{self.content_type}:{self.object_id}"


class AIAlert(models.Model):
    """Alertas proactivas generadas por IA o reglas."""

    class AlertType(models.TextChoices):
        PQRS_SLA_RISK = "pqrs_sla_risk", "PQRS riesgo SLA"
        PQRS_DUPLICATE = "pqrs_duplicate", "PQRS duplicada"
        PDM_ANOMALY = "pdm_anomaly", "PDM anomalía"
        PDM_FORECAST = "pdm_forecast", "PDM pronóstico"
        INSIGHT = "insight", "Insight IA"

    class Severity(models.TextChoices):
        LOW = "low", "Baja"
        MEDIUM = "medium", "Media"
        HIGH = "high", "Alta"
        CRITICAL = "critical", "Crítica"

    entity = models.ForeignKey(
        "entities.Entity",
        on_delete=models.CASCADE,
        related_name="ai_alerts",
    )
    alert_type = models.CharField(max_length=40, choices=AlertType.choices, db_index=True)
    severity = models.CharField(max_length=20, choices=Severity.choices, default=Severity.MEDIUM)
    title = models.CharField(max_length=255)
    message = models.TextField()
    score = models.FloatField(null=True, blank=True, help_text="Score de confianza o riesgo 0-100")
    object_type = models.CharField(max_length=40, blank=True)
    object_id = models.PositiveIntegerField(null=True, blank=True)
    metadata = models.JSONField(default=dict, blank=True)
    is_read = models.BooleanField(default=False, db_index=True)
    is_dismissed = models.BooleanField(default=False, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        db_table = "ai_alerts"
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["entity", "is_read", "-created_at"]),
        ]

    def __str__(self) -> str:
        return f"{self.alert_type}: {self.title}"


class CopilotConversation(models.Model):
    """Conversaciones del copiloto interno (PDM / global)."""

    class CopilotType(models.TextChoices):
        PDM = "pdm", "PDM"
        GLOBAL = "global", "Global"

    entity = models.ForeignKey(
        "entities.Entity",
        on_delete=models.CASCADE,
        related_name="copilot_conversations",
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="copilot_conversations",
    )
    copilot_type = models.CharField(max_length=20, choices=CopilotType.choices)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "ai_copilot_conversations"
        ordering = ["-updated_at"]


class CopilotMessage(models.Model):
    """Mensajes del copiloto interno."""

    conversation = models.ForeignKey(
        CopilotConversation,
        on_delete=models.CASCADE,
        related_name="messages",
    )
    role = models.CharField(max_length=20)  # user | assistant
    content = models.TextField()
    sources = models.JSONField(default=list, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "ai_copilot_messages"
        ordering = ["created_at"]
