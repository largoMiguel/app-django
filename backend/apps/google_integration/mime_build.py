"""Construcción MIME RFC 5322 para Gmail API send."""
from __future__ import annotations

import base64
import email.utils
from email.mime.application import MIMEApplication
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from typing import Iterable


def _ensure_re_subject(subject: str) -> str:
    subj = (subject or "").strip()
    if not subj:
        return "Re: PQRS"
    if subj.lower().startswith("re:"):
        return subj
    return f"Re: {subj}"


def build_reply_message(
    *,
    from_email: str,
    from_name: str,
    to_addrs: list[str],
    subject: str,
    body_text: str,
    body_html: str | None = None,
    in_reply_to: str = "",
    references: str = "",
    attachments: Iterable[tuple[str, bytes, str]] | None = None,
) -> str:
    """Retorna raw base64url para Gmail API."""
    if attachments:
        msg = MIMEMultipart("mixed")
        alt = MIMEMultipart("alternative")
        alt.attach(MIMEText(body_text, "plain", "utf-8"))
        if body_html:
            alt.attach(MIMEText(body_html, "html", "utf-8"))
        msg.attach(alt)
        for name, content, mime in attachments:
            part = MIMEApplication(content, _subtype=mime.split("/")[-1] if "/" in mime else "octet-stream")
            part.add_header("Content-Disposition", "attachment", filename=name)
            msg.attach(part)
    else:
        if body_html:
            msg = MIMEMultipart("alternative")
            msg.attach(MIMEText(body_text, "plain", "utf-8"))
            msg.attach(MIMEText(body_html, "html", "utf-8"))
        else:
            msg = MIMEText(body_text, "plain", "utf-8")

    msg["To"] = ", ".join(to_addrs)
    msg["From"] = email.utils.formataddr((from_name or from_email, from_email))
    msg["Subject"] = _ensure_re_subject(subject)
    if in_reply_to:
        msg["In-Reply-To"] = in_reply_to
    if references:
        msg["References"] = references
    msg["Date"] = email.utils.formatdate(localtime=True)

    raw_bytes = msg.as_bytes()
    return base64.urlsafe_b64encode(raw_bytes).decode("ascii").rstrip("=")
