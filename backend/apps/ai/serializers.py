"""Serializers para API de IA."""
from rest_framework import serializers

from .models import AIAlert, AIInteraction, CopilotConversation, CopilotMessage


class AIAlertSerializer(serializers.ModelSerializer):
    class Meta:
        model = AIAlert
        fields = [
            "id", "alert_type", "severity", "title", "message",
            "score", "object_type", "object_id", "metadata",
            "is_read", "is_dismissed", "created_at",
        ]
        read_only_fields = fields


class CopilotMessageSerializer(serializers.ModelSerializer):
    class Meta:
        model = CopilotMessage
        fields = ["id", "role", "content", "sources", "created_at"]


class CopilotChatRequestSerializer(serializers.Serializer):
    message = serializers.CharField(max_length=2000)
    conversation_id = serializers.IntegerField(required=False, allow_null=True)


class CopilotChatResponseSerializer(serializers.Serializer):
    reply = serializers.CharField()
    sources = serializers.ListField(child=serializers.DictField(), required=False)
    conversation_id = serializers.IntegerField(required=False)


class PQRSDraftRequestSerializer(serializers.Serializer):
    extra_context = serializers.CharField(required=False, allow_blank=True, max_length=2000)


class PQRSDraftResponseSerializer(serializers.Serializer):
    draft = serializers.CharField()
    tipo_solicitud = serializers.CharField()
    normativa = serializers.CharField()
    model = serializers.CharField(required=False)


class SemanticSearchSerializer(serializers.Serializer):
    query = serializers.CharField(max_length=500)
    content_types = serializers.ListField(
        child=serializers.CharField(),
        required=False,
    )
    limit = serializers.IntegerField(default=10, min_value=1, max_value=50)


class AIInteractionStatsSerializer(serializers.Serializer):
    total_tokens = serializers.IntegerField()
    total_interactions = serializers.IntegerField()
    by_feature = serializers.DictField()
