import { useEffect, useMemo, useState } from "react";
import { Loader2, X } from "lucide-react";
import { planesApi, type PlanActividad, type PlanEvidencia, type PlanEvidenciaArchivo } from "@/core/api/planes";
import { formatApiError } from "@/core/api/errors";
import { useAuthenticatedImage } from "@/features/pdm/useAuthenticatedImage";
import { PlanesFilePicker, PlanesModal, btnPrimary, btnSecondary, inputClass } from "./components/PlanesUi";

interface Props {
  open: boolean;
  onClose: () => void;
  actividad: PlanActividad;
  evidencia?: PlanEvidencia | null;
  onSaved: () => void;
}

function parseMeta(value: string): number | null {
  const match = value.trim().replace(",", ".").match(/\d+(?:\.\d+)?/);
  return match ? Number(match[0]) : null;
}

function ArchivoPreview({
  arch,
  onRemove,
}: {
  arch: PlanEvidenciaArchivo;
  onRemove?: () => void;
}) {
  const isImage = (arch.content_type || "").toLowerCase().startsWith("image/");
  const { src, failed } = useAuthenticatedImage(isImage && arch.url ? arch.url : null);

  return (
    <li className="flex items-center justify-between gap-2 rounded bg-slate-50 px-3 py-2 text-sm">
      <div className="flex min-w-0 flex-1 items-center gap-2">
        {isImage && arch.url && !failed && src ? (
          <img src={src} alt={arch.nombre} className="h-10 w-10 rounded object-cover" />
        ) : isImage && arch.url ? (
          <div className="flex h-10 w-10 items-center justify-center rounded bg-slate-200">
            <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
          </div>
        ) : null}
        <span className="truncate">{arch.nombre}</span>
      </div>
      {onRemove && (
        <button type="button" onClick={onRemove} className="shrink-0 text-red-500 hover:text-red-700">
          <X className="h-4 w-4" />
        </button>
      )}
    </li>
  );
}

export default function EvidenciaFormModal({ open, onClose, actividad, evidencia = null, onSaved }: Props) {
  const isEdit = Boolean(evidencia?.id);
  const [descripcion, setDescripcion] = useState("");
  const [cantidadEjecutada, setCantidadEjecutada] = useState("");
  const [urlEvidencia, setUrlEvidencia] = useState("");
  const [archivosNuevos, setArchivosNuevos] = useState<File[]>([]);
  const [archivosEliminar, setArchivosEliminar] = useState<number[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const metaProgramada = parseMeta(actividad.meta || "");
  const ejecutadoSinEsta = useMemo(() => {
    const total = actividad.total_ejecutado ?? 0;
    if (!evidencia) return total;
    return Math.max(0, total - Number(evidencia.cantidad_ejecutada || 0));
  }, [actividad.total_ejecutado, evidencia]);

  const restante = useMemo(() => {
    if (!metaProgramada || metaProgramada <= 0) return null;
    return Math.max(0, metaProgramada - ejecutadoSinEsta);
  }, [metaProgramada, ejecutadoSinEsta]);

  const cantidadNum = parseMeta(cantidadEjecutada) ?? 0;
  const archivosActuales = useMemo(
    () => (evidencia?.archivos ?? []).filter((a) => !archivosEliminar.includes(a.id)),
    [evidencia?.archivos, archivosEliminar],
  );

  const avancePreview = useMemo(() => {
    if (!metaProgramada || metaProgramada <= 0) return null;
    const total = ejecutadoSinEsta + cantidadNum;
    return Math.min(100, Math.round((total / metaProgramada) * 100));
  }, [metaProgramada, ejecutadoSinEsta, cantidadNum]);

  useEffect(() => {
    if (!open) return;
    if (evidencia) {
      setDescripcion(evidencia.descripcion || "");
      setCantidadEjecutada(String(evidencia.cantidad_ejecutada ?? ""));
      setUrlEvidencia(evidencia.url_evidencia || "");
    } else {
      setDescripcion("");
      setCantidadEjecutada("");
      setUrlEvidencia("");
    }
    setArchivosNuevos([]);
    setArchivosEliminar([]);
    setError(null);
  }, [open, actividad.id, evidencia]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!descripcion.trim()) {
      setError("La descripción de la evidencia es requerida.");
      return;
    }
    if (cantidadNum <= 0) {
      setError("Indique cuánto se ejecutó en esta evidencia (mayor a 0).");
      return;
    }
    if (restante !== null && cantidadNum > restante) {
      setError(`Solo puede registrar hasta ${restante} unidades (meta ${metaProgramada}, ya ejecutado ${ejecutadoSinEsta}).`);
      return;
    }
    const tieneUrl = Boolean(urlEvidencia.trim());
    const tieneArchivos = archivosActuales.length > 0 || archivosNuevos.length > 0;
    if (!tieneUrl && !tieneArchivos) {
      setError("Adjunte al menos un archivo o una URL externa.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      if (isEdit && evidencia) {
        await planesApi.actividades.actualizarEvidencia(actividad.id, evidencia.id, {
          descripcion: descripcion.trim(),
          cantidad_ejecutada: cantidadNum,
          url_evidencia: urlEvidencia.trim(),
          archivos: archivosNuevos,
          archivos_eliminar: archivosEliminar.length ? archivosEliminar : undefined,
        });
      } else {
        await planesApi.actividades.registrarEvidencia(actividad.id, {
          descripcion: descripcion.trim(),
          cantidad_ejecutada: cantidadNum,
          url_evidencia: urlEvidencia.trim() || undefined,
          archivos: archivosNuevos,
        });
      }
      onSaved();
    } catch (err) {
      setError(formatApiError(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <PlanesModal open={open} title={isEdit ? "Editar evidencia de ejecución" : "Registrar evidencia de ejecución"} onClose={onClose} wide>
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
        )}
        <p className="text-sm text-slate-600">
          Actividad: <strong>{actividad.nombre}</strong>
          {actividad.meta && (
            <>
              {" "}
              · Meta programada: <strong>{actividad.meta}</strong>
            </>
          )}
          {ejecutadoSinEsta > 0 && (
            <>
              {" "}
              · Ya ejecutado: <strong>{ejecutadoSinEsta}</strong>
            </>
          )}
          {restante !== null && (
            <>
              {" "}
              · Disponible: <strong>{restante}</strong>
            </>
          )}
        </p>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Descripción *</label>
          <textarea
            value={descripcion}
            onChange={(e) => setDescripcion(e.target.value)}
            className={inputClass}
            rows={3}
            placeholder="Qué se hizo en este registro…"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Cantidad ejecutada *</label>
          <input
            type="number"
            min={0}
            max={restante ?? undefined}
            step="any"
            value={cantidadEjecutada}
            onChange={(e) => setCantidadEjecutada(e.target.value)}
            className={inputClass}
            placeholder={
              restante !== null
                ? `Máximo ${restante} (${ejecutadoSinEsta} de ${metaProgramada} ya ejecutados)`
                : actividad.meta
                  ? `Ej. 10 de ${actividad.meta}`
                  : "Ej. 10"
            }
          />
          {avancePreview !== null && (
            <p className="mt-1 text-xs text-slate-500">
              Avance estimado de la actividad tras este registro: <strong>{avancePreview}%</strong>
            </p>
          )}
        </div>
        <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
          Debe adjuntar <strong>al menos uno</strong>: URL externa <em>o</em> archivo(s). Puede usar ambos.
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">
            URL externa <span className="font-normal text-slate-500">(opcional si adjunta archivo)</span>
          </label>
          <input value={urlEvidencia} onChange={(e) => setUrlEvidencia(e.target.value)} className={inputClass} />
        </div>
        {archivosActuales.length > 0 && (
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Archivos actuales</label>
            <ul className="space-y-1">
              {archivosActuales.map((arch) => (
                <ArchivoPreview
                  key={arch.id}
                  arch={arch}
                  onRemove={() => setArchivosEliminar((prev) => [...prev, arch.id])}
                />
              ))}
            </ul>
          </div>
        )}
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">
            {isEdit ? "Agregar archivos" : "Archivos"}{" "}
            <span className="font-normal text-slate-500">(opcional si indica URL)</span>
          </label>
          <PlanesFilePicker files={archivosNuevos} onChange={setArchivosNuevos} />
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className={btnSecondary}>
            Cancelar
          </button>
          <button type="submit" disabled={saving} className={btnPrimary}>
            {saving ? "Guardando…" : isEdit ? "Guardar cambios" : "Registrar evidencia"}
          </button>
        </div>
      </form>
    </PlanesModal>
  );
}
