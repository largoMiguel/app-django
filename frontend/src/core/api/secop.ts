import { api } from "@/core/api/client";

/** Consultas SECOP pueden tardar (datos.gov.co + caché fría). */
const SECOP_TIMEOUT_MS = 120_000;

export interface SecopRecord {
  fuente: "secop1" | "secop2";
  tipo_registro: "contrato" | "proceso";
  id: string;
  referencia: string;
  objeto: string | null;
  proveedor: string | null;
  documento_proveedor: string | null;
  valor: number;
  valor_pagado: number;
  valor_pendiente: number;
  valor_adiciones?: number;
  valor_con_adiciones?: number;
  estado: string;
  modalidad: string | null;
  tipo: string | null;
  fecha_firma: string | null;
  fecha_inicio: string | null;
  fecha_fin: string | null;
  supervisor: string | null;
  url: string | null;
  proceso_vinculado?: SecopRecord;
}

export interface SecopKpis {
  total_registros: number;
  total_contratos: number;
  total_procesos_sin_contrato: number;
  valor_total: number;
  valor_promedio: number;
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

export interface SecopAnalytics {
  kpis: SecopKpis;
  hhi: number;
  por_modalidad: SecopChartItem[];
  por_tipo: SecopChartItem[];
  por_estado: SecopChartItem[];
  valor_por_modalidad: SecopChartItem[];
  serie_mensual: { mes: string; valor: number }[];
  top_proveedores_valor: {
    proveedor: string;
    documento: string;
    valor: number;
    count: number;
  }[];
  origen_recursos: SecopChartItem[];
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
  nit_secop_i: string | null;
  nit_secop_ii: string | null;
  nits_resueltos_i: string[];
  nits_resueltos_ii: string[];
  anios_disponibles: number[];
  anio_default: number;
  tendencia_secop1: { anio: number; total: number }[];
  tendencia_secop2_contratos: { anio: number; total: number }[];
  tendencia_secop2_procesos: { anio: number; total: number }[];
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

export interface SecopResumen {
  anio: number;
  kpis: SecopKpis;
  comparativo: {
    delta_valor_total: number | null;
    delta_total_contratos: number | null;
  } | null;
  secop1: { meta: Record<string, unknown>; kpis: SecopKpis };
  secop2: { meta: Record<string, unknown>; kpis: SecopKpis; analitica: SecopAnalytics };
  alertas_criticas: SecopAlert[];
  total_alertas: number;
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
      .post<{ anio: number; analisis: string; contexto: Record<string, unknown> }>(
        "/secop/ai/analisis/",
        { anio },
        { timeout: SECOP_TIMEOUT_MS },
      )
      .then((r) => r.data),

  aiCopilot: (message: string, anio: number, history?: { role: string; content: string }[]) =>
    api
      .post<{ reply: string; sources: { tool: string; preview: string }[] }>(
        "/secop/ai/copilot/",
        { message, anio, history },
        { timeout: SECOP_TIMEOUT_MS },
      )
      .then((r) => r.data),

  aiContrato: (fuente: string, id: string, anio: number) =>
    api
      .post<{ resumen: string; registro: SecopRecord }>(
        "/secop/ai/contrato/",
        { fuente, id, anio },
        { timeout: SECOP_TIMEOUT_MS },
      )
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
