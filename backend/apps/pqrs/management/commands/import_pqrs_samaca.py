"""Importa PQRS exportadas desde AWS softone360 (Samacá entity 8 → entity 4)."""
from __future__ import annotations

import json
import os
from datetime import datetime
from pathlib import Path

from django.core.files.base import ContentFile
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.utils import timezone
from django.utils.dateparse import parse_datetime

from apps.accounts.models import User
from apps.common.storages import pqrs_storage_for_paths
from apps.entities.models import Entity, Secretaria
from apps.pqrs.models import (
    DIAS_RESPUESTA_LEY1755,
    AsignacionAuditoria,
    EstadoPQRS,
    PQRS,
    sumar_dias_habiles,
)
from apps.pqrs.services.creation import attach_archivos_from_bytes
from apps.pqrs.storage_paths import pqrs_respuesta_path

TIPO_SOLICITUD_MAP = {
    "peticion": "peticion",
    "queja": "queja",
    "reclamo": "reclamo",
    "sugerencia": "sugerencia",
    "felicitacion": "felicitacion",
    "denuncia": "denuncia",
    "solicitud_informacion": "solicitud_informacion",
    "solicitud_datos_personales": "otro",
    "agenda_cita": "otro",
}

CANAL_LLEGADA_MAP = {
    "web": "web",
    "presencial": "presencial",
    "telefono": "telefono",
    "carta": "carta",
    "buzon": "buzon",
    "correo": "email",
    "fisica": "entrega_fisica",
    "email": "email",
    "entrega_fisica": "entrega_fisica",
}


def parse_dt(value) -> datetime | None:
    if value is None:
        return None
    if isinstance(value, datetime):
        dt = value
    else:
        dt = parse_datetime(str(value))
        if dt is None:
            return None
    if timezone.is_naive(dt):
        return timezone.make_aware(dt, timezone.get_current_timezone())
    return dt


def map_estado(orig_estado: str, assigned_to_id, respuesta) -> str:
    estado = (orig_estado or "pendiente").lower()
    has_assignment = bool(assigned_to_id)
    has_respuesta = bool(respuesta and str(respuesta).strip())

    if estado == "pendiente":
        return EstadoPQRS.ASIGNADA if has_assignment else EstadoPQRS.RECIBIDA
    if estado == "en_proceso":
        return EstadoPQRS.EN_PROCESO
    if estado == "resuelto":
        return EstadoPQRS.RESPONDIDA
    if estado == "cerrado":
        return EstadoPQRS.CERRADA
    if has_respuesta:
        return EstadoPQRS.RESPONDIDA
    if has_assignment:
        return EstadoPQRS.ASIGNADA
    return EstadoPQRS.RECIBIDA


def should_assign(orig: dict, dest_estado: str) -> bool:
    if orig.get("assigned_to_id"):
        return True
    return dest_estado in (
        EstadoPQRS.ASIGNADA,
        EstadoPQRS.EN_PROCESO,
        EstadoPQRS.RESPONDIDA,
        EstadoPQRS.CERRADA,
    )


class Command(BaseCommand):
    help = "Importa PQRS de Samacá desde export JSON (AWS softone360 → app_django)."

    def add_arguments(self, parser):
        parser.add_argument(
            "--input",
            required=True,
            help="Ruta al samaca_pqrs_export.json",
        )
        parser.add_argument(
            "--files-dir",
            required=True,
            help="Directorio samaca_pqrs_files con adjuntos descargados",
        )
        parser.add_argument("--entity-id", type=int, default=4)
        parser.add_argument(
            "--secretaria-nombre",
            default="SECRETARIA",
            help="Nombre de la secretaría destino para todas las asignaciones",
        )
        parser.add_argument(
            "--create-secretaria",
            action="store_true",
            help="Crear la secretaría si no existe",
        )
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Simular sin escribir en DB ni B2",
        )
        parser.add_argument(
            "--skip-existing",
            action="store_true",
            default=True,
            help="Omitir radicados que ya existen (default: true)",
        )
        parser.add_argument(
            "--no-skip-existing",
            action="store_false",
            dest="skip_existing",
            help="Fallar o sobrescribir si el radicado ya existe",
        )

    def handle(self, *args, **options):
        input_path = Path(options["input"]).resolve()
        files_dir = Path(options["files_dir"]).resolve()
        entity_id = options["entity_id"]
        secretaria_nombre = options["secretaria_nombre"].strip()
        dry_run = options["dry_run"]
        skip_existing = options["skip_existing"]

        if not input_path.is_file():
            raise CommandError(f"No existe el archivo: {input_path}")
        if not files_dir.is_dir():
            raise CommandError(f"No existe el directorio de archivos: {files_dir}")

        with open(input_path, encoding="utf-8") as fh:
            data = json.load(fh)

        pqrs_list = data.get("pqrs") or []
        auditoria_list = data.get("asignacion_auditoria") or []
        users_src = {u["id"]: u for u in (data.get("users") or [])}

        auditoria_by_pqrs: dict[int, list] = {}
        for aud in auditoria_list:
            auditoria_by_pqrs.setdefault(aud["pqrs_id"], []).append(aud)

        try:
            entity = Entity.objects.get(pk=entity_id)
        except Entity.DoesNotExist as exc:
            raise CommandError(f"Entity id={entity_id} no existe en destino") from exc

        secretaria = Secretaria.objects.filter(
            entity_id=entity_id,
            nombre__iexact=secretaria_nombre,
        ).first()
        if not secretaria and options["create_secretaria"]:
            if dry_run:
                self.stdout.write(
                    self.style.WARNING(
                        f"[dry-run] Se crearía secretaría '{secretaria_nombre}' en entity {entity_id}"
                    )
                )
            else:
                secretaria = Secretaria.objects.create(
                    entity=entity,
                    nombre=secretaria_nombre.upper(),
                    is_active=True,
                )
                self.stdout.write(
                    self.style.SUCCESS(f"Secretaría creada: {secretaria.nombre} (id={secretaria.id})")
                )
        if not secretaria:
            raise CommandError(
                f"Secretaría '{secretaria_nombre}' no encontrada en entity {entity_id}. "
                "Use --create-secretaria."
            )

        user_by_email: dict[str, User | None] = {}

        def resolve_user(src_user_id: int | None) -> User | None:
            if not src_user_id:
                return None
            src = users_src.get(src_user_id)
            if not src:
                return None
            email = (src.get("email") or "").strip().lower()
            if not email:
                return None
            if email not in user_by_email:
                user_by_email[email] = User.objects.filter(email__iexact=email).first()
            return user_by_email[email]

        stats = {
            "imported": 0,
            "skipped": 0,
            "errors": 0,
            "archivos_solicitud": 0,
            "archivos_respuesta": 0,
            "auditorias": 0,
            "users_not_found": set(),
            "files_missing": [],
        }

        self.stdout.write(f"Entidad destino: {entity.name} (id={entity_id})")
        self.stdout.write(f"Secretaría: {secretaria.nombre} (id={secretaria.id})")
        self.stdout.write(f"PQRS en export: {len(pqrs_list)}")
        if dry_run:
            self.stdout.write(self.style.WARNING("Modo DRY-RUN — no se escribirá nada"))

        for orig in pqrs_list:
            radicado = orig["numero_radicado"]
            try:
                self._import_one(
                    orig=orig,
                    radicado=radicado,
                    entity=entity,
                    secretaria=secretaria,
                    files_dir=files_dir,
                    auditoria_by_pqrs=auditoria_by_pqrs,
                    resolve_user=resolve_user,
                    users_src=users_src,
                    dry_run=dry_run,
                    skip_existing=skip_existing,
                    stats=stats,
                )
            except Exception as exc:
                stats["errors"] += 1
                self.stdout.write(
                    self.style.ERROR(f"  ERROR {radicado}: {exc}")
                )

        self.stdout.write("\n--- Resumen ---")
        self.stdout.write(f"Importadas:  {stats['imported']}")
        self.stdout.write(f"Omitidas:    {stats['skipped']}")
        self.stdout.write(f"Errores:     {stats['errors']}")
        self.stdout.write(f"Adj. solicitud: {stats['archivos_solicitud']}")
        self.stdout.write(f"Adj. respuesta: {stats['archivos_respuesta']}")
        self.stdout.write(f"Auditorías:  {stats['auditorias']}")
        if stats["users_not_found"]:
            self.stdout.write(
                self.style.WARNING(
                    f"Usuarios origen sin match en destino: {len(stats['users_not_found'])}"
                )
            )
        if stats["files_missing"]:
            self.stdout.write(
                self.style.WARNING(f"Archivos no encontrados: {len(stats['files_missing'])}")
            )

    def _import_one(
        self,
        *,
        orig,
        radicado,
        entity,
        secretaria,
        files_dir,
        auditoria_by_pqrs,
        resolve_user,
        users_src,
        dry_run,
        skip_existing,
        stats,
    ):
        if PQRS.objects.filter(numero_radicado=radicado).exists():
            if skip_existing:
                stats["skipped"] += 1
                return
            raise CommandError(f"Radicado ya existe: {radicado}")

        tipo_raw = (orig.get("tipo_solicitud") or "peticion").lower()
        tipo = TIPO_SOLICITUD_MAP.get(tipo_raw, "otro")
        canal_raw = (orig.get("canal_llegada") or "web").lower()
        canal = CANAL_LLEGADA_MAP.get(canal_raw, "web")
        dest_estado = map_estado(
            orig.get("estado"),
            orig.get("assigned_to_id"),
            orig.get("respuesta"),
        )
        assign = should_assign(orig, dest_estado)

        dias = orig.get("dias_respuesta")
        if not dias:
            dias = DIAS_RESPUESTA_LEY1755.get(tipo, 15)

        fecha_solicitud = parse_dt(orig.get("fecha_solicitud")) or timezone.now()
        fecha_vencimiento = sumar_dias_habiles(fecha_solicitud, dias)

        tipo_doc = (orig.get("tipo_documento") or "CC").strip() or "CC"
        if (orig.get("tipo_identificacion") or "").lower() == "anonima":
            tipo_doc = "ANONIMA"

        created_by = resolve_user(orig.get("created_by_id"))
        if orig.get("created_by_id") and not created_by:
            src = users_src.get(orig["created_by_id"], {})
            email = src.get("email", "?")
            stats["users_not_found"].add(email)

        fields_preview = {
            "radicado": radicado,
            "estado": dest_estado,
            "tipo": tipo,
            "asignada": assign,
        }

        if dry_run:
            stats["imported"] += 1
            if orig.get("archivo_adjunto_local"):
                stats["archivos_solicitud"] += 1
            if orig.get("archivo_respuesta_local"):
                stats["archivos_respuesta"] += 1
            stats["auditorias"] += len(auditoria_by_pqrs.get(orig["id"], [])) + 1
            self.stdout.write(f"  [dry-run] {radicado} → {fields_preview}")
            return

        with transaction.atomic():
            pqrs = PQRS.objects.create(
                entity=entity,
                created_by=created_by,
                numero_radicado=radicado,
                tipo_solicitud=tipo,
                asunto=(orig.get("asunto") or "Sin asunto")[:255],
                descripcion=orig.get("descripcion") or "",
                estado=dest_estado,
                canal_llegada=canal,
                tipo_identificacion=tipo_doc[:50],
                medio_respuesta=(orig.get("medio_respuesta") or "email")[:50],
                nombre_ciudadano=orig.get("nombre_ciudadano"),
                cedula_ciudadano=orig.get("cedula_ciudadano"),
                telefono_ciudadano=orig.get("telefono_ciudadano"),
                email_ciudadano=orig.get("email_ciudadano"),
                direccion_ciudadano=orig.get("direccion_ciudadano"),
                tipo_persona=orig.get("tipo_persona"),
                dias_respuesta=dias,
                respuesta=orig.get("respuesta"),
                justificacion_asignacion=orig.get("justificacion_asignacion"),
                email_enviado=bool(orig.get("email_enviado")) if orig.get("email_enviado") is not None else False,
                email_error=orig.get("email_error"),
                fecha_solicitud=fecha_solicitud,
                fecha_vencimiento=fecha_vencimiento,
                fecha_cierre=parse_dt(orig.get("fecha_cierre")),
                fecha_delegacion=parse_dt(orig.get("fecha_delegacion")),
                fecha_respuesta=parse_dt(orig.get("fecha_respuesta")),
            )

            if assign:
                pqrs.assigned_secretarias.set([secretaria])
                pqrs.assigned_to = secretaria
                pqrs.save(update_fields=["assigned_to"])

            adj_local = orig.get("archivo_adjunto_local")
            if adj_local:
                adj_path = files_dir / adj_local
                if adj_path.is_file():
                    content = adj_path.read_bytes()
                    filename = adj_path.name
                    attach_archivos_from_bytes(
                        pqrs,
                        [(filename, content)],
                        created_by,
                        limit_archivos=False,
                        skip_extension_check=True,
                    )
                    stats["archivos_solicitud"] += 1
                else:
                    stats["files_missing"].append(str(adj_local))

            resp_local = orig.get("archivo_respuesta_local")
            if resp_local:
                resp_path = files_dir / resp_local
                if resp_path.is_file():
                    content = resp_path.read_bytes()
                    ext = resp_path.suffix.lstrip(".") or "pdf"
                    safe_name = pqrs_respuesta_path(
                        pqrs,
                        f"respuesta_{int(timezone.now().timestamp())}.{ext}",
                    )
                    storage = pqrs_storage_for_paths()
                    archivo_path = storage.save(safe_name, ContentFile(content))
                    pqrs.archivo_respuesta = archivo_path
                    pqrs.save(update_fields=["archivo_respuesta"])
                    stats["archivos_respuesta"] += 1
                else:
                    stats["files_missing"].append(str(resp_local))

            for aud in auditoria_by_pqrs.get(orig["id"], []):
                AsignacionAuditoria.objects.create(
                    pqrs=pqrs,
                    usuario_anterior=resolve_user(aud.get("usuario_anterior_id")),
                    usuario_nuevo=resolve_user(aud.get("usuario_nuevo_id")),
                    secretaria_nueva=secretaria,
                    accion="asignacion",
                    justificacion=aud.get("justificacion") or "",
                    fecha_asignacion=parse_dt(aud.get("fecha_asignacion")) or timezone.now(),
                )
                stats["auditorias"] += 1

            AsignacionAuditoria.objects.create(
                pqrs=pqrs,
                secretaria_nueva=secretaria,
                usuario_nuevo=created_by,
                accion="edicion",
                justificacion="Migrado desde sistema anterior (AWS softone360)",
                fecha_asignacion=timezone.now(),
            )
            stats["auditorias"] += 1

        stats["imported"] += 1
        self.stdout.write(self.style.SUCCESS(f"  OK {radicado} → {dest_estado}"))
