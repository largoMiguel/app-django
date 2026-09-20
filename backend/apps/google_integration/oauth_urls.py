from django.urls import path

from .oauth_views import (
    GoogleCallbackView,
    GoogleConnectView,
    GoogleDisconnectView,
    GoogleStatusView,
)

urlpatterns = [
    path("connect", GoogleConnectView.as_view(), name="google-oauth-connect"),
    path("callback", GoogleCallbackView.as_view(), name="google-oauth-callback"),
    path("status", GoogleStatusView.as_view(), name="google-oauth-status"),
    path("disconnect", GoogleDisconnectView.as_view(), name="google-oauth-disconnect"),
]
