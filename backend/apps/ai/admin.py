from django.contrib import admin

from .models import AIAlert, AIInteraction, ContentEmbedding, CopilotConversation


@admin.register(AIInteraction)
class AIInteractionAdmin(admin.ModelAdmin):
    list_display = ("feature", "entity", "model", "total_tokens", "success", "created_at")
    list_filter = ("feature", "success")
    readonly_fields = ("created_at",)


@admin.register(AIAlert)
class AIAlertAdmin(admin.ModelAdmin):
    list_display = ("alert_type", "severity", "title", "entity", "is_read", "created_at")
    list_filter = ("alert_type", "severity", "is_read")


@admin.register(ContentEmbedding)
class ContentEmbeddingAdmin(admin.ModelAdmin):
    list_display = ("content_type", "object_id", "entity", "updated_at")


@admin.register(CopilotConversation)
class CopilotConversationAdmin(admin.ModelAdmin):
    list_display = ("copilot_type", "entity", "user", "updated_at")
