"""Modelos OAuth Gmail y trazabilidad de correo PQRS."""
from __future__ import annotations

from django.conf import settings
from django.db import models


class GoogleConnectionStatus(models.TextChoices):
    ACTIVA = "activa", "Activa"
    REQUIERE_REAUTORIZACION = "requiere_reautorizacion", "Requiere reautorización"
    REVOCADA = "revocada", "Revocada"


class GoogleEmailConnection(models.Model):
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="google_email_connection",
        db_column="user_id",
    )
    entity = models.ForeignKey(
        "entities.Entity",
        on_delete=models.CASCADE,
        related_name="google_email_connections",
        db_column="entity_id",
    )
    google_email = models.EmailField(db_index=True)
    google_subject_id = models.CharField(max_length=128, blank=True, default="")
    encrypted_refresh_token = models.BinaryField()
    scopes = models.JSONField(default=list, blank=True)
    status = models.CharField(
        max_length=32,
        choices=GoogleConnectionStatus.choices,
        default=GoogleConnectionStatus.ACTIVA,
        db_index=True,
    )
    connected_at = models.DateTimeField(auto_now_add=True)
    last_used_at = models.DateTimeField(null=True, blank=True)
    revoked_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "google_email_connections"
        verbose_name = "Conexión Gmail"
        verbose_name_plural = "Conexiones Gmail"

    def __str__(self) -> str:
        return f"{self.google_email} ({self.status})"


class GoogleOAuthState(models.Model):
    state = models.CharField(max_length=128, unique=True, db_index=True)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="google_oauth_states",
        db_column="user_id",
    )
    entity_id = models.IntegerField(null=True, blank=True)
    expires_at = models.DateTimeField(db_index=True)
    used_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "google_oauth_states"
        verbose_name = "Estado OAuth Google"
        verbose_name_plural = "Estados OAuth Google"


class PQRSGmailOrigin(models.Model):
    PROVIDER_GMAIL = "gmail"

    pqrs = models.OneToOneField(
        "pqrs.PQRS",
        on_delete=models.CASCADE,
        related_name="gmail_origin",
        db_column="pqrs_id",
    )
    provider = models.CharField(max_length=20, default=PROVIDER_GMAIL)
    gmail_account_email = models.EmailField(db_index=True)
    gmail_message_id = models.CharField(max_length=255)
    gmail_thread_id = models.CharField(max_length=255, blank=True, default="")
    internet_message_id = models.CharField(max_length=500, blank=True, default="")
    original_from = models.CharField(max_length=500, blank=True, default="")
    original_to = models.TextField(blank=True, default="")
    original_cc = models.TextField(blank=True, default="")
    original_subject = models.CharField(max_length=500, blank=True, default="")
    references_header = models.TextField(blank=True, default="")
    in_reply_to_header = models.CharField(max_length=500, blank=True, default="")
    text_body = models.TextField(blank=True, default="")
    html_body = models.TextField(blank=True, default="")
    received_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "pqrs_gmail_origins"
        verbose_name = "Origen Gmail PQRS"
        verbose_name_plural = "Orígenes Gmail PQRS"
        constraints = [
            models.UniqueConstraint(
                fields=["gmail_account_email", "gmail_message_id"],
                name="uniq_gmail_account_message",
            ),
        ]

    def __str__(self) -> str:
        return f"{self.gmail_account_email} — {self.gmail_message_id[:24]}"


class GmailEnvioAuditoria(models.Model):
    pqrs = models.ForeignKey(
        "pqrs.PQRS",
        on_delete=models.CASCADE,
        related_name="gmail_envios",
        db_column="pqrs_id",
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="gmail_envios",
        db_column="user_id",
    )
    entity = models.ForeignKey(
        "entities.Entity",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="gmail_envios",
        db_column="entity_id",
    )
    google_email = models.EmailField()
    gmail_message_id = models.CharField(max_length=255, blank=True, default="")
    gmail_thread_id = models.CharField(max_length=255, blank=True, default="")
    destinatarios = models.JSONField(default=list, blank=True)
    estado = models.CharField(max_length=32, db_index=True)
    error = models.CharField(max_length=500, blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "gmail_envio_auditoria"
        verbose_name = "Auditoría envío Gmail"
        verbose_name_plural = "Auditorías envío Gmail"
        ordering = ["-created_at", "-id"]
