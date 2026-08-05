"""Auth API — profile endpoint (login handled by Clerk)."""
from __future__ import annotations

from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.memberships import list_memberships

from .serializers import MembershipSerializer, UserMeSerializer, UserMeUpdateSerializer


class MeView(APIView):
    permission_classes = (IsAuthenticated,)

    def get(self, request):
        data = UserMeSerializer(request.user).data
        data["active_entity_id"] = getattr(request.user, "_active_entity_id", None) or request.user.entity_id
        data["memberships"] = MembershipSerializer(list_memberships(request.user), many=True).data
        return Response(data)

    def patch(self, request):
        ser = UserMeUpdateSerializer(request.user, data=request.data, partial=True)
        ser.is_valid(raise_exception=True)
        ser.save()
        data = UserMeSerializer(request.user).data
        data["active_entity_id"] = getattr(request.user, "_active_entity_id", None) or request.user.entity_id
        data["memberships"] = MembershipSerializer(list_memberships(request.user), many=True).data
        return Response(data)


class MembershipsView(APIView):
    permission_classes = (IsAuthenticated,)

    def get(self, request):
        return Response(MembershipSerializer(list_memberships(request.user), many=True).data)
