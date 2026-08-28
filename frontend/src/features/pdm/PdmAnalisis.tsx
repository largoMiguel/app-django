import { Fragment, useMemo } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  LabelList,
  Legend,
  Line,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  AlertTriangle,
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

const SECTOR_COLORS = [
  "#0891b2",
  "#059669",
  "#d97706",
  "#7c3aed",
  "#dc2626",
  "#2563eb",
  "#db2777",
  "#4d7c0f",
  "#ea580c",
  "#6366f1",
  "#0d9488",
  "#b45309",
];

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

const FUENTES_FINANCIACION_ORDER = [
  "Propios",
  "SGP - Salud",
  "SGP - Educación",
  "SGP - Propósito General Deporte",
  "SGP - Propósito General Cultura",
  "SGP - Propósito General Libre Inversión",
  "SGP - Propósito General Libre Destinación",
  "SGP - Alimentación Escolar",
  "SGP - Ribereños",
  "SGP - Agua Potable y Saneamiento Básico",
  "SGP - Primera Infancia",
  "Otros",
] as const;

const FUENTE_FINANCIACION_COLORS = [
  "#2563eb",
  "#059669",
  "#7c3aed",
  "#d97706",
  "#db2777",
  "#0891b2",
  "#4d7c0f",
  "#ea580c",
  "#6366f1",
  "#0d9488",
  "#b45309",
  "#64748b",
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

function buildFuentesStackedChart(
  rows: PdmAnalisisResponse["fuentes_por_anio"],
  metric: "pto_definitivo" | "pagos",
) {
  const active = new Set<string>();
  for (const row of rows) {
    for (const fuente of row.fuentes) active.add(fuente.nombre);
  }
  const fuentes = FUENTES_FINANCIACION_ORDER.filter((nombre) => active.has(nombre));
  const chartData = rows.map((row) => {
    const byName = Object.fromEntries(row.fuentes.map((fuente) => [fuente.nombre, fuente]));
    const point: Record<string, string | number> = { anio: String(row.anio) };
    for (const nombre of fuentes) {
      point[nombre] = byName[nombre]?.[metric] ?? 0;
    }
    return point;
  });
  return { fuentes, chartData };
}

type FuenteResumenRow = {
  nombre: string;
  color: string;
  anios: Record<number, { pto: number; pagos: number }>;
  totalPto: number;
  totalPagos: number;
  pctPagado: number;
};

function buildFuentesResumen(
  rows: PdmAnalisisResponse["fuentes_por_anio"],
  anios: readonly number[],
): FuenteResumenRow[] {
  const map = new Map<string, Record<number, { pto: number; pagos: number }>>();
  for (const row of rows) {
    for (const fuente of row.fuentes) {
      if (!map.has(fuente.nombre)) map.set(fuente.nombre, {});
      map.get(fuente.nombre)![row.anio] = {
        pto: fuente.pto_definitivo,
        pagos: fuente.pagos,
      };
    }
  }

  return FUENTES_FINANCIACION_ORDER.filter((nombre) => map.has(nombre)).map((nombre, idx) => {
    const raw = map.get(nombre) ?? {};
    const aniosData = Object.fromEntries(
      anios.map((anio) => [anio, raw[anio] ?? { pto: 0, pagos: 0 }]),
    ) as Record<number, { pto: number; pagos: number }>;
    const totalPto = anios.reduce((sum, anio) => sum + aniosData[anio].pto, 0);
    const totalPagos = anios.reduce((sum, anio) => sum + aniosData[anio].pagos, 0);
    return {
      nombre,
      color: FUENTE_FINANCIACION_COLORS[idx % FUENTE_FINANCIACION_COLORS.length],
      anios: aniosData,
      totalPto,
      totalPagos,
      pctPagado: totalPto > 0 ? (totalPagos / totalPto) * 100 : 0,
    };
  });
}

function AnalisisContent({
  data,
  filtroAnio,
  filtroSecretaria,
  secretarias,
  isAdmin,
}: {
  data: PdmAnalisisResponse;
  filtroAnio: number | "all";
  filtroSecretaria: string;
  secretarias: Secretaria[];
  isAdmin: boolean;
}) {
  const aniosVista = useMemo(
    () => (filtroAnio === "all" ? [...ANIOS_PDM] : [filtroAnio]),
    [filtroAnio],
  );
  const periodoLabel = filtroAnio === "all" ? "Cuatrienio 2024-2027" : `Vigencia ${filtroAnio}`;
  const filtroContexto = useMemo(() => {
    const parts: string[] = [periodoLabel];
    if (filtroSecretaria) {
      const secretaria = secretarias.find((s) => String(s.id) === filtroSecretaria);
      parts.push(secretaria?.nombre ?? "Secretaría seleccionada");
    }
    return parts.join(" · ");
  }, [periodoLabel, filtroSecretaria, secretarias]);
  const estado = data.estado_distribucion;
  const estadoTotal = estado.total || 1;

  const pieEstadoData = useMemo(
    () =>
      [
        { name: "PENDIENTE", value: estado.pendiente, color: ESTADO_COLORS.PENDIENTE },
        { name: "EN PROGRESO", value: estado.en_progreso, color: ESTADO_COLORS.EN_PROGRESO },
        { name: "AL 100%", value: estado.completado, color: ESTADO_COLORS.COMPLETADO },
        { name: "POR EJECUTAR", value: estado.por_ejecutar, color: ESTADO_COLORS.POR_EJECUTAR },
      ].filter((d) => d.value > 0),
    [estado],
  );

  const sectorChartData = useMemo(
    () => data.por_sector_estado.filter((s) => s.total > 0),
    [data.por_sector_estado],
  );

  const sectorPieData = useMemo(
    () =>
      sectorChartData.map((s, idx) => ({
        name: truncateLabel(s.sector, 32),
        fullName: s.sector,
        value: s.total,
        color: SECTOR_COLORS[idx % SECTOR_COLORS.length],
      })),
    [sectorChartData],
  );

  const metasChartData = useMemo(
    () =>
      data.metas_por_anio.map((m) => ({
        anio: String(m.anio),
        programada: m.programada,
        ejecutada: m.ejecutada,
        pct: m.pct,
        meta_programada_total: m.meta_programada_total ?? 0,
        meta_ejecutada_total: m.meta_ejecutada_total ?? 0,
      })),
    [data.metas_por_anio],
  );

  const lineaChartData = useMemo(
    () =>
      data.por_linea.map((l, idx) => ({
        name: truncateLabel(l.linea, 26),
        fullName: l.linea,
        avance_pct: l.avance_pct,
        productos: l.productos,
        color: SECTOR_COLORS[idx % SECTOR_COLORS.length],
      })),
    [data.por_linea],
  );

  const secretariaChartData = useMemo(
    () =>
      data.por_secretaria.map((s) => ({
        name: truncateLabel(s.secretaria, 22),
        fullName: s.secretaria,
        avance_pct: s.avance_pct,
        avance_financiero_pct: Number((s.avance_financiero_pct ?? 0).toFixed(1)),
        productos: s.productos,
        meta_programada: s.meta_programada_total ?? 0,
        meta_ejecutada: s.meta_ejecutada_total ?? 0,
        presupuesto_plan: s.presupuesto_plan ?? 0,
        pagos: s.pagos ?? 0,
      })),
    [data.por_secretaria],
  );

  const fuentesPtoChart = useMemo(
    () => buildFuentesStackedChart(data.fuentes_por_anio ?? [], "pto_definitivo"),
    [data.fuentes_por_anio],
  );
  const fuentesPagosChart = useMemo(
    () => buildFuentesStackedChart(data.fuentes_por_anio ?? [], "pagos"),
    [data.fuentes_por_anio],
  );
  const fuentesResumen = useMemo(
    () => buildFuentesResumen(data.fuentes_por_anio ?? [], aniosVista),
    [data.fuentes_por_anio, aniosVista],
  );
  const fuentesTotales = useMemo(
    () =>
      fuentesResumen.reduce(
        (acc, row) => ({
          pto: acc.pto + row.totalPto,
          pagos: acc.pagos + row.totalPagos,
        }),
        { pto: 0, pagos: 0 },
      ),
    [fuentesResumen],
  );
  const fuentesConDatos = fuentesResumen.length > 0;

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

  const productosConMeta = data.productos_con_meta ?? data.total_productos;
  const totalEnPlan = data.total_productos_todos ?? data.total_productos;
  const completados = data.estado_distribucion.completado;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <PdmStatCard
          label="Productos con Meta"
          value={productosConMeta}
          hint={`${productosConMeta} con meta · ${totalEnPlan} en el plan · ${filtroContexto}`}
          icon={<Box size={24} className="text-cyan-600" />}
          accent="cyan"
        />
        <PdmStatCard
          label="Avance físico promedio"
          value={`${data.avance_global}%`}
          hint={`Promedio de ${productosConMeta} productos · ${completados} al 100% · ${filtroContexto}`}
          icon={<TrendingUp size={24} className="text-emerald-600" />}
          accent="emerald"
        />
        <PdmStatCard
          label="Presupuesto Total (Ejecución)"
          value={formatearMoneda(data.presupuesto.pto_definitivo)}
          hint={`Pto. definitivo · ${filtroContexto}`}
          icon={<DollarSign size={24} className="text-blue-600" />}
          accent="blue"
        />
        <PdmStatCard
          label="Presupuesto Pagado"
          value={formatearMoneda(data.presupuesto.pagos)}
          hint={`${pctPagadoGlobal}% sobre pto. definitivo · ${filtroContexto}`}
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
            Cantidad de productos por estado ({filtroContexto})
            <span className="mt-1 block text-xs font-normal text-slate-500">
              «Al 100%» = meta cumplida · distinto del avance físico promedio ({data.avance_global}%)
            </span>
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
          title="Productos con Meta vs Completados por Año"
          icon={<Target size={16} className="text-emerald-700" />}
          headerClassName="border-b border-emerald-100 bg-emerald-50/90 text-emerald-900"
        >
          <p className="mb-4 text-center text-sm font-medium text-slate-600">
            Conteo de productos y meta física ({filtroContexto})
          </p>
          {metasChartData.every((m) => m.programada === 0) ? (
            <div className="flex h-56 items-center justify-center text-sm text-slate-400">Sin datos</div>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <ComposedChart data={metasChartData} margin={{ top: 36, right: 12, left: 8, bottom: 12 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis dataKey="anio" tick={{ fontSize: 11, fill: "#64748b" }} />
                <YAxis
                  yAxisId="left"
                  tick={{ fontSize: 10, fill: "#64748b" }}
                  allowDecimals={false}
                  width={36}
                />
                {aniosVista.length > 1 && (
                  <YAxis
                    yAxisId="right"
                    orientation="right"
                    tick={{ fontSize: 10, fill: "#64748b" }}
                    width={48}
                  />
                )}
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                <Legend verticalAlign="top" align="center" wrapperStyle={{ fontSize: 11, paddingBottom: 8 }} />
                <Bar
                  yAxisId="left"
                  dataKey="programada"
                  name="Productos con meta"
                  fill="#87ceeb"
                  radius={[4, 4, 0, 0]}
                />
                <Bar
                  yAxisId="left"
                  dataKey="ejecutada"
                  name="Productos completados"
                  fill="#20c997"
                  radius={[4, 4, 0, 0]}
                />
                {aniosVista.length > 1 && (
                  <>
                    <Line
                      yAxisId="right"
                      type="monotone"
                      dataKey="meta_programada_total"
                      name="Meta física programada"
                      stroke="#6366f1"
                      strokeWidth={2}
                      dot={{ r: 3 }}
                    />
                    <Line
                      yAxisId="right"
                      type="monotone"
                      dataKey="meta_ejecutada_total"
                      name="Meta física ejecutada"
                      stroke="#f59e0b"
                      strokeWidth={2}
                      dot={{ r: 3 }}
                    />
                  </>
                )}
              </ComposedChart>
            </ResponsiveContainer>
          )}
        </ChartCard>
      </div>

      <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
        <ChartCard
          title="Sectores — Estado de Productos"
          icon={<PieChartIcon size={16} className="text-cyan-600" />}
          headerClassName="border-b border-cyan-100 bg-cyan-50/90"
          bodyClassName="p-3 sm:p-4"
        >
          <p className="mb-3 text-center text-sm font-medium text-slate-600">
            Distribución por sector ({filtroContexto})
          </p>
          {sectorPieData.length === 0 ? (
            <div className="flex h-52 items-center justify-center text-sm text-slate-400">Sin datos</div>
          ) : (
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
              <div className="mx-auto w-full max-w-[220px] shrink-0">
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie
                      data={sectorPieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={82}
                      dataKey="value"
                    >
                      {sectorPieData.map((entry, idx) => (
                        <Cell key={entry.fullName} fill={SECTOR_COLORS[idx % SECTOR_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="min-h-0 max-h-[220px] flex-1 space-y-1 overflow-y-auto pr-1">
                {sectorChartData.map((s, idx) => (
                  <div key={s.sector} className="flex items-start gap-2 text-xs text-slate-600">
                    <span
                      className="mt-0.5 inline-block h-3 w-3 shrink-0 rounded-sm"
                      style={{ backgroundColor: SECTOR_COLORS[idx % SECTOR_COLORS.length] }}
                    />
                    <span>
                      {truncateLabel(s.sector, 36)} ({s.total})
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </ChartCard>

        <ChartCard
          title="Detalle por Sector"
          icon={<Table2 size={16} className="text-cyan-600" />}
          headerClassName="border-b border-cyan-100 bg-cyan-50/90"
          bodyClassName="p-3 sm:p-4"
        >
          <div className="max-h-[268px] overflow-auto rounded-lg border border-slate-100">
            <table className="min-w-full text-sm">
              <thead className="sticky top-0 bg-cyan-50 text-left text-xs uppercase tracking-wide text-cyan-900">
                <tr>
                  <th className="px-3 py-2 font-semibold">Sector</th>
                  <th className="px-3 py-2 text-right font-semibold">Productos</th>
                  <th className="px-3 py-2 text-right font-semibold">Avance %</th>
                  <th className="px-3 py-2 text-right font-semibold">Avance Fin. %</th>
                  <th className="px-3 py-2 text-right font-semibold">Pto. Def.</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {sectorChartData.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-3 py-8 text-center text-slate-400">
                      Sin datos
                    </td>
                  </tr>
                ) : (
                  sectorChartData.map((row, idx) => (
                    <tr key={row.sector} className={idx % 2 === 0 ? "bg-white" : "bg-slate-50/50"}>
                      <td className="max-w-[200px] truncate px-3 py-2 text-slate-800" title={row.sector}>
                        {row.sector}
                      </td>
                      <td className="px-3 py-2 text-right font-medium">{row.total}</td>
                      <td className="px-3 py-2 text-right">{row.avance_pct.toFixed(1)}%</td>
                      <td className="px-3 py-2 text-right">{row.avance_financiero_pct.toFixed(1)}%</td>
                      <td className="px-3 py-2 text-right font-medium">{formatearMoneda(row.pto_definitivo)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </ChartCard>
      </div>

      <PdmCard title="Por Línea Estratégica" icon={<Layers size={16} />}>
        {data.por_linea.length === 0 ? (
          <p className="py-6 text-center text-sm text-slate-500">Sin datos por línea estratégica.</p>
        ) : (
          <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
            {lineaChartData.length > 0 && (
              <div className="rounded-lg border border-slate-100 bg-slate-50/60 p-3 sm:p-4">
                <p className="mb-3 text-center text-sm font-medium text-slate-600">
                  Avance por línea estratégica ({filtroContexto})
                </p>
                <ResponsiveContainer width="100%" height={Math.max(220, lineaChartData.length * 48)}>
                  <BarChart
                    data={lineaChartData}
                    layout="vertical"
                    margin={{ top: 4, right: 56, left: 4, bottom: 4 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
                    <XAxis
                      type="number"
                      domain={[0, 100]}
                      tick={{ fontSize: 10, fill: "#64748b" }}
                      tickFormatter={(v) => `${v}%`}
                    />
                    <YAxis
                      type="category"
                      dataKey="name"
                      width={180}
                      tick={{ fontSize: 11, fill: "#475569" }}
                      interval={0}
                    />
                    <Tooltip
                      contentStyle={{ fontSize: 12, borderRadius: 8 }}
                      formatter={(value, _name, item) => [
                        `${value}% · ${(item?.payload as { productos?: number })?.productos ?? 0} producto(s)`,
                        "Avance",
                      ]}
                      labelFormatter={(_label, payload) => payload?.[0]?.payload?.fullName ?? ""}
                    />
                    <Bar dataKey="avance_pct" name="Avance %" radius={[0, 4, 4, 0]} barSize={18}>
                      {lineaChartData.map((entry) => (
                        <Cell key={entry.fullName} fill={entry.color} />
                      ))}
                      <LabelList
                        dataKey="avance_pct"
                        position="right"
                        formatter={(v) => `${v}%`}
                        style={{ fontSize: 11, fill: "#475569" }}
                      />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
            <div className="max-h-[420px] space-y-4 overflow-y-auto pr-1">
              {data.por_linea.map((item) => (
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
                  <PdmProgressBar
                    value={item.avance_pct}
                    tone={item.avance_pct >= 75 ? "success" : item.avance_pct >= 40 ? "info" : "warning"}
                  />
                </div>
              ))}
            </div>
          </div>
        )}
      </PdmCard>

      <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
        <ChartCard
          title="ODS"
          icon={<PieChartIcon size={16} className="text-amber-600" />}
          headerClassName="border-b border-amber-100 bg-amber-50/90"
          bodyClassName="p-3 sm:p-4"
        >
          <p className="mb-3 text-center text-sm font-medium text-slate-600">
            Objetivos de Desarrollo Sostenible ({filtroContexto})
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
                  <th className="px-3 py-2 text-right font-semibold">Presupuesto</th>
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
                      <td className="px-3 py-2 text-right font-medium">{formatearMoneda(row.presupuesto)}</td>
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
        <p className="mb-4 text-center text-sm font-medium text-slate-600">{filtroContexto}</p>
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

      <ChartCard
        title="Fuentes de Financiación por Año"
        icon={<DollarSign size={16} className="text-violet-600" />}
        headerClassName="border-b border-violet-100 bg-violet-50/90"
      >
        <p className="mb-4 text-center text-sm font-medium text-slate-600">
          Ejecución presupuestal por fuente MGA normalizada ({filtroContexto})
        </p>
        {!fuentesConDatos ? (
          <div className="flex h-48 items-center justify-center text-sm text-slate-400">
            Sin datos de ejecución por fuente de financiación
          </div>
        ) : (
          <div className="grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] xl:items-start">
            <div className="space-y-4">
              <div className="min-w-0 rounded-lg border border-slate-100 bg-slate-50/60 p-3 sm:p-4">
                <p className="mb-3 text-center text-sm font-medium text-slate-600">Pto. definitivo por año</p>
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={fuentesPtoChart.chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                    <XAxis dataKey="anio" tick={{ fontSize: 11, fill: "#64748b" }} />
                    <YAxis
                      tick={{ fontSize: 10, fill: "#64748b" }}
                      tickFormatter={(v) => `${(Number(v) / 1e9).toFixed(1)}B`}
                    />
                    <Tooltip
                      contentStyle={{ fontSize: 12, borderRadius: 8 }}
                      formatter={(value, name) => [formatearMoneda(Number(value ?? 0)), String(name)]}
                    />
                    {fuentesPtoChart.fuentes.map((nombre, idx) => (
                      <Bar
                        key={nombre}
                        dataKey={nombre}
                        stackId="pto"
                        fill={FUENTE_FINANCIACION_COLORS[idx % FUENTE_FINANCIACION_COLORS.length]}
                      />
                    ))}
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="min-w-0 rounded-lg border border-slate-100 bg-slate-50/60 p-3 sm:p-4">
                <p className="mb-3 text-center text-sm font-medium text-slate-600">Pagado por año</p>
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={fuentesPagosChart.chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                    <XAxis dataKey="anio" tick={{ fontSize: 11, fill: "#64748b" }} />
                    <YAxis
                      tick={{ fontSize: 10, fill: "#64748b" }}
                      tickFormatter={(v) => `${(Number(v) / 1e9).toFixed(1)}B`}
                    />
                    <Tooltip
                      contentStyle={{ fontSize: 12, borderRadius: 8 }}
                      formatter={(value, name) => [formatearMoneda(Number(value ?? 0)), String(name)]}
                    />
                    {fuentesPagosChart.fuentes.map((nombre, idx) => (
                      <Bar
                        key={nombre}
                        dataKey={nombre}
                        stackId="pagos"
                        fill={FUENTE_FINANCIACION_COLORS[idx % FUENTE_FINANCIACION_COLORS.length]}
                      />
                    ))}
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="flex flex-wrap gap-2 rounded-lg border border-slate-100 bg-white px-3 py-2">
                {fuentesResumen.map((row) => (
                  <span
                    key={row.nombre}
                    className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-slate-100 bg-slate-50 px-2 py-1 text-[11px] text-slate-600"
                    title={row.nombre}
                  >
                    <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: row.color }} />
                    <span className="truncate">{truncateLabel(row.nombre, 34)}</span>
                  </span>
                ))}
              </div>
            </div>

            <div className="min-w-0 overflow-hidden rounded-lg border border-slate-100">
              <div className="border-b border-violet-100 bg-violet-50/80 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-violet-900">
                Detalle por fuente MGA
              </div>
              <div className="max-h-[620px] overflow-auto">
                <table className="min-w-full text-xs sm:text-sm">
                  <thead className="sticky top-0 z-10 bg-slate-50 text-[10px] uppercase tracking-wide text-slate-500 sm:text-xs">
                    <tr className="border-b border-slate-100">
                      <th className="px-3 py-2 text-left font-semibold" rowSpan={2}>
                        Fuente
                      </th>
                      {aniosVista.map((anio) => (
                        <th key={anio} className="px-2 py-2 text-center font-semibold" colSpan={2}>
                          {anio}
                        </th>
                      ))}
                      <th className="px-2 py-2 text-center font-semibold" colSpan={2}>
                        Total
                      </th>
                      <th className="px-2 py-2 text-center font-semibold" rowSpan={2}>
                        % Pag.
                      </th>
                    </tr>
                    <tr className="border-b border-slate-100">
                      {aniosVista.map((anio) => (
                        <Fragment key={`sub-${anio}`}>
                          <th className="px-2 py-1.5 text-right font-medium text-slate-400">Pto.</th>
                          <th className="px-2 py-1.5 text-right font-medium text-slate-400">Pag.</th>
                        </Fragment>
                      ))}
                      <th className="px-2 py-1.5 text-right font-medium text-slate-400">Pto.</th>
                      <th className="px-2 py-1.5 text-right font-medium text-slate-400">Pag.</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {fuentesResumen.map((row, idx) => (
                      <tr key={row.nombre} className={idx % 2 === 0 ? "bg-white" : "bg-slate-50/50"}>
                        <td className="max-w-[160px] px-3 py-2.5 font-medium text-slate-800">
                          <span className="flex items-start gap-2">
                            <span
                              className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full"
                              style={{ backgroundColor: row.color }}
                            />
                            <span className="min-w-0 leading-snug" title={row.nombre}>
                              {row.nombre}
                            </span>
                          </span>
                        </td>
                        {aniosVista.map((anio) => {
                          const cell = row.anios[anio];
                          return (
                            <Fragment key={`${row.nombre}-${anio}`}>
                              <td className="whitespace-nowrap px-2 py-2.5 text-right text-slate-700">
                                {cell.pto > 0 ? formatearMoneda(cell.pto) : "—"}
                              </td>
                              <td className="whitespace-nowrap px-2 py-2.5 text-right text-slate-700">
                                {cell.pagos > 0 ? formatearMoneda(cell.pagos) : "—"}
                              </td>
                            </Fragment>
                          );
                        })}
                        <td className="whitespace-nowrap px-2 py-2.5 text-right font-semibold text-slate-900">
                          {formatearMoneda(row.totalPto)}
                        </td>
                        <td className="whitespace-nowrap px-2 py-2.5 text-right font-semibold text-slate-900">
                          {formatearMoneda(row.totalPagos)}
                        </td>
                        <td className="whitespace-nowrap px-2 py-2.5 text-right">
                          <span className={row.pctPagado >= 50 ? "font-semibold text-emerald-600" : "font-semibold text-amber-600"}>
                            {row.pctPagado.toFixed(1)}%
                          </span>
                        </td>
                      </tr>
                    ))}
                    <tr className="bg-violet-50/60 font-semibold text-violet-950">
                      <td className="px-3 py-2.5">Total general</td>
                      {aniosVista.map((anio) => {
                        const ptoAnio = fuentesResumen.reduce((sum, row) => sum + row.anios[anio].pto, 0);
                        const pagosAnio = fuentesResumen.reduce((sum, row) => sum + row.anios[anio].pagos, 0);
                        return (
                          <Fragment key={`total-${anio}`}>
                            <td className="whitespace-nowrap px-2 py-2.5 text-right">{formatearMoneda(ptoAnio)}</td>
                            <td className="whitespace-nowrap px-2 py-2.5 text-right">{formatearMoneda(pagosAnio)}</td>
                          </Fragment>
                        );
                      })}
                      <td className="whitespace-nowrap px-2 py-2.5 text-right">{formatearMoneda(fuentesTotales.pto)}</td>
                      <td className="whitespace-nowrap px-2 py-2.5 text-right">{formatearMoneda(fuentesTotales.pagos)}</td>
                      <td className="whitespace-nowrap px-2 py-2.5 text-right">
                        {fuentesTotales.pto > 0
                          ? `${((fuentesTotales.pagos / fuentesTotales.pto) * 100).toFixed(1)}%`
                          : "—"}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </ChartCard>

      {isAdmin && data.por_secretaria.length > 0 && (
        <ChartCard
          title="Análisis por Secretaría (Dependencia)"
          icon={<Layers size={16} className="text-indigo-600" />}
          headerClassName="border-b border-indigo-100 bg-indigo-50/90"
        >
          <div className="mb-5 grid gap-4 lg:grid-cols-2 lg:items-start">
            <div className="min-w-0 rounded-lg border border-slate-100 bg-slate-50/60 p-3 sm:p-4">
              <p className="mb-3 text-center text-sm font-medium text-slate-600">
                Meta física programada vs ejecutada ({filtroContexto})
              </p>
              <ResponsiveContainer width="100%" height={Math.max(200, secretariaChartData.length * 52)}>
                <BarChart
                  data={secretariaChartData}
                  layout="vertical"
                  margin={{ top: 4, right: 16, left: 4, bottom: 4 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 10, fill: "#64748b" }} />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={160}
                    tick={{ fontSize: 11, fill: "#475569" }}
                    interval={0}
                  />
                  <Tooltip
                    contentStyle={{ fontSize: 12, borderRadius: 8 }}
                    formatter={(value, name) => [
                      Number(value ?? 0).toLocaleString("es-CO", { maximumFractionDigits: 2 }),
                      String(name),
                    ]}
                    labelFormatter={(_label, payload) => payload?.[0]?.payload?.fullName ?? ""}
                  />
                  <Legend verticalAlign="top" wrapperStyle={{ fontSize: 11, paddingBottom: 8 }} />
                  <Bar
                    dataKey="meta_programada"
                    name="Meta programada"
                    fill="#6366f1"
                    radius={[0, 4, 4, 0]}
                    barSize={14}
                  />
                  <Bar
                    dataKey="meta_ejecutada"
                    name="Meta ejecutada"
                    fill="#20c997"
                    radius={[0, 4, 4, 0]}
                    barSize={14}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="min-w-0 rounded-lg border border-slate-100 bg-slate-50/60 p-3 sm:p-4">
              <p className="mb-3 text-center text-sm font-medium text-slate-600">
                Presupuesto programado vs pagado ({filtroContexto})
              </p>
              <ResponsiveContainer width="100%" height={Math.max(200, secretariaChartData.length * 52)}>
                <BarChart
                  data={secretariaChartData}
                  layout="vertical"
                  margin={{ top: 4, right: 16, left: 4, bottom: 4 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
                  <XAxis
                    type="number"
                    tick={{ fontSize: 10, fill: "#64748b" }}
                    tickFormatter={(v) => `${(Number(v) / 1e6).toFixed(0)}M`}
                  />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={160}
                    tick={{ fontSize: 11, fill: "#475569" }}
                    interval={0}
                  />
                  <Tooltip
                    contentStyle={{ fontSize: 12, borderRadius: 8 }}
                    formatter={(value, name) => [formatearMoneda(Number(value ?? 0)), String(name)]}
                    labelFormatter={(_label, payload) => payload?.[0]?.payload?.fullName ?? ""}
                  />
                  <Legend verticalAlign="top" wrapperStyle={{ fontSize: 11, paddingBottom: 8 }} />
                  <Bar
                    dataKey="presupuesto_plan"
                    name="Presupuesto programado (plan)"
                    fill="#3b82f6"
                    radius={[0, 4, 4, 0]}
                    barSize={14}
                  />
                  <Bar dataKey="pagos" name="Pagado (ejecutado)" fill="#f59e0b" radius={[0, 4, 4, 0]} barSize={14} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
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
                  <th className="px-2 py-3 text-right">Meta prog.</th>
                  <th className="px-2 py-3 text-right">Meta ejec.</th>
                  <th className="px-2 py-3 text-right">Ppto. plan</th>
                  <th className="px-2 py-3 text-center">Avance Fin. %</th>
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
                    <td className="px-2 py-3 text-right text-xs">
                      {(s.meta_programada_total ?? 0).toLocaleString("es-CO", { maximumFractionDigits: 2 })}
                    </td>
                    <td className="px-2 py-3 text-right text-xs">
                      {(s.meta_ejecutada_total ?? 0).toLocaleString("es-CO", { maximumFractionDigits: 2 })}
                    </td>
                    <td className="px-2 py-3 text-right text-xs sm:text-sm">
                      {formatearMoneda(s.presupuesto_plan ?? 0)}
                    </td>
                    <td className="px-2 py-3 text-center text-xs font-semibold">
                      {(s.avance_financiero_pct ?? 0).toFixed(1)}%
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
        <AnalisisContent
          data={data}
          filtroAnio={filtroAnio}
          filtroSecretaria={filtroSecretaria}
          secretarias={secretarias}
          isAdmin={isAdmin}
        />
      )}
    </div>
  );
}
