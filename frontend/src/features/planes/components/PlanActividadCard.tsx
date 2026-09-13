import { memo, useCallback, useEffect, useState } from "react";
import {
  Calendar,
  CheckCircle2,
  Clock,
  Edit,
  ExternalLink,
  FileText,
  Loader2,
  Target,
  Trash2,
  TrendingUp,
  User,
  X,
} from "lucide-react";
import { openAuthenticatedFile } from "@/core/api/client";
import { planesApi, type PlanActividad, type PlanEvidencia, type PlanEvidenciaArchivo } from "@/core/api/planes";
import { formatApiError } from "@/core/api/errors";
import { useAuthenticatedImage } from "@/features/pdm/useAuthenticatedImage";
import { PdmBadge, PdmBtn, PdmProgressBar } from "@/features/pdm/components/PdmUi";
import { formatFechaCorta, formatFechaHora, getColorEstadoActividad } from "@/features/pdm/pdmUtils";

function parseMeta(value: string): number | null {
  const match = value.trim().replace(",", ".").match(/\d+(?:\.\d+)?/);
  return match ? Number(match[0]) : null;
}

export function puedeAgregarEvidencia(act: PlanActividad): boolean {
  const meta = parseMeta(act.meta || "");
  if (!meta || meta <= 0) return true;
  return (act.total_ejecutado ?? 0) < meta;
}

function isImageArchivo(arch: PlanEvidenciaArchivo): boolean {
  return (arch.content_type || "").toLowerCase().startsWith("image/");
}

function AuthenticatedImage({
  url,
  alt,
  className = "",
  onClick,
}: {
  url: string;
  alt: string;
  className?: string;
  onClick?: () => void;
}) {
  const { src, failed } = useAuthenticatedImage(url);
  if (failed) {
    return (
      <div className={`flex items-center justify-center bg-slate-100 text-xs text-slate-500 ${className}`}>
        Error
      </div>
    );
  }
  if (!src) {
    return (
      <div className={`flex items-center justify-center bg-slate-100 ${className}`}>
        <Loader2 size={18} className="animate-spin text-slate-400" />
      </div>
    );
  }
  return <img src={src} alt={alt} className={className} onClick={onClick} />;
}

function AuthenticatedImageModal({ url, onClose }: { url: string; onClose: () => void }) {
  const { src, failed } = useAuthenticatedImage(url);
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4" onClick={onClose} role="presentation">
      <button
        type="button"
        onClick={onClose}
        className="absolute right-4 top-4 rounded-full bg-white/10 p-2 text-white hover:bg-white/20"
        aria-label="Cerrar"
      >
        <X size={24} />
      </button>
      {failed ? (
        <p className="text-white">No se pudo cargar la imagen.</p>
      ) : src ? (
        <img src={src} alt="Evidencia ampliada" className="max-h-[90vh] max-w-full object-contain" onClick={(e) => e.stopPropagation()} />
      ) : (
        <Loader2 size={32} className="animate-spin text-white" />
      )}
    </div>
  );
}

function EvidenciaBloque({
  ev,
  actDescripcion,
  canEdit,
  onEdit,
  onDelete,
}: {
  ev: PlanEvidencia;
  actDescripcion?: string;
  canEdit: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const [imagenModal, setImagenModal] = useState<PlanEvidenciaArchivo | null>(null);
  const imagenes = (ev.archivos || []).filter(isImageArchivo);
  const otrosArchivos = (ev.archivos || []).filter((a) => !isImageArchivo(a));
  const descDistinta =
    ev.descripcion.trim().toLowerCase() !== (actDescripcion || "").trim().toLowerCase();

  return (
    <>
      <div className="rounded-lg border border-slate-200 bg-white p-3">
        <div className="mb-2 flex flex-wrap items-start justify-between gap-2">
          <h6 className="flex items-center gap-1.5 text-sm font-semibold text-emerald-700">
            <CheckCircle2 size={16} />
            +{ev.cantidad_ejecutada} ejecutado
          </h6>
          {canEdit && (
            <div className="flex gap-1">
              <PdmBtn variant="outline" size="sm" onClick={onEdit} title="Editar evidencia">
                <Edit size={14} />
              </PdmBtn>
              <PdmBtn variant="danger" size="sm" onClick={onDelete} title="Eliminar evidencia">
                <Trash2 size={14} />
              </PdmBtn>
            </div>
          )}
        </div>

        {descDistinta && ev.descripcion && (
          <p className="mb-2 text-sm text-slate-700">
            <strong>Descripción evidencia:</strong> {ev.descripcion}
          </p>
        )}

        <p className="mb-2 flex items-center gap-1.5 text-xs text-slate-500">
          <Clock size={12} />
          Registrado el {formatFechaHora(ev.fecha_registro || ev.created_at)}
        </p>

        {ev.url_evidencia && (
          <div className="mb-2">
            <a
              href={ev.url_evidencia}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 rounded-md border border-blue-300 bg-white px-2.5 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-50"
            >
              <ExternalLink size={12} />
              Ver Evidencia Externa
            </a>
          </div>
        )}

        {imagenes.length > 0 && (
          <div className="mb-2 grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
            {imagenes.map((archivo) => (
              <button
                key={archivo.id}
                type="button"
                onClick={() => archivo.url && setImagenModal(archivo)}
                className="overflow-hidden rounded-md border border-slate-300 bg-[#f0f0f0] p-0 transition hover:opacity-90"
              >
                {archivo.url && (
                  <AuthenticatedImage
                    url={archivo.url}
                    alt={archivo.nombre}
                    className="min-h-[100px] w-full cursor-pointer object-cover"
                  />
                )}
              </button>
            ))}
          </div>
        )}

        {otrosArchivos.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {otrosArchivos.map((archivo) => (
              <button
                key={archivo.id}
                type="button"
                onClick={() => archivo.url && openAuthenticatedFile(archivo.url)}
                className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
              >
                <FileText size={12} />
                {archivo.nombre}
              </button>
            ))}
          </div>
        )}
      </div>

      {imagenModal?.url && <AuthenticatedImageModal url={imagenModal.url} onClose={() => setImagenModal(null)} />}
    </>
  );
}

export interface PlanActividadCardProps {
  act: PlanActividad;
  canCreate: boolean;
  isAdmin: boolean;
  onEditActividad: () => void;
  onDeleteActividad: () => void;
  onAgregarEvidencia: () => void;
  onEditEvidencia: (ev: PlanEvidencia) => void;
  onDeleteEvidencia: (ev: PlanEvidencia) => void;
}

export const PlanActividadCard = memo(function PlanActividadCard({
  act,
  canCreate,
  isAdmin,
  onEditActividad,
  onDeleteActividad,
  onAgregarEvidencia,
  onEditEvidencia,
  onDeleteEvidencia,
}: PlanActividadCardProps) {
  const [expandida, setExpandida] = useState(false);
  const [cargandoEvidencias, setCargandoEvidencias] = useState(false);
  const [evidencias, setEvidencias] = useState<PlanEvidencia[]>(act.evidencias ?? []);
  const [errorCarga, setErrorCarga] = useState<string | null>(null);

  useEffect(() => {
    setEvidencias(act.evidencias ?? []);
    setExpandida(false);
    setCargandoEvidencias(false);
    setErrorCarga(null);
  }, [act.id, act.evidencias, act.tiene_evidencia, act.total_ejecutado, act.avance]);

  const meta = parseMeta(act.meta || "");
  const ejecutado = act.total_ejecutado ?? 0;
  const restante = meta && meta > 0 ? Math.max(0, meta - ejecutado) : null;
  const puedeAgregar = puedeAgregarEvidencia(act);
  const tieneEvidencia = act.tiene_evidencia || evidencias.length > 0;

  const cargarEvidencias = useCallback(async () => {
    if (cargandoEvidencias) return;
    setCargandoEvidencias(true);
    setErrorCarga(null);
    try {
      const data = await planesApi.actividades.listEvidencias(act.id);
      setEvidencias(data);
      setExpandida(true);
    } catch (err) {
      setErrorCarga(formatApiError(err));
    } finally {
      setCargandoEvidencias(false);
    }
  }, [act.id, cargandoEvidencias]);

  const handleToggleEvidencias = () => {
    if (expandida) {
      setExpandida(false);
      return;
    }
    if (evidencias.length > 0) {
      setExpandida(true);
      return;
    }
    void cargarEvidencias();
  };

  const progressTone =
    act.avance >= 100 ? "success" : act.avance >= 50 ? "info" : act.avance > 0 ? "warning" : "danger";

  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm transition duration-300 hover:translate-x-1 hover:shadow-md">
      <div className="border-l-4 border-[#4e73df] p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 flex-1">
            <h6 className="mb-1 flex flex-wrap items-center gap-2 text-sm font-semibold text-slate-900">
              {act.nombre}
              <PdmBadge tone={getColorEstadoActividad(act.estado)}>{act.estado_label}</PdmBadge>
              {tieneEvidencia && (
                <PdmBadge tone="success">
                  <CheckCircle2 size={12} className="mr-1 inline" />
                  Con Evidencia{evidencias.length > 1 ? ` (${evidencias.length})` : ""}
                </PdmBadge>
              )}
            </h6>
            <p className="mb-2 text-sm text-slate-500">{act.descripcion || "Sin descripción"}</p>

            <div className="mb-3 grid gap-2 text-xs text-slate-600 sm:grid-cols-2 lg:grid-cols-4">
              <div className="flex items-start gap-1.5">
                <User size={12} className="mt-0.5 shrink-0 text-slate-400" />
                <span>
                  <strong>Secretaría:</strong> {act.responsable_secretaria_nombre || "Sin asignar"}
                </span>
              </div>
              <div className="flex items-start gap-1.5">
                <User size={12} className="mt-0.5 shrink-0 text-slate-400" />
                <span>
                  <strong>Contratista:</strong> {act.responsable_usuario_nombre || "Sin asignar"}
                </span>
              </div>
              <div className="flex items-start gap-1.5">
                <Calendar size={12} className="mt-0.5 shrink-0 text-slate-400" />
                <span>
                  <strong>Plazo:</strong>{" "}
                  {act.fecha_inicio || act.fecha_fin
                    ? `${formatFechaCorta(act.fecha_inicio)} – ${formatFechaCorta(act.fecha_fin)}`
                    : act.trimestre_label}
                </span>
              </div>
              <div className="flex items-start gap-1.5">
                <Target size={12} className="mt-0.5 shrink-0 text-slate-400" />
                <span>
                  <strong>Meta:</strong> {act.meta || "Sin meta"}
                  {ejecutado > 0 && <> · Ejecutado: {ejecutado}</>}
                  {restante !== null && <> · Disponible: {restante}</>}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2 text-xs text-slate-500">
              <TrendingUp size={12} className="text-slate-400" />
              <span className="min-w-[3rem] font-medium text-slate-700">{act.avance}%</span>
              <div className="min-w-0 flex-1">
                <PdmProgressBar value={act.avance} tone={progressTone} showLabel={false} />
              </div>
            </div>
          </div>

          <div className="flex shrink-0 flex-wrap gap-1.5 sm:ml-3">
            {canCreate && (
              <PdmBtn variant="outline" size="sm" onClick={onEditActividad} title="Editar actividad">
                <Edit size={14} />
              </PdmBtn>
            )}
            {canCreate && puedeAgregar && (
              <PdmBtn
                variant="primary"
                size="sm"
                onClick={onAgregarEvidencia}
                title={tieneEvidencia ? "Agregar otra evidencia" : "Registrar evidencia"}
              >
                <CheckCircle2 size={14} />
              </PdmBtn>
            )}
            {canCreate && (!tieneEvidencia || isAdmin) && (
              <PdmBtn
                variant="danger"
                size="sm"
                onClick={onDeleteActividad}
                title={tieneEvidencia ? "Eliminar (incluye evidencias)" : "Eliminar actividad"}
              >
                <Trash2 size={14} />
              </PdmBtn>
            )}
          </div>
        </div>

        {canCreate && !tieneEvidencia && puedeAgregar && (
          <button
            type="button"
            onClick={onAgregarEvidencia}
            className="mt-3 flex w-full cursor-pointer items-center justify-center gap-2 rounded-lg border-2 border-dashed border-slate-200 py-4 text-sm text-slate-500 transition hover:border-blue-300 hover:bg-blue-50/40 hover:text-slate-700"
          >
            <CheckCircle2 size={16} className="text-slate-400" />
            Sin evidencia — Clic para registrar
          </button>
        )}

        {tieneEvidencia && (
          <div className="mt-3 rounded-lg bg-slate-100 p-3">
            {!expandida && !cargandoEvidencias && (
              <button
                type="button"
                onClick={handleToggleEvidencias}
                className="flex w-full cursor-pointer items-center justify-center gap-2 py-3 text-sm text-slate-500 transition hover:text-slate-700"
              >
                <CheckCircle2 size={16} className="text-emerald-600" />
                Tiene evidencia — Clic para cargar
              </button>
            )}

            {cargandoEvidencias && (
              <div className="flex items-center justify-center gap-2 py-3 text-sm text-slate-500">
                <Loader2 size={16} className="animate-spin text-blue-600" />
                Cargando evidencia...
              </div>
            )}

            {errorCarga && (
              <div className="py-2 text-center text-sm text-red-600">
                {errorCarga}
                <button type="button" onClick={() => void cargarEvidencias()} className="ml-2 text-blue-600 underline">
                  Reintentar
                </button>
              </div>
            )}

            {expandida && !cargandoEvidencias && (
              <div>
                <div className="mb-2 flex items-center justify-between gap-2">
                  <h6 className="flex items-center gap-1.5 text-sm font-semibold text-emerald-700">
                    <CheckCircle2 size={16} />
                    Evidencia de Cumplimiento
                    {evidencias.length > 1 ? ` (${evidencias.length})` : ""}
                  </h6>
                  <button
                    type="button"
                    onClick={() => setExpandida(false)}
                    className="text-xs text-slate-500 hover:text-slate-700"
                  >
                    Ocultar
                  </button>
                </div>
                <div className="space-y-3">
                  {evidencias.map((ev) => (
                    <EvidenciaBloque
                      key={ev.id}
                      ev={ev}
                      actDescripcion={act.descripcion}
                      canEdit={canCreate}
                      onEdit={() => onEditEvidencia(ev)}
                      onDelete={() => onDeleteEvidencia(ev)}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {canCreate && tieneEvidencia && !puedeAgregar && (
          <p className="mt-2 text-center text-xs font-medium text-emerald-700">Meta cumplida</p>
        )}
      </div>
    </div>
  );
});
