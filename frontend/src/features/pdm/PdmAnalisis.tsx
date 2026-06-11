import { useMemo } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  AlertTriangle,
  BarChart3,
  Box,
  DollarSign,
  Layers,
  PieChart as PieChartIcon,
  Table2,
  Target,
  TrendingUp,
} from "lucide-react";
import type { PdmAnalisisResponse } from "@/core/api/pdm";
import type { Secretaria } from "@/core/api/entities";
import { formatApiError } from "@/core/api/errors";
import { usePdmAnalisis } from "@/core/api/hooks/usePdm";
import { PdmCard, PdmProgressBar, PdmSelect, PdmStatCard } from "@/features/pdm/components/PdmUi";
import { ANIOS_PDM, formatearMoneda } from "@/features/pdm/pdmUtils";

const ESTADO_COLORS = {
  EN_PROGRESO: "#17a2b8",
  PENDIENTE: "#ffc107",
  COMPLETADO: "#28a745",
  POR_EJECUTAR: "#6c757d",
} as const;

const ODS_COLORS = [
  "#d4a017",
  "#5bc0de",
  "#fd7e14",
  "#e83e8c",
  "#8b0000",
  "#dc3545",
  "#ffc107",
  "#c82333",
  "#800020",
  "#28a745",
  "#6610f2",
  "#20c997",
  "#007bff",
  "#6f42c1",
  "#17a2b8",
  "#343a40",
  "#795548",
];

interface PdmAnalisisProps {
  slug: string;
  filtroAnio: number | "all";
  onFiltroAnio: (anio: number | "all") => void;
  filtroSecretaria: string;
  onFiltroSecretaria: (value: string) => void;
  secretarias: Secretaria[];
  isAdmin: boolean;
}

function ChartCard({
  title,
  icon,
  headerClassName,
  bodyClassName,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  headerClassName?: string;
  bodyClassName?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div
        className={`flex items-center gap-2 px-4 py-3 text-sm font-semibold text-slate-800 sm:px-5 ${headerClassName ?? "border-b border-slate-100 bg-slate-50/80"}`}
      >
        {icon}
        {title}
      </div>
      <div className={bodyClassName ?? "p-4 sm:p-5"}>{children}</div>
    </div>
  );
}

function truncateLabel(value: string, max = 28): string {
  if (value.length <= max) return value;
  return `${value.slice(0, max - 3)}...`;
}

function AnalisisContent({
  data,
  filtroAnio,
  isAdmin,
}: {
  data: PdmAnalisisResponse;
  filtroAnio: number | "all";
  isAdmin: boolean;
}) {
  const anioLabel = filtroAnio === "all" ? "todos los años" : String(filtroAnio);
  const estado = data.estado_distribucion;
  const estadoTotal = estado.total || 1;

  const pieEstadoData = useMemo(
    () =>
      [
        { name: "PENDIENTE", value: estado.pendiente, color: ESTADO_COLORS.PENDIENTE },
        { name: "EN_PROGRESO", value: estado.en_progreso, color: ESTADO_COLORS.EN_PROGRESO },
        { name: "COMPLETADO", value: estado.completado, color: ESTADO_COLORS.COMPLETADO },
        { name: "POR_EJECUTAR", value: estado.por_ejecutar, color: ESTADO_COLORS.POR_EJECUTAR },
      ].filter((d) => d.value > 0),
    [estado],
  );

  const sectorChartData = useMemo(
    () =>
      data.por_sector_estado.map((s) => ({
        ...s,
        sectorShort: truncateLabel(s.sector, 32),
      })),
    [data.por_sector_estado],
  );

  const metasChartData = useMemo(
    () =>
      data.metas_por_anio.map((m) => ({
        anio: String(m.anio),
        programada: m.programada,
        ejecutada: m.ejecutada,
        pct: m.pct,
      })),
    [data.metas_por_anio],
  );

  const odsPieData = useMemo(
    () =>
      data.por_ods.map((o, idx) => ({
        name: truncateLabel(o.ods, 32),
        fullName: o.ods,
        value: o.productos,
        color: ODS_COLORS[idx % ODS_COLORS.length],
      })),
    [data.por_ods],
  );

  const pctPagadoGlobal =
    data.presupuesto.pto_definitivo > 0
      ? Math.round((data.presupuesto.pagos / data.presupuesto.pto_definitivo) * 1000) / 10
      : 0;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <PdmStatCard
          label="Total Productos"
          value={data.total_productos}
          hint={anioLabel}
          icon={<Box size={24} className="text-cyan-600" />}
          accent="cyan"
        />
        <PdmStatCard
          label="Avance Global"
          value={`${data.avance_global}%`}
          hint={
            filtroAnio === "all"
              ? `Promedio cuatrienio · ${data.productos_al_100 ?? 0} producto(s) al 100%`
              : `Promedio del año · ${data.productos_al_100 ?? 0} producto(s) al 100%`
          }
          icon={<TrendingUp size={24} className="text-emerald-600" />}
          accent="emerald"
        />
        <PdmStatCard
          label="Presupuesto Total (Ejecución)"
          value={formatearMoneda(data.presupuesto.pto_definitivo)}
          hint="Pto. definitivo"
          icon={<DollarSign size={24} className="text-blue-600" />}
          accent="blue"
        />
        <PdmStatCard
          label="Presupuesto Pagado"
          value={formatearMoneda(data.presupuesto.pagos)}
          hint={`${pctPagadoGlobal}% de la ejecución`}
          icon={<DollarSign size={24} className="text-amber-600" />}
          accent="amber"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <ChartCard
          title="Distribución por Estado"
          icon={<PieChartIcon size={16} className="text-cyan-600" />}
          headerClassName="border-b border-cyan-100 bg-cyan-50/90"
        >
          <p className="mb-4 text-center text-sm font-medium text-slate-600">
            Distribución de Productos por Estado ({anioLabel === "todos los años" ? "Cuatrienio" : anioLabel})
          </p>
          {pieEstadoData.length === 0 ? (
            <div className="flex h-56 items-center justify-center text-sm text-slate-400">Sin datos</div>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={240}>
                <PieChart>
                  <Pie
                    data={pieEstadoData}
                    cx="50%"
                    cy="45%"
                    outerRadius={85}
                    dataKey="value"
                  >
                    {pieEstadoData.map((entry) => (
                      <Cell key={entry.name} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
              <div className="mt-3 flex flex-wrap justify-center gap-3 border-t border-slate-100 pt-3">
                {pieEstadoData.map((entry) => (
                  <div key={entry.name} className="flex items-center gap-1.5 text-xs text-slate-600">
                    <span className="inline-block h-3 w-3 rounded-sm" style={{ backgroundColor: entry.color }} />
                    <span className="font-medium">
                      {entry.name}: {entry.value} ({((entry.value / estadoTotal) * 100).toFixed(1)}%)
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}
        </ChartCard>

        <ChartCard
          title="Metas Totales vs Ejecutadas por Año"
          icon={<Target size={16} className="text-emerald-700" />}
          headerClassName="border-b border-emerald-100 bg-emerald-50/90 text-emerald-900"
        >
          <p className="mb-4 text-center text-sm font-medium text-slate-600">
            Metas Totales vs Ejecutadas por Año (2024-2027)
          </p>
          {metasChartData.every((m) => m.programada === 0) ? (
            <div className="flex h-56 items-center justify-center text-sm text-slate-400">Sin datos</div>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={metasChartData} margin={{ top: 36, right: 12, left: 8, bottom: 12 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis dataKey="anio" tick={{ fontSize: 11, fill: "#64748b" }} />
                <YAxis tick={{ fontSize: 10, fill: "#64748b" }} allowDecimals={false} width={36} />
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                <Legend verticalAlign="top" align="center" wrapperStyle={{ fontSize: 11, paddingBottom: 8 }} />
                <Bar dataKey="programada" name="Meta Total Programada" fill="#87ceeb" radius={[4, 4, 0, 0]} />
                <Bar dataKey="ejecutada" name="Meta Ejecutada" fill="#20c997" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>
      </div>

      <ChartCard
        title="Sectores — Estado de Productos"
        icon={<BarChart3 size={16} className="text-cyan-600" />}
        headerClassName="border-b border-cyan-100 bg-cyan-50/90"
      >
        <p className="mb-4 text-center text-sm font-medium text-slate-600">
          Todos los sectores ({anioLabel === "todos los años" ? "Cuatrienio" : anioLabel})
        </p>
        {sectorChartData.length === 0 ? (
          <div className="flex h-40 items-center justify-center text-sm text-slate-400">Sin datos</div>
        ) : (
          <div className="max-h-[28rem] overflow-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <th className="sticky top-0 z-10 bg-slate-50 px-3 py-3 text-left">Sector</th>
                  <th className="sticky top-0 z-10 bg-slate-50 px-2 py-3 text-center">Productos</th>
                  <th className="sticky top-0 z-10 bg-slate-50 px-2 py-3 text-center">Completados</th>
                  <th className="sticky top-0 z-10 bg-slate-50 px-2 py-3 text-center">En Progreso</th>
                  <th className="sticky top-0 z-10 bg-slate-50 px-2 py-3 text-center">Pendientes</th>
                  <th className="sticky top-0 z-10 bg-slate-50 px-2 py-3 text-center">Por Ejecutar</th>
                  <th className="sticky top-0 z-10 bg-slate-50 px-2 py-3 text-center">Avance %</th>
                  <th className="sticky top-0 z-10 bg-slate-50 px-2 py-3 text-right">Pto. Def.</th>
                  <th className="sticky top-0 z-10 bg-slate-50 px-2 py-3 text-right">Pagado</th>
                </tr>
              </thead>
              <tbody>
                {sectorChartData.map((s) => (
                  <tr key={s.sector} className="border-b border-slate-50 hover:bg-slate-50/80">
                    <td className="max-w-[220px] truncate px-3 py-3 font-medium text-slate-800" title={s.sector}>
                      {s.sector}
                    </td>
                    <td className="px-2 py-3 text-center font-bold">{s.total}</td>
                    <td className="px-2 py-3 text-center text-emerald-600">{s.completados}</td>
                    <td className="px-2 py-3 text-center text-cyan-600">{s.en_progreso}</td>
                    <td className="px-2 py-3 text-center text-amber-600">{s.pendientes}</td>
                    <td className="px-2 py-3 text-center text-slate-500">{s.por_ejecutar}</td>
                    <td className="px-2 py-3 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <div className="h-1.5 w-12 overflow-hidden rounded-full bg-slate-100">
                          <div
                            className={`h-full rounded-full ${s.avance_pct >= 75 ? "bg-emerald-500" : s.avance_pct >= 40 ? "bg-amber-400" : "bg-red-400"}`}
                            style={{ width: `${Math.min(100, s.avance_pct)}%` }}
                          />
                        </div>
                        <span className="text-xs font-semibold">{s.avance_pct}%</span>
                      </div>
                    </td>
                    <td className="px-2 py-3 text-right text-xs sm:text-sm">{formatearMoneda(s.pto_definitivo)}</td>
                    <td className="px-2 py-3 text-right text-xs sm:text-sm">{formatearMoneda(s.pagos)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </ChartCard>

      <PdmCard title="Por Línea Estratégica" icon={<Layers size={16} />}>
        <div className="max-h-96 space-y-4 overflow-y-auto pr-1">
          {data.por_linea.length === 0 ? (
            <p className="py-6 text-center text-sm text-slate-500">Sin datos por línea estratégica.</p>
          ) : (
            data.por_linea.map((item) => (
              <div key={item.linea}>
                <div className="mb-1 flex flex-wrap justify-between gap-2 text-sm">
                  <span className="min-w-0 flex-1 truncate text-slate-700" title={item.linea}>
                    {item.linea}
                  </span>
                  <span className="shrink-0 text-slate-500">
                    {item.productos} producto{item.productos !== 1 ? "s" : ""}
                  </span>
                  <strong className="shrink-0 text-slate-900">{item.avance_pct}%</strong>
                </div>
                <PdmProgressBar value={item.avance_pct} tone={item.avance_pct >= 75 ? "success" : item.avance_pct >= 40 ? "info" : "warning"} />
              </div>
            ))
          )}
        </div>
      </PdmCard>

      <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
        <ChartCard
          title="ODS"
          icon={<PieChartIcon size={16} className="text-amber-600" />}
          headerClassName="border-b border-amber-100 bg-amber-50/90"
          bodyClassName="p-3 sm:p-4"
        >
          <p className="mb-3 text-center text-sm font-medium text-slate-600">
            Objetivos de Desarrollo Sostenible ({anioLabel === "todos los años" ? "Cuatrienio" : anioLabel})
          </p>
          {odsPieData.length === 0 ? (
            <div className="flex h-52 items-center justify-center text-sm text-slate-400">Sin datos</div>
          ) : (
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
              <div className="mx-auto w-full max-w-[220px] shrink-0">
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie
                      data={odsPieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={82}
                      dataKey="value"
                    >
                      {odsPieData.map((entry, idx) => (
                        <Cell key={entry.fullName} fill={ODS_COLORS[idx % ODS_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="min-h-0 max-h-[220px] flex-1 space-y-1 overflow-y-auto pr-1">
                {data.por_ods.map((o, idx) => (
                  <div key={o.ods} className="flex items-start gap-2 text-xs text-slate-600">
                    <span
                      className="mt-0.5 inline-block h-3 w-3 shrink-0 rounded-sm"
                      style={{ backgroundColor: ODS_COLORS[idx % ODS_COLORS.length] }}
                    />
                    <span>
                      {truncateLabel(o.ods, 36)} ({o.productos})
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </ChartCard>

        <ChartCard
          title="Detalle por ODS"
          icon={<Table2 size={16} className="text-amber-600" />}
          headerClassName="border-b border-amber-100 bg-amber-50/90"
          bodyClassName="p-3 sm:p-4"
        >
          <div className="max-h-[268px] overflow-auto rounded-lg border border-slate-100">
            <table className="min-w-full text-sm">
              <thead className="sticky top-0 bg-amber-50 text-left text-xs uppercase tracking-wide text-amber-900">
                <tr>
                  <th className="px-3 py-2 font-semibold">ODS</th>
                  <th className="px-3 py-2 text-right font-semibold">Productos</th>
                  <th className="px-3 py-2 text-right font-semibold">Avance %</th>
                  <th className="px-3 py-2 text-right font-semibold">Ejecución (Pto. Def.)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {data.por_ods.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-3 py-8 text-center text-slate-400">
                      Sin datos
                    </td>
                  </tr>
                ) : (
                  data.por_ods.map((row, idx) => (
                    <tr key={row.ods} className={idx % 2 === 0 ? "bg-white" : "bg-slate-50/50"}>
                      <td className="max-w-[200px] truncate px-3 py-2 text-slate-800" title={row.ods}>
                        {row.ods}
                      </td>
                      <td className="px-3 py-2 text-right font-medium">{row.productos}</td>
                      <td className="px-3 py-2 text-right">{row.avance_pct.toFixed(1)}%</td>
                      <td className="px-3 py-2 text-right font-medium">{formatearMoneda(row.ejecucion ?? row.presupuesto)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </ChartCard>
      </div>

      <ChartCard
        title="Análisis Presupuestal por Año"
        icon={<DollarSign size={16} className="text-blue-600" />}
        headerClassName="border-b border-blue-100 bg-blue-50/90"
      >
        <div className="overflow-x-auto rounded-lg border border-slate-100">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-2 font-semibold">Año</th>
                <th className="px-4 py-2 text-right font-semibold">Plan (PDM)</th>
                <th className="px-4 py-2 text-right font-semibold">Ejecución (Pto. Def.)</th>
                <th className="px-4 py-2 text-right font-semibold">Pagado</th>
                <th className="px-4 py-2 text-right font-semibold">% Pagado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {data.presupuestal_por_anio.map((row, idx) => (
                <tr key={row.anio} className={idx % 2 === 0 ? "bg-white" : "bg-slate-50/50"}>
                  <td className="px-4 py-2 font-medium text-slate-800">{row.anio}</td>
                  <td className="px-4 py-2 text-right">{formatearMoneda(row.plan)}</td>
                  <td className="px-4 py-2 text-right">{formatearMoneda(row.ejecucion)}</td>
                  <td className="px-4 py-2 text-right">{formatearMoneda(row.pagos)}</td>
                  <td className="px-4 py-2 text-right">
                    <span className={row.pct_pagado >= 50 ? "text-emerald-600" : "text-red-500"}>
                      {row.pct_pagado.toFixed(1)}%
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-4 hidden sm:block">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart
              data={data.presupuestal_por_anio.map((r) => ({
                anio: String(r.anio),
                ejecucion: r.ejecucion,
                pagos: r.pagos,
              }))}
              margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis dataKey="anio" tick={{ fontSize: 11, fill: "#64748b" }} />
              <YAxis tick={{ fontSize: 10, fill: "#64748b" }} tickFormatter={(v) => `${(v / 1e9).toFixed(1)}B`} />
              <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="ejecucion" name="Ejecución" fill="#87ceeb" radius={[4, 4, 0, 0]} />
              <Bar dataKey="pagos" name="Pagado" fill="#20c997" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </ChartCard>

      {isAdmin && data.por_secretaria.length > 0 && (
        <ChartCard
          title="Análisis por Secretaría"
          icon={<Layers size={16} className="text-indigo-600" />}
          headerClassName="border-b border-indigo-100 bg-indigo-50/90"
        >
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <th className="px-3 py-3 text-left">Secretaría</th>
                  <th className="px-2 py-3 text-center">Productos</th>
                  <th className="px-2 py-3 text-center">Completados</th>
                  <th className="px-2 py-3 text-center">En Progreso</th>
                  <th className="px-2 py-3 text-center">Pendientes</th>
                  <th className="px-2 py-3 text-center">Por Ejecutar</th>
                  <th className="px-2 py-3 text-center">Avance %</th>
                  <th className="px-2 py-3 text-right">Pto. Def.</th>
                  <th className="px-2 py-3 text-right">Pagado</th>
                </tr>
              </thead>
              <tbody>
                {data.por_secretaria.map((s) => (
                  <tr key={s.secretaria_id} className="border-b border-slate-50 hover:bg-slate-50/80">
                    <td className="max-w-[180px] truncate px-3 py-3 font-medium text-slate-800" title={s.secretaria}>
                      {s.secretaria}
                    </td>
                    <td className="px-2 py-3 text-center font-bold">{s.productos}</td>
                    <td className="px-2 py-3 text-center text-emerald-600">{s.completados}</td>
                    <td className="px-2 py-3 text-center text-cyan-600">{s.en_progreso}</td>
                    <td className="px-2 py-3 text-center text-amber-600">{s.pendientes}</td>
                    <td className="px-2 py-3 text-center text-slate-500">{s.por_ejecutar}</td>
                    <td className="px-2 py-3 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <div className="h-1.5 w-12 overflow-hidden rounded-full bg-slate-100">
                          <div
                            className={`h-full rounded-full ${s.avance_pct >= 75 ? "bg-emerald-500" : s.avance_pct >= 40 ? "bg-amber-400" : "bg-red-400"}`}
                            style={{ width: `${Math.min(100, s.avance_pct)}%` }}
                          />
                        </div>
                        <span className="text-xs font-semibold">{s.avance_pct}%</span>
                      </div>
                    </td>
                    <td className="px-2 py-3 text-right text-xs sm:text-sm">{formatearMoneda(s.pto_definitivo)}</td>
                    <td className="px-2 py-3 text-right text-xs sm:text-sm">{formatearMoneda(s.pagos)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </ChartCard>
      )}
    </div>
  );
}

export default function PdmAnalisis({
  slug,
  filtroAnio,
  onFiltroAnio,
  filtroSecretaria,
  onFiltroSecretaria,
  secretarias,
  isAdmin,
}: PdmAnalisisProps) {
  const secretariaId = filtroSecretaria ? Number(filtroSecretaria) : undefined;
  const { data, isLoading, isError, error } = usePdmAnalisis(
    slug,
    filtroAnio,
    secretariaId,
    Boolean(slug),
  );

  const loadError = isError ? formatApiError(error, "No se pudieron cargar los datos de análisis.") : null;

  return (
    <div className="space-y-6">
      <PdmCard>
        <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end">
          <div className="min-w-[160px] flex-1 sm:max-w-xs">
            <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">Año</label>
            <PdmSelect
              value={filtroAnio === "all" ? "all" : String(filtroAnio)}
              onChange={(e) => {
                const v = e.target.value;
                onFiltroAnio(v === "all" ? "all" : Number(v));
              }}
            >
              <option value="all">Todos los años</option>
              {ANIOS_PDM.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </PdmSelect>
          </div>
          {isAdmin && (
            <div className="min-w-[200px] flex-1 sm:max-w-sm">
              <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">
                Secretaría
              </label>
              <PdmSelect value={filtroSecretaria} onChange={(e) => onFiltroSecretaria(e.target.value)}>
                <option value="">Todas las secretarías</option>
                {secretarias.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.nombre}
                  </option>
                ))}
              </PdmSelect>
            </div>
          )}
        </div>
      </PdmCard>

      {isLoading && (
        <div className="flex h-48 items-center justify-center text-sm text-slate-500 animate-pulse">
          Cargando análisis…
        </div>
      )}

      {loadError && (
        <div className="flex h-48 flex-col items-center justify-center gap-2 text-center text-red-600 text-sm">
          <AlertTriangle className="h-8 w-8" />
          <p>{loadError}</p>
        </div>
      )}

      {!isLoading && !loadError && data && (
        <AnalisisContent data={data} filtroAnio={filtroAnio} isAdmin={isAdmin} />
      )}
    </div>
  );
}
