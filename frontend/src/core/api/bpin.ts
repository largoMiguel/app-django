import { api } from "@/core/api/client";

export interface ProyectoBpin {
  bpin: string;
  nombreproyecto?: string;
  objetivogeneral?: string;
  estadoproyecto?: string;
  horizonte?: string;
  sector?: string;
  entidadresponsable?: string;
  valortotalproyecto?: string;
  valorvigenteproyecto?: string;
}

export interface BpinConsultaResponse {
  proyecto: ProyectoBpin | null;
  consulta_url: string;
  portal_url: string;
  detail?: string | null;
}

const DATOS_GOV_CO_API = "https://www.datos.gov.co/resource/cf9k-55fw.json";
export const DATOS_GOV_CO_PORTAL =
  "https://www.datos.gov.co/Inversi-n/Proyectos-de-Inversi-n-P-blica-BPIN/cf9k-55fw";

export function buildBpinConsultaUrl(bpin: string): string {
  return `${DATOS_GOV_CO_API}?bpin=${encodeURIComponent(bpin.trim())}&$limit=1`;
}

export async function fetchBpinDirect(bpin: string): Promise<ProyectoBpin | null> {
  const consultaUrl = buildBpinConsultaUrl(bpin);
  const response = await fetch(consultaUrl, {
    headers: { Accept: "application/json" },
  });
  if (!response.ok) {
    throw new Error(`datos.gov.co respondió HTTP ${response.status}`);
  }
  const data = (await response.json()) as ProyectoBpin[];
  return data?.[0] ?? null;
}

export const bpinApi = {
  get: async (bpin: string): Promise<BpinConsultaResponse> => {
    const trimmed = bpin.trim();
    const consulta_url = buildBpinConsultaUrl(trimmed);
    const portal_url = DATOS_GOV_CO_PORTAL;

    try {
      const resp = await api.get<BpinConsultaResponse>(`/bpin/${encodeURIComponent(trimmed)}`);
      if (resp.data.proyecto) return resp.data;
    } catch {
      // fallback directo en navegador
    }

    try {
      const proyecto = await fetchBpinDirect(trimmed);
      return {
        proyecto,
        consulta_url,
        portal_url,
        detail: proyecto ? null : "No se encontró información para este código BPIN.",
      };
    } catch (e) {
      const message = e instanceof Error ? e.message : "Error al consultar datos.gov.co";
      return {
        proyecto: null,
        consulta_url,
        portal_url,
        detail: message,
      };
    }
  },
};
