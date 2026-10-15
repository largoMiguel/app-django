from django.test import TestCase, override_settings

from apps.google_integration.crypto import (
    decrypt_refresh_token,
    encrypt_refresh_token,
    refresh_token_stored_valid,
)


@override_settings(GOOGLE_TOKEN_ENCRYPTION_KEY="test-key-for-fernet-wrap-32bytes!!")
class CryptoTests(TestCase):
    def test_encrypt_decrypt_roundtrip(self):
        plain = "1//refresh-token-example"
        cipher = encrypt_refresh_token(plain)
        self.assertIsInstance(cipher, bytes)
        self.assertNotEqual(cipher.decode("latin-1", errors="ignore"), plain)
        self.assertEqual(decrypt_refresh_token(cipher), plain)
        self.assertTrue(refresh_token_stored_valid(cipher))
        self.assertFalse(refresh_token_stored_valid(b""))
        self.assertFalse(refresh_token_stored_valid(None))

    def test_refresh_token_stored_valid_after_key_rotation(self):
        cipher = encrypt_refresh_token("token")
        with override_settings(GOOGLE_TOKEN_ENCRYPTION_KEY="other-key-that-does-not-match!!!!!"):
            self.assertFalse(refresh_token_stored_valid(cipher))
