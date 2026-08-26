import { api } from "@/core/api/client";
import type { AIAlert, AIInsightIgnorado, AIModuleKey } from "./types";

export const sharedAiApi = {
  alerts: (opts?: { unread?: boolean; module?: AIModuleKey }) =>
    api.get<AIAlert[]>("/ai/alerts/", {
      params: {
        ...(opts?.unread ? { unread: "1" } : {}),
        ...(opts?.module ? { module: opts.module } : {}),
      },
    }).then((r) => r.data),

  markAlertRead: (id: number) =>
    api.post(`/ai/alerts/${id}/mark_read/`).then((r) => r.data),

  dismissAlert: (id: number) =>
    api.post(`/ai/alerts/${id}/dismiss/`).then((r) => r.data),

  ignoredInsights: (module: AIModuleKey) =>
    api.get<AIInsightIgnorado[]>("/ai/insights/ignored/", { params: { module } }).then((r) => r.data),

  ignoreInsight: (payload: { module: AIModuleKey; fingerprint: string; title?: string }) =>
    api.post("/ai/insights/ignored/", payload).then((r) => r.data),

  restoreInsight: (module: AIModuleKey, fingerprint: string) =>
    api.delete(`/ai/insights/ignored/${fingerprint}/`, { params: { module } }).then((r) => r.data),

  usage: () =>
    api.get<{ total_tokens: number; total_interactions: number; by_feature: Record<string, number> }>(
      "/ai/usage/",
    ).then((r) => r.data),
};
