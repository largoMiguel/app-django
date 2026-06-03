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
  pto_definitivo_anio?: number;
  pagos_anio?: number;
  avance_financiero_anio?: number;
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
  productos_sin_linea?: number;
  productos_sin_sector?: number;
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

export interface PdmAnalisisResponse {
  anio_filtro: number | null;
  total_productos: number;
  avance_global: number;
  productos_al_100?: number;
  presupuesto: { pto_definitivo: number; pagos: number };
  estado_distribucion: {
    pendiente: number;
    en_progreso: number;
    completado: number;
    por_ejecutar: number;
    total: number;
  };
  metas_por_anio: { anio: number; programada: number; ejecutada: number; pct: number }[];
  por_linea: { linea: string; productos: number; avance_pct: number }[];
  por_sector_estado: {
    sector: string;
    total: number;
    completados: number;
    en_progreso: number;
    pendientes: number;
    por_ejecutar: number;
    avance_fisico_pct: number;
    avance_financiero_pct: number;
    avance_pct: number;
    pto_definitivo: number;
    pagos: number;
  }[];
  por_ods: { ods: string; productos: number; avance_pct: number; presupuesto: number }[];
  presupuestal_por_anio: {
    anio: number;
    plan: number;
    ejecucion: number;
    pagos: number;
    pct_pagado: number;
  }[];
  por_secretaria: {
    secretaria_id: number;
    secretaria: string;
    productos: number;
    completados: number;
    en_progreso: number;
    pendientes: number;
    por_ejecutar: number;
    avance_pct: number;
    pto_definitivo: number;
    pagos: number;
  }[];
}

export interface PdmStatusResponse {
  tiene_datos: boolean;
  total_productos: number;
  total_productos_entidad?: number;
  fecha_ultima_carga?: string | null;
}

export interface PdmProyectoProducto {
  codigo_producto: string;
  nombre: string;
  linea_estrategica?: string | null;
  sector_mga?: string | null;
  meta_cuatrienio: number;
  responsable_secretaria_nombre?: string | null;
  avance: number;
  avance_financiero: number;
  estado: string;
  presupuesto: number;
}

export interface PdmProyecto {
  bpin: string;
  nombre_proyecto?: string | null;
  estado?: string | null;
  sector?: string | null;
  datos_abiertos_ok: boolean;
  total_productos: number;
  avance_general: number;
  completados: number;
  en_progreso: number;
  pendientes: number;
  por_ejecutar: number;
  presupuesto_total: number;
  productos: PdmProyectoProducto[];
}

export interface PdmProyectosResponse {
  total_proyectos: number;
  total_productos_con_bpin: number;
  productos_sin_bpin: number;
  avance_promedio: number;
  proyectos: PdmProyecto[];
  datos_abiertos_error?: string | null;
  portal_url?: string;
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
  ejecucion_por_linea?: { linea: string; total: number }[];
  ejecucion_por_sector?: { sector: string; total: number }[];
  ejecucion_sin_producto_plan?: {
    codigo_producto: string;
    pto_definitivo: number;
    anios?: number[];
    detalle_anios?: { anio: number; pto_definitivo: number }[];
  }[];
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

export interface PdmContratosResumen {
  contratos: PdmContrato[];
  total_contratado: number;
  cantidad_contratos: number;
  anio: number;
}

export const pdmApi = {
  status: (slug: string) =>
    api.get<PdmStatusResponse>(`/pdm/v2/${slug}/status`).then((r) => r.data),
  meta: (slug: string) =>
    api.get<PdmMetaResponse>(`/pdm/v2/${slug}/meta`).then((r) => r.data),
  stats: (slug: string, anio?: number) =>
    api.get<PdmStatsResponse>(`/pdm/v2/${slug}/stats`, { params: anio ? { anio } : undefined }).then((r) => r.data),
  analisis: (slug: string, params?: { anio?: number | "all"; secretaria?: number }) =>
    api
      .get<PdmAnalisisResponse>(`/pdm/v2/${slug}/analisis`, {
        params: {
          ...(params?.anio !== undefined
            ? { anio: params.anio === "all" ? "all" : params.anio }
            : {}),
          ...(params?.secretaria ? { secretaria: params.secretaria } : {}),
        },
      })
      .then((r) => r.data),
  proyectos: (slug: string) =>
    api.get<PdmProyectosResponse>(`/pdm/v2/${slug}/proyectos`).then((r) => r.data),
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
      .get<PdmActividad[]>(`/pdm/v2/${slug}/productos/${encodeURIComponent(codigo)}/actividades`, {
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
      .get<PdmContratosResumen>(
        `/pdm/contratos/${slug}/contratos`,
        { params: { ...(anio ? { anio } : {}), ...(codigoProducto ? { codigo_producto: codigoProducto } : {}) } },
      )
      .then((r) => r.data),
};
