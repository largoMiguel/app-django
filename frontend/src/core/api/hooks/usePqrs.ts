import { useQuery, useQueryClient } from "@tanstack/react-query";
import { pqrsApi, type PaginatedPQRS, type PQRS, type PQRSStats } from "@/core/api/pqrs";

export const pqrsKeys = {
  all: ["pqrs"] as const,
  list: (params: Record<string, string | number | boolean | undefined>) =>
    [...pqrsKeys.all, "list", params] as const,
  stats: () => [...pqrsKeys.all, "stats"] as const,
  detail: (id: number) => [...pqrsKeys.all, "detail", id] as const,
};

export function usePqrsList(
  params: Record<string, string | number | boolean | undefined>,
  options?: { enabled?: boolean },
) {
  return useQuery<PaginatedPQRS>({
    queryKey: pqrsKeys.list(params),
    queryFn: () => pqrsApi.listPaginated(params),
    enabled: options?.enabled ?? true,
  });
}

export function usePqrsStats(options?: { enabled?: boolean }) {
  return useQuery<PQRSStats>({
    queryKey: pqrsKeys.stats(),
    queryFn: () => pqrsApi.stats(),
    enabled: options?.enabled ?? true,
  });
}

export function useInvalidatePqrs() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: pqrsKeys.all });
}

/** Compat: preferir usePqrsStats o pqrsApi.fetchFiltered */
export function usePqrsListAll(
  params?: Record<string, string | number | boolean | undefined>,
  options?: { enabled?: boolean },
) {
  return useQuery<PQRS[]>({
    queryKey: [...pqrsKeys.all, "filtered", params ?? {}],
    queryFn: () => pqrsApi.fetchFiltered(params),
    enabled: options?.enabled ?? true,
  });
}
