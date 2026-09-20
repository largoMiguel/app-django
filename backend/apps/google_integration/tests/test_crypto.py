from django.test import TestCase, override_settings

from apps.google_integration.crypto import decrypt_refresh_token, encrypt_refresh_token


@override_settings(GOOGLE_TOKEN_ENCRYPTION_KEY="test-key-for-fernet-wrap-32bytes!!")
class CryptoTests(TestCase):
    def test_encrypt_decrypt_roundtrip(self):
        plain = "1//refresh-token-example"
        cipher = encrypt_refresh_token(plain)
        self.assertIsInstance(cipher, bytes)
        self.assertNotEqual(cipher.decode("latin-1", errors="ignore"), plain)
        self.assertEqual(decrypt_refresh_token(cipher), plain)
