import { useLocation, useParams } from "react-router-dom";

export type PdmRouteSegment = "dashboard" | "productos" | "detalle" | "analisis" | "proyectos";

export function usePdmRoute(): PdmRouteSegment {
  const location = useLocation();
  const { codigo } = useParams<{ codigo?: string }>();
  const path = location.pathname;
  if (path.includes("/analisis")) return "analisis";
  if (path.includes("/proyectos")) return "proyectos";
  if (codigo) return "detalle";
  if (path.includes("/productos")) return "productos";
  return "dashboard";
}

export type PdmDetalleFrom = "proyectos" | "analisis";

export function readDetalleFrom(state: unknown): PdmDetalleFrom | undefined {
  if (!state || typeof state !== "object") return undefined;
  const from = (state as { from?: string }).from;
  if (from === "proyectos" || from === "analisis") return from;
  return undefined;
}
