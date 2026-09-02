import { api } from "./client";

function downloadBlob(data: Blob, filename: string) {
  const url = URL.createObjectURL(data);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

export interface GdStats {
  instrumentos_total: number;
  instrumentos_vigentes: number;
  por_estado_instrumento: Record<string, number>;
  expedientes_total: number;
  expedientes_abiertos: number;
  por_etapa: Record<string, number>;
  series_total: number;
  fuid_registros: number;
  transferencias_pendientes: number;
  retencion_vencida: number;
  trd_vigente: boolean;
  ccd_vigente: boolean;
  pgd_vigente: boolean;
  procesos_pgd: { key: string; label: string; desc: string; avance: number }[];
}

export interface InstrumentoArchivistico {
  id: number;
  tipo: string;
  tipo_label: string;
  vigencia: number;
  version: string;
  estado: string;
  estado_label: string;
  titulo: string;
  codigo_rusd: string;
  nombre_archivo: string;
  archivo_url: string | null;
  size: number;
  fecha_convalidacion: string | null;
  updated_at: string;
}

export interface SerieDocumental {
  id: number;
  codigo: string;
  nombre: string;
  es_subserie: boolean;
  parent: number | null;
  parent_codigo: string;
  unidad: number | null;
  unidad_nombre: string;
  tipos_documentales: string[];
  retencion_gestion_anios: number;
  retencion_central_anios: number;
  disposicion_final: string;
  disposicion_label: string;
  procedimiento: string;
  instrumento: number | null;
  is_active: boolean;
}

export interface ExpedienteListItem {
  id: number;
  codigo: string;
  titulo: string;
  serie: number;
  serie_codigo: string;
  serie_nombre: string;
  secretaria: number | null;
  secretaria_nombre: string;
  etapa: string;
  etapa_label: string;
  estado: string;
  estado_label: string;
  soporte: string;
  fecha_extrema_inicial: string | null;
  fecha_extrema_final: string | null;
  folios: number;
  documentos_count: number;
  updated_at: string;
}

export interface DocumentoExpediente {
  id: number;
  nombre: string;
  tipo_documental: string;
  archivo_url: string | null;
  content_type: string;
  size: number;
  sha256: string;
  version: number;
  folio_inicio: number | null;
  folio_fin: number | null;
  fecha_documento: string | null;
  uploaded_by_nombre: string;
  created_at: string;
}

export interface ExpedienteDetail extends ExpedienteListItem {
  unidad: number | null;
  responsable: number | null;
  notas: string;
  documentos: DocumentoExpediente[];
  created_at: string;
}

export interface FuidRegistro {
  id: number;
  expediente: number | null;
  expediente_codigo: string;
  codigo: string;
  serie_nombre: string;
  subserie_nombre: string;
  unidad_documental: string;
  fecha_inicial: string | null;
  fecha_final: string | null;
  soporte_fisico: boolean;
  soporte_electronico: boolean;
  caja: string;
  carpeta: string;
  tomo: string;
  folios: number;
  ubicacion: string;
  notas: string;
  created_at: string;
}

export interface Transferencia {
  id: number;
  tipo: string;
  tipo_label: string;
  estado: string;
  estado_label: string;
  acta: string;
  expedientes_count: number;
  ejecutada_at: string | null;
  notas: string;
  created_at: string;
}

export interface Paginated<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

function qs(params: Record<string, string | number | boolean | undefined>): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== "") sp.set(k, String(v));
  }
  const s = sp.toString();
  return s ? `?${s}` : "";
}

export const gestionDocumentalApi = {
  stats: () => api.get<GdStats>("/gestion-documental/stats/").then((r) => r.data),

  instrumentos: {
    list: (params: Record<string, string | number | undefined> = {}) =>
      api.get<Paginated<InstrumentoArchivistico>>(`/gestion-documental/instrumentos/${qs(params)}`).then((r) => r.data),
    create: (data: Partial<InstrumentoArchivistico>) =>
      api.post<InstrumentoArchivistico>("/gestion-documental/instrumentos/", data).then((r) => r.data),
    update: (id: number, data: Partial<InstrumentoArchivistico>) =>
      api.patch<InstrumentoArchivistico>(`/gestion-documental/instrumentos/${id}/`, data).then((r) => r.data),
    uploadArchivo: (id: number, file: File) => {
      const fd = new FormData();
      fd.append("archivo", file);
      return api
        .post<InstrumentoArchivistico>(`/gestion-documental/instrumentos/${id}/archivo/`, fd)
        .then((r) => r.data);
    },
  },

  series: {
    list: (params: Record<string, string | number | boolean | undefined> = {}) =>
      api.get<Paginated<SerieDocumental>>(`/gestion-documental/series/${qs(params)}`).then((r) => r.data),
    create: (data: Partial<SerieDocumental>) =>
      api.post<SerieDocumental>("/gestion-documental/series/", data).then((r) => r.data),
    update: (id: number, data: Partial<SerieDocumental>) =>
      api.patch<SerieDocumental>(`/gestion-documental/series/${id}/`, data).then((r) => r.data),
    importar: (file: File, instrumentoId?: number) => {
      const fd = new FormData();
      fd.append("archivo", file);
      if (instrumentoId) fd.append("instrumento_id", String(instrumentoId));
      return api.post<{ created: number; updated: number }>("/gestion-documental/series/importar/", fd).then((r) => r.data);
    },
  },

  expedientes: {
    list: (params: Record<string, string | number | undefined> = {}) =>
      api.get<Paginated<ExpedienteListItem>>(`/gestion-documental/expedientes/${qs(params)}`).then((r) => r.data),
    get: (id: number) =>
      api.get<ExpedienteDetail>(`/gestion-documental/expedientes/${id}/`).then((r) => r.data),
    create: (data: Record<string, unknown>) =>
      api.post<ExpedienteDetail>("/gestion-documental/expedientes/", data).then((r) => r.data),
    uploadDocumento: (id: number, file: File, meta?: Record<string, string>) => {
      const fd = new FormData();
      fd.append("archivo", file);
      if (meta) {
        for (const [k, v] of Object.entries(meta)) fd.append(k, v);
      }
      return api
        .post<DocumentoExpediente>(`/gestion-documental/expedientes/${id}/documentos/`, fd)
        .then((r) => r.data);
    },
    cerrar: (id: number) =>
      api.post<ExpedienteDetail>(`/gestion-documental/expedientes/${id}/cerrar/`).then((r) => r.data),
  },

  fuid: {
    list: (params: Record<string, string | number | undefined> = {}) =>
      api.get<Paginated<FuidRegistro>>(`/gestion-documental/fuid/${qs(params)}`).then((r) => r.data),
    generarDesdeExpedientes: () =>
      api.post<{ created: number }>("/gestion-documental/fuid/generar-desde-expedientes/").then((r) => r.data),
  },

  transferencias: {
    list: (params: Record<string, string | number | undefined> = {}) =>
      api.get<Paginated<Transferencia>>(`/gestion-documental/transferencias/${qs(params)}`).then((r) => r.data),
    create: (data: { tipo: string; acta?: string; notas?: string; expediente_ids?: number[] }) =>
      api.post<Transferencia>("/gestion-documental/transferencias/", data).then((r) => r.data),
    ejecutar: (id: number) =>
      api.post<Transferencia>(`/gestion-documental/transferencias/${id}/ejecutar/`).then((r) => r.data),
  },

  exportExcel: async (tipo: "fuid" | "trd" | "transferencias") => {
    const resp = await api.get(`/gestion-documental/export/${qs({ tipo })}`, { responseType: "blob" });
    const filename =
      tipo === "trd" ? "TRD.xlsx" : tipo === "transferencias" ? "Transferencias.xlsx" : "FUID.xlsx";
    downloadBlob(resp.data as Blob, filename);
  },
};
