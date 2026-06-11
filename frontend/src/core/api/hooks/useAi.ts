import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { aiApi } from "@/core/api/ai";

export const aiKeys = {
  alerts: (unread?: boolean) => ["ai", "alerts", unread] as const,
  compliance: () => ["ai", "pqrs-compliance"] as const,
  pqrsInsights: () => ["ai", "pqrs-insights"] as const,
  pdmInsights: (slug: string, anio?: number) => ["ai", "pdm-insights", slug, anio] as const,
  usage: () => ["ai", "usage"] as const,
};

export function useAIAlerts(unread = true) {
  return useQuery({
    queryKey: aiKeys.alerts(unread),
    queryFn: () => aiApi.alerts(unread),
  });
}

export function usePqrsCompliance() {
  return useQuery({
    queryKey: aiKeys.compliance(),
    queryFn: () => aiApi.pqrsCompliance(),
  });
}

export function useDismissAlert() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => aiApi.dismissAlert(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["ai", "alerts"] }),
  });
}
