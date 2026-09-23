from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.test import TestCase, override_settings
from rest_framework.test import APIRequestFactory

from apps.google_integration.addon_views import GmailAddonOpenView
from apps.google_integration.models import PQRSGmailOrigin
from apps.google_integration.services.radicar import check_duplicate

User = get_user_model()


@override_settings(
    GOOGLE_ADDON_CLIENT_ID="addon-client",
    GOOGLE_CLIENT_ID="web-client",
)
class AddonTests(TestCase):
    def setUp(self):
        self.factory = APIRequestFactory()

    def test_open_returns_card(self):
        request = self.factory.post("/google-addon/gmail/open", {}, format="json")
        response = GmailAddonOpenView.as_view()(request)
        self.assertEqual(response.status_code, 200)
        self.assertIn("renderActions", response.data)

    @patch("apps.google_integration.addon_views.verify_google_id_token")
    @patch("apps.google_integration.addon_views.resolve_user_for_addon")
    @patch("apps.google_integration.addon_views.ensure_entity")
    @patch("apps.google_integration.addon_views.fetch_and_parse_message")
    @patch("apps.google_integration.addon_views.apply_original_sender_to_extraction")
    @patch("apps.google_integration.addon_views.scrub_entity_from_extraction")
    @patch("apps.google_integration.addon_views.extraer_pqrs_con_ia")
    def test_preview_requires_valid_tokens(
        self,
        mock_ia,
        mock_scrub,
        mock_apply,
        mock_fetch,
        mock_entity,
        mock_user,
        mock_verify,
    ):
        from apps.entities.models import Entity
        from apps.google_integration.mime_parse import ParsedGmailMessage

        entity = Entity.objects.create(name="E", code="E", slug="e-slug", enable_ai_reports=True)
        mock_verify.return_value = {"email": "a@gov.co", "email_verified": True}
        mock_user.return_value = User.objects.create_user(email="a@gov.co", password="x")
        mock_entity.return_value = entity
        mock_fetch.return_value = (
            ParsedGmailMessage(gmail_message_id="m1", gmail_thread_id="t1", text_body="texto"),
            {},
            [],
            {},
            [],
        )
        extraido = {
            "tipo_solicitud": "peticion",
            "asunto": "Test",
            "descripcion": "Desc",
            "medio_respuesta": "email",
        }
        mock_ia.return_value = extraido
        mock_scrub.return_value = extraido
        mock_apply.return_value = extraido

        event = {
            "authorizationEventObject": {
                "userOAuthToken": "u",
                "userIdToken": "id",
                "systemIdToken": "sys",
            },
            "gmail": {"messageId": "m1", "threadId": "t1", "accessToken": "acc"},
        }
        request = self.factory.post("/google-addon/gmail/preview", event, format="json")
        from apps.google_integration.addon_views import GmailAddonPreviewView

        response = GmailAddonPreviewView.as_view()(request)
        self.assertEqual(response.status_code, 200)
        self.assertIn("renderActions", response.data)

    def test_duplicate_detection_helper(self):
        from apps.entities.models import Entity
        from apps.pqrs.models import PQRS

        entity = Entity.objects.create(name="E2", code="E2", slug="e2")
        pqrs = PQRS.objects.create(
            entity=entity,
            numero_radicado="PQRS-1-20260101-001",
            asunto="A",
            descripcion="D",
        )
        PQRSGmailOrigin.objects.create(
            pqrs=pqrs,
            gmail_account_email="u@gov.co",
            gmail_message_id="mid-1",
        )
        found = check_duplicate("u@gov.co", "mid-1")
        self.assertEqual(found.id, pqrs.id)
