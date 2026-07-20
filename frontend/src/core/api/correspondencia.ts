import { api } from "@/core/api/client";
import type { PaginatedResponse } from "@/core/api/entities";

export interface CorrespondenciaListItem {
  id: number;
  numero_radicado: string;
  sentido: "entrada" | "salida";
  sentido_label: string;
  tipologia: string;
  tipologia_label: string;
  fecha_radicacion: string;
  remitente_nombre: string;
  destinatario_nombre: string;
  asunto: string;
  canal: string;
  secretaria: number;
  secretaria_nombre: string;
  assigned_to: number | null;
  assigned_to_nombre: string | null;
  estado: string;
  estado_label: string;
  dias_habiles_respuesta: number;
  fecha_vencimiento: string;
  sla_status: "en_plazo" | "por_vencer" | "vencida" | "cerrado";
  created_at: string;
}

export interface CorrespondenciaAnexo {
  id: number;
  tipo: string;
  nombre: string;
  content_type: string;
  size: number;
  url: string | null;
  uploaded_by: number | null;
  uploaded_by_nombre: string | null;
  created_at: string;
}

export interface CorrespondenciaEvento {
  id: number;
  tipo: string;
  detalle: Record<string, unknown>;
  actor: number | null;
  actor_nombre: string | null;
  created_at: string;
}

export interface CorrespondenciaDetail extends CorrespondenciaListItem {
  remitente_documento: string;
  remitente_dependencia: string;
  destinatario_documento: string;
  destinatario_dependencia: string;
  contacto_email: string;
  contacto_direccion: string;
  descripcion: string;
  numero_folios: number;
  respuesta_texto: string;
  fecha_respuesta: string | null;
  created_by: number | null;
  created_by_nombre: string | null;
  updated_at: string;
  anexos: CorrespondenciaAnexo[];
  eventos: CorrespondenciaEvento[];
}

export interface CorrespondenciaStats {
  hoy: number;
  en_tramite: number;
  vencidas: number;
  total: number;
  por_sentido: { entrada: number; salida: number };
  por_estado: Record<string, number>;
}

export interface CorrespondenciaWritePayload {
  sentido: "entrada" | "salida";
  tipologia: string;
  remitente_nombre: string;
  remitente_documento?: string;
  remitente_dependencia?: string;
  destinatario_nombre: string;
  destinatario_documento?: string;
  destinatario_dependencia?: string;
  canal: string;
  contacto_email?: string;
  contacto_direccion?: string;
  asunto: string;
  descripcion?: string;
  numero_folios?: number;
  secretaria_id: number;
  assigned_to_id?: number | null;
  dias_habiles_respuesta?: number;
}

export const TIPOLOGIA_OPTIONS = [
  { value: "oficio", label: "Oficio" },
  { value: "memorando", label: "Memorando" },
  { value: "circular", label: "Circular" },
  { value: "derecho_peticion", label: "Derecho de petición" },
  { value: "remision", label: "Remisión" },
  { value: "otro", label: "Otro" },
] as const;

export const CANAL_OPTIONS = [
  { value: "fisico", label: "Físico" },
  { value: "correo", label: "Correo electrónico" },
  { value: "digital", label: "Digital" },
] as const;

export const SLA_OPTIONS = [5, 10, 15, 30] as const;

export const ESTADO_OPTIONS = [
  { value: "radicada", label: "Radicada" },
  { value: "en_tramite", label: "En trámite" },
  { value: "respondida", label: "Respondida" },
  { value: "cerrada", label: "Cerrada" },
  { value: "archivada", label: "Archivada" },
] as const;

function parsePaginated<T>(data: T[] | PaginatedResponse<T>): PaginatedResponse<T> {
  if (Array.isArray(data)) {
    return { count: data.length, next: null, previous: null, results: data };
  }
  return data;
}

export const correspondenciaApi = {
  stats: (params?: Record<string, string>) =>
    api.get<CorrespondenciaStats>("/correspondencia/stats/", { params }).then((r) => r.data),
  list: (params?: Record<string, string | number>) =>
    api
      .get<CorrespondenciaListItem[] | PaginatedResponse<CorrespondenciaListItem>>(
        "/correspondencia/",
        { params },
      )
      .then((r) => parsePaginated(r.data)),
  get: (id: number) =>
    api.get<CorrespondenciaDetail>(`/correspondencia/${id}/`).then((r) => r.data),
  create: (payload: CorrespondenciaWritePayload) =>
    api.post<CorrespondenciaDetail>("/correspondencia/", payload).then((r) => r.data),
  responder: (id: number, respuesta_texto: string) =>
    api
      .post<CorrespondenciaDetail>(`/correspondencia/${id}/responder/`, { respuesta_texto })
      .then((r) => r.data),
  cerrar: (id: number) =>
    api.post<CorrespondenciaDetail>(`/correspondencia/${id}/cerrar/`).then((r) => r.data),
  cambiarEstado: (id: number, estado: string) =>
    api
      .post<CorrespondenciaDetail>(`/correspondencia/${id}/cambiar-estado/`, { estado })
      .then((r) => r.data),
  asignar: (id: number, payload: { secretaria_id: number; assigned_to_id?: number | null }) =>
    api
      .post<CorrespondenciaDetail>(`/correspondencia/${id}/asignar/`, payload)
      .then((r) => r.data),
  uploadAnexo: (id: number, file: File, tipo: string) => {
    const form = new FormData();
    form.append("file", file);
    form.append("tipo", tipo);
    return api
      .post<CorrespondenciaAnexo>(`/correspondencia/${id}/anexos/`, form, {
        headers: { "Content-Type": "multipart/form-data" },
      })
      .then((r) => r.data);
  },
  deleteAnexo: (id: number, anexoId: number) =>
    api.delete(`/correspondencia/${id}/anexos/${anexoId}/`),
  exportUrl: (params?: Record<string, string>) => {
    const qs = new URLSearchParams(params).toString();
    const base = import.meta.env.VITE_API_URL || "/api/v1";
    return `${base}/correspondencia/export/${qs ? `?${qs}` : ""}`;
  },
};
