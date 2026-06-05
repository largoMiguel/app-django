import axios from "axios";
import { PUBLIC_API_BASE } from "@/core/api/client";

const publicApi = axios.create({
  baseURL: `${PUBLIC_API_BASE}/api/v1/public`,
  headers: { "Content-Type": "application/json" },
  timeout: 120_000,
});

export interface PdmChatSource {
  tipo: string;
  titulo: string;
  url: string | null;
  codigo_producto?: string;
}

export interface PdmChatInfo {
  entity_id: number;
  name: string;
  slug: string;
  logo_url: string | null;
  plan_name: string | null;
  intro: string;
  sugerencias: string[];
  enabled: boolean;
  chat_url: string;
}

export interface PdmChatResponse {
  conversation_id: string;
  reply: string;
  sources: PdmChatSource[];
}

export interface PdmChatAnalytics {
  total_conversaciones: number;
  total_mensajes: number;
  promedio_mensajes_por_conversacion: number;
  conversaciones_por_dia: { fecha: string; conversaciones: number }[];
  ultimas_preguntas: { pregunta: string; fecha: string }[];
  periodo_dias: number;
}

export const pdmChatPublicApi = {
  getInfo: (slug: string) =>
    publicApi.get<PdmChatInfo>(`/entity/${slug}/pdm-chat/info/`).then((r) => r.data),

  sendMessage: (slug: string, payload: { message: string; conversation_id?: string }) =>
    publicApi
      .post<PdmChatResponse>(`/entity/${slug}/pdm-chat/`, payload)
      .then((r) => r.data),
};
