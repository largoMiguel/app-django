import { api } from "@/core/api/client";

export type EstadoPQRS =
  | "recibida"
  | "asignada"
  | "en_proceso"
  | "respondida"
  | "rechazada_asignacion"
  | "cerrada";

export type TipoSolicitud =
  | "peticion"
  | "queja"
  | "reclamo"
  | "sugerencia"
  | "denuncia"
  | "felicitacion"
  | "solicitud_informacion"
  | "copia"
  | "otro";

export interface AuditoriaItem {
  id: number;
  accion: string;
  justificacion: string | null;
  secretaria_anterior: number | null;
  secretaria_anterior_nombre: string | null;
  secretaria_nueva: number | null;
  secretaria_nueva_nombre: string | null;
  usuario_anterior: number | null;
  usuario_anterior_email: string | null;
  usuario_anterior_nombre: string | null;
  usuario_nuevo: number | null;
  usuario_nuevo_email: string | null;
  usuario_nuevo_nombre: string | null;
  fecha_asignacion: string | null;
}

export type EstadoCorreoPQRS =
  | "pendiente"
  | "enviado"
  | "entregado"
  | "rebote_temporal"
  | "rebotado"
  | "reclamacion_spam"
  | "error";

export type TipoCorreoPQRS = "radicacion" | "respuesta" | "asignacion";

export interface SecretariaAsignada {
  id: number;
  nombre: string;
}

export interface PQRSCorreoDestinatario {
  email: string;
  estado: string;
  motivo?: string | null;
  evento_at?: string | null;
}

export interface PQRSCorreoItem {
  id: number;
  tipo: TipoCorreoPQRS;
  asunto: string;
  estado: EstadoCorreoPQRS;
  error: string | null;
  request_id: string | null;
  destinatarios: PQRSCorreoDestinatario[];
  created_at: string;
  updated_at: string;
}

export interface PQRS {
  id: number;
  entity: number;
  created_by: number | null;
  /** ID de la secretaría asignada (no del usuario). */
  assigned_to: number | null;
  assigned_to_nombre: string | null;
  assigned_secretarias?: SecretariaAsignada[];
  numero_radicado: string;
  tipo_identificacion: string;
  medio_respuesta: string;
  nombre_ciudadano: string | null;
  cedula_ciudadano: string | null;
  telefono_ciudadano: string | null;
  email_ciudadano: string | null;
  direccion_ciudadano: string | null;
  tipo_solicitud: TipoSolicitud;
  tipo_persona: string | null;
  asunto: string;
  descripcion: string;
  estado: EstadoPQRS;
  canal_llegada: "web" | "presencial" | "email" | "telefono" | "carta" | "buzon" | "entrega_fisica";
  respuesta: string | null;
  archivo_respuesta: string | null;
  archivo_respuesta_url: string | null;
  is_anonima?: boolean;
  justificacion_asignacion: string | null;
  email_enviado?: boolean;
  email_error?: string | null;
  correo_alerta?: boolean;
  correos?: PQRSCorreoItem[];
  fecha_solicitud: string | null;
  fecha_respuesta: string | null;
  fecha_cierre: string | null;
  fecha_vencimiento: string | null;
  created_at?: string;
  updated_at?: string;
  auditoria?: AuditoriaItem[];
  archivos?: PQRSArchivoItem[];
}

export interface PQRSArchivoItem {
  id: number;
  nombre: string;
  nombre_original: string;
  content_type: string;
  size: number;
  url: string | null;
  created_at: string;
}

export const MAX_ARCHIVOS_PQRS = 4;
export const MAX_FILE_SIZE_MB = 10;

export function filterValidUploadFiles(files: File[]): File[] {
  const maxBytes = MAX_FILE_SIZE_MB * 1024 * 1024;
  return files.filter((f) => f.size <= maxBytes);
}

export interface CreatePQRSPayload {
  tipo_solicitud: TipoSolicitud;
  asunto: string;
  descripcion: string;
  tipo_identificacion?: string;
  cedula_ciudadano?: string;
  nombre_ciudadano?: string;
  email_ciudadano?: string;
  telefono_ciudadano?: string;
  direccion_ciudadano?: string;
  medio_respuesta?: string;
  canal_llegada?: "web" | "presencial" | "email" | "telefono" | "carta" | "buzon" | "entrega_fisica";
  fecha_solicitud?: string;
  tipo_persona?: "natural" | "juridica";
}

function listOf<T>(d: T[] | { results: T[] }): T[] {
  return Array.isArray(d) ? d : d.results || [];
}

export interface PaginatedPQRS {
  results: PQRS[];
  count: number;
  next: string | null;
  previous: string | null;
}

export interface SecretaryStats {
  secretaria_id: number;
  nombre: string;
  total: number;
  respondidas: number;
  cerradas: number;
  en_proceso: number;
  pendientes: number;
  vencidas: number;
}

export interface PQRSStats {
  total: number;
  this_month: number;
  respondidas: number;
  cerradas: number;
  pendientes: number;
  sin_asignar: number;
  alerta_count: number;
  by_estado: Partial<Record<EstadoPQRS, number>>;
  by_tipo: Partial<Record<TipoSolicitud, number>>;
  by_canal: Record<string, number>;
  timeline: { month: number; recibidas: number; resueltas: number }[];
  by_secretaria: SecretaryStats[];
}

export interface PQRSReportPreview {
  total: number;
  truncated: boolean;
  max_rows: number;
  stats: PQRSStats;
  rows: Array<{
    id: number;
    numero_radicado: string;
    tipo_solicitud: TipoSolicitud;
    nombre_ciudadano: string | null;
    email_ciudadano: string | null;
    estado: EstadoPQRS;
    assigned_to: number | null;
    assigned_to_nombre: string | null;
    fecha_solicitud: string | null;
    fecha_vencimiento: string | null;
    canal_llegada: string;
  }>;
}

const MAX_REPORT_PAGES = 200;

async function fetchAllPaginated(
  params?: Record<string, string | number | boolean | undefined>,
): Promise<PQRS[]> {
  const all: PQRS[] = [];
  let page = 1;
  while (page <= MAX_REPORT_PAGES) {
    const response = await api.get<PQRS[] | PaginatedPQRS>("/pqrs/", {
      params: { ...params, page, page_size: 500 } as Record<string, string | number | boolean>,
    });
    const batch = parsePaginated(response.data);
    all.push(...batch.results);
    if (!batch.next) return all;
    page += 1;
  }
  throw new Error(
    `El informe supera ${MAX_REPORT_PAGES * 500} registros. Acota el rango de fechas o filtros.`,
  );
}

function parsePaginated(data: PQRS[] | PaginatedPQRS): PaginatedPQRS {
  if (Array.isArray(data)) {
    return { results: data, count: data.length, next: null, previous: null };
  }
  return data;
}

export const pqrsApi = {
  list: (params?: Record<string, string | number | boolean | undefined>) =>
    api
      .get<PQRS[] | PaginatedPQRS>("/pqrs/", { params: params as Record<string, string | number | boolean> })
      .then((r) => listOf(r.data)),
  listPaginated: (params?: Record<string, string | number | boolean | undefined>) =>
    api
      .get<PQRS[] | PaginatedPQRS>("/pqrs/", { params: params as Record<string, string | number | boolean> })
      .then((r) => parsePaginated(r.data)),
  stats: () => api.get<PQRSStats>("/pqrs/stats/").then((r) => r.data),
  reportPreview: (params?: Record<string, string | number | boolean | undefined>) =>
    api
      .get<PQRSReportPreview>("/pqrs/reports-preview/", {
        params: params as Record<string, string | number | boolean>,
      })
      .then((r) => r.data),
  fetchFiltered: (params?: Record<string, string | number | boolean | undefined>) =>
    fetchAllPaginated(params),
  /** @deprecated Usar stats() o fetchFiltered() con filtros */
  listAll: (params?: Record<string, string | number | boolean | undefined>) =>
    fetchAllPaginated(params),
  get: (id: number) => api.get<PQRS>(`/pqrs/${id}/`).then((r) => r.data),
  create: (payload: CreatePQRSPayload) =>
    api.post<PQRS>("/pqrs/", payload).then((r) => r.data),
  createWithFiles: (payload: CreatePQRSPayload, files: File[]) => {
    const fd = new FormData();
    Object.entries(payload).forEach(([k, v]) => {
      if (v !== undefined && v !== null) fd.append(k, String(v));
    });
    files.slice(0, MAX_ARCHIVOS_PQRS).forEach((f) => fd.append("archivos", f));
    return api
      .post<PQRS>("/pqrs/", fd, { headers: { "Content-Type": "multipart/form-data" } })
      .then((r) => r.data);
  },
  autoCreate: (texto: string, files: File[], options?: { entity_id?: number; canalRespuesta?: string; email?: string; telefono?: string; direccion?: string }) => {
    const fd = new FormData();
    if (texto) fd.append("texto", texto);
    if (options?.entity_id) fd.append("entity", String(options.entity_id));
    if (options?.canalRespuesta) fd.append("medio_respuesta", options.canalRespuesta);
    if (options?.email) fd.append("email_ciudadano", options.email);
    if (options?.telefono) fd.append("telefono_ciudadano", options.telefono);
    if (options?.direccion) fd.append("direccion_ciudadano", options.direccion);
    files.slice(0, MAX_ARCHIVOS_PQRS).forEach((f) => fd.append("archivos", f));
    return api
      .post<PQRS>("/pqrs/auto-create/", fd, {
        headers: { "Content-Type": "multipart/form-data" },
        timeout: 180000,
      })
      .then((r) => r.data);
  },
  update: (id: number, payload: Partial<CreatePQRSPayload>) =>
    api.patch<PQRS>(`/pqrs/${id}/`, payload).then((r) => r.data),
  updateWithFiles: (id: number, payload: Partial<CreatePQRSPayload>, files: File[]) => {
    const fd = new FormData();
    Object.entries(payload).forEach(([k, v]) => {
      if (v !== undefined && v !== null) fd.append(k, String(v));
    });
    files.slice(0, MAX_ARCHIVOS_PQRS).forEach((f) => fd.append("archivos", f));
    return api
      .patch<PQRS>(`/pqrs/${id}/`, fd, { headers: { "Content-Type": "multipart/form-data" } })
      .then((r) => r.data);
  },
  addArchivos: (id: number, files: File[]) => {
    const fd = new FormData();
    files.forEach((f) => fd.append("archivos", f));
    return api
      .post<PQRSArchivoItem[]>(`/pqrs/${id}/archivos/`, fd, {
        headers: { "Content-Type": "multipart/form-data" },
      })
      .then((r) => r.data);
  },
  removeArchivo: (id: number, archivoId: number) =>
    api.delete(`/pqrs/${id}/archivos/${archivoId}/`),
  remove: (id: number) => api.delete(`/pqrs/${id}/`),
  asignar: (id: number, secretaria_ids: number[], justificacion?: string) =>
    api
      .post<PQRS>(`/pqrs/${id}/asignar/`, { secretaria_ids, justificacion })
      .then((r) => r.data),
  rechazarAsignacion: (id: number, motivo: string) =>
    api.post<PQRS>(`/pqrs/${id}/rechazar-asignacion/`, { motivo }).then((r) => r.data),
  responder: (
    id: number,
    respuesta: string,
    archivo?: File | null,
    emailOpts?: { enviarEmail: boolean; emailDestino?: string },
  ) => {
    if (archivo) {
      const fd = new FormData();
      fd.append("respuesta", respuesta);
      fd.append("archivo_respuesta", archivo);
      if (emailOpts?.enviarEmail) {
        fd.append("enviar_email", "true");
        if (emailOpts.emailDestino) fd.append("email_destino", emailOpts.emailDestino);
      }
      return api
        .post<PQRS>(`/pqrs/${id}/responder/`, fd, {
          headers: { "Content-Type": "multipart/form-data" },
        })
        .then((r) => r.data);
    }
    return api
      .post<PQRS>(`/pqrs/${id}/responder/`, {
        respuesta,
        ...(emailOpts?.enviarEmail && {
          enviar_email: true,
          ...(emailOpts.emailDestino && { email_destino: emailOpts.emailDestino }),
        }),
      })
      .then((r) => r.data);
  },
  cerrar: (id: number) => api.post<PQRS>(`/pqrs/${id}/cerrar/`).then((r) => r.data),
  reabrir: (id: number) => api.post<PQRS>(`/pqrs/${id}/reabrir/`).then((r) => r.data),
  reenviarCorreo: (
    id: number,
    opts?: { correoId?: number; emailDestino?: string },
  ) =>
    api
      .post<PQRS>(`/pqrs/${id}/reenviar-correo/`, {
        ...(opts?.correoId != null && { correo_id: opts.correoId }),
        ...(opts?.emailDestino && { email_destino: opts.emailDestino }),
      })
      .then((r) => r.data),
  descartarAlertaCorreo: (id: number) =>
    api.post<PQRS>(`/pqrs/${id}/descartar-alerta-correo/`).then((r) => r.data),
};

export {
  TIPO_SOLICITUD_LABEL,
  ESTADO_LABEL,
  ESTADO_CHART_COLORS,
  CANAL_LLEGADA_LABEL,
  ROLE_LABEL,
  labelTipo,
  labelEstado,
  labelCanal,
  TIPO_SOLICITUD_KEYS,
  ESTADO_KEYS,
} from "@/features/pqrs/labels";
