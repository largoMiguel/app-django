import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  pdmApi,
  type PaginatedPdmProductos,
  type PdmMetaResponse,
  type PdmStatsResponse,
  type PdmStatusResponse,
} from "@/core/api/pdm";

export const pdmKeys = {
  all: ["pdm"] as const,
  status: (slug: string) => [...pdmKeys.all, "status", slug] as const,
  meta: (slug: string) => [...pdmKeys.all, "meta", slug] as const,
  stats: (slug: string, anio?: number) => [...pdmKeys.all, "stats", slug, anio] as const,
  productos: (slug: string, params: Record<string, string | number | undefined>) =>
    [...pdmKeys.all, "productos", slug, params] as const,
  producto: (slug: string, codigo: string, anio?: number) =>
    [...pdmKeys.all, "producto", slug, codigo, anio] as const,
};

export function usePdmStatus(slug: string, enabled = true) {
  return useQuery<PdmStatusResponse>({
    queryKey: pdmKeys.status(slug),
    queryFn: () => pdmApi.status(slug),
    enabled: Boolean(slug) && enabled,
  });
}

export function usePdmMeta(slug: string, enabled = true) {
  return useQuery<PdmMetaResponse>({
    queryKey: pdmKeys.meta(slug),
    queryFn: () => pdmApi.meta(slug),
    enabled: Boolean(slug) && enabled,
  });
}

export function usePdmStats(slug: string, anio?: number, enabled = true) {
  return useQuery<PdmStatsResponse>({
    queryKey: pdmKeys.stats(slug, anio),
    queryFn: () => pdmApi.stats(slug, anio),
    enabled: Boolean(slug) && enabled,
  });
}

export function usePdmProductos(
  slug: string,
  params: Record<string, string | number | undefined>,
  enabled = true,
) {
  return useQuery<PaginatedPdmProductos>({
    queryKey: pdmKeys.productos(slug, params),
    queryFn: () => pdmApi.listProductos(slug, params),
    enabled: Boolean(slug) && enabled,
  });
}

export function useInvalidatePdm() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: pdmKeys.all });
}
