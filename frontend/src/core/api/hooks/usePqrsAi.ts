import { useQuery } from "@tanstack/react-query";
import { pqrsAiApi } from "@/core/api/ai/pqrs";
import { sharedAiApi } from "@/core/api/ai/shared";

export const pqrsAiKeys = {
  insights: () => ["pqrs", "ai", "insights"] as const,
  compliance: () => ["pqrs", "ai", "compliance"] as const,
  alerts: (unread?: boolean) => ["pqrs", "ai", "alerts", unread] as const,
};

export function usePqrsInsights(enabled = true) {
  return useQuery({
    queryKey: pqrsAiKeys.insights(),
    queryFn: () => pqrsAiApi.insights(),
    enabled,
    staleTime: 5 * 60 * 1000,
  });
}

export function usePqrsCompliance(enabled = true) {
  return useQuery({
    queryKey: pqrsAiKeys.compliance(),
    queryFn: () => pqrsAiApi.compliance(),
    enabled,
    staleTime: 2 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}

export function usePqrsAlerts(unread = true, enabled = true) {
  return useQuery({
    queryKey: pqrsAiKeys.alerts(unread),
    queryFn: () => sharedAiApi.alerts({ unread, module: "pqrs" }),
    enabled,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });
}
