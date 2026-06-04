"""Clerk webhook handler — sync user lifecycle events to Django."""
from __future__ import annotations

import logging

from django.conf import settings
from django.contrib.auth import get_user_model
from django.http import HttpResponse
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import csrf_exempt
from rest_framework.permissions import AllowAny
from rest_framework.views import APIView
from svix.webhooks import Webhook, WebhookVerificationError

from apps.accounts.services.clerk import ClerkServiceError, update_user_name

logger = logging.getLogger(__name__)
User = get_user_model()


def _primary_email_from_payload(data: dict) -> str | None:
    addresses = data.get("email_addresses") or []
    primary_id = data.get("primary_email_address_id")
    for addr in addresses:
        if primary_id and addr.get("id") == primary_id:
            return (addr.get("email_address") or "").lower()
    if addresses:
        return (addresses[0].get("email_address") or "").lower()
    return None


def _full_name_from_payload(data: dict) -> str:
    first = (data.get("first_name") or "").strip()
    last = (data.get("last_name") or "").strip()
    if first and last:
        return f"{first} {last}"
    return first or last or ""


@method_decorator(csrf_exempt, name="dispatch")
class ClerkWebhookView(APIView):
    permission_classes = (AllowAny,)
    authentication_classes = ()

    def post(self, request):
        secret = settings.CLERK_WEBHOOK_SIGNING_SECRET
        if not secret:
            logger.error("CLERK_WEBHOOK_SIGNING_SECRET not configured")
            return HttpResponse(status=500)

        raw_body = request.body
        headers = {
            "svix-id": request.headers.get("svix-id", ""),
            "svix-timestamp": request.headers.get("svix-timestamp", ""),
            "svix-signature": request.headers.get("svix-signature", ""),
        }

        try:
            wh = Webhook(secret)
            payload = wh.verify(raw_body, headers)
        except WebhookVerificationError:
            return HttpResponse("Verification failed", status=400)

        event_type = payload.get("type", "")
        data = payload.get("data") or {}

        if event_type == "user.created":
            self._handle_user_created(data)
        elif event_type == "user.updated":
            self._handle_user_updated(data)
        elif event_type == "user.deleted":
            self._handle_user_deleted(data)

        return HttpResponse("OK", status=200)

    def _handle_user_created(self, data: dict) -> None:
        clerk_id = data.get("id")
        email = _primary_email_from_payload(data)
        if not clerk_id or not email:
            return
        user = User.objects.filter(email__iexact=email).first()
        if user and not user.clerk_id:
            user.clerk_id = clerk_id
            user.save(update_fields=["clerk_id"])
            logger.info("Linked clerk_id %s to user %s", clerk_id, email)

        clerk_first = (data.get("first_name") or "").strip()
        clerk_last = (data.get("last_name") or "").strip()
        if user and user.full_name and not clerk_first and not clerk_last:
            try:
                update_user_name(clerk_id=clerk_id, full_name=user.full_name)
            except ClerkServiceError as exc:
                logger.warning("Could not sync name to Clerk for %s: %s", email, exc)

    def _handle_user_updated(self, data: dict) -> None:
        clerk_id = data.get("id")
        email = _primary_email_from_payload(data)
        if not clerk_id:
            return

        user = User.objects.filter(clerk_id=clerk_id).first()
        if not user and email:
            user = User.objects.filter(email__iexact=email).first()
            if user and not user.clerk_id:
                user.clerk_id = clerk_id
                user.save(update_fields=["clerk_id"])

        if not user:
            return

        updates: dict = {}
        if email and user.email.lower() != email:
            updates["email"] = email

        full_name = _full_name_from_payload(data)
        if full_name and user.full_name != full_name:
            updates["full_name"] = full_name

        banned = data.get("banned")
        if banned is True and user.is_active:
            updates["is_active"] = False
        elif banned is False and not user.is_active:
            updates["is_active"] = True

        if updates:
            for key, value in updates.items():
                setattr(user, key, value)
            user.save(update_fields=list(updates.keys()))

    def _handle_user_deleted(self, data: dict) -> None:
        clerk_id = data.get("id")
        if not clerk_id:
            return
        User.objects.filter(clerk_id=clerk_id).update(is_active=False)
