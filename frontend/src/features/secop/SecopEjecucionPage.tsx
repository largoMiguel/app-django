import { useCallback, useEffect, useState } from "react";
import { DollarSign, Clock, TrendingUp, AlertTriangle } from "lucide-react";
import { Line, LineChart, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from "recharts";
import { formatCOP, secopApi, type SecopRecord } from "@/core/api/secop";
import { useSecopYear } from "./SecopYearContext";
import { ChartCard, ProgressBar, SemaforoDot, StatCard } from "./components";
import SecopDetalleModal from "./SecopDetalleModal";

export default function SecopEjecucionPage() {
  const { anio } = useSecopYear();
  const [results, setResults] = useState<SecopRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<SecopRecord | null>(null);
  const [resumen, setResumen] = useState<Awaited<ReturnType<typeof secopApi.resumen>> | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [ej, res] = await Promise.all([
        secopApi.ejecucion({ anio, page: 1, page_size: 100 }),
        secopApi.resumen(anio),
      ]);
      setResults(ej.results);
      setResumen(res);
    } finally {
      setLoading(false);
    }
  }, [anio]);

  useEffect(() => {
    load();
  }, [load]);

  const kpis = resumen?.kpis;
  const venc = resumen?.vencimientos;
  const pagos = resumen?.pagos;

  const chartData = (pagos?.serie_mensual_pagos || []).map((p, i) => ({
    mes: p.mes,
    pagos: p.valor,
    contratacion: resumen?.secop2.analitica?.serie_mensual?.[i]?.valor || 0,
  }));

  if (loading) {
    return <div className="rounded-xl border bg-white p-8 text-center text-slate-500">Cargando ejecución…</div>;
  }

  return (
    <div className="space-y-6">
      {kpis && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Valor contratado" value={formatCOP(kpis.valor_total)} icon={<DollarSign className="h-5 w-5" />} />
          <StatCard label="Valor pagado" value={formatCOP(kpis.valor_pagado_total)} icon={<TrendingUp className="h-5 w-5" />} accent="border-l-emerald-500" iconBg="bg-emerald-500" />
          <StatCard label="Por vencer (30d)" value={kpis.contratos_por_vencer_30d} icon={<Clock className="h-5 w-5" />} accent="border-l-amber-500" iconBg="bg-amber-500" />
          <StatCard label="Vencidos" value={kpis.contratos_vencidos} icon={<AlertTriangle className="h-5 w-5" />} accent="border-l-red-500" iconBg="bg-red-500" />
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

      {chartData.length > 0 && (
        <ChartCard title={`Contratado vs pagado — ${anio}`}>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={chartData}>
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

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-4 py-3">
          <h3 className="text-sm font-semibold text-slate-700">Avance por contrato</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3"> </th>
                <th className="px-4 py-3">Referencia</th>
                <th className="px-4 py-3">Proveedor</th>
                <th className="px-4 py-3">Estado</th>
                <th className="px-4 py-3 text-right">Valor</th>
                <th className="px-4 py-3 text-right">Pagado</th>
                <th className="px-4 py-3 w-36">Avance tiempo</th>
                <th className="px-4 py-3 w-36">Avance financiero</th>
                <th className="px-4 py-3">Días</th>
              </tr>
            </thead>
            <tbody>
              {results.map((row) => (
                <tr
                  key={row.id}
                  className="cursor-pointer border-b border-slate-50 hover:bg-slate-50"
                  onClick={() => setSelected(row)}
                >
                  <td className="px-4 py-3">
                    <SemaforoDot semaforo={row.avance?.semaforo || "gris"} />
                  </td>
                  <td className="px-4 py-3 font-medium">{row.referencia}</td>
                  <td className="max-w-[140px] truncate px-4 py-3 text-slate-600">{row.proveedor || "—"}</td>
                  <td className="px-4 py-3 text-slate-600">{row.estado}</td>
                  <td className="px-4 py-3 text-right">{formatCOP(row.valor_con_adiciones || row.valor)}</td>
                  <td className="px-4 py-3 text-right">
                    {row.datos_pago_disponibles ? formatCOP(row.valor_pagado) : "N/D"}
                  </td>
                  <td className="px-4 py-3">
                    <ProgressBar value={row.avance?.avance_tiempo ?? null} color="bg-blue-400" />
                  </td>
                  <td className="px-4 py-3">
                    <ProgressBar value={row.avance?.avance_financiero ?? null} color="bg-emerald-500" />
                  </td>
                  <td className="px-4 py-3 text-slate-500">{row.avance?.dias_restantes ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {selected && <SecopDetalleModal record={selected} anio={anio} onClose={() => setSelected(null)} />}
    </div>
  );
}
