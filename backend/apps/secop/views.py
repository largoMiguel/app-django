"""API SECOP — contratación pública."""
from __future__ import annotations

from datetime import date

from django.http import HttpResponse
from django.shortcuts import get_object_or_404
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.throttling import UserRateThrottle
from rest_framework.views import APIView

from apps.entities.models import Entity

from .access import ensure_secop_access, resolve_nits_secop_i, resolve_nits_secop_ii
from .ai_service import generate_secop_analysis, run_secop_copilot, summarize_contract
from .alerts import compute_alerts, filter_alerts
from .analytics import compare_kpis, compute_analytics, compute_kpis, merge_year_trends
from .datasets import (
    fetch_available_years_secop1,
    fetch_available_years_secop2_contracts,
    fetch_available_years_secop2_processes,
    invalidate_entity_cache,
)
from .export import build_alerts_excel, build_contracts_excel
from .normalize import public_record
from .serializers import (
    SecopAIAnalisisSerializer,
    SecopAICopilotSerializer,
    SecopAIContratoSerializer,
    SecopAlertasQuerySerializer,
    SecopAnioQuerySerializer,
    SecopDetalleQuerySerializer,
    SecopExportQuerySerializer,
    SecopListQuerySerializer,
    SecopRefrescarSerializer,
)
from .unify import load_secop1_normalized, load_secop2_unified


def _entity_for_user(user) -> Entity:
    if not user.entity_id:
        from rest_framework.exceptions import PermissionDenied
        raise PermissionDenied("Usuario sin entidad asignada.")
    return get_object_or_404(Entity, pk=user.entity_id)


class SecopDatosGovThrottle(UserRateThrottle):
    scope = "secop_datos_gov"


class SecopAIThrottle(UserRateThrottle):
    scope = "secop_ai"


class SecopBaseView(APIView):
    permission_classes = (permissions.IsAuthenticated,)
    throttle_classes = (SecopDatosGovThrottle,)

    def initial(self, request, *args, **kwargs):
        super().initial(request, *args, **kwargs)
        entity = _entity_for_user(request.user)
        ensure_secop_access(request.user, entity)
        self.entity = entity


def _default_anio() -> int:
    return date.today().year


def _validated_anio(ser) -> int:
    ser.is_valid(raise_exception=True)
    return ser.validated_data.get("anio") or _default_anio()


def _filter_records(records: list[dict], params: dict) -> list[dict]:
    out = records
    search = (params.get("search") or "").strip().lower()
    if search:
        def match(r: dict) -> bool:
            blob = " ".join(
                str(r.get(k) or "") for k in ("referencia", "objeto", "proveedor", "estado", "modalidad", "tipo")
            ).lower()
            return search in blob
        out = [r for r in out if match(r)]

    if params.get("estado"):
        est = params["estado"].lower()
        out = [r for r in out if est in (r.get("estado") or "").lower()]
    if params.get("modalidad"):
        mod = params["modalidad"].lower()
        out = [r for r in out if mod in (r.get("modalidad") or "").lower()]
    if params.get("tipo"):
        tp = params["tipo"].lower()
        out = [r for r in out if tp in (r.get("tipo") or "").lower()]
    if params.get("tipo_registro") and params["tipo_registro"] != "all":
        out = [r for r in out if r.get("tipo_registro") == params["tipo_registro"]]
    if params.get("proveedor"):
        prov = params["proveedor"].lower()
        out = [
            r for r in out
            if prov in (r.get("proveedor") or "").lower()
            or prov in str(r.get("documento_proveedor") or "")
        ]
    if params.get("valor_min") is not None:
        out = [r for r in out if float(r.get("valor") or 0) >= float(params["valor_min"])]
    if params.get("valor_max") is not None:
        out = [r for r in out if float(r.get("valor") or 0) <= float(params["valor_max"])]

    ordering = params.get("ordering") or "-valor"
    reverse = ordering.startswith("-")
    field = ordering.lstrip("-")
    if field in {"valor", "fecha_firma", "referencia", "estado"}:

        def sort_key(record: dict, key: str):
            val = record.get(key)
            if val is None:
                return ""
            if key == "valor":
                return float(val or 0)
            return val

        out = sorted(out, key=lambda r: sort_key(r, field), reverse=reverse)
    return out


def _paginate(records: list[dict], page: int, page_size: int) -> dict:
    total = len(records)
    start = (page - 1) * page_size
    end = start + page_size
    return {
        "count": total,
        "next": page + 1 if end < total else None,
        "previous": page - 1 if page > 1 else None,
        "results": [public_record(r) for r in records[start:end]],
    }


class SecopConfigView(SecopBaseView):
    def get(self, request):
        nits_i = resolve_nits_secop_i(self.entity)
        nits_ii = resolve_nits_secop_ii(self.entity)
        y1, _ = fetch_available_years_secop1(nits_i)
        y2c, _ = fetch_available_years_secop2_contracts(nits_ii)
        y2p, _ = fetch_available_years_secop2_processes(nits_ii)
        years = sorted(
            {
                *{int(r["anio"]) for r in merge_year_trends(y2c) if r.get("anio")},
                *{int(r["anio"]) for r in merge_year_trends(y2p) if r.get("anio")},
                *{int(r["anio"]) for r in merge_year_trends(y1, "anno_firma_contrato") if r.get("anio")},
            },
            reverse=True,
        )
        if not years:
            years = list(range(_default_anio(), _default_anio() - 5, -1))
        return Response(
            {
                "entity": self.entity.name,
                "nit_general": self.entity.nit,
                "nit_secop_i": self.entity.nit_secop_i or self.entity.nit,
                "nit_secop_ii": self.entity.nit_secop_ii or self.entity.nit,
                "nits_resueltos_i": nits_i,
                "nits_resueltos_ii": nits_ii,
                "anios_disponibles": years,
                "anio_default": years[0] if years else _default_anio(),
                "tendencia_secop1": merge_year_trends(y1, "anno_firma_contrato")[-10:],
                "tendencia_secop2_contratos": merge_year_trends(y2c)[-10:],
                "tendencia_secop2_procesos": merge_year_trends(y2p)[-10:],
            }
        )


class SecopResumenView(SecopBaseView):
    def get(self, request):
        ser = SecopAnioQuerySerializer(data=request.query_params)
        anio = _validated_anio(ser)
        nits_i = resolve_nits_secop_i(self.entity)
        nits_ii = resolve_nits_secop_ii(self.entity)
        s1, meta1 = load_secop1_normalized(nits_i, anio)
        s2, meta2 = load_secop2_unified(nits_ii, anio)
        all_recs = s1 + s2
        kpis = compute_kpis(all_recs)
        prev_kpis = {}
        if anio > 2000:
            ps1, _ = load_secop1_normalized(nits_i, anio - 1)
            ps2, _ = load_secop2_unified(nits_ii, anio - 1)
            prev_kpis = compute_kpis(ps1 + ps2)
        alerts = compute_alerts(s1, s2, nits_i=nits_i, nits_ii=nits_ii, anio=anio)
        return Response(
            {
                "anio": anio,
                "kpis": kpis,
                "comparativo": compare_kpis(kpis, prev_kpis) if prev_kpis else None,
                "secop1": {"meta": meta1, "kpis": compute_kpis(s1)},
                "secop2": {"meta": meta2, "kpis": compute_kpis(s2), "analitica": compute_analytics(s2)},
                "alertas_criticas": [a for a in alerts if a["severidad"] in {"critica", "alta"}][:8],
                "total_alertas": len(alerts),
            }
        )


class Secop2ListView(SecopBaseView):
    def get(self, request):
        ser = SecopListQuerySerializer(data=request.query_params)
        ser.is_valid(raise_exception=True)
        params = ser.validated_data
        params["anio"] = params.get("anio") or _default_anio()
        anio = params["anio"]
        records, meta = load_secop2_unified(resolve_nits_secop_ii(self.entity), anio)
        filtered = _filter_records(records, params)
        payload = _paginate(filtered, params["page"], params["page_size"])
        payload["meta"] = meta
        payload["kpis"] = compute_kpis(records)
        payload["analitica"] = compute_analytics(records)
        return Response(payload)


class Secop2AnaliticaView(SecopBaseView):
    def get(self, request):
        ser = SecopAnioQuerySerializer(data=request.query_params)
        anio = _validated_anio(ser)
        records, meta = load_secop2_unified(resolve_nits_secop_ii(self.entity), anio)
        return Response({"anio": anio, "meta": meta, **compute_analytics(records)})


class Secop1ListView(SecopBaseView):
    def get(self, request):
        ser = SecopListQuerySerializer(data=request.query_params)
        ser.is_valid(raise_exception=True)
        params = ser.validated_data
        params["anio"] = params.get("anio") or _default_anio()
        records, meta = load_secop1_normalized(resolve_nits_secop_i(self.entity), params["anio"])
        filtered = _filter_records(records, params)
        payload = _paginate(filtered, params["page"], params["page_size"])
        payload["meta"] = meta
        payload["kpis"] = compute_kpis(records)
        payload["analitica"] = compute_analytics(records)
        return Response(payload)


class Secop1AnaliticaView(SecopBaseView):
    def get(self, request):
        ser = SecopAnioQuerySerializer(data=request.query_params)
        anio = _validated_anio(ser)
        records, meta = load_secop1_normalized(resolve_nits_secop_i(self.entity), anio)
        return Response({"anio": anio, "meta": meta, **compute_analytics(records)})


class SecopAlertasView(SecopBaseView):
    def get(self, request):
        ser = SecopAlertasQuerySerializer(data=request.query_params)
        ser.is_valid(raise_exception=True)
        data = ser.validated_data
        anio = data.get("anio") or _default_anio()
        nits_i = resolve_nits_secop_i(self.entity)
        nits_ii = resolve_nits_secop_ii(self.entity)
        s1, _ = load_secop1_normalized(nits_i, anio)
        s2, _ = load_secop2_unified(nits_ii, anio)
        alerts = compute_alerts(s1, s2, nits_i=nits_i, nits_ii=nits_ii, anio=anio)
        alerts = filter_alerts(alerts, fuente=data.get("fuente"), severidad=data.get("severidad"))
        resumen = {
            "critica": sum(1 for a in alerts if a["severidad"] == "critica"),
            "alta": sum(1 for a in alerts if a["severidad"] == "alta"),
            "media": sum(1 for a in alerts if a["severidad"] == "media"),
            "baja": sum(1 for a in alerts if a["severidad"] == "baja"),
        }
        return Response({"anio": anio, "resumen": resumen, "alertas": alerts})


class SecopDetalleView(SecopBaseView):
    def get(self, request):
        ser = SecopDetalleQuerySerializer(data=request.query_params)
        ser.is_valid(raise_exception=True)
        fuente = ser.validated_data["fuente"]
        rec_id = ser.validated_data["id"]
        anio = ser.validated_data["anio"]
        if fuente == "secop1":
            records, _ = load_secop1_normalized(resolve_nits_secop_i(self.entity), anio)
        else:
            records, _ = load_secop2_unified(resolve_nits_secop_ii(self.entity), anio)
        match = next((r for r in records if r.get("id") == rec_id), None)
        if not match:
            return Response({"detail": "Registro no encontrado."}, status=status.HTTP_404_NOT_FOUND)
        return Response(public_record(match))


class SecopExportView(SecopBaseView):
    def get(self, request):
        ser = SecopExportQuerySerializer(data=request.query_params)
        ser.is_valid(raise_exception=True)
        fuente = ser.validated_data["fuente"]
        anio = ser.validated_data.get("anio") or _default_anio()
        nits_i = resolve_nits_secop_i(self.entity)
        nits_ii = resolve_nits_secop_ii(self.entity)

        if fuente == "alertas":
            s1, _ = load_secop1_normalized(nits_i, anio)
            s2, _ = load_secop2_unified(nits_ii, anio)
            alerts = compute_alerts(s1, s2, nits_i=nits_i, nits_ii=nits_ii, anio=anio)
            content = build_alerts_excel(alerts)
            filename = f"SECOP_alertas_{self.entity.slug}_{anio}.xlsx"
        elif fuente == "secop1":
            records, _ = load_secop1_normalized(nits_i, anio)
            content = build_contracts_excel([public_record(r) for r in records], "SECOP I")
            filename = f"SECOP1_{self.entity.slug}_{anio}.xlsx"
        elif fuente == "secop2":
            records, _ = load_secop2_unified(nits_ii, anio)
            content = build_contracts_excel([public_record(r) for r in records], "SECOP II")
            filename = f"SECOP2_{self.entity.slug}_{anio}.xlsx"
        else:
            s1, _ = load_secop1_normalized(nits_i, anio)
            s2, _ = load_secop2_unified(nits_ii, anio)
            content = build_contracts_excel([public_record(r) for r in s1 + s2], "SECOP unificado")
            filename = f"SECOP_{self.entity.slug}_{anio}.xlsx"

        response = HttpResponse(
            content,
            content_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        )
        response["Content-Disposition"] = f'attachment; filename="{filename}"'
        return response


class SecopRefrescarView(SecopBaseView):
    def post(self, request):
        ser = SecopRefrescarSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        anio = ser.validated_data.get("anio")
        deleted = invalidate_entity_cache(
            resolve_nits_secop_i(self.entity),
            resolve_nits_secop_ii(self.entity),
            anio=anio,
        )
        return Response({"ok": True, "cache_keys_cleared": deleted})


class SecopAIAnalisisView(SecopBaseView):
    throttle_classes = (SecopAIThrottle,)

    def post(self, request):
        ser = SecopAIAnalisisSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        anio = ser.validated_data["anio"]
        try:
            result = generate_secop_analysis(self.entity, anio, user_id=request.user.id)
        except ValueError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_503_SERVICE_UNAVAILABLE)
        return Response(result)


class SecopAICopilotView(SecopBaseView):
    throttle_classes = (SecopAIThrottle,)

    def post(self, request):
        ser = SecopAICopilotSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        data = ser.validated_data
        try:
            result = run_secop_copilot(
                self.entity,
                data["message"],
                anio=data["anio"],
                history=data.get("history"),
                user_id=request.user.id,
            )
        except ValueError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_503_SERVICE_UNAVAILABLE)
        return Response(result)


class SecopAIContratoView(SecopBaseView):
    throttle_classes = (SecopAIThrottle,)

    def post(self, request):
        ser = SecopAIContratoSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        fuente = ser.validated_data["fuente"]
        rec_id = ser.validated_data["id"]
        anio = ser.validated_data["anio"]
        if fuente == "secop1":
            records, _ = load_secop1_normalized(resolve_nits_secop_i(self.entity), anio)
        else:
            records, _ = load_secop2_unified(resolve_nits_secop_ii(self.entity), anio)
        match = next((r for r in records if r.get("id") == rec_id), None)
        if not match:
            return Response({"detail": "Registro no encontrado."}, status=status.HTTP_404_NOT_FOUND)
        try:
            result = summarize_contract(self.entity, match, user_id=request.user.id)
        except ValueError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_503_SERVICE_UNAVAILABLE)
        return Response(result)
