"""Parseo de mensajes Gmail API (format=full)."""
from __future__ import annotations

import base64
import re
from dataclasses import dataclass, field
from email.utils import getaddresses
from typing import Any


@dataclass
class ParsedGmailMessage:
    gmail_message_id: str
    gmail_thread_id: str
    internet_message_id: str = ""
    subject: str = ""
    from_raw: str = ""
    from_email: str = ""
    from_name: str = ""
    to_emails: list[str] = field(default_factory=list)
    cc_emails: list[str] = field(default_factory=list)
    date_header: str = ""
    references: str = ""
    in_reply_to: str = ""
    text_body: str = ""
    html_body: str = ""
    attachments: list[tuple[str, bytes, str]] = field(default_factory=list)


def _decode_b64url(data: str) -> bytes:
    if not data:
        return b""
    padded = data + "=" * (-len(data) % 4)
    return base64.urlsafe_b64decode(padded.encode("ascii"))


def _header_map(payload: dict[str, Any]) -> dict[str, str]:
    headers = payload.get("headers") or []
    out: dict[str, str] = {}
    for h in headers:
        name = (h.get("name") or "").lower()
        value = h.get("value") or ""
        if name:
            out[name] = value
    return out


def _collect_parts(part: dict[str, Any], *, include_attachments: bool) -> tuple[list[str], list[str], list]:
    plain: list[str] = []
    html: list[str] = []
    attachments: list[tuple[str, bytes, str]] = []

    def walk(p: dict[str, Any]) -> None:
        mime = (p.get("mimeType") or "").lower()
        body = p.get("body") or {}
        filename = p.get("filename") or ""
        data = body.get("data") or ""
        attachment_id = body.get("attachmentId")
        if p.get("parts"):
            for child in p["parts"]:
                walk(child)
            return
        if attachment_id or filename:
            if include_attachments and attachment_id:
                attachments.append((filename or "adjunto", b"", mime))
            return
        if mime == "text/plain" and data:
            plain.append(_decode_b64url(data).decode("utf-8", errors="ignore"))
        elif mime == "text/html" and data:
            html.append(_decode_b64url(data).decode("utf-8", errors="ignore"))

    walk(part)
    return plain, html, attachments


def parse_gmail_api_message(
    api_message: dict[str, Any],
    *,
    include_attachments: bool = True,
) -> ParsedGmailMessage:
    msg_id = api_message.get("id") or ""
    thread_id = api_message.get("threadId") or ""
    payload = api_message.get("payload") or {}
    headers = _header_map(payload)
    plain, html, attachment_stubs = _collect_parts(payload, include_attachments=include_attachments)

    from_raw = headers.get("from", "")
    addrs = getaddresses([from_raw])
    from_email = (addrs[0][1] if addrs else "").strip().lower()
    from_name = (addrs[0][0] if addrs else "").strip()

    to_emails = [addr.lower() for _, addr in getaddresses([headers.get("to", "")]) if addr]
    cc_emails = [addr.lower() for _, addr in getaddresses([headers.get("cc", "")]) if addr]

    return ParsedGmailMessage(
        gmail_message_id=msg_id,
        gmail_thread_id=thread_id,
        internet_message_id=headers.get("message-id", "").strip(),
        subject=headers.get("subject", "").strip(),
        from_raw=from_raw,
        from_email=from_email,
        from_name=from_name,
        to_emails=to_emails,
        cc_emails=cc_emails,
        date_header=headers.get("date", ""),
        references=headers.get("references", "").strip(),
        in_reply_to=headers.get("in-reply-to", "").strip(),
        text_body="\n\n".join(p for p in plain if p).strip(),
        html_body="\n".join(h for h in html if h).strip(),
        attachments=attachment_stubs,
    )


def html_to_text_simple(raw_html: str) -> str:
    text = re.sub(r"(?is)<(script|style).*?>.*?</\1>", " ", raw_html)
    text = re.sub(r"(?i)<br\s*/?>", "\n", text)
    text = re.sub(r"(?i)</p>", "\n\n", text)
    text = re.sub(r"<[^>]+>", " ", text)
    return re.sub(r"\s+\n", "\n", text).strip()


def body_text_for_ia(parsed: ParsedGmailMessage) -> str:
    if parsed.text_body.strip():
        return parsed.text_body.strip()
    if parsed.html_body.strip():
        return html_to_text_simple(parsed.html_body)
    return ""
