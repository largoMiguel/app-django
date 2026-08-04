import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, Calendar, CheckCircle2, ClipboardList, TrendingUp } from "lucide-react";
import { planesApi, type PlanStats } from "@/core/api/planes";
import { formatApiError } from "@/core/api/errors";
import { PlanesCard, PlanesLoading } from "./components/PlanesUi";

const currentYear = new Date().getFullYear();

export default function PlanesDashboard() {
  const [anio, setAnio] = useState(currentYear);
  const [stats, setStats] = useState<PlanStats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    planesApi
      .stats(anio)
      .then(setStats)
      .catch((err) => setError(formatApiError(err)))
      .finally(() => setLoading(false));
  }, [anio]);

  if (loading) return <PlanesLoading />;
  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
    );
  }
  if (!stats) return null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <label className="text-sm font-medium text-slate-600">Vigencia</label>
        <select
          value={anio}
          onChange={(e) => setAnio(Number(e.target.value))}
          className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
        >
          {[currentYear - 1, currentYear, currentYear + 1].map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>
        <Link to="/planes/lista" className="text-sm font-medium text-[#0e7490] hover:underline">
          Ver todos los planes →
        </Link>
      </div>

      <div className="rounded-lg border border-[#b8e4ef] bg-[#f0f9fc] px-4 py-3 text-sm text-[#0d4f61]">
        Los <strong>12 planes del Decreto 612 de 2018</strong> deben integrarse al Plan de Acción y publicarse
        en la web a más tardar el <strong>31 de enero</strong> de cada año. El seguimiento se reporta por trimestre.
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Planes vigencia" value={stats.planes_total} icon={<ClipboardList className="h-5 w-5" />} />
        <StatCard label="Actividades" value={stats.actividades_total} icon={<Calendar className="h-5 w-5" />} />
        <StatCard
          label="Avance promedio"
          value={`${stats.avance_promedio}%`}
          icon={<TrendingUp className="h-5 w-5" />}
        />
        <StatCard
          label="Vencidas"
          value={stats.actividades_vencidas}
          icon={<AlertTriangle className="h-5 w-5" />}
          accent={stats.actividades_vencidas > 0 ? "warning" : "default"}
        />
      </div>

      {stats.planes_sin_responsable > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {stats.planes_sin_responsable} plan(es) sin secretaría responsable asignada.
        </div>
      )}

      <PlanesCard title="Avance por trimestre" icon={<CheckCircle2 className="h-4 w-4 text-[#3eafd4]" />}>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {stats.por_trimestre.map((t) => (
            <div key={t.trimestre} className="rounded-lg border border-slate-100 bg-slate-50/50 p-4">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{t.trimestre_label}</div>
              <div className="mt-1 text-2xl font-bold text-slate-900">{t.avance_promedio}%</div>
              <div className="mt-1 text-xs text-slate-500">
                {t.completadas}/{t.total} completadas
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-200">
                <div
                  className="h-full rounded-full bg-[#3eafd4] transition-all"
                  style={{ width: `${Math.min(100, t.avance_promedio)}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </PlanesCard>
    </div>
  );
}

function StatCard({
  label,
  value,
  icon,
  accent = "default",
}: {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  accent?: "default" | "warning";
}) {
  return (
    <div
      className={`flex items-center gap-3 rounded-xl border bg-white px-5 py-5 shadow-sm ${
        accent === "warning" ? "border-amber-200" : "border-slate-200"
      }`}
    >
      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#3eafd4] text-white">{icon}</div>
      <div>
        <div className="text-xl font-bold text-slate-800">{value}</div>
        <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</div>
      </div>
    </div>
  );
}
