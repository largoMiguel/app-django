import { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle,
  Clock,
  DollarSign,
  Download,
  FileText,
  Layers,
  Search,
  TrendingUp,
  X,
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
import {
  ChartCard,
  ProgressBar,
  SectionHeader,
  SemaforoDot,
  StatCard,
  TipoRegistroBadge,
} from "./components";
import SecopDetalleModal from "./SecopDetalleModal";

const PIE_COLORS = ["#3eafd4", "#1d4ed8", "#0e7490", "#6366f1", "#8b5cf6", "#f59e0b"];

const VENCIMIENTO_STYLES: Record<string, { ring: string; text: string }> = {
  vencidos_ejecucion: { ring: "ring-red-200", text: "text-red-700" },
  por_vencer_7: { ring: "ring-orange-200", text: "text-orange-700" },
  por_vencer_15: { ring: "ring-amber-200", text: "text-amber-700" },
  por_vencer_30: { ring: "ring-yellow-200", text: "text-yellow-700" },
  por_vencer_60: { ring: "ring-lime-200", text: "text-lime-700" },
  vencidos_sin_liquidar: { ring: "ring-purple-200", text: "text-purple-700" },
};

function pagadoDisplay(row: SecopRecord) {
  if (!row.datos_pago_disponibles && row.tipo_registro === "contrato") return "N/D";
  const val = row.total_pagado_real ?? row.valor_pagado;
  return val != null ? formatCOP(val) : "—";
}

export default function SecopIIPage() {
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
      setError(formatApiError(err) || "No se pudo cargar SECOP II.");
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

  const kpis = list?.kpis || resumen?.kpis;
  const venc = resumen?.vencimientos;
  const analytics = list?.analitica;
  const groups = depTab === "supervisor" ? supervisores : ordenadores;
  const totalPages = list ? Math.ceil(list.count / 15) : 1;

  const lineData = (resumen?.pagos?.serie_mensual_pagos || []).map((p, i) => ({
    mes: p.mes,
    pagos: p.valor,
    contratacion: resumen?.secop2.analitica?.serie_mensual?.[i]?.valor || 0,
  }));

  if (loading && !list) {
    return (
      <div className="flex min-h-[320px] items-center justify-center rounded-2xl border border-slate-200 bg-white">
        <div className="text-center">
          <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-2 border-[#3eafd4] border-t-transparent" />
          <p className="text-sm text-slate-500">Consultando datos.gov.co…</p>
          <p className="mt-1 text-xs text-slate-400">La primera carga puede tardar hasta 1 minuto</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Encabezado */}
      <div className="flex flex-wrap items-start justify-between gap-4 rounded-2xl border border-slate-200 bg-gradient-to-br from-white to-slate-50 p-5 shadow-sm">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-[#0e7490]">Datos abiertos Colombia</p>
          <h2 className="mt-1 text-xl font-bold text-slate-900">SECOP II</h2>
          <p className="mt-1 max-w-xl text-sm text-slate-500">
            Procesos, contratos, ejecución financiera y responsables — vigencia {anio}
          </p>
        </div>
        <button
          type="button"
          onClick={() => secopApi.exportExcel("secop2", anio)}
          className="inline-flex items-center gap-2 rounded-lg bg-[#3eafd4] px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-[#2d9bbf]"
        >
          <Download className="h-4 w-4" />
          Exportar Excel
        </button>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      {/* KPIs */}
      {kpis && (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
          <StatCard label="Registros" value={kpis.total_registros} icon={<Layers className="h-5 w-5" />} />
          <StatCard label="Contratos" value={kpis.total_contratos} icon={<FileText className="h-5 w-5" />} />
          <StatCard
            label="Sin contrato"
            value={kpis.total_procesos_sin_contrato}
            icon={<FileText className="h-5 w-5" />}
            accent="border-l-amber-500"
            iconBg="bg-amber-500"
          />
          <StatCard label="Valor contratado" value={formatCOP(kpis.valor_total)} icon={<DollarSign className="h-5 w-5" />} />
          <StatCard
            label="Valor pagado"
            value={formatCOP(kpis.valor_pagado_total)}
            icon={<TrendingUp className="h-5 w-5" />}
            accent="border-l-emerald-500"
            iconBg="bg-emerald-500"
          />
          <StatCard
            label="Por vencer (30d)"
            value={kpis.contratos_por_vencer_30d}
            icon={<Clock className="h-5 w-5" />}
            accent="border-l-orange-500"
            iconBg="bg-orange-500"
          />
        </div>
      )}

      {/* Vencimientos */}
      {venc && (
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <SectionHeader title="Vencimientos" description="Contratos por plazo y liquidación" />
          <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-6">
            {[
              ["vencidos_ejecucion", "Vencidos"],
              ["por_vencer_7", "≤ 7 días"],
              ["por_vencer_15", "≤ 15 días"],
              ["por_vencer_30", "≤ 30 días"],
              ["por_vencer_60", "≤ 60 días"],
              ["vencidos_sin_liquidar", "Sin liquidar"],
            ].map(([key, label]) => {
              const bucket = venc[key];
              const style = VENCIMIENTO_STYLES[key] || { ring: "ring-slate-200", text: "text-slate-700" };
              return (
                <div
                  key={key}
                  className={`rounded-xl bg-slate-50 p-3 text-center ring-1 ${style.ring}`}
                >
                  <div className={`text-2xl font-bold ${style.text}`}>{bucket?.count ?? 0}</div>
                  <div className="mt-0.5 text-[0.65rem] font-medium uppercase tracking-wide text-slate-500">{label}</div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Análisis + Responsables */}
      <div className="grid gap-6 xl:grid-cols-12">
        <div className="space-y-6 xl:col-span-8">
          {lineData.length > 0 && (
            <ChartCard title={`Contratado vs pagado — ${anio}`}>
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={lineData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="mes" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `${Math.round(Number(v) / 1e6)}M`} />
                  <Tooltip formatter={(v) => formatCOP(Number(v ?? 0))} />
                  <Legend />
                  <Line type="monotone" dataKey="contratacion" name="Contratado" stroke="#1d4ed8" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="pagos" name="Pagado" stroke="#10b981" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </ChartCard>
          )}

          <div className="grid gap-4 md:grid-cols-2">
            {analytics && (
              <ChartCard title="Por modalidad">
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie
                      data={(analytics.por_modalidad || []).slice(0, 6)}
                      dataKey="count"
                      nameKey="label"
                      cx="50%"
                      cy="50%"
                      outerRadius={72}
                    >
                      {(analytics.por_modalidad || []).slice(0, 6).map((entry, i) => (
                        <Cell key={entry.label} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </ChartCard>
            )}
            {analytics && (
              <ChartCard title="Top proveedores">
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={(analytics.top_proveedores_valor || []).slice(0, 6)} layout="vertical" margin={{ left: 4 }}>
                    <XAxis type="number" hide />
                    <YAxis type="category" dataKey="proveedor" width={96} tick={{ fontSize: 8 }} />
                    <Tooltip formatter={(v) => formatCOP(Number(v ?? 0))} />
                    <Bar dataKey="valor" fill="#1d4ed8" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </ChartCard>
            )}
          </div>
        </div>

        <aside className="xl:col-span-4">
          <div className="sticky top-4 rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-100 p-4">
              <SectionHeader
                title="Equipo de contratación"
                description="Supervisores y ordenadores del gasto"
              />
              <div className="flex rounded-lg bg-slate-100 p-1">
                <button
                  type="button"
                  onClick={() => setDepTab("supervisor")}
                  className={`flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                    depTab === "supervisor" ? "bg-white text-[#0e7490] shadow-sm" : "text-slate-600"
                  }`}
                >
                  Supervisores
                </button>
                <button
                  type="button"
                  onClick={() => setDepTab("ordenador")}
                  className={`flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                    depTab === "ordenador" ? "bg-white text-[#0e7490] shadow-sm" : "text-slate-600"
                  }`}
                >
                  Ordenadores
                </button>
              </div>
            </div>
            <div className="max-h-[420px] space-y-2 overflow-y-auto p-3">
              {groups.length === 0 ? (
                <p className="py-6 text-center text-xs text-slate-400">Sin datos para {anio}</p>
              ) : (
                groups.map((g) => (
                  <button
                    key={g.nombre}
                    type="button"
                    onClick={() => {
                      setResponsableFilter(g.nombre === responsableFilter ? "" : g.nombre);
                      setPage(1);
                    }}
                    className={`w-full rounded-xl border p-3 text-left transition-all ${
                      responsableFilter === g.nombre
                        ? "border-[#3eafd4] bg-[#3eafd4]/5 ring-1 ring-[#3eafd4]"
                        : "border-slate-100 bg-slate-50/50 hover:border-slate-200 hover:bg-white"
                    }`}
                  >
                    <p className="truncate text-sm font-semibold text-slate-800" title={g.nombre}>
                      {g.nombre}
                    </p>
                    <div className="mt-2 grid grid-cols-2 gap-x-2 gap-y-1 text-[0.7rem] text-slate-500">
                      <span>{g.contratos} contratos</span>
                      <span>{formatCOP(g.valor_total)}</span>
                      <span>Pagado: {formatCOP(g.valor_pagado)}</span>
                      {g.vencidos > 0 && (
                        <span className="flex items-center gap-0.5 text-red-600">
                          <AlertTriangle className="h-3 w-3" />
                          {g.vencidos} venc.
                        </span>
                      )}
                      {g.sin_liquidar > 0 && <span className="text-purple-600">{g.sin_liquidar} s/ liq.</span>}
                    </div>
                    <div className="mt-2">
                      <ProgressBar value={g.avance_promedio} label="Avance financiero" color="bg-emerald-500" />
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        </aside>
      </div>

      {/* Tabla completa */}
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 bg-slate-50/80 px-5 py-4">
          <SectionHeader
            title="Registro de procesos y contratos"
            description="Ejecución financiera, plazos y estado por registro"
            action={
              responsableFilter ? (
                <button
                  type="button"
                  onClick={() => setResponsableFilter("")}
                  className="inline-flex items-center gap-1 rounded-full bg-[#3eafd4]/10 px-3 py-1 text-xs font-medium text-[#0e7490]"
                >
                  {responsableFilter.slice(0, 28)}
                  <X className="h-3 w-3" />
                </button>
              ) : undefined
            }
          />
          <div className="flex flex-wrap gap-2">
            <div className="relative min-w-[220px] flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                placeholder="N.º proceso, objeto, proveedor, modalidad…"
                className="w-full rounded-lg border border-slate-200 bg-white py-2.5 pl-9 pr-3 text-sm shadow-sm focus:border-[#3eafd4] focus:outline-none focus:ring-2 focus:ring-[#3eafd4]/20"
              />
            </div>
            <select
              value={tipoRegistro}
              onChange={(e) => {
                setTipoRegistro(e.target.value);
                setPage(1);
              }}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm shadow-sm"
            >
              <option value="all">Todos los registros</option>
              <option value="contrato">Solo contratos</option>
              <option value="proceso">Solo procesos</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-[1100px] w-full text-left text-sm">
            <thead className="border-b border-slate-100 bg-white text-[0.65rem] font-semibold uppercase tracking-wider text-slate-500">
              <tr>
                <th className="sticky left-0 z-10 bg-white px-4 py-3"> </th>
                <th className="px-4 py-3">N.º proceso</th>
                <th className="px-4 py-3">Tipo</th>
                <th className="px-4 py-3">Modalidad</th>
                <th className="px-4 py-3">Estado</th>
                <th className="px-4 py-3">Proveedor</th>
                <th className="px-4 py-3">Supervisor</th>
                <th className="px-4 py-3 text-right">Valor</th>
                <th className="px-4 py-3 text-right">Pagado</th>
                <th className="px-4 py-3">Financiero</th>
                <th className="px-4 py-3 text-center">Días</th>
                <th className="px-4 py-3">Firma</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {(list?.results || []).length === 0 ? (
                <tr>
                  <td colSpan={12} className="px-4 py-12 text-center text-slate-500">
                    No hay registros para {anio}.
                  </td>
                </tr>
              ) : (
                (list?.results || []).map((row) => {
                  const avance = row.avance;
                  return (
                    <tr
                      key={row.id}
                      className="group cursor-pointer hover:bg-[#3eafd4]/[0.03]"
                      onClick={() => setSelected(row)}
                    >
                      <td className="sticky left-0 z-10 bg-white px-4 py-3 group-hover:bg-[#f0fbff]">
                        <SemaforoDot semaforo={avance?.semaforo || "gris"} />
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-semibold text-slate-800">{row.referencia}</div>
                        {row.referencia_contrato && row.referencia_contrato !== row.referencia && (
                          <div className="text-[0.65rem] text-slate-400">{row.referencia_contrato}</div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <TipoRegistroBadge tipo={row.tipo_registro} />
                      </td>
                      <td className="max-w-[120px] truncate px-4 py-3 text-slate-600" title={row.modalidad || ""}>
                        {row.modalidad || "—"}
                      </td>
                      <td className="max-w-[130px] truncate px-4 py-3 text-slate-600">{row.estado}</td>
                      <td className="max-w-[140px] truncate px-4 py-3 text-slate-600">{row.proveedor || "—"}</td>
                      <td className="max-w-[120px] truncate px-4 py-3 text-slate-500">{row.supervisor || "—"}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-right font-medium text-slate-800">
                        {formatCOP(row.valor_con_adiciones || row.valor)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-right text-slate-600">{pagadoDisplay(row)}</td>
                      <td className="px-4 py-3">
                        <ProgressBar value={avance?.avance_financiero ?? null} color="bg-emerald-500" compact />
                      </td>
                      <td className="px-4 py-3 text-center">
                        {avance?.dias_restantes != null ? (
                          <span
                            className={`inline-flex min-w-[2rem] justify-center rounded-md px-1.5 py-0.5 text-xs font-medium ${
                              avance.dias_restantes < 0
                                ? "bg-red-50 text-red-700"
                                : avance.dias_restantes <= 30
                                  ? "bg-amber-50 text-amber-700"
                                  : "bg-slate-50 text-slate-600"
                            }`}
                          >
                            {avance.dias_restantes}
                          </span>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-slate-500">
                        {row.fecha_firma?.slice(0, 10) || "—"}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50/50 px-5 py-3">
            <span className="text-xs text-slate-500">
              Página {page} de {totalPages} · {list?.count} registros
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
                className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm disabled:opacity-40"
              >
                Anterior
              </button>
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm disabled:opacity-40"
              >
                Siguiente
              </button>
            </div>
          </div>
        )}
      </section>

      {selected && <SecopDetalleModal record={selected} anio={anio} onClose={() => setSelected(null)} />}
    </div>
  );
}
