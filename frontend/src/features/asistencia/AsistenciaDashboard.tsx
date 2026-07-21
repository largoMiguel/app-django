import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Users, LogIn, LogOut, Activity, ArrowRight, ExternalLink } from "lucide-react";
import { asistenciaApi, type AsistenciaStats } from "@/core/api/asistencia";
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

export default function AsistenciaDashboard() {
  const [stats, setStats] = useState<AsistenciaStats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    asistenciaApi
      .stats()
      .then(setStats)
      .catch((err) => setError(formatApiError(err)))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="py-12 text-center text-slate-500">Cargando estadísticas…</div>;
  }

  if (error) {
    return (
      <div className="rounded-[0.3rem] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
        {error}
      </div>
    );
  }

  if (!stats) return null;

  const jornadaLabel =
    stats.asistencias_por_dia === 4
      ? "Doble jornada (4 registros)"
      : "Jornada simple (2 registros)";

  return (
    <div className="space-y-6">
      <div className="rounded-[0.3rem] border border-[#b8e4ef] bg-[#f0f9fc] px-4 py-3 text-sm text-[#0d4f61]">
        Configuración de jornada: <strong>{jornadaLabel}</strong> — definida por el
        superadministrador. Las fotos de marcación se eliminan automáticamente a los 15 días.
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Funcionarios activos"
          value={stats.total_funcionarios}
          icon={<Users className="h-5 w-5" />}
          accent="border-l-[#3eafd4]"
          iconBg="bg-[#3eafd4]"
        />
        <StatCard
          label="Registros hoy"
          value={stats.registros_hoy}
          sub={`Promedio semanal: ${stats.promedio_asistencia_semanal}/día`}
          icon={<Activity className="h-5 w-5" />}
          accent="border-l-indigo-500"
          iconBg="bg-indigo-500"
        />
        <StatCard
          label="Entradas hoy"
          value={stats.entradas_hoy}
          icon={<LogIn className="h-5 w-5" />}
          accent="border-l-emerald-500"
          iconBg="bg-emerald-500"
        />
        <StatCard
          label="Presentes estimados"
          value={stats.funcionarios_presentes}
          sub={`Salidas finales: ${stats.salidas_hoy}`}
          icon={<LogOut className="h-5 w-5" />}
          accent="border-l-amber-500"
          iconBg="bg-amber-500"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {[
          {
            to: "/asistencia/funcionarios",
            title: "Gestionar funcionarios",
            sub: "Alta, edición y estado",
          },
          {
            to: "/asistencia/equipos",
            title: "Equipos kiosk",
            sub: "Emparejar PCs de registro",
          },
          {
            to: "/asistencia/registros",
            title: "Ver registros",
            sub: "Historial y exportación",
          },
        ].map((item) => (
          <Link
            key={item.to}
            to={item.to}
            className="group flex items-center justify-between rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-[#3eafd4] hover:shadow-md"
          >
            <div>
              <p className="font-semibold text-slate-800">{item.title}</p>
              <p className="text-sm text-slate-500">{item.sub}</p>
            </div>
            <ArrowRight className="h-5 w-5 text-slate-400 group-hover:text-[#3eafd4]" />
          </Link>
        ))}
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-800">Kiosk web</h2>
        <p className="mt-1 text-sm text-slate-600">
          En el equipo Windows abra{" "}
          <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs">/kiosk</code> en Chrome o
          Edge (modo pantalla completa). Empareje con el código generado desde Equipos. El fichaje es
          automático por reconocimiento facial (enrole el rostro de cada funcionario una vez desde
          esta sección).
        </p>
        <a
          href="/kiosk"
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 inline-flex items-center gap-1.5 rounded-[0.3rem] border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          Abrir kiosk <ExternalLink className="h-3.5 w-3.5" />
        </a>
      </div>
    </div>
  );
}
