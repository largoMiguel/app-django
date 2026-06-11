"""Auth API — profile endpoint (login handled by Clerk)."""
from __future__ import annotations

from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .serializers import UserMeSerializer, UserMeUpdateSerializer


class MeView(APIView):
    permission_classes = (IsAuthenticated,)

    def get(self, request):
        return Response(UserMeSerializer(request.user).data)

    def patch(self, request):
        ser = UserMeUpdateSerializer(request.user, data=request.data, partial=True)
        ser.is_valid(raise_exception=True)
        ser.save()
        return Response(UserMeSerializer(request.user).data)
