import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { sharedAiApi } from "@/core/api/ai/shared";
import type { AIModuleKey } from "@/core/api/ai/types";

export const aiKeys = {
  alerts: (module?: AIModuleKey, unread?: boolean) => ["ai", "alerts", module, unread] as const,
  usage: () => ["ai", "usage"] as const,
  ignoredInsights: (module: AIModuleKey) => ["ai", "insights", "ignored", module] as const,
};

export function useAIAlerts(opts?: { unread?: boolean; module?: AIModuleKey; enabled?: boolean }) {
  const unread = opts?.unread ?? true;
  return useQuery({
    queryKey: aiKeys.alerts(opts?.module, unread),
    queryFn: () => sharedAiApi.alerts({ unread, module: opts?.module }),
    enabled: opts?.enabled ?? true,
  });
}

export function useDismissAlert() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => sharedAiApi.dismissAlert(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ai", "alerts"] });
      qc.invalidateQueries({ queryKey: ["pqrs", "ai", "alerts"] });
      qc.invalidateQueries({ queryKey: ["pdm", "ai", "alerts"] });
    },
  });
}

export function useIgnoredInsights(module: AIModuleKey, enabled = true) {
  return useQuery({
    queryKey: aiKeys.ignoredInsights(module),
    queryFn: () => sharedAiApi.ignoredInsights(module),
    enabled,
  });
}

export function useIgnoreInsight(module: AIModuleKey) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: { fingerprint: string; title?: string }) =>
      sharedAiApi.ignoreInsight({ module, ...payload }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: aiKeys.ignoredInsights(module) });
      qc.invalidateQueries({ queryKey: ["pqrs", "ai", "insights"] });
      qc.invalidateQueries({ queryKey: ["pdm", "ai", "insights"] });
    },
  });
}

export function useRestoreInsight(module: AIModuleKey) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (fingerprint: string) => sharedAiApi.restoreInsight(module, fingerprint),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: aiKeys.ignoredInsights(module) });
      qc.invalidateQueries({ queryKey: ["pqrs", "ai", "insights"] });
      qc.invalidateQueries({ queryKey: ["pdm", "ai", "insights"] });
    },
  });
}
