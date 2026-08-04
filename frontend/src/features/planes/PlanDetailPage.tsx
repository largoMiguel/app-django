import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Plus } from "lucide-react";
import { openAuthenticatedFile } from "@/core/api/client";
import {
  planesApi,
  TRIMESTRE_OPTIONS,
  type PlanActividad,
  type PlanDetail,
} from "@/core/api/planes";
import { formatApiError } from "@/core/api/errors";
import { primaryRole, useAuthStore } from "@/core/auth/store";
import ActividadFormModal from "./ActividadFormModal";
import { PlanesBadge, PlanesCard, PlanesLoading, btnPrimary } from "./components/PlanesUi";

export default function PlanDetailPage() {
  const { id } = useParams<{ id: string }>();
  const planId = Number(id);
  const user = useAuthStore((s) => s.user);
  const role = primaryRole(user);
  const canCreate = role === "admin" || role === "secretario";

  const [plan, setPlan] = useState<PlanDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editActividad, setEditActividad] = useState<PlanActividad | null>(null);

  const load = useCallback(async () => {
    if (!planId) return;
    setLoading(true);
    try {
      const data = await planesApi.get(planId);
      setPlan(data);
    } catch (err) {
      setError(formatApiError(err));
    } finally {
      setLoading(false);
    }
  }, [planId]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) return <PlanesLoading />;
  if (error || !plan) {
    return (
      <div className="space-y-4">
        <Link to="/planes/lista" className="inline-flex items-center gap-1 text-sm text-[#0e7490]">
          <ArrowLeft className="h-4 w-4" /> Volver
        </Link>
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error || "Plan no encontrado"}
        </div>
      </div>
    );
  }

  const byTrimestre = TRIMESTRE_OPTIONS.map((t) => ({
    ...t,
    actividades: plan.actividades.filter((a) => a.trimestre === t.value),
  }));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link to="/planes/lista" className="mb-2 inline-flex items-center gap-1 text-sm text-[#0e7490]">
            <ArrowLeft className="h-4 w-4" /> Volver a planes
          </Link>
          <h2 className="text-xl font-bold text-slate-900">{plan.nombre}</h2>
          <p className="mt-1 text-sm text-slate-500">
            {plan.catalogo_nombre} · Vigencia {plan.anio} ·{" "}
            {plan.responsable_secretaria_nombre || "Sin responsable"}
          </p>
        </div>
        {canCreate && (
          <button
            type="button"
            onClick={() => {
              setEditActividad(null);
              setModalOpen(true);
            }}
            className={btnPrimary}
          >
            <Plus className="mr-1 h-4 w-4" />
            Nueva actividad
          </button>
        )}
      </div>

      {plan.objetivo && (
        <PlanesCard title="Objetivo">
          <p className="text-sm text-slate-700">{plan.objetivo}</p>
        </PlanesCard>
      )}

      {plan.resumen_por_trimestre?.map((r) => (
        <div key={r.trimestre} className="hidden" />
      ))}

      {byTrimestre.map(({ value, label, actividades }) => (
        <PlanesCard key={value} title={label}>
          {actividades.length === 0 ? (
            <p className="text-sm text-slate-500">Sin actividades en este trimestre.</p>
          ) : (
            <div className="space-y-3">
              {actividades.map((act) => (
                <ActividadRow
                  key={act.id}
                  act={act}
                  onEdit={() => {
                    setEditActividad(act);
                    setModalOpen(true);
                  }}
                />
              ))}
            </div>
          )}
        </PlanesCard>
      ))}

      <ActividadFormModal
        open={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setEditActividad(null);
        }}
        plan={plan}
        actividad={editActividad}
        onSaved={() => {
          setModalOpen(false);
          setEditActividad(null);
          load();
        }}
      />
    </div>
  );
}

function ActividadRow({ act, onEdit }: { act: PlanActividad; onEdit: () => void }) {
  const estadoTone =
    act.estado === "COMPLETADA" ? "success" : act.estado === "EN_PROGRESO" ? "info" : "slate";

  return (
    <div className="rounded-lg border border-slate-100 bg-slate-50/50 p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="font-medium text-slate-900">{act.nombre}</div>
          {act.descripcion && <p className="mt-1 text-sm text-slate-600">{act.descripcion}</p>}
          <div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-500">
            <PlanesBadge tone={estadoTone}>{act.estado_label}</PlanesBadge>
            <span>Avance: {act.avance}%</span>
            {act.responsable_secretaria_nombre && <span>· {act.responsable_secretaria_nombre}</span>}
            {act.fecha_inicio && act.fecha_fin && (
              <span>
                · {act.fecha_inicio} → {act.fecha_fin}
              </span>
            )}
          </div>
        </div>
        <button type="button" onClick={onEdit} className="text-sm font-medium text-[#0e7490] hover:underline">
          Editar / evidencia
        </button>
      </div>
      {act.evidencia && (
        <div className="mt-3 border-t border-slate-200 pt-3 text-sm">
          <div className="font-medium text-slate-700">Evidencia</div>
          <p className="text-slate-600">{act.evidencia.descripcion}</p>
          {act.evidencia.url_evidencia && (
            <a
              href={act.evidencia.url_evidencia}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-1 inline-block text-[#0e7490] hover:underline"
            >
              URL externa
            </a>
          )}
          {act.evidencia.archivos?.length > 0 && (
            <ul className="mt-2 space-y-1">
              {act.evidencia.archivos.map((arch) => (
                <li key={arch.id}>
                  <button
                    type="button"
                    onClick={() => arch.url && openAuthenticatedFile(arch.url)}
                    className="text-[#0e7490] hover:underline"
                  >
                    {arch.nombre}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
