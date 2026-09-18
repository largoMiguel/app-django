import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, FileText, Plus, Trash2 } from "lucide-react";
import { picApi, type PicActividad } from "@/core/api/pic";
import { formatApiError } from "@/core/api/errors";
import { primaryRole, useAuthStore } from "@/core/auth/store";
import { PicCard, PicLoading, formatCOP } from "./components/PicUi";
import { usePicYear } from "./PicYearContext";
import EjecucionFormModal from "./EjecucionFormModal";

export default function PicActividadDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { anio } = usePicYear();
  const role = primaryRole(useAuthStore().user);
  const [act, setAct] = useState<PicActividad | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showEjecucion, setShowEjecucion] = useState(false);

  const load = useCallback(() => {
    if (!id) return;
    setLoading(true);
    picApi
      .getActividad(Number(id))
      .then(setAct)
      .catch((err) => setError(formatApiError(err)))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleDeleteEjecucion(ejId: number) {
    if (!confirm("¿Eliminar esta ejecución y sus archivos?")) return;
    try {
      await picApi.deleteEjecucion(ejId);
      load();
    } catch (err) {
      alert(formatApiError(err));
    }
  }

  if (loading) return <PicLoading />;
  if (error || !act) {
    return (
      <div className="space-y-4">
        <Link to="/pic/actividades" className="inline-flex items-center gap-1 text-sm text-[#0e7490]">
          <ArrowLeft className="h-4 w-4" /> Volver
        </Link>
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error || "Actividad no encontrada"}
        </div>
      </div>
    );
  }

  const canRegister = act.disponible > 0;

  return (
    <div className="space-y-6">
      <Link to="/pic/actividades" className="inline-flex items-center gap-1 text-sm text-[#0e7490] hover:underline">
        <ArrowLeft className="h-4 w-4" /> Actividades
      </Link>

      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-xs font-semibold uppercase text-slate-500">Actividad #{act.numero}</div>
            <h2 className="mt-1 text-lg font-bold text-slate-900">{act.actividad}</h2>
            <p className="mt-2 text-sm text-slate-600">{act.encargado_texto}</p>
          </div>
          {canRegister && (
            <button
              type="button"
              onClick={() => setShowEjecucion(true)}
              className="inline-flex items-center gap-2 rounded-lg bg-[#0e7490] px-4 py-2 text-sm font-medium text-white"
            >
              <Plus className="h-4 w-4" />
              Registrar ejecución
            </button>
          )}
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4 text-sm">
          <Metric label="Programado" value={String(act.total_programado)} />
          <Metric label="Ejecutado" value={String(act.total_ejecutado)} />
          <Metric label="Disponible" value={String(act.disponible)} />
          <Metric label="Valor cobrado" value={formatCOP(act.valor_cobrado_total)} />
        </div>
      </div>

      <PicCard title="Soportes requeridos" icon={<FileText className="h-4 w-4 text-[#0e7490]" />}>
        <pre className="whitespace-pre-wrap text-sm text-slate-700 font-sans">{act.soportes || "—"}</pre>
      </PicCard>

      <PicCard title="Programación trimestral">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="text-xs uppercase text-slate-500">
              <tr>
                <th className="pb-2 text-left">Trimestre</th>
                <th className="pb-2 text-right">Prog. trim.</th>
                <th className="pb-2 text-right">Prog. acum.</th>
                <th className="pb-2 text-right">Ejec. trim.</th>
                <th className="pb-2 text-right">Ejec. acum.</th>
                <th className="pb-2 text-right">Pendiente</th>
              </tr>
            </thead>
            <tbody>
              {(act.resumen_trimestral ?? []).map((r) => (
                <tr key={r.trimestre} className="border-t border-slate-100">
                  <td className="py-2">{r.trimestre_label}</td>
                  <td className="py-2 text-right">{r.programado_trimestre}</td>
                  <td className="py-2 text-right">{r.programado_acumulado}</td>
                  <td className="py-2 text-right">{r.ejecutado_trimestre}</td>
                  <td className="py-2 text-right">{r.ejecutado_acumulado}</td>
                  <td className="py-2 text-right font-medium">{r.pendiente_acumulado}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </PicCard>

      <PicCard title="Ejecuciones registradas">
        {!act.ejecuciones?.length ? (
          <p className="text-sm text-slate-500">Sin ejecuciones registradas.</p>
        ) : (
          <div className="space-y-4">
            {act.ejecuciones.map((ej) => (
              <div key={ej.id} className="rounded-lg border border-slate-100 p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <div className="font-medium text-slate-900">
                      {ej.fecha_ejecucion} · {ej.trimestre_label} · Cant. {ej.cantidad_ejecutada}
                    </div>
                    <div className="text-sm text-[#0e7490]">{formatCOP(ej.valor_cobrado)}</div>
                    {ej.descripcion && <p className="mt-1 text-sm text-slate-600">{ej.descripcion}</p>}
                  </div>
                  {(role === "admin" || role === "secretario") && (
                    <button
                      type="button"
                      onClick={() => handleDeleteEjecucion(ej.id)}
                      className="rounded p-1 text-red-500 hover:bg-red-50"
                      title="Eliminar"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
                {ej.archivos.length > 0 && (
                  <ul className="mt-2 space-y-1">
                    {ej.archivos.map((a) => (
                      <li key={a.id}>
                        <a
                          href={a.url ?? "#"}
                          target="_blank"
                          rel="noreferrer"
                          className="text-sm text-[#0e7490] hover:underline"
                        >
                          {a.nombre_original || a.nombre}
                        </a>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        )}
      </PicCard>

      {showEjecucion && (
        <EjecucionFormModal
          actividadId={act.id}
          anio={anio}
          disponible={act.disponible}
          onClose={() => setShowEjecucion(false)}
          onSuccess={load}
        />
      )}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-slate-50 px-3 py-2">
      <div className="text-xs text-slate-500">{label}</div>
      <div className="font-semibold text-slate-900">{value}</div>
    </div>
  );
}
