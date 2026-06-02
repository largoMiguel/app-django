import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  pdmApi,
  type PaginatedPdmProductos,
  type PdmContratosResumen,
  type PdmEjecucionProducto,
  type PdmMetaResponse,
  type PdmStatsResponse,
  type PdmStatusResponse,
} from "@/core/api/pdm";
import type { ResumenEjecucionAnual } from "@/features/pdm/pdmUtils";

export const pdmKeys = {
  all: ["pdm"] as const,
  status: (slug: string) => [...pdmKeys.all, "status", slug] as const,
  meta: (slug: string) => [...pdmKeys.all, "meta", slug] as const,
  stats: (slug: string, anio?: number) => [...pdmKeys.all, "stats", slug, anio] as const,
  productos: (slug: string, params: Record<string, string | number | undefined>) =>
    [...pdmKeys.all, "productos", slug, params] as const,
  producto: (slug: string, codigo: string, anio?: number) =>
    [...pdmKeys.all, "producto", slug, codigo, anio] as const,
  ejecucionProducto: (codigo: string, anio?: number) =>
    [...pdmKeys.all, "ejecucion-producto", codigo, anio] as const,
  contratos: (slug: string, anio?: number, codigo?: string) =>
    [...pdmKeys.all, "contratos", slug, anio, codigo] as const,
  ejecucionAnual: () => [...pdmKeys.all, "ejecucion-anual"] as const,
};

const META_STALE_MS = 5 * 60_000;

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
    staleTime: META_STALE_MS,
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

export function usePdmProductoDetail(slug: string, codigo: string, anio?: number, enabled = true) {
  return useQuery({
    queryKey: pdmKeys.producto(slug, codigo, anio),
    queryFn: () => pdmApi.productoDetail(slug, codigo, anio),
    enabled: Boolean(slug) && Boolean(codigo) && enabled,
  });
}

export function usePdmEjecucionProducto(codigo: string, anio?: number, enabled = true) {
  return useQuery<PdmEjecucionProducto>({
    queryKey: pdmKeys.ejecucionProducto(codigo, anio),
    queryFn: () => pdmApi.ejecucionPorProducto(codigo, anio),
    enabled: Boolean(codigo) && enabled,
    retry: false,
  });
}

export function usePdmContratos(slug: string, anio?: number, codigo?: string, enabled = true) {
  return useQuery<PdmContratosResumen>({
    queryKey: pdmKeys.contratos(slug, anio, codigo),
    queryFn: async () => {
      const data = await pdmApi.contratos(slug, anio, codigo);
      return { ...data, anio: data.anio ?? anio ?? 0 };
    },
    enabled: Boolean(slug) && enabled,
  });
}

export function usePdmResumenEjecucionAnual(enabled = true) {
  return useQuery<ResumenEjecucionAnual | null>({
    queryKey: pdmKeys.ejecucionAnual(),
    queryFn: () => pdmApi.resumenEjecucionAnualEntidad(),
    enabled,
  });
}

export function useInvalidatePdm() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: pdmKeys.all });
}

export function useInvalidatePdmQueries() {
  const qc = useQueryClient();
  return {
    invalidateAll: () => qc.invalidateQueries({ queryKey: pdmKeys.all }),
    invalidateStatus: (slug: string) => qc.invalidateQueries({ queryKey: pdmKeys.status(slug) }),
    invalidateMeta: (slug: string) => qc.invalidateQueries({ queryKey: pdmKeys.meta(slug) }),
    invalidateStats: (slug: string, anio?: number) =>
      qc.invalidateQueries({ queryKey: pdmKeys.stats(slug, anio) }),
    invalidateProductos: (slug: string) =>
      qc.invalidateQueries({ queryKey: [...pdmKeys.all, "productos", slug] }),
    invalidateProducto: (slug: string, codigo: string, anio?: number) =>
      qc.invalidateQueries({ queryKey: pdmKeys.producto(slug, codigo, anio) }),
    invalidateEjecucionAnual: () => qc.invalidateQueries({ queryKey: pdmKeys.ejecucionAnual() }),
    invalidateEjecucionProducto: (codigo: string, anio?: number) =>
      qc.invalidateQueries({ queryKey: pdmKeys.ejecucionProducto(codigo, anio) }),
    invalidateContratos: (slug: string, anio?: number, codigo?: string) =>
      qc.invalidateQueries({ queryKey: pdmKeys.contratos(slug, anio, codigo) }),
    afterActividadMutation: (slug: string, codigo: string, anio: number) => {
      void qc.invalidateQueries({ queryKey: pdmKeys.producto(slug, codigo, anio) });
      void qc.invalidateQueries({ queryKey: pdmKeys.stats(slug, anio) });
      void qc.invalidateQueries({ queryKey: [...pdmKeys.all, "productos", slug] });
    },
    afterUploadPlan: (_slug: string) => {
      void qc.invalidateQueries({ queryKey: pdmKeys.all });
    },
    afterUploadEjecucion: () => {
      void qc.invalidateQueries({ queryKey: pdmKeys.ejecucionAnual() });
      void qc.invalidateQueries({ queryKey: [...pdmKeys.all, "ejecucion-producto"] });
    },
    afterAsignarResponsable: (slug: string) => {
      void qc.invalidateQueries({ queryKey: [...pdmKeys.all, "productos", slug] });
    },
  };
}
