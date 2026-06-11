import { api } from "@/core/api/client";
import type { AIInsight, CopilotResponse } from "./types";

/** APIs de IA exclusivas del módulo PDM. */
export const pdmAiApi = {
  insights: (slug: string, anio?: number) =>
    api.get<{
      insights: AIInsight[];
      anomalies_count: number;
      anomalies?: Array<Record<string, unknown>>;
      anio?: number;
    }>(`/ai/pdm/${slug}/insights/`, { params: anio ? { anio } : {} }).then((r) => r.data),

  anomalies: (slug: string, anio?: number) =>
    api.get(`/ai/pdm/${slug}/anomalies/`, { params: anio ? { anio } : {} }).then((r) => r.data),

  report: (slug: string, anio: number, async = false) =>
    api.post(`/ai/pdm/${slug}/report/`, { anio, async }).then((r) => r.data),

  copilot: (message: string, conversationId?: number) =>
    api.post<CopilotResponse>("/ai/copilot/pdm/", {
      message,
      conversation_id: conversationId,
    }).then((r) => r.data),
};
