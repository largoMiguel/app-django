import { api } from "@/core/api/client";

/** Consultas SECOP pueden tardar (datos.gov.co + caché fría). */
const SECOP_TIMEOUT_MS = 120_000;

export interface SecopAvance {
  avance_tiempo: number | null;
  avance_financiero: number | null;
  desviacion: number | null;
  dias_restantes: number | null;
  semaforo: "verde" | "amarillo" | "rojo" | "gris";
}

export interface SecopPago {
  id_pago?: string;
  numero_factura?: string;
  fecha?: string;
  valor_neto?: number;
  valor_total?: number;
  estado?: string;
  pago_confirmado?: boolean;
  notas?: string;
  radicado?: string;
}

export interface SecopModificacion {
  identificador?: string;
  tipo?: string;
  descripcion?: string;
  fecha_aprobacion?: string;
  valor_modificacion?: number;
  dias_extendidos?: number;
  fecha_fin_contrato?: string;
  liquidacion?: string;
  estado?: string;
}

export interface SecopRecord {
  fuente: "secop1" | "secop2";
  tipo_registro: "contrato" | "proceso";
  id: string;
  referencia: string;
  referencia_contrato?: string | null;
  numero_proceso?: string | null;
  objeto: string | null;
  proveedor: string | null;
  documento_proveedor: string | null;
  valor: number;
  valor_pagado: number | null;
  valor_pendiente: number | null;
  valor_adiciones?: number;
  valor_con_adiciones?: number;
  datos_pago_disponibles?: boolean;
  estado: string;
  modalidad: string | null;
  tipo: string | null;
  fecha_firma: string | null;
  fecha_inicio: string | null;
  fecha_fin: string | null;
  supervisor: string | null;
  ordenador_gasto?: string | null;
  url: string | null;
  pagos?: SecopPago[];
  modificaciones?: SecopModificacion[];
  total_pagado_real?: number;
  ultimo_pago?: string | null;
  avance?: SecopAvance;
  proceso_vinculado?: SecopRecord;
}

export interface SecopKpis {
  total_registros: number;
  total_contratos: number;
  total_procesos_sin_contrato: number;
  valor_total: number;
  valor_promedio: number;
  valor_pagado_total?: number;
  contratos_vigentes: number;
  contratos_vencidos: number;
  contratos_por_vencer_30d: number;
  proveedores_unicos: number;
}

export interface SecopChartItem {
  label: string;
  count?: number;
  valor?: number;
}

export interface SecopResponsableGroup {
  nombre: string;
  campo: string;
  contratos: number;
  valor_total: number;
  valor_pagado: number;
  avance_promedio: number | null;
  vencidos: number;
  por_vencer_30d: number;
  sin_liquidar: number;
}

export interface SecopVencimientoBucket {
  count: number;
  valor: number;
  registros: Partial<SecopRecord>[];
}

export interface SecopAnalytics {
  kpis: SecopKpis;
  hhi: number;
  por_modalidad: SecopChartItem[];
  por_tipo: SecopChartItem[];
  por_estado: SecopChartItem[];
  valor_por_modalidad: SecopChartItem[];
  serie_mensual: { mes: string; valor: number }[];
  serie_mensual_pagos?: { mes: string; valor: number }[];
  top_proveedores_valor: {
    proveedor: string;
    documento: string;
    valor: number;
    count: number;
  }[];
  origen_recursos: SecopChartItem[];
  por_supervisor?: SecopResponsableGroup[];
  por_ordenador?: SecopResponsableGroup[];
  vencimientos?: Record<string, SecopVencimientoBucket>;
  pagos?: SecopPagosResponse;
}

export interface SecopPagosResponse {
  serie_mensual_pagos: { mes: string; valor: number }[];
  pagos_recientes: (SecopPago & { referencia?: string; proveedor?: string; contrato_id?: string })[];
  contratos_sin_pago: Partial<SecopRecord>[];
  total_pagado: number;
}

export interface SecopAlert {
  codigo: string;
  severidad: "critica" | "alta" | "media" | "baja";
  titulo: string;
  mensaje: string;
  fuente: string;
  cantidad: number;
  valor_implicado: number;
  registros: Partial<SecopRecord>[];
}

export interface SecopConfig {
  entity: string;
  nit_general: string | null;
  secop_i_codigo_entidad: string | null;
  secop_i_nombre_entidad: string | null;
  secop_ii_codigo_entidad: string | null;
  secop_ii_nombre_entidad: string | null;
  nits_resueltos_i: string[];
  nits_resueltos_ii: string[];
  anios_disponibles: number[];
  anio_default: number;
  tendencia_secop1: { anio: number; total: number }[];
  tendencia_secop2_contratos: { anio: number; total: number }[];
  tendencia_secop2_procesos: { anio: number; total: number }[];
}

export interface SecopEntidadDatosGov {
  fuente: string;
  nombre_entidad: string;
  codigo_entidad: string;
  nit: string;
  total: number;
}

export interface SecopChartSpec {
  tipo: "bar" | "line" | "pie" | "area";
  titulo: string;
  formato?: "moneda" | "numero" | "porcentaje";
  eje_x?: string;
  eje_y?: string;
  datos: { label: string; valor: number }[];
}

export interface SecopAnalisisStructured {
  resumen_ejecutivo: string;
  indicadores_clave: { label: string; valor: string; tendencia: string; detalle: string }[];
  hallazgos: { titulo: string; detalle: string; severidad: string; metrica?: string }[];
  riesgos: { titulo: string; detalle: string; severidad: string; impacto?: string }[];
  recomendaciones: { titulo: string; accion: string; prioridad: string; plazo?: string }[];
}

export interface PaginatedSecop {
  count: number;
  next: number | null;
  previous: number | null;
  results: SecopRecord[];
  meta?: Record<string, unknown>;
  kpis?: SecopKpis;
  analitica?: SecopAnalytics;
}

export interface Secop2Panel extends PaginatedSecop {
  anio: number;
  vencimientos: Record<string, SecopVencimientoBucket>;
  pagos: SecopPagosResponse;
  por_supervisor: SecopResponsableGroup[];
  por_ordenador: SecopResponsableGroup[];
}

export interface SecopResumen {
  anio: number;
  kpis: SecopKpis;
  comparativo: {
    delta_valor_total: number | null;
    delta_total_contratos: number | null;
    delta_valor_pagado?: number | null;
  } | null;
  secop1: { meta: Record<string, unknown>; kpis: SecopKpis };
  secop2: { meta: Record<string, unknown>; kpis: SecopKpis; analitica: SecopAnalytics };
  alertas_criticas: SecopAlert[];
  total_alertas: number;
  vencimientos?: Record<string, SecopVencimientoBucket>;
  pagos?: SecopPagosResponse;
}

function downloadBlob(data: Blob, filename: string) {
  const url = URL.createObjectURL(data);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export const secopApi = {
  config: () => api.get<SecopConfig>("/secop/config/", { timeout: SECOP_TIMEOUT_MS }).then((r) => r.data),

  resumen: (anio: number) =>
    api.get<SecopResumen>("/secop/resumen/", { params: { anio }, timeout: SECOP_TIMEOUT_MS }).then((r) => r.data),

  listSecop2: (params: Record<string, string | number>) =>
    api.get<PaginatedSecop>("/secop/secop2/", { params, timeout: SECOP_TIMEOUT_MS }).then((r) => r.data),

  panelSecop2: (params: Record<string, string | number>) =>
    api.get<Secop2Panel>("/secop/secop2/panel/", { params, timeout: SECOP_TIMEOUT_MS }).then((r) => r.data),

  analiticaSecop2: (anio: number) =>
    api.get<SecopAnalytics & { anio: number; meta: Record<string, unknown> }>("/secop/secop2/analitica/", {
      params: { anio },
    }).then((r) => r.data),

  listSecop1: (params: Record<string, string | number>) =>
    api.get<PaginatedSecop>("/secop/secop1/", { params, timeout: SECOP_TIMEOUT_MS }).then((r) => r.data),

  analiticaSecop1: (anio: number) =>
    api.get<SecopAnalytics & { anio: number; meta: Record<string, unknown> }>("/secop/secop1/analitica/", {
      params: { anio },
    }).then((r) => r.data),

  ejecucion: (params: Record<string, string | number>) =>
    api
      .get<{ anio: number; kpis: SecopKpis; count: number; results: SecopRecord[] }>("/secop/ejecucion/", {
        params,
        timeout: SECOP_TIMEOUT_MS,
      })
      .then((r) => r.data),

  dependencias: (anio: number) =>
    api
      .get<{ anio: number; por_supervisor: SecopResponsableGroup[]; por_ordenador: SecopResponsableGroup[] }>(
        "/secop/dependencias/",
        { params: { anio }, timeout: SECOP_TIMEOUT_MS },
      )
      .then((r) => r.data),

  vencimientos: (anio: number) =>
    api
      .get<{ anio: number } & Record<string, SecopVencimientoBucket>>("/secop/vencimientos/", {
        params: { anio },
        timeout: SECOP_TIMEOUT_MS,
      })
      .then((r) => r.data),

  pagos: (anio: number) =>
    api.get<SecopPagosResponse & { anio: number }>("/secop/pagos/", { params: { anio }, timeout: SECOP_TIMEOUT_MS }).then((r) => r.data),

  entidadesDatosGov: (nit: string) =>
    api
      .get<{ entidades: SecopEntidadDatosGov[] }>("/secop/entidades-datos-gov/", { params: { nit }, timeout: SECOP_TIMEOUT_MS })
      .then((r) => r.data),

  alertas: (params: Record<string, string | number>) =>
    api
      .get<{ anio: number; resumen: Record<string, number>; alertas: SecopAlert[] }>("/secop/alertas/", { params })
      .then((r) => r.data),

  detalle: (fuente: string, id: string, anio: number) =>
    api.get<SecopRecord>("/secop/detalle/", { params: { fuente, id, anio } }).then((r) => r.data),

  refrescar: (anio?: number) =>
    api.post<{ ok: boolean; cache_keys_cleared: number }>("/secop/refrescar/", anio ? { anio } : {}).then((r) => r.data),

  exportExcel: async (fuente: string, anio: number) => {
    const res = await api.get("/secop/export/", {
      params: { fuente, anio },
      responseType: "blob",
      timeout: SECOP_TIMEOUT_MS,
    });
    downloadBlob(res.data as Blob, `SECOP_${fuente}_${anio}.xlsx`);
  },

  aiAnalisis: (anio: number) =>
    api
      .post<{ anio: number; analisis: string; structured: SecopAnalisisStructured | null; contexto: Record<string, unknown> }>(
        "/secop/ai/analisis/",
        { anio },
        { timeout: SECOP_TIMEOUT_MS },
      )
      .then((r) => r.data),

  aiCopilot: (message: string, anio: number, history?: { role: string; content: string }[]) =>
    api
      .post<{
        reply: string;
        sources: { tool: string; preview: string }[];
        chart?: SecopChartSpec | null;
        registros?: Partial<SecopRecord>[];
      }>("/secop/ai/copilot/", { message, anio, history }, { timeout: SECOP_TIMEOUT_MS })
      .then((r) => r.data),

  aiContrato: (fuente: string, id: string, anio: number) =>
    api
      .post<{ resumen: string; registro: SecopRecord }>("/secop/ai/contrato/", { fuente, id, anio }, { timeout: SECOP_TIMEOUT_MS })
      .then((r) => r.data),
};

export function formatCOP(value: number | null | undefined): string {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(value || 0);
}

export const SEVERIDAD_COLORS: Record<string, string> = {
  critica: "bg-red-100 text-red-800 border-red-200",
  alta: "bg-orange-100 text-orange-800 border-orange-200",
  media: "bg-amber-100 text-amber-800 border-amber-200",
  baja: "bg-slate-100 text-slate-700 border-slate-200",
};

export const SEMAFORO_COLORS: Record<string, string> = {
  verde: "bg-emerald-500",
  amarillo: "bg-amber-500",
  rojo: "bg-red-500",
  gris: "bg-slate-300",
};
