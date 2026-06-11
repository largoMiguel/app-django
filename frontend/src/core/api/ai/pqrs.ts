import { api } from "@/core/api/client";
import type {
  AIInsight,
  ComplianceStats,
  CopilotResponse,
  PQRSDraftResponse,
  PQRSStatusLookup,
  SemanticSearchResult,
  SLARisk,
} from "./types";

/** APIs de IA exclusivas del módulo PQRS. */
export const pqrsAiApi = {
  insights: () =>
    api.get<{ insights: AIInsight[]; stats: ComplianceStats; sla_risks_count?: number }>(
      "/ai/pqrs/insights/",
    ).then((r) => r.data),

  compliance: () =>
    api.get<{ compliance: ComplianceStats; sla_risks: SLARisk[] }>(
      "/ai/pqrs/compliance/",
    ).then((r) => r.data),

  draft: (pqrsId: number, extraContext?: string) =>
    api.post<PQRSDraftResponse>(`/pqrs/${pqrsId}/draft-respuesta/`, {
      extra_context: extraContext,
    }).then((r) => r.data),

  search: (query: string, contentTypes?: string[], limit = 10) =>
    api.post<{
      results: SemanticSearchResult[];
      indexed_count?: number;
      search_mode?: "semantic" | "keyword" | "none";
      hint?: string | null;
    }>("/ai/search/", {
      query,
      content_types: contentTypes ?? ["pqrs_descripcion", "pqrs_respuesta"],
      limit,
    }).then((r) => r.data),

  statusLookup: (slug: string, radicado: string) =>
    api.get<PQRSStatusLookup>(`/public/entity/${slug}/pqrs/status/`, {
      params: { radicado },
    }).then((r) => r.data),

  globalCopilot: (message: string, conversationId?: number) =>
    api.post<CopilotResponse>("/ai/copilot/global/", {
      message,
      conversation_id: conversationId,
    }).then((r) => r.data),
};
