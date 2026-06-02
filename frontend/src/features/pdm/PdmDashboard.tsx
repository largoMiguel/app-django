import { AlertTriangle, BarChart3, Box, Calendar, DollarSign, GitBranch, Layers, PieChart } from "lucide-react";
import {
  ANIOS_PDM,
  formatearMoneda,
  getEjecucionDefinitivoAnio,
  getEjecucionTotalDefinitivo,
  PDM_SIN_PRODUCTO_EN_PLAN,
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
  const ejecucionPorLinea = (resumenEjecucion?.ejecucion_por_linea ?? []).filter(
    (item) => item.linea !== PDM_SIN_PRODUCTO_EN_PLAN,
  );
  const ejecucionPorSector = (resumenEjecucion?.ejecucion_por_sector ?? []).filter(
    (item) => item.sector !== PDM_SIN_PRODUCTO_EN_PLAN,
  );
  const ejecucionSinProductoPlan = resumenEjecucion?.ejecucion_sin_producto_plan ?? [];
  const ejecucionChartTotal = ejecucionPorLinea.reduce((sum, item) => sum + item.total, 0);
  const ejecucionSectorChartTotal = ejecucionPorSector.reduce((sum, item) => sum + item.total, 0);

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

      {ejecucionSinProductoPlan.length > 0 && (
        <PdmCard title="Ejecución sin producto en el Plan Indicativo" icon={<AlertTriangle size={16} className="text-amber-600" />}>
          <p className="mb-3 text-sm text-slate-600">
            Estos códigos tienen ejecución cargada pero <strong>no existen en el Plan Indicativo</strong>.
          </p>
          <div className="overflow-x-auto rounded-lg border border-amber-100">
            <table className="min-w-full text-sm">
              <thead className="bg-amber-50 text-left text-xs uppercase tracking-wide text-amber-900">
                <tr>
                  <th className="px-4 py-2 font-semibold">Código producto (Excel)</th>
                  <th className="px-4 py-2 text-right font-semibold">Pto. definitivo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-amber-50">
                {ejecucionSinProductoPlan.map((item) => (
                  <tr key={item.codigo_producto}>
                    <td className="px-4 py-2 font-mono text-slate-800">{item.codigo_producto}</td>
                    <td className="px-4 py-2 text-right font-semibold text-slate-900">
                      {formatearMoneda(item.pto_definitivo)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </PdmCard>
      )}

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
                    value={ejecucionChartTotal ? (item.total / ejecucionChartTotal) * 100 : 0}
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
              ejecucionPorSector.map((item) => (
                <div key={item.sector}>
                  <div className="mb-1 flex justify-between gap-2 text-sm">
                    <span className="truncate text-slate-700" title={item.sector}>
                      {item.sector}
                    </span>
                    <strong className="shrink-0 text-slate-900">{formatearMoneda(item.total)}</strong>
                  </div>
                  <PdmProgressBar
                    value={ejecucionSectorChartTotal ? (item.total / ejecucionSectorChartTotal) * 100 : 0}
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
