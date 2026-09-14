import { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle,
  Clock,
  DollarSign,
  Download,
  Layers,
  Search,
  TrendingUp,
} from "lucide-react";
import {
  Bar,
  BarChart,
  Cell,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  formatCOP,
  secopApi,
  type PaginatedSecop,
  type SecopRecord,
  type SecopResponsableGroup,
} from "@/core/api/secop";
import { formatApiError } from "@/core/api/errors";
import { useSecopYear } from "./SecopYearContext";
import { ChartCard, ProgressBar, SemaforoDot, StatCard } from "./components";
import SecopDetalleModal from "./SecopDetalleModal";

const PIE_COLORS = ["#3eafd4", "#1d4ed8", "#0e7490", "#6366f1", "#8b5cf6", "#f59e0b"];

export default function SecopContratosPage() {
  const { anio, loadingConfig } = useSecopYear();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [resumen, setResumen] = useState<Awaited<ReturnType<typeof secopApi.resumen>> | null>(null);
  const [supervisores, setSupervisores] = useState<SecopResponsableGroup[]>([]);
  const [ordenadores, setOrdenadores] = useState<SecopResponsableGroup[]>([]);
  const [list, setList] = useState<PaginatedSecop | null>(null);
  const [depTab, setDepTab] = useState<"supervisor" | "ordenador">("supervisor");
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [tipoRegistro, setTipoRegistro] = useState("all");
  const [responsableFilter, setResponsableFilter] = useState("");
  const [selected, setSelected] = useState<SecopRecord | null>(null);

  const load = useCallback(async () => {
    if (loadingConfig) return;
    setLoading(true);
    setError("");
    try {
      const params: Record<string, string | number> = { anio, page, page_size: 15 };
      if (search.trim()) params.search = search.trim();
      if (tipoRegistro !== "all") params.tipo_registro = tipoRegistro;
      if (responsableFilter) {
        if (depTab === "ordenador") params.ordenador = responsableFilter;
        else params.supervisor = responsableFilter;
      }

      const [res, dep, listRes] = await Promise.all([
        secopApi.resumen(anio),
        secopApi.dependencias(anio),
        secopApi.listSecop2(params),
      ]);
      setResumen(res);
      setSupervisores(dep.por_supervisor);
      setOrdenadores(dep.por_ordenador);
      setList(listRes);
    } catch (err) {
      setError(formatApiError(err) || "No se pudo cargar la contratación.");
    } finally {
      setLoading(false);
    }
  }, [anio, page, search, tipoRegistro, responsableFilter, depTab, loadingConfig]);

  useEffect(() => {
    setResponsableFilter("");
  }, [depTab]);

  useEffect(() => {
    const t = setTimeout(load, search ? 400 : 0);
    return () => clearTimeout(t);
  }, [load, search]);

  const kpis = resumen?.kpis;
  const venc = resumen?.vencimientos;
  const pagos = resumen?.pagos;
  const analytics = list?.analitica;
  const groups = depTab === "supervisor" ? supervisores : ordenadores;
  const totalPages = list ? Math.ceil(list.count / 15) : 1;

  const lineData = (pagos?.serie_mensual_pagos || []).map((p, i) => ({
    mes: p.mes,
    pagos: p.valor,
    contratacion: resumen?.secop2.analitica?.serie_mensual?.[i]?.valor || 0,
  }));

  const depChartData = groups.slice(0, 8).map((g) => ({
    name: g.nombre.length > 20 ? `${g.nombre.slice(0, 18)}…` : g.nombre,
    valor: g.valor_total,
    pagado: g.valor_pagado,
  }));

  if (loading && !list) {
    return (
      <div className="rounded-xl border bg-white p-8 text-center text-slate-500">
        Cargando contratos desde datos.gov.co… puede tardar hasta 1 minuto la primera vez.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-[#111827]">Contratos y ejecución SECOP II</h2>
        <button
          type="button"
          onClick={() => secopApi.exportExcel("secop2", anio)}
          className="inline-flex items-center gap-1.5 rounded-md bg-[#3eafd4] px-3 py-2 text-sm font-medium text-white hover:bg-[#2d9bbf]"
        >
          <Download className="h-4 w-4" />
          Exportar Excel
        </button>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      {kpis && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Registros" value={kpis.total_registros} icon={<Layers className="h-5 w-5" />} />
          <StatCard label="Valor contratado" value={formatCOP(kpis.valor_total)} icon={<DollarSign className="h-5 w-5" />} />
          <StatCard label="Valor pagado" value={formatCOP(kpis.valor_pagado_total)} icon={<TrendingUp className="h-5 w-5" />} accent="border-l-emerald-500" iconBg="bg-emerald-500" />
          <StatCard label="Por vencer (30d)" value={kpis.contratos_por_vencer_30d} icon={<Clock className="h-5 w-5" />} accent="border-l-amber-500" iconBg="bg-amber-500" />
        </div>
      )}

      {venc && (
        <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {[
            ["vencidos_ejecucion", "Vencidos en ejecución"],
            ["por_vencer_7", "≤ 7 días"],
            ["por_vencer_15", "≤ 15 días"],
            ["por_vencer_30", "≤ 30 días"],
            ["por_vencer_60", "≤ 60 días"],
            ["vencidos_sin_liquidar", "Sin liquidar"],
          ].map(([key, label]) => {
            const bucket = venc[key];
            return (
              <div key={key} className="rounded-lg border border-slate-200 bg-white p-3 text-center shadow-sm">
                <div className="text-2xl font-bold text-slate-800">{bucket?.count ?? 0}</div>
                <div className="text-[0.65rem] font-medium uppercase text-slate-500">{label}</div>
              </div>
            );
          })}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        {lineData.length > 0 && (
          <ChartCard title={`Contratado vs pagado — ${anio}`}>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={lineData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="mes" tick={{ fontSize: 9 }} />
                <YAxis tick={{ fontSize: 9 }} tickFormatter={(v) => `${Math.round(Number(v) / 1e6)}M`} />
                <Tooltip formatter={(v) => formatCOP(Number(v ?? 0))} />
                <Legend />
                <Line type="monotone" dataKey="contratacion" name="Contratado" stroke="#1d4ed8" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="pagos" name="Pagado" stroke="#10b981" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </ChartCard>
        )}

        {analytics && (
          <ChartCard title="Por modalidad">
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={(analytics.por_modalidad || []).slice(0, 6)} dataKey="count" nameKey="label" cx="50%" cy="50%" outerRadius={70}>
                  {(analytics.por_modalidad || []).slice(0, 6).map((entry, i) => (
                    <Cell key={entry.label} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </ChartCard>
        )}

        {depChartData.length > 0 && (
          <ChartCard title={`Por ${depTab === "supervisor" ? "supervisor" : "ordenador"}`}>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={depChartData} layout="vertical" margin={{ left: 4, right: 8 }}>
                <XAxis type="number" hide />
                <YAxis type="category" dataKey="name" width={90} tick={{ fontSize: 8 }} />
                <Tooltip formatter={(v) => formatCOP(Number(v ?? 0))} />
                <Bar dataKey="valor" name="Contratado" fill="#3eafd4" radius={[0, 4, 4, 0]} />
                <Bar dataKey="pagado" name="Pagado" fill="#10b981" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        )}
      </div>

      <div className="space-y-3">
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setDepTab("supervisor")}
            className={`rounded-lg px-4 py-2 text-sm font-medium ${depTab === "supervisor" ? "bg-[#3eafd4] text-white" : "bg-slate-100 text-slate-600"}`}
          >
            Por supervisor
          </button>
          <button
            type="button"
            onClick={() => setDepTab("ordenador")}
            className={`rounded-lg px-4 py-2 text-sm font-medium ${depTab === "ordenador" ? "bg-[#3eafd4] text-white" : "bg-slate-100 text-slate-600"}`}
          >
            Por ordenador del gasto
          </button>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {groups.map((g) => (
            <button
              key={g.nombre}
              type="button"
              onClick={() => {
                setResponsableFilter(g.nombre === responsableFilter ? "" : g.nombre);
                setPage(1);
              }}
              className={`rounded-xl border bg-white p-4 text-left shadow-sm transition-colors ${
                responsableFilter === g.nombre ? "border-[#3eafd4] ring-1 ring-[#3eafd4]" : "border-slate-200 hover:border-slate-300"
              }`}
            >
              <h3 className="mb-2 truncate font-semibold text-slate-800" title={g.nombre}>
                {g.nombre}
              </h3>
              <div className="mb-2 grid grid-cols-2 gap-2 text-sm">
                <span>{g.contratos} contratos</span>
                <span>{formatCOP(g.valor_total)}</span>
              </div>
              <ProgressBar value={g.avance_promedio} label="Avance financiero" color="bg-emerald-500" />
              <div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-500">
                <span>Pagado: {formatCOP(g.valor_pagado)}</span>
                {g.vencidos > 0 && (
                  <span className="flex items-center gap-1 text-red-600">
                    <AlertTriangle className="h-3 w-3" />
                    {g.vencidos} vencidos
                  </span>
                )}
              </div>
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <div className="relative min-w-[200px] flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Buscar número de proceso, objeto, proveedor…"
            className="w-full rounded-md border border-slate-300 py-2 pl-9 pr-3 text-sm focus:border-[#3eafd4] focus:outline-none focus:ring-1 focus:ring-[#3eafd4]"
          />
        </div>
        <select
          value={tipoRegistro}
          onChange={(e) => {
            setTipoRegistro(e.target.value);
            setPage(1);
          }}
          className="rounded-md border border-slate-300 px-3 py-2 text-sm"
        >
          <option value="all">Todos</option>
          <option value="contrato">Con contrato</option>
          <option value="proceso">Sin contrato</option>
        </select>
        {responsableFilter && (
          <button
            type="button"
            onClick={() => setResponsableFilter("")}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-600"
          >
            Quitar filtro: {responsableFilter.slice(0, 24)}…
          </button>
        )}
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-4 py-3">
          <h3 className="text-sm font-semibold text-slate-700">Contratos y procesos</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3"> </th>
                <th className="px-4 py-3">N.º proceso</th>
                <th className="px-4 py-3">Tipo</th>
                <th className="px-4 py-3">Estado</th>
                <th className="px-4 py-3">Proveedor</th>
                <th className="px-4 py-3">Supervisor</th>
                <th className="px-4 py-3 text-right">Valor</th>
                <th className="px-4 py-3 w-28">Avance</th>
                <th className="px-4 py-3">Días</th>
              </tr>
            </thead>
            <tbody>
              {(list?.results || []).length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-slate-500">
                    No hay registros para {anio}.
                  </td>
                </tr>
              ) : (
                (list?.results || []).map((row) => {
                  const avance = row.avance;
                  return (
                    <tr
                      key={row.id}
                      className="cursor-pointer border-b border-slate-50 hover:bg-slate-50"
                      onClick={() => setSelected(row)}
                    >
                      <td className="px-4 py-3">
                        <SemaforoDot semaforo={avance?.semaforo || "gris"} />
                      </td>
                      <td className="px-4 py-3 font-medium text-slate-800">{row.referencia}</td>
                      <td className="px-4 py-3">
                        <span className={`rounded px-1.5 py-0.5 text-[0.7rem] font-medium ${row.tipo_registro === "contrato" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>
                          {row.tipo_registro === "contrato" ? "Contrato" : "Proceso"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-600">{row.estado}</td>
                      <td className="max-w-[140px] truncate px-4 py-3 text-slate-600">{row.proveedor || "—"}</td>
                      <td className="max-w-[120px] truncate px-4 py-3 text-slate-500">{row.supervisor || "—"}</td>
                      <td className="px-4 py-3 text-right font-medium">{formatCOP(row.valor_con_adiciones || row.valor)}</td>
                      <td className="px-4 py-3">
                        <ProgressBar value={avance?.avance_financiero ?? avance?.avance_tiempo ?? null} color="bg-emerald-500" />
                      </td>
                      <td className="px-4 py-3 text-slate-500">{avance?.dias_restantes ?? "—"}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3">
            <span className="text-[0.78rem] text-slate-500">
              Página {page} de {totalPages} ({list?.count} registros)
            </span>
            <div className="flex gap-2">
              <button type="button" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="rounded border px-3 py-1 text-sm disabled:opacity-40">
                Anterior
              </button>
              <button type="button" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)} className="rounded border px-3 py-1 text-sm disabled:opacity-40">
                Siguiente
              </button>
            </div>
          </div>
        )}
      </div>

      {selected && <SecopDetalleModal record={selected} anio={anio} onClose={() => setSelected(null)} />}
    </div>
  );
}
