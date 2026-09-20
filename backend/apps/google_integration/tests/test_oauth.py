from datetime import timedelta
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIRequestFactory, force_authenticate

from apps.entities.models import Entity
from apps.google_integration.models import GoogleEmailConnection, GoogleOAuthState
from apps.google_integration.oauth_views import GoogleConnectView, GoogleDisconnectView, GoogleStatusView

User = get_user_model()


@override_settings(
    GOOGLE_GMAIL_SEND_ENABLED=True,
    GOOGLE_CLIENT_ID="client-id",
    GOOGLE_CLIENT_SECRET="secret",
    GOOGLE_REDIRECT_URI="https://demo.test/callback",
)
class OAuthViewsTests(TestCase):
    def setUp(self):
        self.factory = APIRequestFactory()
        self.user = User.objects.create_user(
            email="admin@test.com",
            password="x",
            full_name="Admin",
        )

    def test_connect_returns_authorize_url(self):
        request = self.factory.post("/integrations/google/connect")
        force_authenticate(request, user=self.user)
        response = GoogleConnectView.as_view()(request)
        self.assertEqual(response.status_code, 200)
        self.assertIn("authorize_url", response.data)
        self.assertTrue(GoogleOAuthState.objects.filter(user=self.user).exists())

    def test_status_not_connected(self):
        request = self.factory.get("/integrations/google/status")
        force_authenticate(request, user=self.user)
        response = GoogleStatusView.as_view()(request)
        self.assertEqual(response.status_code, 200)
        self.assertFalse(response.data["connected"])

    @patch("apps.google_integration.crypto.encrypt_refresh_token")
    def test_disconnect(self, mock_enc):
        mock_enc.return_value = b"cipher"
        entity = Entity.objects.create(name="Ent", code="ENT", slug="ent-oauth")
        GoogleEmailConnection.objects.create(
            user=self.user,
            entity=entity,
            google_email="x@gov.co",
            encrypted_refresh_token=b"x",
            status="activa",
        )
        request = self.factory.delete("/integrations/google/disconnect")
        force_authenticate(request, user=self.user)
        response = GoogleDisconnectView.as_view()(request)
        self.assertEqual(response.status_code, 200)
        conn = GoogleEmailConnection.objects.get(user=self.user)
        self.assertEqual(conn.status, "revocada")
