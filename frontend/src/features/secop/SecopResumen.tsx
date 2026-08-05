import { useEffect, useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  CartesianGrid,
} from "recharts";
import { AlertTriangle, DollarSign, FileText, Users, TrendingUp } from "lucide-react";
import { formatCOP, secopApi, type SecopResumen } from "@/core/api/secop";
import { useSecopYear } from "./SecopYearContext";
import { ChartCard, StatCard, SeverityBadge } from "./components";

export default function SecopResumen() {
  const { anio } = useSecopYear();
  const [data, setData] = useState<SecopResumen | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    secopApi
      .resumen(anio)
      .then((res) => {
        if (!cancelled) setData(res);
      })
      .catch(() => {
        if (!cancelled) setError("No se pudo cargar el resumen SECOP.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [anio]);

  if (loading) {
    return <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-slate-500">Cargando resumen…</div>;
  }
  if (error || !data) {
    return <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-red-700">{error || "Sin datos"}</div>;
  }

  const kpis = data.kpis;
  const trend = data.secop2.analitica?.serie_mensual || [];

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Valor contratado" value={formatCOP(kpis.valor_total)} icon={<DollarSign className="h-5 w-5" />} />
        <StatCard
          label="Contratos"
          value={kpis.total_contratos}
          sub={`${kpis.total_procesos_sin_contrato} procesos sin contrato`}
          icon={<FileText className="h-5 w-5" />}
        />
        <StatCard label="Proveedores" value={kpis.proveedores_unicos} icon={<Users className="h-5 w-5" />} />
        <StatCard
          label="Alertas activas"
          value={data.total_alertas}
          sub={`${data.alertas_criticas.length} críticas/altas`}
          icon={<AlertTriangle className="h-5 w-5" />}
          accent="border-l-orange-500"
          iconBg="bg-orange-500"
        />
      </div>

      {data.comparativo && (
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-700">
            <TrendingUp className="h-4 w-4 text-[#3eafd4]" />
            Comparativo vs {anio - 1}
          </div>
          <div className="flex flex-wrap gap-6 text-sm text-slate-600">
            <span>
              Valor:{" "}
              <strong className={data.comparativo.delta_valor_total && data.comparativo.delta_valor_total >= 0 ? "text-emerald-600" : "text-red-600"}>
                {data.comparativo.delta_valor_total != null ? formatCOP(data.comparativo.delta_valor_total) : "—"}
              </strong>
            </span>
            <span>
              Contratos:{" "}
              <strong>{data.comparativo.delta_total_contratos ?? "—"}</strong>
            </span>
          </div>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard title={`Ejecución mensual SECOP II — ${anio}`}>
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={trend}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis dataKey="mes" tick={{ fontSize: 10, fill: "#64748b" }} />
              <YAxis tick={{ fontSize: 10, fill: "#64748b" }} tickFormatter={(v) => `${Math.round(v / 1e6)}M`} />
              <Tooltip formatter={(v) => formatCOP(Number(v ?? 0))} />
              <Line type="monotone" dataKey="valor" stroke="#3eafd4" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Modalidad de contratación (SECOP II)">
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={(data.secop2.analitica?.por_modalidad || []).slice(0, 8)} layout="vertical" margin={{ left: 8, right: 16 }}>
              <XAxis type="number" hide />
              <YAxis type="category" dataKey="label" width={120} tick={{ fontSize: 9, fill: "#64748b" }} />
              <Tooltip />
              <Bar dataKey="count" fill="#3eafd4" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="mb-3 text-xs font-bold uppercase tracking-wide text-slate-600">SECOP I — histórico</h3>
          <p className="text-2xl font-bold text-slate-800">{data.secop1.kpis.total_contratos} contratos</p>
          <p className="text-sm text-slate-500">{formatCOP(data.secop1.kpis.valor_total)}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="mb-3 text-xs font-bold uppercase tracking-wide text-slate-600">SECOP II — vigencia</h3>
          <p className="text-2xl font-bold text-slate-800">{data.secop2.kpis.total_registros} registros</p>
          <p className="text-sm text-slate-500">
            {data.secop2.kpis.contratos_vigentes} vigentes · {data.secop2.kpis.contratos_por_vencer_30d} por vencer
          </p>
        </div>
      </div>

      {data.alertas_criticas.length > 0 && (
        <div className="rounded-xl border border-orange-200 bg-orange-50/50 p-5">
          <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-orange-900">
            <AlertTriangle className="h-4 w-4" />
            Alertas prioritarias
          </h3>
          <ul className="space-y-2">
            {data.alertas_criticas.map((a) => (
              <li key={a.codigo} className="flex flex-wrap items-start gap-2 rounded-lg bg-white/80 px-3 py-2 text-sm">
                <SeverityBadge severidad={a.severidad} />
                <span className="font-medium text-slate-800">{a.titulo}</span>
                <span className="text-slate-500">— {a.mensaje}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
