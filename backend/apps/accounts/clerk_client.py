"""Cliente Clerk compartido por proceso (evita instanciar en cada request)."""
from __future__ import annotations

from django.conf import settings
from clerk_backend_api import Clerk

_client: Clerk | None = None


def get_clerk_client() -> Clerk | None:
    global _client
    secret = settings.CLERK_SECRET_KEY
    if not secret:
        return None
    if _client is None:
        _client = Clerk(bearer_auth=secret)
    return _client
