from django.urls import path

from .public_chat_views import PublicPdmChatInfoView, PublicPdmChatView

urlpatterns = [
    path(
        "entity/<slug:slug>/pdm-chat/info/",
        PublicPdmChatInfoView.as_view(),
        name="public-pdm-chat-info",
    ),
    path(
        "entity/<slug:slug>/pdm-chat/",
        PublicPdmChatView.as_view(),
        name="public-pdm-chat",
    ),
]
