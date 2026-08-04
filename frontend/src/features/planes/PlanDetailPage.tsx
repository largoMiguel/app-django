import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, CheckCircle2, ClipboardCheck, Pencil, Plus } from "lucide-react";
import { openAuthenticatedFile } from "@/core/api/client";
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
import ActividadFormModal from "./ActividadFormModal";
import EvidenciaFormModal from "./EvidenciaFormModal";
import PlanFormModal from "./PlanFormModal";
import { PlanesBadge, PlanesCard, PlanesLoading, btnPrimary, btnSecondary } from "./components/PlanesUi";

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
    resumen: plan.resumen_por_trimestre?.find((r) => r.trimestre === t.value),
  }));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
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
        <div className="flex flex-wrap items-center gap-2">
          <Link to="/planes/lista" className={btnSecondary}>
            <ArrowLeft className="mr-1 h-4 w-4" />
            Volver a planes
          </Link>
          {isAdmin && (
            <button type="button" onClick={() => setPlanModalOpen(true)} className={btnSecondary}>
              <Pencil className="mr-1 h-4 w-4" />
              Editar plan
            </button>
          )}
          {canCreate && (
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
        </div>
      </div>

      {plan.estado === "BORRADOR" && isAdmin && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Este plan está en <strong>borrador</strong>. Cuando lo publique en la web de la entidad, edítelo y cambie
          el estado a <strong>Publicado</strong> (indique URL y fecha). Luego pase a <strong>En ejecución</strong>{" "}
          para el seguimiento trimestral.
        </div>
      )}

      {plan.objetivo && (
        <PlanesCard title="Objetivo">
          <p className="text-sm text-slate-700">{plan.objetivo}</p>
        </PlanesCard>
      )}

      {byTrimestre.map(({ value, label, actividades, resumen }) => (
        <PlanesCard
          key={value}
          title={
            resumen
              ? `${label} · ${resumen.completadas}/${resumen.total} completadas · Avance ${resumen.avance_promedio}%`
              : label
          }
        >
          {actividades.length === 0 ? (
            <p className="text-sm text-slate-500">Sin actividades en este trimestre.</p>
          ) : (
            <div className="space-y-3">
              {actividades.map((act) => (
                <ActividadRow
                  key={act.id}
                  act={act}
                  canCreate={canCreate}
                  onEditActividad={() => {
                    setEditActividad(act);
                    setActividadModalOpen(true);
                  }}
                  onAgregarEvidencia={() => {
                    setEvidenciaActividad(act);
                    setEvidenciaModalOpen(true);
                  }}
                />
              ))}
            </div>
          )}
        </PlanesCard>
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
          }}
          actividad={evidenciaActividad}
          onSaved={() => {
            setEvidenciaModalOpen(false);
            setEvidenciaActividad(null);
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

function ActividadRow({
  act,
  canCreate,
  onEditActividad,
  onAgregarEvidencia,
}: {
  act: PlanActividad;
  canCreate: boolean;
  onEditActividad: () => void;
  onAgregarEvidencia: () => void;
}) {
  const estadoTone =
    act.estado === "COMPLETADA" ? "success" : act.estado === "EN_PROGRESO" ? "info" : "slate";
  const evidencias = act.evidencias ?? [];

  return (
    <div className="rounded-lg border border-slate-100 bg-slate-50/50 p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <div className="font-medium text-slate-900">{act.nombre}</div>
            {act.tiene_evidencia && (
              <PlanesBadge tone="success">
                <CheckCircle2 className="mr-1 inline h-3 w-3" />
                {evidencias.length} evidencia{evidencias.length === 1 ? "" : "s"}
              </PlanesBadge>
            )}
          </div>
          {act.descripcion && <p className="mt-1 text-sm text-slate-600">{act.descripcion}</p>}
          <div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-500">
            <PlanesBadge tone={estadoTone}>{act.estado_label}</PlanesBadge>
            <span>Avance: {act.avance}%</span>
            {act.meta && <span>· Meta: {act.meta}</span>}
            {(act.total_ejecutado ?? 0) > 0 && <span>· Ejecutado: {act.total_ejecutado}</span>}
            {act.responsable_secretaria_nombre && <span>· {act.responsable_secretaria_nombre}</span>}
          </div>
        </div>
        {canCreate && (
          <div className="flex shrink-0 flex-wrap gap-2">
            <button type="button" onClick={onEditActividad} className={btnSecondary}>
              Editar actividad
            </button>
            <button type="button" onClick={onAgregarEvidencia} className={btnPrimary}>
              <ClipboardCheck className="mr-1 inline h-4 w-4" />
              Agregar evidencia
            </button>
          </div>
        )}
      </div>
      {evidencias.length > 0 && (
        <div className="mt-3 space-y-2 border-t border-slate-200 pt-3">
          {evidencias.map((ev) => (
            <EvidenciaItem key={ev.id} ev={ev} />
          ))}
        </div>
      )}
    </div>
  );
}

function EvidenciaItem({ ev }: { ev: PlanEvidencia }) {
  return (
    <div className="rounded-md border border-slate-200 bg-white p-3 text-sm">
      <div className="font-medium text-slate-800">
        +{ev.cantidad_ejecutada} ejecutado · {ev.descripcion}
      </div>
      {ev.url_evidencia && (
        <a
          href={ev.url_evidencia}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-1 inline-block text-[#0e7490] hover:underline"
        >
          URL externa
        </a>
      )}
      {ev.archivos?.length > 0 && (
        <ul className="mt-2 space-y-1">
          {ev.archivos.map((arch) => (
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
  );
}
