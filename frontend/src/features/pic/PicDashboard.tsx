import { useEffect, useState } from "react";
import { Download, TrendingUp, Upload, Wallet, ClipboardList, AlertTriangle } from "lucide-react";
import { picApi, type PicStats } from "@/core/api/pic";
import { formatApiError } from "@/core/api/errors";
import { primaryRole, useAuthStore } from "@/core/auth/store";
import { PicCard, PicLoading, formatCOP } from "./components/PicUi";
import { usePicYear } from "./PicYearContext";
import PicCargaExcelModal from "./PicCargaExcelModal";

export default function PicDashboard() {
  const { anio } = usePicYear();
  const role = primaryRole(useAuthStore().user);
  const [stats, setStats] = useState<PicStats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showUpload, setShowUpload] = useState(false);

  const load = () => {
    setLoading(true);
    picApi
      .stats(anio)
      .then(setStats)
      .catch((err) => setError(formatApiError(err)))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, [anio]);

  if (loading) return <PicLoading />;
  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
    );
  }
  if (!stats) return null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">
        {role === "admin" && (
          <button
            type="button"
            onClick={() => setShowUpload(true)}
            className="inline-flex items-center gap-2 rounded-lg bg-[#0e7490] px-4 py-2 text-sm font-medium text-white hover:bg-[#0c6378]"
          >
            <Upload className="h-4 w-4" />
            Cargar Excel PIC
          </button>
        )}
        {(role === "admin" || role === "secretario") && stats.tiene_plan && (
          <button
            type="button"
            onClick={() => picApi.downloadExport(anio)}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            <Download className="h-4 w-4" />
            Exportar seguimiento
          </button>
        )}
      </div>

      {!stats.tiene_plan && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          No hay plan PIC cargado para {anio}. {role === "admin" ? "Sube el Excel de seguimiento para comenzar." : "Contacta al administrador."}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Actividades" value={stats.actividades_total} icon={<ClipboardList className="h-5 w-5" />} />
        <StatCard label="Avance" value={`${stats.avance_pct}%`} icon={<TrendingUp className="h-5 w-5" />} />
        <StatCard label="Valor total PIC" value={formatCOP(stats.valor_total_pic)} icon={<Wallet className="h-5 w-5" />} />
        <StatCard label="Valor cobrado" value={formatCOP(stats.valor_cobrado_total)} icon={<Wallet className="h-5 w-5" />} />
      </div>

      {stats.sin_responsables > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 space-y-2">
          <p>
            <AlertTriangle className="mr-1 inline h-4 w-4" />
            {stats.sin_responsables} actividad(es) sin responsables asignados.
            {role === "admin" ? " Vaya a Encargados, mapee cada cargo del Excel y asigne contratistas." : " Contacte al administrador."}
          </p>
          {role === "admin" && stats.encargados_pendientes?.length > 0 && (
            <p className="text-xs">
              Sin mapear en Excel:{" "}
              <strong>{stats.encargados_pendientes.map((p) => `${p.token} (${p.actividades})`).join(", ")}</strong>
            </p>
          )}
        </div>
      )}

      <PicCard title="Avance por trimestre">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {stats.por_trimestre.map((t) => {
            const pct = t.programado > 0 ? Math.round((100 * t.ejecutado) / t.programado) : 0;
            return (
              <div key={t.trimestre} className="rounded-lg border border-slate-100 bg-slate-50/50 p-4">
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{t.trimestre_label}</div>
                <div className="mt-1 text-2xl font-bold text-slate-900">{pct}%</div>
                <div className="mt-1 text-xs text-slate-500">
                  {t.ejecutado}/{t.programado} programado
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-200">
                  <div className="h-full rounded-full bg-[#0e7490] transition-all" style={{ width: `${Math.min(100, pct)}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      </PicCard>

      {stats.por_responsable.length > 0 && (
        <PicCard title="Por responsable">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs uppercase text-slate-500">
                  <th className="pb-2 pr-4">Responsable</th>
                  <th className="pb-2 pr-4">Actividades</th>
                  <th className="pb-2 pr-4">Ejecutado</th>
                  <th className="pb-2">Valor cobrado</th>
                </tr>
              </thead>
              <tbody>
                {stats.por_responsable.map((r) => (
                  <tr key={r.usuario_id} className="border-b border-slate-100">
                    <td className="py-2 pr-4 font-medium text-slate-800">{r.nombre}</td>
                    <td className="py-2 pr-4">{r.actividades}</td>
                    <td className="py-2 pr-4">{r.total_ejecutado}</td>
                    <td className="py-2">{formatCOP(r.valor_cobrado)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </PicCard>
      )}

      {showUpload && (
        <PicCargaExcelModal
          anio={anio}
          onClose={() => setShowUpload(false)}
          onSuccess={() => {
            setShowUpload(false);
            load();
          }}
        />
      )}
    </div>
  );
}

function StatCard({ label, value, icon }: { label: string; value: string | number; icon: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-5 py-5 shadow-sm">
      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#0e7490] text-white">{icon}</div>
      <div>
        <div className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</div>
        <div className="text-xl font-bold text-slate-900">{value}</div>
      </div>
    </div>
  );
}
