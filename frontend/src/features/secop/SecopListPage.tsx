import { useCallback, useEffect, useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { Download, Search, DollarSign, FileText, Layers } from "lucide-react";
import { formatCOP, secopApi, type PaginatedSecop, type SecopRecord } from "@/core/api/secop";
import { formatApiError } from "@/core/api/errors";
import { useSecopYear } from "./SecopYearContext";
import { ChartCard, StatCard } from "./components";
import SecopDetalleModal from "./SecopDetalleModal";

const PIE_COLORS = ["#3eafd4", "#1d4ed8", "#0e7490", "#6366f1", "#8b5cf6", "#f59e0b"];

interface Props {
  fuente: "secop1" | "secop2";
}

export default function SecopListPage({ fuente }: Props) {
  const { anio, loadingConfig } = useSecopYear();
  const [list, setList] = useState<PaginatedSecop | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [tipoRegistro, setTipoRegistro] = useState("all");
  const [selected, setSelected] = useState<SecopRecord | null>(null);

  const load = useCallback(async () => {
    if (loadingConfig) return;
    setLoading(true);
    setError("");
    try {
      const params: Record<string, string | number> = { anio, page, page_size: 15 };
      if (search.trim()) params.search = search.trim();
      if (tipoRegistro !== "all") params.tipo_registro = tipoRegistro;
      const listRes =
        fuente === "secop2" ? await secopApi.listSecop2(params) : await secopApi.listSecop1(params);
      setList(listRes);
    } catch (err) {
      setList(null);
      setError(formatApiError(err) || "No se pudo cargar los contratos. Intente de nuevo o use «Actualizar datos».");
    } finally {
      setLoading(false);
    }
  }, [anio, page, search, tipoRegistro, fuente, loadingConfig]);

  useEffect(() => {
    const t = setTimeout(load, search ? 400 : 0);
    return () => clearTimeout(t);
  }, [load, search]);

  const analytics = list?.analitica;
  const kpis = list?.kpis || analytics?.kpis;
  const totalPages = list ? Math.ceil(list.count / 15) : 1;
  const title = fuente === "secop2" ? "SECOP II — procesos y contratos" : "SECOP I — contratos históricos";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-[#111827]">{title}</h2>
        <button
          type="button"
          onClick={() => secopApi.exportExcel(fuente, anio)}
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
          <StatCard label="Contratos" value={kpis.total_contratos} icon={<FileText className="h-5 w-5" />} />
          {fuente === "secop2" && (
            <StatCard label="Sin contrato" value={kpis.total_procesos_sin_contrato} icon={<FileText className="h-5 w-5" />} accent="border-l-amber-500" iconBg="bg-amber-500" />
          )}
          <StatCard label="Valor total" value={formatCOP(kpis.valor_total)} icon={<DollarSign className="h-5 w-5" />} />
        </div>
      )}

      {analytics && (
        <div className="grid gap-4 lg:grid-cols-2">
          <ChartCard title="Por modalidad">
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={(analytics.por_modalidad || []).slice(0, 6)} dataKey="count" nameKey="label" cx="50%" cy="50%" outerRadius={80}>
                  {(analytics.por_modalidad || []).slice(0, 6).map((entry, i) => (
                    <Cell key={entry.label} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </ChartCard>
          <ChartCard title="Top proveedores">
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={(analytics.top_proveedores_valor || []).slice(0, 6)} layout="vertical">
                <XAxis type="number" hide />
                <YAxis type="category" dataKey="proveedor" width={100} tick={{ fontSize: 9 }} />
                <Tooltip formatter={(v) => formatCOP(Number(v ?? 0))} />
                <Bar dataKey="valor" fill="#1d4ed8" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <div className="relative min-w-[200px] flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Buscar referencia, objeto, proveedor…"
            className="w-full rounded-md border border-slate-300 py-2 pl-9 pr-3 text-sm focus:border-[#3eafd4] focus:outline-none focus:ring-1 focus:ring-[#3eafd4]"
          />
        </div>
        {fuente === "secop2" && (
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
        )}
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        {loading ? (
          <div className="p-8 text-center text-slate-500">
            Cargando contratos desde datos.gov.co… puede tardar hasta 1 minuto la primera vez.
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="border-b border-slate-100 bg-slate-50 text-xs uppercase text-slate-500">
                  <tr>
                    <th className="px-4 py-3">Referencia</th>
                    <th className="px-4 py-3">Tipo</th>
                    <th className="px-4 py-3">Estado</th>
                    <th className="px-4 py-3">Proveedor</th>
                    <th className="px-4 py-3 text-right">Valor</th>
                    <th className="px-4 py-3">Firma</th>
                  </tr>
                </thead>
                <tbody>
                  {(list?.results || []).length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                        No hay registros para {anio}. Pruebe otro año en el selector de vigencia.
                      </td>
                    </tr>
                  ) : (
                    (list?.results || []).map((row) => (
                      <tr
                        key={row.id}
                        className="cursor-pointer border-b border-slate-50 hover:bg-slate-50"
                        onClick={() => setSelected(row)}
                      >
                        <td className="px-4 py-3 font-medium text-slate-800">{row.referencia}</td>
                        <td className="px-4 py-3">
                          <span className={`rounded px-1.5 py-0.5 text-[0.7rem] font-medium ${row.tipo_registro === "contrato" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>
                            {row.tipo_registro === "contrato" ? "Contrato" : "Proceso"}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-600">{row.estado}</td>
                        <td className="max-w-[180px] truncate px-4 py-3 text-slate-600">{row.proveedor || "—"}</td>
                        <td className="px-4 py-3 text-right font-medium">{formatCOP(row.valor)}</td>
                        <td className="px-4 py-3 text-slate-500">{row.fecha_firma?.slice(0, 10) || "—"}</td>
                      </tr>
                    ))
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
          </>
        )}
      </div>

      {selected && (
        <SecopDetalleModal record={selected} anio={anio} onClose={() => setSelected(null)} />
      )}
    </div>
  );
}
