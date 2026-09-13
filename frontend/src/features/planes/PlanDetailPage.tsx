import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, ClipboardList, Inbox, Pencil, Plus } from "lucide-react";
import { secretariasApi, type Secretaria } from "@/core/api/entities";
import {
  planesApi,
  TRIMESTRE_OPTIONS,
  type PlanActividad,
  type PlanCatalogoItem,
  type PlanDetail,
  type PlanEvidencia,
  type PlanListItem,
} from "@/core/api/planes";
import { formatApiError } from "@/core/api/errors";
import { primaryRole, useAuthStore } from "@/core/auth/store";
import { PdmAlert, PdmBadge, PdmBtn, PdmCard, PdmProgressBar } from "@/features/pdm/components/PdmUi";
import { getColorProgreso } from "@/features/pdm/pdmUtils";
import ActividadFormModal from "./ActividadFormModal";
import EvidenciaFormModal from "./EvidenciaFormModal";
import PlanFormModal from "./PlanFormModal";
import { PlanActividadCard, puedeAgregarEvidencia } from "./components/PlanActividadCard";
import { usePlanesDetailHeader } from "./PlanesDetailHeaderContext";
import { PlanesBadge, PlanesLoading, btnPrimary, btnSecondary } from "./components/PlanesUi";

export default function PlanDetailPage() {
  const { id } = useParams<{ id: string }>();
  const planId = Number(id);
  const user = useAuthStore((s) => s.user);
  const role = primaryRole(user);
  const isAdmin = role === "admin";
  const canCreate = isAdmin || role === "secretario";

  const [plan, setPlan] = useState<PlanDetail | null>(null);
  const [catalogo, setCatalogo] = useState<PlanCatalogoItem[]>([]);
  const [secretarias, setSecretarias] = useState<Secretaria[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actividadModalOpen, setActividadModalOpen] = useState(false);
  const [evidenciaModalOpen, setEvidenciaModalOpen] = useState(false);
  const [planModalOpen, setPlanModalOpen] = useState(false);
  const [editActividad, setEditActividad] = useState<PlanActividad | null>(null);
  const [evidenciaActividad, setEvidenciaActividad] = useState<PlanActividad | null>(null);
  const [editEvidencia, setEditEvidencia] = useState<PlanEvidencia | null>(null);
  const { setHeaderActions } = usePlanesDetailHeader();

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
    if (!isAdmin) return;
    planesApi.catalogo({ page_size: "50" }).then((r) => setCatalogo(r.results)).catch(() => setCatalogo([]));
    secretariasApi.list().then(setSecretarias).catch(() => setSecretarias([]));
  }, [isAdmin]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    setHeaderActions(
      <div className="flex flex-wrap items-center gap-2">
        <Link to="/planes/lista" className={btnSecondary}>
          <ArrowLeft className="mr-1 h-4 w-4" />
          Volver a planes
        </Link>
        {isAdmin && !loading && !error && plan && (
          <button type="button" onClick={() => setPlanModalOpen(true)} className={btnSecondary}>
            <Pencil className="mr-1 h-4 w-4" />
            Editar plan
          </button>
        )}
        {canCreate && !loading && !error && plan && (
          <button
            type="button"
            onClick={() => {
              setEditActividad(null);
              setActividadModalOpen(true);
            }}
            className={btnPrimary}
          >
            <Plus className="mr-1 h-4 w-4" />
            Nueva actividad
          </button>
        )}
      </div>,
    );
    return () => setHeaderActions(null);
  }, [isAdmin, canCreate, loading, error, plan, setHeaderActions]);

  async function handleDeleteActividad(act: PlanActividad) {
    if (!window.confirm(`¿Eliminar la actividad "${act.nombre}" y todas sus evidencias?`)) return;
    try {
      await planesApi.actividades.delete(act.id);
      load();
    } catch (err) {
      alert(formatApiError(err));
    }
  }

  async function handleDeleteEvidencia(act: PlanActividad, ev: PlanEvidencia) {
    if (!window.confirm("¿Eliminar esta evidencia?")) return;
    try {
      await planesApi.actividades.eliminarEvidencia(act.id, ev.id);
      load();
    } catch (err) {
      alert(formatApiError(err));
    }
  }

  if (loading) return <PlanesLoading />;
  if (error || !plan) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
        {error || "Plan no encontrado"}
      </div>
    );
  }

  const byTrimestre = TRIMESTRE_OPTIONS.map((t) => ({
    ...t,
    actividades: plan.actividades.filter((a) => a.trimestre === t.value),
    resumen: plan.resumen_por_trimestre?.find((r) => r.trimestre === t.value),
  }));

  return (
    <div className="mx-auto w-full max-w-[1600px] space-y-6">
      <div>
        <h2 className="text-xl font-bold text-slate-900">{plan.nombre}</h2>
        <p className="mt-1 text-sm text-slate-500">
          {plan.catalogo_codigo} · Vigencia {plan.anio} ·{" "}
          {plan.responsable_secretaria_nombre || "Sin responsable"}
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <PlanesBadge tone={planEstadoTone(plan.estado)}>{plan.estado_label}</PlanesBadge>
          {plan.fecha_publicacion && (
            <span className="text-xs text-slate-500">Publicado: {plan.fecha_publicacion}</span>
          )}
          {plan.url_publicacion && (
            <a
              href={plan.url_publicacion}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-[#0e7490] hover:underline"
            >
              Ver publicación
            </a>
          )}
        </div>
      </div>

      {plan.estado === "BORRADOR" && isAdmin && (
        <PdmAlert tone="warning">
          Este plan está en <strong>borrador</strong>. Cuando lo publique en la web de la entidad, edítelo y cambie el
          estado a <strong>Publicado</strong>. Luego pase a <strong>En ejecución</strong> para el seguimiento trimestral.
        </PdmAlert>
      )}

      {plan.objetivo && (
        <PdmCard title="Objetivo del plan" icon={<ClipboardList size={16} className="text-blue-600" />}>
          <p className="text-sm text-slate-700">{plan.objetivo}</p>
        </PdmCard>
      )}

      {byTrimestre.map(({ value, label, actividades, resumen }) => (
        <PdmCard
          key={value}
          title={
            <div className="flex w-full flex-wrap items-center justify-between gap-3">
              <span>{label}</span>
              {resumen && (
                <span className="text-xs font-normal text-slate-500">
                  {resumen.completadas}/{resumen.total} completadas · Avance {resumen.avance_promedio}%
                </span>
              )}
            </div>
          }
          icon={<ClipboardList size={16} className="text-blue-600" />}
        >
          {resumen && resumen.total > 0 && (
            <PdmAlert tone="info">
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <strong className="block text-slate-800">Actividades</strong>
                  <p>{resumen.total} registradas</p>
                </div>
                <div>
                  <strong className="block text-slate-800">Avance del trimestre</strong>
                  <p className="flex flex-wrap items-center gap-2">
                    {resumen.completadas} / {resumen.total} completadas
                    <PdmBadge tone={getColorProgreso(resumen.avance_promedio)}>
                      {resumen.avance_promedio}%
                    </PdmBadge>
                  </p>
                </div>
              </div>
              <div className="mt-3">
                <PdmProgressBar value={resumen.avance_promedio} tone={getColorProgreso(resumen.avance_promedio)} />
              </div>
            </PdmAlert>
          )}

          <div className="mt-4">
            {actividades.length === 0 ? (
              <div className="py-10 text-center">
                <Inbox size={48} className="mx-auto mb-3 text-slate-300" />
                <p className="text-sm text-slate-500">No hay actividades en este trimestre.</p>
                {canCreate && (
                  <PdmBtn
                    className="mt-4"
                    onClick={() => {
                      setEditActividad(null);
                      setActividadModalOpen(true);
                    }}
                  >
                    <Plus size={14} />
                    Crear actividad
                  </PdmBtn>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                {actividades.map((act) => (
                  <PlanActividadCard
                    key={act.id}
                    act={act}
                    canCreate={canCreate}
                    isAdmin={isAdmin}
                    onEditActividad={() => {
                      setEditActividad(act);
                      setActividadModalOpen(true);
                    }}
                    onDeleteActividad={() => handleDeleteActividad(act)}
                    onAgregarEvidencia={() => {
                      if (!puedeAgregarEvidencia(act)) return;
                      setEditEvidencia(null);
                      setEvidenciaActividad(act);
                      setEvidenciaModalOpen(true);
                    }}
                    onEditEvidencia={(ev) => {
                      setEditEvidencia(ev);
                      setEvidenciaActividad(act);
                      setEvidenciaModalOpen(true);
                    }}
                    onDeleteEvidencia={(ev) => handleDeleteEvidencia(act, ev)}
                  />
                ))}
              </div>
            )}
          </div>
        </PdmCard>
      ))}

      <ActividadFormModal
        open={actividadModalOpen}
        onClose={() => {
          setActividadModalOpen(false);
          setEditActividad(null);
        }}
        plan={plan}
        actividad={editActividad}
        onSaved={() => {
          setActividadModalOpen(false);
          setEditActividad(null);
          load();
        }}
      />

      {evidenciaActividad && (
        <EvidenciaFormModal
          open={evidenciaModalOpen}
          onClose={() => {
            setEvidenciaModalOpen(false);
            setEvidenciaActividad(null);
            setEditEvidencia(null);
          }}
          actividad={evidenciaActividad}
          evidencia={editEvidencia}
          onSaved={() => {
            setEvidenciaModalOpen(false);
            setEvidenciaActividad(null);
            setEditEvidencia(null);
            load();
          }}
        />
      )}

      {isAdmin && plan && (
        <PlanFormModal
          open={planModalOpen}
          onClose={() => setPlanModalOpen(false)}
          plan={plan as PlanListItem}
          catalogo={catalogo}
          secretarias={secretarias}
          defaultAnio={plan.anio}
          onSaved={() => {
            setPlanModalOpen(false);
            load();
          }}
        />
      )}
    </div>
  );
}

function planEstadoTone(estado: string): "info" | "success" | "warning" | "slate" {
  if (estado === "CERRADO") return "success";
  if (estado === "EN_EJECUCION") return "info";
  if (estado === "PUBLICADO") return "warning";
  return "slate";
}
