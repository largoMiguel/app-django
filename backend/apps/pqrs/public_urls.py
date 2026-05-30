from django.urls import path

from .public_views import (
    PublicEntityInfoView,
    PublicPQRSAutoCreateView,
    PublicPQRSCreateView,
)

urlpatterns = [
    path("entity/<slug:slug>/", PublicEntityInfoView.as_view(), name="public-entity-info"),
    path("entity/<slug:slug>/pqrs/", PublicPQRSCreateView.as_view(), name="public-pqrs-create"),
    path(
        "entity/<slug:slug>/pqrs/auto/",
        PublicPQRSAutoCreateView.as_view(),
        name="public-pqrs-auto-create",
    ),
]
