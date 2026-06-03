"""API v1 router."""
from django.urls import include, path

from apps.accounts.webhooks import ClerkWebhookView

urlpatterns = [
    path("auth/", include("apps.accounts.urls")),
    path("webhooks/clerk", ClerkWebhookView.as_view(), name="clerk-webhook"),
    path("rbac/", include("apps.rbac.urls")),
    path("", include("apps.entities.urls")),
    path("", include("apps.pqrs.urls")),
    path("", include("apps.pdm.urls")),
    path("users/", include("apps.accounts.user_urls")),
]
