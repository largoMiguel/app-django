"""Utilidades compartidas — PIC."""
from __future__ import annotations


def user_display_name(user) -> str:
    return (getattr(user, "full_name", None) or user.email or "").strip() or str(user.email)
