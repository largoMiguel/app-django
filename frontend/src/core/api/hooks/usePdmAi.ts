import { useQuery } from "@tanstack/react-query";
import { pdmAiApi } from "@/core/api/ai/pdm";
import { sharedAiApi } from "@/core/api/ai/shared";

export const pdmAiKeys = {
  insights: (slug: string, anio?: number) => ["pdm", "ai", "insights", slug, anio] as const,
  anomalies: (slug: string, anio?: number) => ["pdm", "ai", "anomalies", slug, anio] as const,
  alerts: (unread?: boolean) => ["pdm", "ai", "alerts", unread] as const,
};

export function usePdmInsights(slug: string, anio?: number, enabled = true) {
  return useQuery({
    queryKey: pdmAiKeys.insights(slug, anio),
    queryFn: () => pdmAiApi.insights(slug, anio),
    enabled: Boolean(slug) && enabled,
    staleTime: 5 * 60 * 1000,
  });
}

export function usePdmAnomalies(slug: string, anio?: number, enabled = true) {
  return useQuery({
    queryKey: pdmAiKeys.anomalies(slug, anio),
    queryFn: () => pdmAiApi.anomalies(slug, anio),
    enabled: Boolean(slug) && enabled,
    staleTime: 5 * 60 * 1000,
  });
}

export function usePdmAlerts(unread = true, enabled = true) {
  return useQuery({
    queryKey: pdmAiKeys.alerts(unread),
    queryFn: () => sharedAiApi.alerts({ unread, module: "pdm" }),
    enabled,
  });
}
