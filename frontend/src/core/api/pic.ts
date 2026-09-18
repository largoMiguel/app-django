import { api, downloadAuthenticatedFile } from "@/core/api/client";
import type { PaginatedResponse } from "@/core/api/entities";

export interface PicPlan {
  id: number;
  entity: number;
  anio: number;
  archivo_nombre: string;
  uploaded_by: number | null;
  actividades_count: number;
  valor_total_pic: number | string;
  created_at: string;
  updated_at: string;
}

export interface PicActividad {
  id: number;
  plan: number;
  numero: number;
  eje_estrategico: string;
  linea_operativa: string;
  encargado_texto: string;
  actividad: string;
  soportes?: string;
  unidad_medida: string;
  total_programado: number;
  prog_t1: number;
  prog_t2: number;
  prog_t3: number;
  prog_t4: number;
  valor_total: string;
  valor_unitario: string;
  total_ejecutado: number;
  disponible: number;
  valor_cobrado_total: string;
  avance_pct: number;
  responsable_secretaria: number | null;
  responsable_secretaria_nombre: string | null;
  responsables: number[];
  responsables_nombres: string[];
  resumen_trimestral?: Array<{
    trimestre: number;
    trimestre_label: string;
    programado_trimestre: number;
    programado_acumulado: number;
    ejecutado_trimestre: number;
    ejecutado_acumulado: number;
    pendiente_acumulado: number;
  }>;
  ejecuciones?: PicEjecucion[];
  fila_excel: number | null;
  created_at: string;
  updated_at: string;
}

export interface PicEjecucionArchivo {
  id: number;
  nombre: string;
  nombre_original: string;
  content_type: string;
  size: number;
  url: string | null;
  created_at: string;
}

export interface PicEjecucion {
  id: number;
  actividad: number;
  fecha_ejecucion: string;
  trimestre: number;
  trimestre_label: string;
  cantidad_ejecutada: number;
  descripcion: string;
  valor_cobrado: string;
  registrado_por: number | null;
  registrado_por_nombre: string | null;
  archivos: PicEjecucionArchivo[];
  created_at: string;
}

export interface PicStats {
  anio: number;
  plan_id: number | null;
  tiene_plan: boolean;
  actividades_total: number;
  valor_total_pic: string;
  valor_cobrado_total: string;
  total_programado: number;
  total_ejecutado: number;
  avance_pct: number;
  por_trimestre: Array<{
    trimestre: number;
    trimestre_label: string;
    programado: number;
    ejecutado: number;
  }>;
  por_responsable: Array<{
    usuario_id: number;
    nombre: string;
    actividades: number;
    total_ejecutado: number;
    valor_cobrado: string;
  }>;
  sin_responsables: number;
}

export interface PicCargo {
  id: number;
  entity: number;
  etiqueta: string;
  etiqueta_norm: string;
  secretaria: number | null;
  usuarios: number[];
  usuarios_nombres: string[];
  created_at: string;
  updated_at: string;
}

export interface PicUploadResult {
  ok: boolean;
  anio: number;
  plan_id: number;
  total_actividades: number;
  creadas: number;
  actualizadas: number;
  eliminadas: number;
  conservadas_sin_excel: number;
  sin_mapeo_encargado: string[];
  advertencias: string[];
  valor_total_pic: string;
  fecha_carga: string | null;
  errores?: string[];
}

export interface PicPreviewValor {
  valido: boolean;
  disponible: number;
  valor_cobrado: string | null;
  mensaje: string | null;
}

export const picApi = {
  listPlans: () => api.get<PicPlan[]>("/pic/plan/").then((r) => r.data),

  getPlan: (anio: number) => api.get<PicPlan>(`/pic/plan/?anio=${anio}`).then((r) => r.data),

  uploadPlan: (anio: number, file: File, reasignarEncargados = false) => {
    const form = new FormData();
    form.append("file", file);
    form.append("anio", String(anio));
    if (reasignarEncargados) form.append("reasignar_encargados", "true");
    return api.post<PicUploadResult>("/pic/plan/upload/", form).then((r) => r.data);
  },

  deletePlan: (anio: number) => api.delete(`/pic/plan/${anio}/`),

  stats: (anio: number) => api.get<PicStats>(`/pic/stats/?anio=${anio}`).then((r) => r.data),

  listActividades: (params: Record<string, string | number | undefined>) =>
    api
      .get<PaginatedResponse<PicActividad>>("/pic/actividades/", { params })
      .then((r) => r.data),

  getActividad: (id: number) =>
    api.get<PicActividad>(`/pic/actividades/${id}/`).then((r) => r.data),

  updateResponsables: (id: number, data: { responsables: number[]; responsable_secretaria_id?: number | null }) =>
    api.patch<PicActividad>(`/pic/actividades/${id}/responsables/`, data).then((r) => r.data),

  previewValor: (id: number, cantidad: number) =>
    api
      .post<PicPreviewValor>(`/pic/actividades/${id}/preview-valor/`, { cantidad_ejecutada: cantidad })
      .then((r) => r.data),

  createEjecucion: (
    actividadId: number,
    data: { fecha_ejecucion: string; cantidad_ejecutada: number; descripcion?: string },
    archivos: File[],
  ) => {
    const form = new FormData();
    form.append("fecha_ejecucion", data.fecha_ejecucion);
    form.append("cantidad_ejecutada", String(data.cantidad_ejecutada));
    if (data.descripcion) form.append("descripcion", data.descripcion);
    archivos.forEach((f) => form.append("archivos", f));
    return api
      .post<PicEjecucion>(`/pic/actividades/${actividadId}/ejecuciones/`, form)
      .then((r) => r.data);
  },

  deleteEjecucion: (id: number) => api.delete(`/pic/ejecuciones/${id}/`),

  listCargos: (params?: { search?: string; page?: number; page_size?: number }) =>
    api.get<PaginatedResponse<PicCargo>>("/pic/cargos/", { params }).then((r) => r.data),

  createCargo: (data: { etiqueta: string; secretaria_id?: number | null; usuarios: number[] }) =>
    api.post<PicCargo>("/pic/cargos/", data).then((r) => r.data),

  updateCargo: (id: number, data: Partial<{ etiqueta: string; secretaria_id: number | null; usuarios: number[] }>) =>
    api.patch<PicCargo>(`/pic/cargos/${id}/`, data).then((r) => r.data),

  deleteCargo: (id: number) => api.delete(`/pic/cargos/${id}/`),

  aplicarCargos: (anio: number) =>
    api.post<{ actualizadas: number; sin_mapeo_encargado: string[] }>("/pic/cargos/aplicar/", { anio }).then((r) => r.data),

  exportUrl: (params: Record<string, string>) => {
    const qs = new URLSearchParams(params).toString();
    const base = import.meta.env.VITE_API_URL || "/api/v1";
    return `${base}/pic/export/?${qs}`;
  },

  downloadExport: async (anio: number, trimestre?: number) => {
    const params: Record<string, string> = { anio: String(anio) };
    if (trimestre) params.trimestre = String(trimestre);
    const triSuffix = trimestre ? `_T${trimestre}` : "";
    const filename = `PIC_${anio}${triSuffix}.xlsx`;
    await downloadAuthenticatedFile(picApi.exportUrl(params), filename);
  },
};
