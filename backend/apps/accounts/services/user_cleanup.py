"""Helpers for removing users and legacy auth artifacts."""
from __future__ import annotations

import logging

from django.db import connection

logger = logging.getLogger(__name__)


def clear_legacy_jwt_tokens(user_id: int) -> None:
    """Remove SimpleJWT blacklist rows left from the old auth stack."""
    tables = connection.introspection.table_names()
    if "token_blacklist_outstandingtoken" not in tables:
        return
    with connection.cursor() as cursor:
        if "token_blacklist_blacklistedtoken" in tables:
            cursor.execute(
                """
                DELETE FROM token_blacklist_blacklistedtoken
                WHERE token_id IN (
                    SELECT id FROM token_blacklist_outstandingtoken WHERE user_id = %s
                )
                """,
                [user_id],
            )
        cursor.execute(
            "DELETE FROM token_blacklist_outstandingtoken WHERE user_id = %s",
            [user_id],
        )
    logger.debug("Cleared legacy JWT tokens for user_id=%s", user_id)
