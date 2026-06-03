import { useMemo, useState } from "react";
import {
  Building2,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  FolderKanban,
  Package,
  Search,
} from "lucide-react";
import type { PdmProyecto, PdmProyectosResponse } from "@/core/api/pdm";
import {
  PdmAlert,
  PdmBadge,
  PdmCard,
  PdmInput,
  PdmLoadingOverlay,
  PdmProgressBar,
  PdmStatCard,
} from "@/features/pdm/components/PdmUi";
import {
  formatearMoneda,
  getColorEstadoProducto,
  getColorProgreso,
  getTextoEstadoProducto,
} from "@/features/pdm/pdmUtils";

interface PdmProyectosViewProps {
  data: PdmProyectosResponse | undefined;
  isLoading: boolean;
  onOpenProducto: (codigo: string) => void;
}

function ProyectoAccordion({
  proyecto,
  onOpenProducto,
}: {
  proyecto: PdmProyecto;
  onOpenProducto: (codigo: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const titulo = proyecto.nombre_proyecto || `Proyecto BPIN ${proyecto.bpin}`;

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition hover:border-cyan-200">
      <button
        type="button"
        className="flex w-full flex-col gap-3 p-4 text-left sm:flex-row sm:items-center sm:justify-between sm:p-5"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
      >
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-cyan-50 text-cyan-600">
            {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <PdmBadge tone="info">{proyecto.bpin}</PdmBadge>
              {proyecto.estado && (
                <span className="inline-flex rounded-full bg-cyan-100 px-2.5 py-0.5 text-xs font-medium text-cyan-800">
                  {proyecto.estado}
                </span>
              )}
              {!proyecto.datos_abiertos_ok && (
                <span className="text-xs text-amber-600">Sin datos en datos.gov.co</span>
              )}
            </div>
            <h3 className="mt-1.5 text-base font-semibold text-slate-900 line-clamp-2">{titulo}</h3>
            {proyecto.sector && <p className="mt-0.5 text-sm text-slate-500">{proyecto.sector}</p>}
          </div>
        </div>

        <div className="flex shrink-0 flex-col gap-2 sm:w-64 sm:items-end">
          <div className="w-full sm:max-w-[220px]">
            <div className="mb-1 flex items-center justify-between text-xs text-slate-500">
              <span>Avance general</span>
              <span className="font-semibold text-slate-700">{proyecto.avance_general}%</span>
            </div>
            <PdmProgressBar value={proyecto.avance_general} tone={getColorProgreso(proyecto.avance_general)} />
          </div>
          <div className="flex flex-wrap gap-2 text-xs text-slate-600">
            <span>{proyecto.total_productos} producto(s)</span>
            {proyecto.completados > 0 && (
              <span className="text-emerald-600">{proyecto.completados} completado(s)</span>
            )}
            {proyecto.en_progreso > 0 && (
              <span className="text-blue-600">{proyecto.en_progreso} en progreso</span>
            )}
            {proyecto.pendientes > 0 && (
              <span className="text-amber-600">{proyecto.pendientes} pendiente(s)</span>
            )}
          </div>
          <p className="text-sm font-medium text-emerald-700">
            {formatearMoneda(proyecto.presupuesto_total)}
          </p>
        </div>
      </button>

      {expanded && (
        <div className="border-t border-slate-100 bg-slate-50/50 px-4 py-4 sm:px-5">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
            Productos del Plan Indicativo
          </p>
          <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
            <table className="min-w-full divide-y divide-slate-100 text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Código
                  </th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Producto
                  </th>
                  <th className="hidden px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 md:table-cell">
                    Sector
                  </th>
                  <th className="px-4 py-2.5 text-center text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Avance
                  </th>
                  <th className="px-4 py-2.5 text-center text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Estado
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {proyecto.productos.map((prod) => (
                  <tr
                    key={prod.codigo_producto}
                    className="cursor-pointer transition hover:bg-blue-50/50"
                    onClick={() => onOpenProducto(prod.codigo_producto)}
                  >
                    <td className="px-4 py-3">
                      <PdmBadge tone="secondary">{prod.codigo_producto}</PdmBadge>
                    </td>
                    <td className="max-w-xs px-4 py-3">
                      <p className="font-medium text-slate-900 line-clamp-2">{prod.nombre}</p>
                      {prod.responsable_secretaria_nombre && (
                        <p className="mt-0.5 text-xs text-slate-500">{prod.responsable_secretaria_nombre}</p>
                      )}
                    </td>
                    <td className="hidden px-4 py-3 text-slate-600 md:table-cell">
                      {prod.sector_mga || "—"}
                    </td>
                    <td className="min-w-[100px] px-4 py-3">
                      <PdmProgressBar value={prod.avance} tone={getColorProgreso(prod.avance)} />
                    </td>
                    <td className="px-4 py-3 text-center">
                      <PdmBadge tone={getColorEstadoProducto(prod.estado)}>
                        {getTextoEstadoProducto(prod.estado)}
                      </PdmBadge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

export default function PdmProyectosView({ data, isLoading, onOpenProducto }: PdmProyectosViewProps) {
  const [busqueda, setBusqueda] = useState("");

  const proyectosFiltrados = useMemo(() => {
    if (!data?.proyectos) return [];
    const q = busqueda.trim().toLowerCase();
    if (!q) return data.proyectos;
    return data.proyectos.filter(
      (p) =>
        p.bpin.toLowerCase().includes(q) ||
        (p.nombre_proyecto || "").toLowerCase().includes(q) ||
        (p.sector || "").toLowerCase().includes(q),
    );
  }, [data?.proyectos, busqueda]);

  if (isLoading) {
    return <PdmLoadingOverlay message="Cargando proyectos BPIN..." />;
  }

  if (!data) {
    return (
      <PdmAlert tone="error">No se pudieron cargar los proyectos. Intente nuevamente.</PdmAlert>
    );
  }

  return (
    <div className="space-y-6">
      {data.datos_abiertos_error && (
        <PdmAlert tone="warning">
          <p>
            Algunos datos de proyectos no pudieron consultarse en datos.gov.co: {data.datos_abiertos_error}.
          </p>
          {data.portal_url && (
            <p className="mt-2">
              <a
                href={data.portal_url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 font-medium text-cyan-700 underline"
              >
                Ver dataset BPIN en datos.gov.co
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </p>
          )}
        </PdmAlert>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <PdmStatCard
          label="Proyectos (BPIN)"
          value={data.total_proyectos}
          icon={<FolderKanban className="h-5 w-5 text-cyan-600" />}
          accent="cyan"
        />
        <PdmStatCard
          label="Productos con BPIN"
          value={data.total_productos_con_bpin}
          icon={<Package className="h-5 w-5 text-blue-600" />}
          accent="blue"
        />
        <PdmStatCard
          label="Productos sin BPIN"
          value={data.productos_sin_bpin}
          hint="No agrupados en esta vista"
          icon={<Building2 className="h-5 w-5 text-amber-600" />}
          accent="amber"
        />
        <PdmStatCard
          label="Avance promedio"
          value={`${data.avance_promedio}%`}
          icon={<FolderKanban className="h-5 w-5 text-emerald-600" />}
          accent="emerald"
        />
      </div>

      <PdmCard title="Proyectos de Inversión (BPIN)">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-slate-600">
            Proyectos unificados por código BPIN con sus productos del Plan Indicativo. Haga clic en un
            producto para ver su detalle.
          </p>
          <div className="relative w-full sm:max-w-xs">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <PdmInput
              type="search"
              placeholder="Buscar BPIN, nombre o sector..."
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>

        {data.total_proyectos === 0 ? (
          <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-6 py-12 text-center">
            <FolderKanban className="mx-auto h-12 w-12 text-slate-300" />
            <p className="mt-4 text-base font-medium text-slate-700">No hay productos con BPIN</p>
            <p className="mt-1 text-sm text-slate-500">
              Los productos del Plan Indicativo deben tener un código BPIN asignado para aparecer aquí.
            </p>
          </div>
        ) : proyectosFiltrados.length === 0 ? (
          <div className="rounded-lg border border-slate-200 bg-slate-50 px-6 py-8 text-center text-sm text-slate-600">
            No se encontraron proyectos que coincidan con &quot;{busqueda}&quot;.
          </div>
        ) : (
          <div className="space-y-3">
            {proyectosFiltrados.map((proyecto) => (
              <ProyectoAccordion
                key={proyecto.bpin}
                proyecto={proyecto}
                onOpenProducto={onOpenProducto}
              />
            ))}
          </div>
        )}
      </PdmCard>
    </div>
  );
}
