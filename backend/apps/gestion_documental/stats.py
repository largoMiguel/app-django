"""Estadísticas dashboard — Gestión documental."""
from __future__ import annotations

from datetime import date, timedelta

from django.db.models import Count, Q
from django.utils import timezone

from apps.entities.models import Entity

from .models import (
    EstadoExpediente,
    EstadoInstrumento,
    EstadoTransferencia,
    EtapaExpediente,
    Expediente,
    FuidRegistro,
    InstrumentoArchivistico,
    SerieDocumental,
    Transferencia,
)


PROCESOS_PGD = [
    {"key": "planeacion", "label": "Planeación", "desc": "Instrumentos archivísticos (PGD, CCD, TRD, TVD, PINAR)"},
    {"key": "produccion", "label": "Producción", "desc": "Documentos y expedientes en formación"},
    {"key": "gestion_tramite", "label": "Gestión y trámite", "desc": "Expedientes abiertos en archivo de gestión"},
    {"key": "organizacion", "label": "Organización", "desc": "Clasificación CCD/TRD y series documentales"},
    {"key": "transferencia", "label": "Transferencia", "desc": "Transferencias primarias y secundarias"},
    {"key": "disposicion", "label": "Disposición", "desc": "CT / S / E / MD según TRD"},
    {"key": "preservacion", "label": "Preservación", "desc": "Repositorio digital y metadatos de integridad"},
    {"key": "valoracion", "label": "Valoración", "desc": "TVD y alertas de retención vencida"},
]


def compute_stats(entity: Entity) -> dict:
    instrumentos = InstrumentoArchivistico.objects.filter(entity=entity)
    expedientes = Expediente.objects.filter(entity=entity)
    series = SerieDocumental.objects.filter(entity=entity, is_active=True)
    transferencias_pendientes = Transferencia.objects.filter(
        entity=entity, estado=EstadoTransferencia.BORRADOR
    ).count()

    por_estado_instrumento = dict(
        instrumentos.values("estado").annotate(c=Count("id")).values_list("estado", "c")
    )
    por_etapa = dict(expedientes.values("etapa").annotate(c=Count("id")).values_list("etapa", "c"))
    por_estado_exp = dict(expedientes.values("estado").annotate(c=Count("id")).values_list("estado", "c"))

    trd_vigente = instrumentos.filter(tipo="trd", estado=EstadoInstrumento.VIGENTE).exists()
    ccd_vigente = instrumentos.filter(tipo="ccd", estado=EstadoInstrumento.VIGENTE).exists()
    pgd_vigente = instrumentos.filter(tipo="pgd", estado=EstadoInstrumento.VIGENTE).exists()

    hoy = timezone.localdate()
    retencion_vencida = 0
    for exp in expedientes.filter(etapa=EtapaExpediente.GESTION).select_related("serie"):
        if not exp.fecha_extrema_final or not exp.serie:
            continue
        limite = exp.fecha_extrema_final + timedelta(days=exp.serie.retencion_gestion_anios * 365)
        if limite <= hoy:
            retencion_vencida += 1

    procesos = []
    for p in PROCESOS_PGD:
        avance = 0
        if p["key"] == "planeacion":
            avance = min(100, (instrumentos.filter(estado=EstadoInstrumento.VIGENTE).count() * 12))
        elif p["key"] == "produccion":
            avance = min(100, expedientes.count() * 5)
        elif p["key"] == "gestion_tramite":
            abiertos = por_estado_exp.get(EstadoExpediente.ABIERTO, 0)
            avance = min(100, abiertos * 10)
        elif p["key"] == "organizacion":
            avance = min(100, series.count() * 3)
        elif p["key"] == "transferencia":
            total_t = Transferencia.objects.filter(entity=entity).count()
            avance = min(100, total_t * 15)
        elif p["key"] == "disposicion":
            from .models import Disposicion

            avance = min(100, Disposicion.objects.filter(entity=entity).count() * 20)
        elif p["key"] == "preservacion":
            from .models import DocumentoExpediente

            avance = min(100, DocumentoExpediente.objects.filter(entity=entity).count() * 5)
        elif p["key"] == "valoracion":
            avance = 100 if retencion_vencida == 0 and trd_vigente else max(0, 100 - retencion_vencida * 10)
        procesos.append({**p, "avance": avance})

    return {
        "instrumentos_total": instrumentos.count(),
        "instrumentos_vigentes": instrumentos.filter(estado=EstadoInstrumento.VIGENTE).count(),
        "por_estado_instrumento": por_estado_instrumento,
        "expedientes_total": expedientes.count(),
        "expedientes_abiertos": por_estado_exp.get(EstadoExpediente.ABIERTO, 0),
        "por_etapa": por_etapa,
        "series_total": series.count(),
        "fuid_registros": FuidRegistro.objects.filter(entity=entity).count(),
        "transferencias_pendientes": transferencias_pendientes,
        "retencion_vencida": retencion_vencida,
        "trd_vigente": trd_vigente,
        "ccd_vigente": ccd_vigente,
        "pgd_vigente": pgd_vigente,
        "procesos_pgd": procesos,
    }
