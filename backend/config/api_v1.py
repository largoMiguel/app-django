"""API v1 router."""
from django.urls import include, path

from apps.accounts.webhooks import ClerkWebhookView
from apps.pqrs.webhooks import ZeptoMailWebhookView

urlpatterns = [
    path("auth/", include("apps.accounts.urls")),
    path("webhooks/clerk", ClerkWebhookView.as_view(), name="clerk-webhook"),
    path("webhooks/zeptomail", ZeptoMailWebhookView.as_view(), name="zeptomail-webhook"),
    path("rbac/", include("apps.rbac.urls")),
    path("", include("apps.entities.urls")),
    path("", include("apps.pqrs.urls")),
    path("", include("apps.pdm.urls")),
    path("", include("apps.asistencia.urls")),
    path("", include("apps.correspondencia.urls")),
    path("", include("apps.ai.urls")),
    path("users/", include("apps.accounts.user_urls")),
]
