from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.test import TestCase, override_settings

from apps.entities.models import Entity
from apps.google_integration.crypto import encrypt_refresh_token
from apps.google_integration.models import GoogleConnectionStatus, GoogleEmailConnection
from apps.google_integration.services.send import user_has_gmail_send
from apps.pqrs.models import PQRS

User = get_user_model()


@override_settings(GOOGLE_GMAIL_SEND_ENABLED=True, GOOGLE_TOKEN_ENCRYPTION_KEY="test-key-32-chars-long!!!!!!!")
class SendDispatchTests(TestCase):
    def setUp(self):
        self.entity = Entity.objects.create(name="E", code="E", slug="e-send")
        self.user = User.objects.create_user(email="u@gov.co", password="x")
        GoogleEmailConnection.objects.create(
            user=self.user,
            entity=self.entity,
            google_email="u@gov.co",
            encrypted_refresh_token=encrypt_refresh_token("refresh"),
            status=GoogleConnectionStatus.ACTIVA,
        )

    def test_user_has_gmail_when_enabled(self):
        self.assertIsNotNone(user_has_gmail_send(self.user))

    @override_settings(GOOGLE_GMAIL_SEND_ENABLED=False)
    def test_disabled_flag(self):
        self.assertIsNone(user_has_gmail_send(self.user))
