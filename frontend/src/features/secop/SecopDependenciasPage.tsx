import { useEffect, useState } from "react";
import { Users, DollarSign, AlertTriangle } from "lucide-react";
import { Bar, BarChart, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { formatCOP, secopApi, type SecopResponsableGroup } from "@/core/api/secop";
import { useSecopYear } from "./SecopYearContext";
import { ChartCard, ProgressBar, StatCard } from "./components";

export default function SecopDependenciasPage() {
  const { anio } = useSecopYear();
  const [supervisores, setSupervisores] = useState<SecopResponsableGroup[]>([]);
  const [ordenadores, setOrdenadores] = useState<SecopResponsableGroup[]>([]);
  const [tab, setTab] = useState<"supervisor" | "ordenador">("supervisor");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    secopApi
      .dependencias(anio)
      .then((res) => {
        setSupervisores(res.por_supervisor);
        setOrdenadores(res.por_ordenador);
      })
      .finally(() => setLoading(false));
  }, [anio]);

  const groups = tab === "supervisor" ? supervisores : ordenadores;
  const chartData = groups.slice(0, 8).map((g) => ({
    name: g.nombre.length > 20 ? `${g.nombre.slice(0, 18)}…` : g.nombre,
    valor: g.valor_total,
    pagado: g.valor_pagado,
  }));

  if (loading) {
    return <div className="rounded-xl border bg-white p-8 text-center text-slate-500">Cargando dependencias…</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setTab("supervisor")}
          className={`rounded-lg px-4 py-2 text-sm font-medium ${tab === "supervisor" ? "bg-[#3eafd4] text-white" : "bg-slate-100 text-slate-600"}`}
        >
          Por supervisor
        </button>
        <button
          type="button"
          onClick={() => setTab("ordenador")}
          className={`rounded-lg px-4 py-2 text-sm font-medium ${tab === "ordenador" ? "bg-[#3eafd4] text-white" : "bg-slate-100 text-slate-600"}`}
        >
          Por ordenador del gasto
        </button>
      </div>

      {chartData.length > 0 && (
        <ChartCard title={`Valor contratado por ${tab === "supervisor" ? "supervisor" : "ordenador"}`}>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={chartData} layout="vertical" margin={{ left: 8, right: 16 }}>
              <XAxis type="number" hide />
              <YAxis type="category" dataKey="name" width={130} tick={{ fontSize: 9 }} />
              <Tooltip formatter={(v) => formatCOP(Number(v ?? 0))} />
              <Bar dataKey="valor" name="Contratado" fill="#3eafd4" radius={[0, 4, 4, 0]} />
              <Bar dataKey="pagado" name="Pagado" fill="#10b981" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      )}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {groups.map((g) => (
          <div key={g.nombre} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="mb-3 truncate font-semibold text-slate-800" title={g.nombre}>
              {g.nombre}
            </h3>
            <div className="mb-4 grid grid-cols-2 gap-3">
              <StatCard label="Contratos" value={g.contratos} icon={<Users className="h-4 w-4" />} />
              <StatCard label="Valor" value={formatCOP(g.valor_total)} icon={<DollarSign className="h-4 w-4" />} />
            </div>
            <div className="mb-3">
              <ProgressBar value={g.avance_promedio} label="Avance financiero promedio" color="bg-emerald-500" />
            </div>
            <div className="flex flex-wrap gap-3 text-xs text-slate-500">
              <span>Pagado: {formatCOP(g.valor_pagado)}</span>
              {g.vencidos > 0 && (
                <span className="flex items-center gap-1 text-red-600">
                  <AlertTriangle className="h-3 w-3" />
                  {g.vencidos} vencidos
                </span>
              )}
              {g.sin_liquidar > 0 && <span className="text-orange-600">{g.sin_liquidar} sin liquidar</span>}
            </div>
          </div>
        ))}
      </div>

      {groups.length === 0 && (
        <p className="text-center text-sm text-slate-500">
          No hay datos de {tab === "supervisor" ? "supervisores" : "ordenadores del gasto"} para {anio}.
        </p>
      )}
    </div>
  );
}
