import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Activity, AlertTriangle, ArrowRight, Inbox, Mail } from "lucide-react";
import { correspondenciaApi, type CorrespondenciaStats } from "@/core/api/correspondencia";
import { formatApiError } from "@/core/api/errors";

function StatCard({
  label,
  value,
  sub,
  icon,
  accent,
  iconBg,
}: {
  label: string;
  value: string | number;
  sub?: string;
  icon: React.ReactNode;
  accent: string;
  iconBg: string;
}) {
  return (
    <div
      className={`flex w-full items-center gap-3 rounded-xl border-l-4 bg-white px-5 py-5 shadow-sm ${accent}`}
    >
      <div
        className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl text-white ${iconBg}`}
      >
        {icon}
      </div>
      <div>
        <div className="text-xl font-bold text-slate-800">{value}</div>
        <div className="text-[0.68rem] font-semibold uppercase tracking-wide text-slate-500">
          {label}
        </div>
        {sub && <div className="mt-0.5 text-[0.67rem] text-slate-400">{sub}</div>}
      </div>
    </div>
  );
}

export default function CorrespondenciaDashboard() {
  const [stats, setStats] = useState<CorrespondenciaStats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    correspondenciaApi
      .stats()
      .then(setStats)
      .catch((err) => setError(formatApiError(err)))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="py-12 text-center text-slate-500">Cargando…</div>;
  }
  if (error) {
    return (
      <div className="rounded-[0.3rem] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
        {error}
      </div>
    );
  }
  if (!stats) return null;

  return (
    <div className="space-y-6">
      <div className="rounded-[0.3rem] border border-[#b8e4ef] bg-[#f0f9fc] px-4 py-3 text-sm text-[#0d4f61]">
        Plazos en <strong>días hábiles Colombia</strong> (lun–vie, sin festivos nacionales). Separado
        del módulo PQRS ciudadano.
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Radicados hoy"
          value={stats.hoy}
          icon={<Activity className="h-5 w-5" />}
          accent="border-l-[#3eafd4]"
          iconBg="bg-[#3eafd4]"
        />
        <StatCard
          label="En trámite"
          value={stats.en_tramite}
          icon={<Inbox className="h-5 w-5" />}
          accent="border-l-indigo-500"
          iconBg="bg-indigo-500"
        />
        <StatCard
          label="Vencidas"
          value={stats.vencidas}
          icon={<AlertTriangle className="h-5 w-5" />}
          accent="border-l-amber-500"
          iconBg="bg-amber-500"
        />
        <StatCard
          label="Total"
          value={stats.total}
          sub={`E: ${stats.por_sentido.entrada} · S: ${stats.por_sentido.salida}`}
          icon={<Mail className="h-5 w-5" />}
          accent="border-l-emerald-500"
          iconBg="bg-emerald-500"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {[
          { to: "/correspondencia/entrada", title: "Correspondencia de entrada", sub: "Radicar y gestionar" },
          { to: "/correspondencia/salida", title: "Correspondencia de salida", sub: "Oficios y remisiones" },
          { to: "/correspondencia/informes", title: "Informes", sub: "Excel y PDF filtrados" },
        ].map((item) => (
          <Link
            key={item.to}
            to={item.to}
            className="group flex items-center justify-between rounded-xl border border-slate-200 bg-white px-5 py-4 shadow-sm transition hover:border-[#3eafd4]/40 hover:bg-[#f8fcfe]"
          >
            <div>
              <div className="font-semibold text-slate-800">{item.title}</div>
              <div className="text-xs text-slate-500">{item.sub}</div>
            </div>
            <ArrowRight className="h-4 w-4 text-slate-400 transition group-hover:text-[#3eafd4]" />
          </Link>
        ))}
      </div>
    </div>
  );
}
