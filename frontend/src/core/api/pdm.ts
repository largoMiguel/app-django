import { api } from "@/core/api/client";

export interface PdmEvidenciaArchivo {
  id: number;
  nombre: string;
  nombre_original?: string;
  url: string;
  content_type?: string;
  size?: number;
  created_at?: string;
}

export interface PdmActividadEvidencia {
  id: number;
  descripcion?: string | null;
  url_evidencia?: string | null;
  archivos?: PdmEvidenciaArchivo[];
  fecha_registro?: string | null;
}

export interface PdmActividad {
  id: number;
  codigo_producto: string;
  anio: number;
  nombre: string;
  descripcion?: string | null;
  responsable_secretaria?: number | null;
  responsable_secretaria_nombre?: string | null;
  fecha_inicio?: string | null;
  fecha_fin?: string | null;
  meta_ejecutar: number;
  estado: "PENDIENTE" | "EN_PROGRESO" | "COMPLETADA" | "CANCELADA";
  tiene_evidencia?: boolean;
  evidencia?: PdmActividadEvidencia | null;
  cargandoEvidencia?: boolean;
}

export interface PdmProducto {
  id: number;
  codigo_producto: string;
  producto_mga?: string | null;
  indicador_producto_mga?: string | null;
  personalizacion_indicador?: string | null;
  linea_estrategica?: string | null;
  sector_mga?: string | null;
  programa_mga?: string | null;
  ods?: string | null;
  tipo_acumulacion?: string | null;
  bpin?: string | null;
  unidad_medida?: string | null;
  meta_cuatrienio?: number | null;
  programacion_2024: number;
  programacion_2025: number;
  programacion_2026: number;
  programacion_2027: number;
  total_2024: number;
  total_2025: number;
  total_2026: number;
  total_2027: number;
  responsable_secretaria?: number | null;
  responsable_secretaria_nombre?: string | null;
  porcentaje_ejecucion?: number;
  avance_anio?: number;
  estado_anio?: string;
  meta_anio?: number;
  presupuesto_anio?: number;
  resumen_por_anio?: Record<string, ResumenAnioBackend>;
  actividades?: PdmActividad[];
}

export interface ResumenAnioBackend {
  anio: number;
  meta_programada: number;
  meta_asignada: number;
  meta_disponible: number;
  meta_ejecutada: number;
  total_actividades: number;
  actividades_completadas: number;
  porcentaje_avance: number;
  presupuesto: number;
}

export interface PaginatedPdmProductos {
  count: number;
  next: string | null;
  previous: string | null;
  results: PdmProducto[];
}

export interface PdmMetaResponse {
  lineas_estrategicas: string[];
  sectores: string[];
  ods: string[];
  tipos_acumulacion: string[];
  iniciativas_sgr: { consecutivo: string; iniciativa_sgr: string; recursos_sgr_indicativos: number; bpin?: string }[];
  total_productos: number;
}

export interface PdmStatsResponse {
  total_lineas_estrategicas: number;
  total_productos: number;
  total_iniciativas_sgr: number;
  presupuesto_total: number;
  presupuesto_por_anio: Record<string, number>;
  presupuesto_por_linea: { linea: string; total: number }[];
  presupuesto_por_sector: { sector: string; total: number }[];
  estado_por_anio: {
    pendiente: number;
    en_progreso: number;
    completado: number;
    por_ejecutar: number;
    total: number;
  };
  anio_seguimiento: number;
}

export interface PdmStatusResponse {
  tiene_datos: boolean;
  total_productos: number;
  fecha_ultima_carga?: string | null;
}

export interface PdmContrato {
  id: number;
  no_crp: string;
  codigo_producto: string;
  concepto?: string | null;
  valor: number;
  contratista?: string | null;
  anio: number;
}

export interface PdmEjecucionResumenAnual {
  anios: { anio: number; pto_definitivo: number; pagos: number }[];
  totales: { pto_definitivo: number; pagos: number };
}

export interface PdmEjecucionFuente {
  nombre: string;
  codigo_fuente?: string | null;
  pto_inicial: number;
  adicion: number;
  reduccion: number;
  credito: number;
  contracredito: number;
  pto_definitivo: number;
  pagos: number;
}

export interface PdmEjecucionProducto {
  codigo_producto: string;
  fuentes: string[];
  fuentes_detalle: PdmEjecucionFuente[];
  totales: {
    pto_inicial: number;
    adicion: number;
    reduccion: number;
    credito: number;
    contracredito: number;
    pto_definitivo: number;
    pagos: number;
  };
}

export const pdmApi = {
  status: (slug: string) =>
    api.get<PdmStatusResponse>(`/pdm/v2/${slug}/status`).then((r) => r.data),
  meta: (slug: string) =>
    api.get<PdmMetaResponse>(`/pdm/v2/${slug}/meta`).then((r) => r.data),
  stats: (slug: string, anio?: number) =>
    api.get<PdmStatsResponse>(`/pdm/v2/${slug}/stats`, { params: anio ? { anio } : undefined }).then((r) => r.data),
  listProductos: (slug: string, params?: Record<string, string | number | undefined>) =>
    api
      .get<PaginatedPdmProductos>(`/pdm/v2/${slug}/productos`, { params })
      .then((r) => r.data),
  productoDetail: (slug: string, codigo: string, anio?: number) =>
    api
      .get<PdmProducto>(`/pdm/v2/${slug}/productos/${encodeURIComponent(codigo)}`, {
        params: anio ? { anio } : undefined,
      })
      .then((r) => r.data),
  upload: (slug: string, payload: Record<string, unknown>) =>
    api.post(`/pdm/v2/${slug}/upload`, payload).then((r) => r.data),
  actividadesByProducto: (slug: string, codigo: string, anio?: number) =>
    api
      .get<PdmActividad[]>(`/pdm/v2/${slug}/actividades/${codigo}`, {
        params: anio ? { anio } : undefined,
      })
      .then((r) => r.data),
  crearActividad: (slug: string, payload: Partial<PdmActividad>) =>
    api.post<PdmActividad>(`/pdm/v2/${slug}/actividades`, payload).then((r) => r.data),
  actualizarActividad: (slug: string, actividadId: number, payload: Partial<PdmActividad>) =>
    api.put<PdmActividad>(`/pdm/v2/${slug}/actividades/${actividadId}`, payload).then((r) => r.data),
  eliminarActividad: (slug: string, actividadId: number) =>
    api.delete(`/pdm/v2/${slug}/actividades/${actividadId}`),
  getEvidencia: (slug: string, actividadId: number) =>
    api.get<PdmActividadEvidencia>(`/pdm/v2/${slug}/actividades/${actividadId}/evidencia`).then((r) => r.data),
  registrarEvidencia: (
    slug: string,
    actividadId: number,
    payload: {
      descripcion: string;
      url_evidencia?: string;
      archivos?: File[];
    },
  ) => {
    const form = new FormData();
    form.append("descripcion", payload.descripcion);
    if (payload.url_evidencia) form.append("url_evidencia", payload.url_evidencia);
    payload.archivos?.forEach((file) => form.append("archivos", file));
    return api
      .post<PdmActividadEvidencia>(`/pdm/v2/${slug}/actividades/${actividadId}/evidencia`, form, {
        timeout: 120_000,
      })
      .then((r) => r.data);
  },
  actualizarEvidencia: (
    slug: string,
    actividadId: number,
    payload: {
      descripcion: string;
      url_evidencia?: string;
      archivos?: File[];
      archivos_eliminar?: number[];
    },
  ) => {
    const form = new FormData();
    form.append("descripcion", payload.descripcion);
    form.append("url_evidencia", payload.url_evidencia || "");
    payload.archivos?.forEach((file) => form.append("archivos", file));
    if (payload.archivos_eliminar?.length) {
      form.append("archivos_eliminar", payload.archivos_eliminar.join(","));
    }
    return api
      .put<PdmActividadEvidencia>(`/pdm/v2/${slug}/actividades/${actividadId}/evidencia`, form, {
        timeout: 120_000,
      })
      .then((r) => r.data);
  },
  asignarResponsable: (slug: string, codigoProducto: string, secretariaId: number) =>
    api
      .patch(
        `/pdm/v2/${slug}/productos/${encodeURIComponent(codigoProducto)}/responsable`,
        {},
        { params: { responsable_secretaria_id: secretariaId } },
      )
      .then((r) => r.data),
  uploadEjecucion: (file: File, anio?: number) => {
    const form = new FormData();
    form.append("file", file);
    if (anio) form.append("anio", String(anio));
    return api.post("/pdm/ejecucion/upload", form).then((r) => r.data);
  },
  resumenEjecucionAnualEntidad: () =>
    api.get<PdmEjecucionResumenAnual>("/pdm/ejecucion/resumen-anual-entidad").then((r) => r.data),
  ejecucionPorProducto: (codigoProducto: string, anio?: number) =>
    api
      .get<PdmEjecucionProducto>(`/pdm/ejecucion/${encodeURIComponent(codigoProducto)}`, {
        params: anio ? { anio } : undefined,
      })
      .then((r) => r.data),
  uploadContratos: (slug: string, file: File, anio?: number) => {
    const form = new FormData();
    form.append("file", file);
    return api
      .post(`/pdm/contratos/${slug}/upload`, form, { params: anio ? { anio } : undefined })
      .then((r) => r.data);
  },
  contratos: (slug: string, anio?: number, codigoProducto?: string) =>
    api
      .get<{ contratos: PdmContrato[]; total_contratado: number; cantidad_contratos: number; anio: number }>(
        `/pdm/contratos/${slug}/contratos`,
        { params: { ...(anio ? { anio } : {}), ...(codigoProducto ? { codigo_producto: codigoProducto } : {}) } },
      )
      .then((r) => r.data),
};
