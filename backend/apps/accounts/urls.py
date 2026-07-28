from django.urls import path

from .views import MeView, MembershipsView

urlpatterns = [
    path("me", MeView.as_view(), name="auth-me"),
    path("memberships", MembershipsView.as_view(), name="auth-memberships"),
]
