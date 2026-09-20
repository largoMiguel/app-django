from django.urls import path

from .addon_views import GmailAddonOpenView, GmailAddonPreviewView, GmailAddonRadicateView

urlpatterns = [
    path("gmail/open", GmailAddonOpenView.as_view(), name="google-addon-gmail-open"),
    path("gmail/preview", GmailAddonPreviewView.as_view(), name="google-addon-gmail-preview"),
    path("gmail/radicate", GmailAddonRadicateView.as_view(), name="google-addon-gmail-radicate"),
]
