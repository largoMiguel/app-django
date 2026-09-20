from django.test import TestCase

from apps.google_integration.mime_build import build_reply_message
from apps.google_integration.mime_parse import html_to_text_simple, parse_gmail_api_message


class MimeTests(TestCase):
    def test_parse_simple_message(self):
        api_msg = {
            "id": "msg123",
            "threadId": "thread456",
            "payload": {
                "headers": [
                    {"name": "Subject", "value": "Solicitud ciudadano"},
                    {"name": "From", "value": "Ciudadano <ciudadano@test.com>"},
                    {"name": "To", "value": "funcionario@gov.co"},
                    {"name": "Message-ID", "value": "<abc@test>"},
                ],
                "mimeType": "text/plain",
                "body": {"data": "SG9sYQ=="},
            },
        }
        parsed = parse_gmail_api_message(api_msg, include_attachments=False)
        self.assertEqual(parsed.gmail_message_id, "msg123")
        self.assertEqual(parsed.from_email, "ciudadano@test.com")
        self.assertIn("Hola", parsed.text_body)

    def test_build_reply_with_thread_headers(self):
        raw = build_reply_message(
            from_email="sec@gov.co",
            from_name="Secretaría",
            to_addrs=["ciudadano@test.com"],
            subject="Original",
            body_text="Respuesta oficial",
            in_reply_to="<abc@test>",
            references="<abc@test>",
        )
        self.assertTrue(len(raw) > 20)

    def test_html_to_text(self):
        self.assertIn("Hola", html_to_text_simple("<p>Hola</p><br> mundo"))
