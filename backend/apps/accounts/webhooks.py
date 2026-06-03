"""Clerk webhook handler — sync user lifecycle events to Django."""
from __future__ import annotations

import json
import logging

from django.conf import settings
from django.contrib.auth import get_user_model
from django.http import HttpResponse
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import csrf_exempt
from rest_framework.permissions import AllowAny
from rest_framework.views import APIView
from svix.webhooks import Webhook, WebhookVerificationError

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

    def _handle_user_updated(self, data: dict) -> None:
        clerk_id = data.get("id")
        email = _primary_email_from_payload(data)
        if not clerk_id or not email:
            return
        user = User.objects.filter(clerk_id=clerk_id).first()
        if user and user.email.lower() != email:
            user.email = email
            user.save(update_fields=["email"])

    def _handle_user_deleted(self, data: dict) -> None:
        clerk_id = data.get("id")
        if not clerk_id:
            return
        User.objects.filter(clerk_id=clerk_id).update(is_active=False)
