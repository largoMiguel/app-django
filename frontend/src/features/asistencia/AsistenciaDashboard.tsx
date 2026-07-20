import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Users, LogIn, LogOut, Activity, ArrowRight } from "lucide-react";
import { asistenciaApi, type AsistenciaStats } from "@/core/api/asistencia";
import { formatApiError } from "@/core/api/errors";

function StatCard({
  label,
  value,
  sub,
  icon,
}: {
  label: string;
  value: string | number;
  sub?: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
          <p className="mt-2 text-3xl font-bold text-slate-900">{value}</p>
          {sub && <p className="mt-1 text-sm text-slate-500">{sub}</p>}
        </div>
        <div className="rounded-lg bg-[#e8f6fa] p-2 text-[#0d6e8a]">{icon}</div>
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
      <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
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
      <div className="rounded-lg border border-[#b8e4ef] bg-[#f0f9fc] px-4 py-3 text-sm text-[#0d4f61]">
        Configuración de jornada: <strong>{jornadaLabel}</strong> — definida por el superadministrador.
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Funcionarios activos"
          value={stats.total_funcionarios}
          icon={<Users className="h-5 w-5" />}
        />
        <StatCard
          label="Registros hoy"
          value={stats.registros_hoy}
          sub={`Promedio semanal: ${stats.promedio_asistencia_semanal}/día`}
          icon={<Activity className="h-5 w-5" />}
        />
        <StatCard
          label="Entradas hoy"
          value={stats.entradas_hoy}
          icon={<LogIn className="h-5 w-5" />}
        />
        <StatCard
          label="Presentes estimados"
          value={stats.funcionarios_presentes}
          sub={`Salidas finales: ${stats.salidas_hoy}`}
          icon={<LogOut className="h-5 w-5" />}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Link
          to="/asistencia/funcionarios"
          className="group flex items-center justify-between rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-[#0d6e8a] hover:shadow"
        >
          <div>
            <p className="font-semibold text-slate-800">Gestionar funcionarios</p>
            <p className="text-sm text-slate-500">Alta, edición y estado</p>
          </div>
          <ArrowRight className="h-5 w-5 text-slate-400 group-hover:text-[#0d6e8a]" />
        </Link>
        <Link
          to="/asistencia/equipos"
          className="group flex items-center justify-between rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-[#0d6e8a] hover:shadow"
        >
          <div>
            <p className="font-semibold text-slate-800">Equipos kiosk</p>
            <p className="text-sm text-slate-500">Emparejar PCs de registro</p>
          </div>
          <ArrowRight className="h-5 w-5 text-slate-400 group-hover:text-[#0d6e8a]" />
        </Link>
        <Link
          to="/asistencia/registros"
          className="group flex items-center justify-between rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-[#0d6e8a] hover:shadow"
        >
          <div>
            <p className="font-semibold text-slate-800">Ver registros</p>
            <p className="text-sm text-slate-500">Historial y exportación</p>
          </div>
          <ArrowRight className="h-5 w-5 text-slate-400 group-hover:text-[#0d6e8a]" />
        </Link>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-800">Kiosk web</h2>
        <p className="mt-1 text-sm text-slate-600">
          En el equipo Windows abra{" "}
          <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs">/kiosk</code> en Chrome o
          Edge (modo pantalla completa). Empareje con el código generado desde Equipos.
        </p>
        <a
          href="/kiosk"
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 inline-flex items-center gap-2 text-sm font-medium text-[#0d6e8a] hover:underline"
        >
          Abrir kiosk <ArrowRight className="h-4 w-4" />
        </a>
      </div>
    </div>
  );
}
