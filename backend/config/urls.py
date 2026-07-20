"""Root URL configuration."""
from django.conf import settings
from django.contrib import admin
from django.http import JsonResponse
from django.urls import include, path, re_path
from drf_spectacular.views import (
    SpectacularAPIView,
    SpectacularRedocView,
    SpectacularSwaggerView,
)

from apps.common.views import ProtectedMediaView, SignedFileDeliveryView


def healthcheck(_request):
    return JsonResponse({"status": "ok"})


urlpatterns = [
    path("api/health", healthcheck),
    path("api/v1/public/", include("apps.pqrs.public_urls")),
    path("api/v1/public/", include("apps.pdm.public_chat_urls")),
    path("api/v1/public/", include("apps.asistencia.public_urls")),
    path("api/v1/", include("config.api_v1")),
    re_path(
        r"^(?P<bucket>softone-pqrs|softone-pdm|softone-th|softone-correspondence)/(?P<path>.+)$",
        SignedFileDeliveryView.as_view(),
        name="signed-file-delivery",
    ),
    re_path(r"^media/(?P<path>.+)$", ProtectedMediaView.as_view(), name="protected-media"),
]

if getattr(settings, "ENABLE_DJANGO_ADMIN", settings.DEBUG):
    urlpatterns.insert(0, path("admin/", admin.site.urls))

if settings.DEBUG or getattr(settings, "ALLOW_API_DOCS", False):
    urlpatterns += [
        path("api/schema/", SpectacularAPIView.as_view(), name="schema"),
        path("api/docs/", SpectacularSwaggerView.as_view(url_name="schema"), name="swagger"),
        path("api/redoc/", SpectacularRedocView.as_view(url_name="schema"), name="redoc"),
    ]
