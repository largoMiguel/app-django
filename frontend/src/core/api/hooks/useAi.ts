import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { sharedAiApi } from "@/core/api/ai/shared";
import type { AIModuleKey } from "@/core/api/ai/types";

export const aiKeys = {
  alerts: (module?: AIModuleKey, unread?: boolean) => ["ai", "alerts", module, unread] as const,
  usage: () => ["ai", "usage"] as const,
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
