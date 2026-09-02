import { useEffect, useState } from "react";
import { AlertTriangle, Archive, CheckCircle2, FileStack, FolderOpen } from "lucide-react";
import { gestionDocumentalApi, type GdStats } from "@/core/api/gestionDocumental";
import { formatApiError } from "@/core/api/errors";
import { useGdHeaderActions } from "./GdHeaderActionsContext";
import { GdBadge, GdCard, GdLoading } from "./components/GdUi";

export default function GdDashboard() {
  const { setHeaderActions } = useGdHeaderActions();
  const [stats, setStats] = useState<GdStats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setHeaderActions(null);
    return () => setHeaderActions(null);
  }, [setHeaderActions]);

  useEffect(() => {
    gestionDocumentalApi
      .stats()
      .then(setStats)
      .catch((err) => setError(formatApiError(err)))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <GdLoading />;
  if (error) {
    return <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>;
  }
  if (!stats) return null;

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-[#b8e4ef] bg-[#f0f9fc] px-4 py-3 text-sm text-[#0d4f61]">
        Módulo <strong>SGDEA</strong> alineado con la <strong>Ley 594 de 2000</strong> y el{" "}
        <strong>Acuerdo AGN 001 de 2024</strong>: instrumentos archivísticos, clasificación TRD/CCD, expedientes,
        inventario FUID, transferencias y disposición final.
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Instrumentos" value={stats.instrumentos_total} icon={<FileStack className="h-5 w-5" />} />
        <StatCard label="Expedientes" value={stats.expedientes_total} icon={<FolderOpen className="h-5 w-5" />} />
        <StatCard label="Series TRD/CCD" value={stats.series_total} icon={<Archive className="h-5 w-5" />} />
        <StatCard
          label="Retención vencida"
          value={stats.retencion_vencida}
          icon={<AlertTriangle className="h-5 w-5" />}
          accent={stats.retencion_vencida > 0 ? "warning" : "default"}
        />
      </div>

      <div className="flex flex-wrap gap-2">
        <GdBadge tone={stats.trd_vigente ? "success" : "warning"}>TRD {stats.trd_vigente ? "vigente" : "pendiente"}</GdBadge>
        <GdBadge tone={stats.ccd_vigente ? "success" : "warning"}>CCD {stats.ccd_vigente ? "vigente" : "pendiente"}</GdBadge>
        <GdBadge tone={stats.pgd_vigente ? "success" : "warning"}>PGD {stats.pgd_vigente ? "vigente" : "pendiente"}</GdBadge>
        {stats.transferencias_pendientes > 0 && (
          <GdBadge tone="warning">{stats.transferencias_pendientes} transferencia(s) pendiente(s)</GdBadge>
        )}
      </div>

      <GdCard title="Procesos del Programa de Gestión Documental (PGD)" icon={<CheckCircle2 className="h-4 w-4 text-[#3eafd4]" />}>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {stats.procesos_pgd.map((p) => (
            <div key={p.key} className="rounded-lg border border-slate-100 bg-slate-50/50 p-4">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{p.label}</div>
              <p className="mt-1 text-xs text-slate-600">{p.desc}</p>
              <div className="mt-2 text-lg font-bold text-slate-900">{p.avance}%</div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-200">
                <div
                  className="h-full rounded-full bg-[#3eafd4] transition-all"
                  style={{ width: `${Math.min(100, p.avance)}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </GdCard>
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
  value: number | string;
  icon: React.ReactNode;
  accent?: "default" | "warning";
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <div className={`rounded-lg p-2 ${accent === "warning" ? "bg-amber-100 text-amber-700" : "bg-[#3eafd4]/10 text-[#3eafd4]"}`}>
          {icon}
        </div>
      </div>
      <div className="mt-3 text-2xl font-bold text-slate-900">{value}</div>
      <div className="mt-1 text-xs font-medium uppercase tracking-wide text-slate-500">{label}</div>
    </div>
  );
}
