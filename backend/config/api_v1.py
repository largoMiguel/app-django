"""API v1 router."""
from django.urls import include, path

urlpatterns = [
    path("auth/", include("apps.accounts.urls")),
    path("rbac/", include("apps.rbac.urls")),
    path("", include("apps.entities.urls")),
    path("", include("apps.pqrs.urls")),
    path("", include("apps.pdm.urls")),
    path("users/", include("apps.accounts.user_urls")),
]
