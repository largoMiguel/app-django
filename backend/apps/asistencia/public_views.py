"""Endpoints públicos del kiosk — sin autenticación Clerk."""
from __future__ import annotations

from rest_framework.exceptions import AuthenticationFailed
from rest_framework.parsers import JSONParser
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.throttling import AnonRateThrottle
from rest_framework.views import APIView

from .device_auth import DeviceTokenAuthenticationRequired, get_equipo_from_request
from .serializers import KioskPairRequestSerializer, KioskRegistroRequestSerializer, RegistroAsistenciaSerializer
from .services import label_for_tipo, pair_equipo, register_punch, secuencia_for_entity


class KioskPairThrottle(AnonRateThrottle):
    scope = "asistencia_kiosk_pair"


class KioskPunchThrottle(AnonRateThrottle):
    scope = "asistencia_kiosk_punch"


class KioskPairView(APIView):
    permission_classes = (AllowAny,)
    authentication_classes = ()
    throttle_classes = (KioskPairThrottle,)
    parser_classes = (JSONParser,)

    def post(self, request):
        ser = KioskPairRequestSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        equipo, token = pair_equipo(ser.validated_data["pairing_code"])
        entity = equipo.entity
        return Response(
            {
                "device_token": token,
                "equipo": {
                    "id": equipo.id,
                    "nombre": equipo.nombre,
                    "ubicacion": equipo.ubicacion,
                },
                "entity": {
                    "id": entity.id,
                    "name": entity.name,
                    "logo_url": entity.logo_url,
                },
                "asistencias_por_dia": entity.asistencias_por_dia,
            },
            status=201,
        )


class KioskSessionView(APIView):
    authentication_classes = (DeviceTokenAuthenticationRequired,)
    permission_classes = (AllowAny,)

    def get(self, request):
        equipo = get_equipo_from_request(request)
        entity = equipo.entity
        return Response(
            {
                "equipo": {
                    "id": equipo.id,
                    "nombre": equipo.nombre,
                    "ubicacion": equipo.ubicacion,
                },
                "entity": {
                    "id": entity.id,
                    "name": entity.name,
                    "logo_url": entity.logo_url,
                },
                "asistencias_por_dia": entity.asistencias_por_dia,
                "secuencia_tipos": secuencia_for_entity(entity),
            }
        )


class KioskRegistroView(APIView):
    authentication_classes = (DeviceTokenAuthenticationRequired,)
    permission_classes = (AllowAny,)
    throttle_classes = (KioskPunchThrottle,)
    parser_classes = (JSONParser,)

    def post(self, request):
        try:
            equipo = get_equipo_from_request(request)
        except AuthenticationFailed as exc:
            raise exc

        ser = KioskRegistroRequestSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        data = ser.validated_data
        registro, new_token = register_punch(
            equipo=equipo,
            cedula=data["cedula"],
            foto_base64=data["foto_base64"],
            idempotency_key=data["idempotency_key"],
            client_ts=data.get("client_ts"),
        )
        payload = {
            "registro": RegistroAsistenciaSerializer(registro).data,
            "mensaje": f"{registro.funcionario.nombre_completo} — {label_for_tipo(registro.tipo)} registrada.",
            "tipo_label": label_for_tipo(registro.tipo),
            "funcionario_nombre": registro.funcionario.nombre_completo,
            "hora": registro.fecha_hora.isoformat(),
        }
        if new_token:
            payload["device_token"] = new_token
        return Response(payload, status=201)
