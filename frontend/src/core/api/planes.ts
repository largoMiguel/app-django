import { api, downloadAuthenticatedFile } from "@/core/api/client";
import type { PaginatedResponse } from "@/core/api/entities";

export interface PlanCatalogoItem {
  id: number;
  entity: number | null;
  codigo: string;
  nombre: string;
  orden: number;
  es_decreto612: boolean;
  descripcion: string;
  is_active: boolean;
}

export interface PlanListItem {
  id: number;
  entity: number;
  catalogo: number;
  catalogo_codigo: string;
  catalogo_nombre: string;
  anio: number;
  nombre: string;
  objetivo: string;
  responsable_secretaria: number | null;
  responsable_secretaria_nombre: string | null;
  responsable_usuario: number | null;
  fecha_publicacion: string | null;
  url_publicacion: string;
  estado: string;
  estado_label: string;
  actividades_count?: number;
  avance_promedio?: number;
  created_at: string;
  updated_at: string;
}

export interface PlanEvidenciaArchivo {
  id: number;
  nombre: string;
  nombre_original: string;
  content_type: string;
  size: number;
  url: string | null;
  created_at: string;
}

export interface PlanEvidencia {
  id: number;
  actividad: number;
  entity: number;
  descripcion: string;
  cantidad_ejecutada: number;
  url_evidencia: string | null;
  archivos: PlanEvidenciaArchivo[];
  fecha_registro: string | null;
  created_at: string;
  updated_at: string;
}

export interface PlanActividad {
  id: number;
  entity: number;
  plan: number;
  anio: number;
  trimestre: number;
  trimestre_label: string;
  nombre: string;
  descripcion: string;
  meta: string;
  indicador: string;
  fecha_inicio: string | null;
  fecha_fin: string | null;
  responsable_secretaria: number | null;
  responsable_secretaria_nombre: string | null;
  responsable_usuario: number | null;
  responsable_usuario_nombre: string | null;
  estado: string;
  estado_label: string;
  avance: number;
  tiene_evidencia: boolean;
  total_ejecutado?: number;
  evidencias?: PlanEvidencia[];
  created_at: string;
  updated_at: string;
}

export interface PlanDetail extends PlanListItem {
  actividades: PlanActividad[];
  resumen_por_trimestre: Array<{
    trimestre: number;
    trimestre_label: string;
    total: number;
    completadas: number;
    avance_promedio: number;
  }>;
}

export interface PlanStats {
  anio: number;
  planes_total: number;
  planes_por_estado: Record<string, number>;
  actividades_total: number;
  actividades_por_estado: Record<string, number>;
  por_trimestre: Array<{
    trimestre: number;
    trimestre_label: string;
    total: number;
    completadas: number;
    avance_promedio: number;
  }>;
  actividades_vencidas: number;
  planes_sin_responsable: number;
  avance_promedio: number;
}

export interface CronogramaPlan {
  plan_id: number;
  plan_nombre: string;
  catalogo_codigo: string;
  catalogo_nombre: string;
  actividades: Array<{
    id: number;
    nombre: string;
    trimestre: number;
    trimestre_label: string;
    fecha_inicio: string | null;
    fecha_fin: string | null;
    estado: string;
    avance: number;
    responsable_secretaria_nombre: string | null;
  }>;
}

export interface PlanWritePayload {
  catalogo_id: number;
  anio: number;
  objetivo?: string;
  responsable_secretaria_id?: number | null;
  fecha_publicacion?: string | null;
  url_publicacion?: string;
  estado?: string;
}

export interface PlanCatalogoWritePayload {
  codigo: string;
  nombre: string;
  descripcion?: string;
  orden?: number;
}

export interface PlanActividadWritePayload {
  plan: number;
  anio?: number;
  trimestre: number;
  nombre: string;
  descripcion?: string;
  meta?: string;
  indicador?: string;
  fecha_inicio?: string | null;
  fecha_fin?: string | null;
  responsable_secretaria?: number | null;
  responsable_usuario?: number | null;
}

export const TRIMESTRE_OPTIONS = [
  { value: 1, label: "Trimestre I" },
  { value: 2, label: "Trimestre II" },
  { value: 3, label: "Trimestre III" },
  { value: 4, label: "Trimestre IV" },
] as const;

export const ESTADO_PLAN_OPTIONS = [
  { value: "BORRADOR", label: "Borrador" },
  { value: "PUBLICADO", label: "Publicado" },
  { value: "EN_EJECUCION", label: "En ejecución" },
  { value: "CERRADO", label: "Cerrado" },
] as const;

export const ESTADO_ACTIVIDAD_OPTIONS = [
  { value: "PENDIENTE", label: "Pendiente" },
  { value: "EN_PROGRESO", label: "En progreso" },
  { value: "COMPLETADA", label: "Completada" },
  { value: "CANCELADA", label: "Cancelada" },
] as const;

function parsePaginated<T>(data: T[] | PaginatedResponse<T>): PaginatedResponse<T> {
  if (Array.isArray(data)) {
    return { count: data.length, next: null, previous: null, results: data };
  }
  return data;
}

export const planesApi = {
  catalogo: (params?: Record<string, string>) =>
    api
      .get<PlanCatalogoItem[] | PaginatedResponse<PlanCatalogoItem>>("/planes/catalogo/", { params })
      .then((r) => parsePaginated(r.data)),

  createCatalogo: (payload: PlanCatalogoWritePayload) =>
    api.post<PlanCatalogoItem>("/planes/catalogo/", payload).then((r) => r.data),

  list: (params?: Record<string, string | number>) =>
    api
      .get<PlanListItem[] | PaginatedResponse<PlanListItem>>("/planes/", { params })
      .then((r) => parsePaginated(r.data)),

  get: (id: number) => api.get<PlanDetail>(`/planes/${id}/`).then((r) => r.data),

  create: (payload: PlanWritePayload) =>
    api.post<PlanDetail>("/planes/", payload).then((r) => r.data),

  update: (id: number, payload: Partial<PlanWritePayload>) =>
    api.patch<PlanDetail>(`/planes/${id}/`, payload).then((r) => r.data),

  delete: (id: number) => api.delete(`/planes/${id}/`),

  assignResponsable: (id: number, responsable_secretaria_id: number | null) =>
    api
      .post(`/planes/${id}/responsable/`, { responsable_secretaria_id })
      .then((r) => r.data),

  stats: (anio?: number) =>
    api
      .get<PlanStats>("/planes/stats/", { params: anio ? { anio: String(anio) } : undefined })
      .then((r) => r.data),

  cronograma: (anio?: number) =>
    api
      .get<CronogramaPlan[]>("/planes/cronograma/", {
        params: anio ? { anio: String(anio) } : undefined,
      })
      .then((r) => r.data),

  exportUrl: (params: Record<string, string>) => {
    const qs = new URLSearchParams(params).toString();
    const base = import.meta.env.VITE_API_URL || "/api/v1";
    return `${base}/planes/export/?${qs}`;
  },

  downloadExport: async (params: Record<string, string>, filename: string) => {
    const url = planesApi.exportUrl(params);
    await downloadAuthenticatedFile(url, filename);
  },

  actividades: {
    list: (params?: Record<string, string | number>) =>
      api
        .get<PlanActividad[] | PaginatedResponse<PlanActividad>>("/planes/actividades/", { params })
        .then((r) => parsePaginated(r.data)),

    get: (id: number) =>
      api.get<PlanActividad>(`/planes/actividades/${id}/`).then((r) => r.data),

    create: (payload: PlanActividadWritePayload) =>
      api.post<PlanActividad>("/planes/actividades/", payload).then((r) => r.data),

    update: (id: number, payload: Partial<PlanActividadWritePayload>) =>
      api.patch<PlanActividad>(`/planes/actividades/${id}/`, payload).then((r) => r.data),

    delete: (id: number) => api.delete(`/planes/actividades/${id}/`),

    assignContratista: (id: number, responsable_usuario_id: number | null) =>
      api
        .patch(`/planes/actividades/${id}/responsable-usuario/`, { responsable_usuario_id })
        .then((r) => r.data),

    listEvidencias: (id: number) =>
      api.get<PlanEvidencia[]>(`/planes/actividades/${id}/evidencia/`).then((r) => r.data),

    registrarEvidencia: (
      id: number,
      payload: {
        descripcion: string;
        cantidad_ejecutada: number;
        url_evidencia?: string;
        archivos?: File[];
      },
    ) => {
      const form = new FormData();
      form.append("descripcion", payload.descripcion);
      form.append("cantidad_ejecutada", String(payload.cantidad_ejecutada));
      if (payload.url_evidencia) form.append("url_evidencia", payload.url_evidencia);
      payload.archivos?.forEach((file) => form.append("archivos", file));
      return api
        .post<PlanEvidencia>(`/planes/actividades/${id}/evidencia/`, form, { timeout: 120_000 })
        .then((r) => r.data);
    },

    actualizarEvidencia: (
      actividadId: number,
      evidenciaId: number,
      payload: {
        descripcion?: string;
        cantidad_ejecutada?: number;
        url_evidencia?: string;
        archivos?: File[];
        archivos_eliminar?: number[];
      },
    ) => {
      const form = new FormData();
      if (payload.descripcion !== undefined) form.append("descripcion", payload.descripcion);
      if (payload.cantidad_ejecutada !== undefined) {
        form.append("cantidad_ejecutada", String(payload.cantidad_ejecutada));
      }
      if (payload.url_evidencia !== undefined) form.append("url_evidencia", payload.url_evidencia);
      payload.archivos?.forEach((file) => form.append("archivos", file));
      if (payload.archivos_eliminar?.length) {
        form.append("archivos_eliminar", payload.archivos_eliminar.join(","));
      }
      return api
        .put<PlanEvidencia>(`/planes/actividades/${actividadId}/evidencia/${evidenciaId}/`, form, {
          timeout: 120_000,
        })
        .then((r) => r.data);
    },

    eliminarEvidencia: (actividadId: number, evidenciaId: number) =>
      api.delete(`/planes/actividades/${actividadId}/evidencia/${evidenciaId}/`),
  },
};
