"""Endpoints públicos del kiosk — sin autenticación Clerk."""
from __future__ import annotations

from rest_framework.exceptions import AuthenticationFailed
from rest_framework.parsers import JSONParser
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.throttling import AnonRateThrottle
from rest_framework.views import APIView

from .device_auth import DeviceTokenAuthenticationRequired, get_equipo_from_request
from .serializers import (
    KioskFacialRegistroRequestSerializer,
    KioskPairRequestSerializer,
    KioskRegistroRequestSerializer,
    RegistroAsistenciaSerializer,
)
from .services import (
    label_for_tipo,
    pair_equipo,
    punch_progress,
    register_punch,
    register_punch_facial,
    secuencia_for_entity,
)


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
        return Response(
            _build_punch_response(equipo, registro, new_token),
            status=201,
        )


def _build_punch_response(equipo, registro, new_token, *, match_distance: float | None = None):
    progress = punch_progress(equipo.entity, registro.funcionario, last_tipo=registro.tipo)
    tipo_label = label_for_tipo(registro.tipo)
    if progress["jornada_completa"]:
        hint = "Jornada completa por hoy. Gracias."
    else:
        hint = f"Próxima marcación: {progress['siguiente_tipo_label']}."
    payload = {
        "registro": RegistroAsistenciaSerializer(registro).data,
        "mensaje": f"{registro.funcionario.nombre_completo} — {tipo_label} registrada.",
        "tipo_label": tipo_label,
        "funcionario_nombre": registro.funcionario.nombre_completo,
        "hora": registro.fecha_hora.isoformat(),
        "hint": hint,
        **progress,
    }
    if match_distance is not None:
        payload["match_distance"] = round(match_distance, 4)
    if new_token:
        payload["device_token"] = new_token
    return payload


class KioskFacialRegistroView(APIView):
    authentication_classes = (DeviceTokenAuthenticationRequired,)
    permission_classes = (AllowAny,)
    throttle_classes = (KioskPunchThrottle,)
    parser_classes = (JSONParser,)

    def post(self, request):
        try:
            equipo = get_equipo_from_request(request)
        except AuthenticationFailed as exc:
            raise exc

        ser = KioskFacialRegistroRequestSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        data = ser.validated_data
        registro, new_token, distance = register_punch_facial(
            equipo=equipo,
            descriptor=data["descriptor"],
            idempotency_key=data["idempotency_key"],
            liveness_passed=data["liveness_passed"],
            client_ts=data.get("client_ts"),
        )
        return Response(
            _build_punch_response(equipo, registro, new_token, match_distance=distance),
            status=201,
        )
