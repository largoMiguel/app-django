from django.contrib import admin

from .models import GmailEnvioAuditoria, GoogleEmailConnection, GoogleOAuthState, PQRSGmailOrigin


@admin.register(GoogleEmailConnection)
class GoogleEmailConnectionAdmin(admin.ModelAdmin):
    list_display = ("google_email", "user", "entity", "status", "connected_at", "last_used_at")
    list_filter = ("status",)
    search_fields = ("google_email", "user__email")
    readonly_fields = ("encrypted_refresh_token",)


@admin.register(PQRSGmailOrigin)
class PQRSGmailOriginAdmin(admin.ModelAdmin):
    list_display = ("pqrs", "gmail_account_email", "gmail_message_id", "received_at")
    search_fields = ("gmail_message_id", "gmail_account_email", "pqrs__numero_radicado")


@admin.register(GmailEnvioAuditoria)
class GmailEnvioAuditoriaAdmin(admin.ModelAdmin):
    list_display = ("pqrs", "google_email", "estado", "created_at")
    list_filter = ("estado",)


@admin.register(GoogleOAuthState)
class GoogleOAuthStateAdmin(admin.ModelAdmin):
    list_display = ("state", "user", "expires_at", "used_at")
