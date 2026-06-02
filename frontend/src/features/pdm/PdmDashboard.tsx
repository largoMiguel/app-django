import { BarChart3, Box, Calendar, DollarSign, GitBranch, Layers, PieChart } from "lucide-react";
import {
  ANIOS_PDM,
  formatearMoneda,
  getEjecucionDefinitivoAnio,
  getEjecucionTotalDefinitivo,
  type EstadisticasPdm,
  type ResumenEjecucionAnual,
} from "@/features/pdm/pdmUtils";
import { PdmCard, PdmProgressBar, PdmStatCard } from "@/features/pdm/components/PdmUi";

interface PdmDashboardProps {
  estadisticas: EstadisticasPdm;
  resumenEjecucion: ResumenEjecucionAnual | null;
  onVerProductos: () => void;
}

export default function PdmDashboard({ estadisticas, resumenEjecucion, onVerProductos }: PdmDashboardProps) {
  const yearColors = ["blue", "info", "warning", "success"] as const;
  const ejecucionTotal = getEjecucionTotalDefinitivo(resumenEjecucion);
  const ejecucionPorLinea = resumenEjecucion?.ejecucion_por_linea ?? [];
  const ejecucionPorSector = resumenEjecucion?.ejecucion_por_sector ?? [];

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <PdmStatCard
          label="Líneas Estratégicas"
          value={estadisticas.total_lineas_estrategicas}
          icon={<Layers size={24} className="text-blue-600" />}
          onClick={onVerProductos}
        />
        <PdmStatCard
          label="Productos"
          value={estadisticas.total_productos}
          icon={<Box size={24} className="text-cyan-600" />}
          onClick={onVerProductos}
        />
        <PdmStatCard
          label="Iniciativas SGR"
          value={estadisticas.total_iniciativas_sgr}
          icon={<GitBranch size={24} className="text-amber-600" />}
          onClick={onVerProductos}
        />
        <PdmStatCard
          label="Presupuesto Total (Ejecución)"
          value={formatearMoneda(getEjecucionTotalDefinitivo(resumenEjecucion))}
          icon={<DollarSign size={24} className="text-emerald-600" />}
          onClick={onVerProductos}
        />
      </div>

      <PdmCard title="Presupuesto por Año (Cuatrienio)" icon={<Calendar size={16} />}>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {ANIOS_PDM.map((anio, idx) => {
            const total = estadisticas.presupuestoPorAnio[`anio${anio}` as keyof typeof estadisticas.presupuestoPorAnio];
            const pct = estadisticas.presupuesto_total ? (total / estadisticas.presupuesto_total) * 100 : 0;
            return (
              <div key={anio} className="rounded-lg border border-slate-100 bg-slate-50/50 p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{anio}</p>
                <p className="mt-1 text-lg font-bold text-slate-900">{formatearMoneda(total)}</p>
                <PdmProgressBar value={pct} tone={yearColors[idx]} showLabel={false} />
              </div>
            );
          })}
        </div>
      </PdmCard>

      <PdmCard title="Ejecución por Año (Cuatrienio)">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {ANIOS_PDM.map((anio, idx) => {
            const definitivo = getEjecucionDefinitivoAnio(resumenEjecucion, anio);
            const total = getEjecucionTotalDefinitivo(resumenEjecucion);
            const pct = total ? (definitivo / total) * 100 : 0;
            return (
              <div key={anio} className="rounded-lg border border-slate-100 bg-slate-50/50 p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{anio}</p>
                <p className="mt-1 text-lg font-bold text-slate-900">{formatearMoneda(definitivo)}</p>
                <PdmProgressBar value={pct} tone={yearColors[idx]} showLabel={false} />
              </div>
            );
          })}
        </div>
      </PdmCard>

      <div className="grid gap-6 lg:grid-cols-2">
        <PdmCard title="Ejecución por Línea Estratégica (Cuatrienio)" icon={<PieChart size={16} />}>
          <div className="max-h-80 space-y-3 overflow-y-auto pr-1">
            {ejecucionPorLinea.length === 0 ? (
              <p className="py-6 text-center text-sm text-slate-500">Sin datos de ejecución por línea estratégica.</p>
            ) : (
              ejecucionPorLinea.map((item) => (
                <div key={item.linea}>
                  <div className="mb-1 flex justify-between gap-2 text-sm">
                    <span className="truncate text-slate-700" title={item.linea}>
                      {item.linea}
                    </span>
                    <strong className="shrink-0 text-slate-900">{formatearMoneda(item.total)}</strong>
                  </div>
                  <PdmProgressBar
                    value={ejecucionTotal ? (item.total / ejecucionTotal) * 100 : 0}
                    tone="blue"
                    showLabel={false}
                  />
                </div>
              ))
            )}
          </div>
        </PdmCard>
        <PdmCard title="Ejecución por Sector (Cuatrienio)" icon={<BarChart3 size={16} />}>
          <div className="max-h-80 space-y-3 overflow-y-auto pr-1">
            {ejecucionPorSector.length === 0 ? (
              <p className="py-6 text-center text-sm text-slate-500">Sin datos de ejecución por sector.</p>
            ) : (
              ejecucionPorSector.slice(0, 12).map((item) => (
                <div key={item.sector}>
                  <div className="mb-1 flex justify-between gap-2 text-sm">
                    <span className="truncate text-slate-700" title={item.sector}>
                      {item.sector}
                    </span>
                    <strong className="shrink-0 text-slate-900">{formatearMoneda(item.total)}</strong>
                  </div>
                  <PdmProgressBar
                    value={ejecucionTotal ? (item.total / ejecucionTotal) * 100 : 0}
                    tone="success"
                    showLabel={false}
                  />
                </div>
              ))
            )}
          </div>
        </PdmCard>
      </div>
    </div>
  );
}
