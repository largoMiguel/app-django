import axios from "axios";
import { PUBLIC_API_BASE } from "@/core/api/client";

const publicApi = axios.create({
  baseURL: `${PUBLIC_API_BASE}/api/v1/public`,
  headers: { "Content-Type": "application/json" },
});

export interface EntityPublicInfo {
  id: number;
  name: string;
  slug: string;
  logo_url: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  description: string | null;
  horario_atencion: string | null;
  enable_pqrs: boolean;
}

export interface PQRSPublicResult {
  numero_radicado: string;
  estado: string;
  fecha_solicitud: string | null;
  fecha_vencimiento: string | null;
  tipo_solicitud: string;
  asunto: string;
  entity_name: string;
  datos_extraidos?: {
    nombre: string | null;
    email: string | null;
    tipo: string;
  };
}

export const publicPqrsApi = {
  getEntity: (slug: string) =>
    publicApi.get<EntityPublicInfo>(`/entity/${slug}/`).then((r) => r.data),

  createManual: (slug: string, formData: FormData) =>
    publicApi
      .post<PQRSPublicResult>(`/entity/${slug}/pqrs/`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      })
      .then((r) => r.data),

  createAuto: (slug: string, formData: FormData) =>
    publicApi
      .post<PQRSPublicResult>(`/entity/${slug}/pqrs/auto/`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      })
      .then((r) => r.data),
};
