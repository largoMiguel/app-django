import { api } from "@/core/api/client";

export interface AIAlert {
  id: number;
  alert_type: string;
  severity: "low" | "medium" | "high" | "critical";
  title: string;
  message: string;
  score: number | null;
  object_type: string;
  object_id: number | null;
  metadata: Record<string, unknown>;
  is_read: boolean;
  is_dismissed: boolean;
  created_at: string;
}

export interface CopilotResponse {
  reply: string;
  sources: Array<Record<string, unknown>>;
  conversation_id: number;
}

export interface PQRSDraftResponse {
  draft: string;
  tipo_solicitud: string;
  normativa: string;
  model?: string;
}

export interface ComplianceStats {
  total: number;
  respondidas: number;
  pct_en_termo: number;
  en_termo: number;
  vencidas_abiertas: number;
  avg_response_days: number | null;
  aging: Record<string, number>;
  compliance_score: number;
  by_tipo: Array<Record<string, unknown>>;
  timeline_yoy: Array<Record<string, unknown>>;
}

export interface SLARisk {
  pqrs_id: number;
  numero_radicado: string;
  asunto: string;
  estado: string;
  risk_score: number;
  factors: string[];
  assigned_to_nombre: string | null;
}

export interface AIInsight {
  title: string;
  text: string;
  severity: "low" | "medium" | "high";
  score?: number;
  source?: "ai" | "rule";
}

export interface SemanticSearchResult {
  content_type: string;
  object_id: number;
  texto: string;
  similarity: number;
  metadata: Record<string, unknown>;
}

export interface PQRSStatusLookup {
  found: boolean;
  numero_radicado?: string;
  estado?: string;
  tipo_solicitud?: string;
  asunto?: string;
  fecha_solicitud?: string;
  fecha_vencimiento?: string;
  fecha_respuesta?: string;
  tiene_respuesta?: boolean;
}

export const aiApi = {
  alerts: (unread?: boolean) =>
    api.get<AIAlert[]>("/ai/alerts/", { params: unread ? { unread: "1" } : {} }).then((r) => r.data),

  markAlertRead: (id: number) =>
    api.post(`/ai/alerts/${id}/mark_read/`).then((r) => r.data),

  dismissAlert: (id: number) =>
    api.post(`/ai/alerts/${id}/dismiss/`).then((r) => r.data),

  pdmCopilot: (message: string, conversationId?: number) =>
    api.post<CopilotResponse>("/ai/copilot/pdm/", {
      message,
      conversation_id: conversationId,
    }).then((r) => r.data),

  globalCopilot: (message: string, conversationId?: number) =>
    api.post<CopilotResponse>("/ai/copilot/global/", {
      message,
      conversation_id: conversationId,
    }).then((r) => r.data),

  pqrsDraft: (pqrsId: number, extraContext?: string) =>
    api.post<PQRSDraftResponse>(`/pqrs/${pqrsId}/draft-respuesta/`, {
      extra_context: extraContext,
    }).then((r) => r.data),

  pqrsCompliance: () =>
    api.get<{ compliance: ComplianceStats; sla_risks: SLARisk[] }>("/ai/pqrs/compliance/").then((r) => r.data),

  pqrsInsights: () =>
    api.get<{ insights: AIInsight[]; stats: ComplianceStats }>("/ai/pqrs/insights/").then((r) => r.data),

  pdmInsights: (slug: string, anio?: number) =>
    api.get<{ insights: AIInsight[]; anomalies_count: number }>(
      `/ai/pdm/${slug}/insights/`,
      { params: anio ? { anio } : {} },
    ).then((r) => r.data),

  pdmAnomalies: (slug: string, anio?: number) =>
    api.get(`/ai/pdm/${slug}/anomalies/`, { params: anio ? { anio } : {} }).then((r) => r.data),

  pdmReport: (slug: string, anio: number, async = false) =>
    api.post(`/ai/pdm/${slug}/report/`, { anio, async }).then((r) => r.data),

  semanticSearch: (query: string, contentTypes?: string[], limit = 10) =>
    api.post<{
      results: SemanticSearchResult[];
      indexed_count?: number;
      search_mode?: "semantic" | "keyword" | "none";
      hint?: string | null;
    }>("/ai/search/", {
      query,
      content_types: contentTypes,
      limit,
    }).then((r) => r.data),

  usage: () =>
    api.get<{ total_tokens: number; total_interactions: number; by_feature: Record<string, number> }>(
      "/ai/usage/",
    ).then((r) => r.data),

  pqrsStatusLookup: (slug: string, radicado: string) =>
    api.get<PQRSStatusLookup>(`/public/entity/${slug}/pqrs/status/`, {
      params: { radicado },
    }).then((r) => r.data),
};
