import { useEffect, useState } from "react";
import { planesApi, type PlanActividad } from "@/core/api/planes";
import { formatApiError } from "@/core/api/errors";
import { PlanesFilePicker, PlanesModal, btnPrimary, btnSecondary, inputClass } from "./components/PlanesUi";

interface Props {
  open: boolean;
  onClose: () => void;
  actividad: PlanActividad;
  onSaved: () => void;
}

export default function EvidenciaFormModal({ open, onClose, actividad, onSaved }: Props) {
  const isEdit = actividad.tiene_evidencia;
  const [descripcion, setDescripcion] = useState("");
  const [metaEjecutada, setMetaEjecutada] = useState("");
  const [avance, setAvance] = useState(0);
  const [urlEvidencia, setUrlEvidencia] = useState("");
  const [archivosNuevos, setArchivosNuevos] = useState<File[]>([]);
  const [archivosEliminar, setArchivosEliminar] = useState<number[]>([]);
  const [loadingEvidencia, setLoadingEvidencia] = useState(false);
  const [archivosExistentes, setArchivosExistentes] = useState(actividad.evidencia?.archivos ?? []);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setArchivosNuevos([]);
    setArchivosEliminar([]);

    if (actividad.evidencia) {
      setDescripcion(actividad.evidencia.descripcion || "");
      setMetaEjecutada(actividad.evidencia.meta_ejecutada || "");
      setAvance(actividad.evidencia.avance ?? actividad.avance ?? 0);
      setUrlEvidencia(actividad.evidencia.url_evidencia || "");
      setArchivosExistentes(actividad.evidencia.archivos || []);
      return;
    }

    setLoadingEvidencia(true);
    planesApi.actividades
      .getEvidencia(actividad.id)
      .then((ev) => {
        if (ev) {
          setDescripcion(ev.descripcion || "");
          setMetaEjecutada(ev.meta_ejecutada || "");
          setAvance(ev.avance ?? 0);
          setUrlEvidencia(ev.url_evidencia || "");
          setArchivosExistentes(ev.archivos || []);
        } else {
          setDescripcion("");
          setMetaEjecutada("");
          setAvance(0);
          setUrlEvidencia("");
          setArchivosExistentes([]);
        }
      })
      .catch(() => {
        setDescripcion("");
        setMetaEjecutada("");
        setAvance(0);
        setUrlEvidencia("");
        setArchivosExistentes([]);
      })
      .finally(() => setLoadingEvidencia(false));
  }, [open, actividad]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!descripcion.trim()) {
      setError("La descripción de la evidencia es requerida.");
      return;
    }
    const conservaArchivos = archivosExistentes.some((a) => !archivosEliminar.includes(a.id));
    if (!urlEvidencia.trim() && archivosNuevos.length === 0 && !conservaArchivos) {
      setError("Adjunte al menos un archivo o una URL externa.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const payload = {
        descripcion: descripcion.trim(),
        meta_ejecutada: metaEjecutada.trim(),
        avance,
        url_evidencia: urlEvidencia.trim() || undefined,
        archivos: archivosNuevos.length ? archivosNuevos : undefined,
        archivos_eliminar: archivosEliminar.length ? archivosEliminar : undefined,
      };
      if (isEdit) {
        await planesApi.actividades.actualizarEvidencia(actividad.id, payload);
      } else {
        await planesApi.actividades.registrarEvidencia(actividad.id, payload);
      }
      onSaved();
    } catch (err) {
      setError(formatApiError(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <PlanesModal
      open={open}
      title={isEdit ? "Editar evidencia de ejecución" : "Registrar evidencia de ejecución"}
      onClose={onClose}
      wide
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
        )}
        <p className="text-sm text-slate-600">
          Actividad: <strong>{actividad.nombre}</strong> · {actividad.trimestre_label}
        </p>
        {loadingEvidencia ? (
          <p className="text-sm text-slate-500">Cargando evidencia…</p>
        ) : (
          <>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Descripción de la ejecución *</label>
              <textarea
                value={descripcion}
                onChange={(e) => setDescripcion(e.target.value)}
                className={inputClass}
                rows={3}
                placeholder="Qué se hizo, resultados obtenidos…"
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Meta ejecutada</label>
                <input
                  value={metaEjecutada}
                  onChange={(e) => setMetaEjecutada(e.target.value)}
                  className={inputClass}
                  placeholder="Ej. 3 capacitaciones realizadas"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Avance (%) *</label>
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={avance}
                  onChange={(e) => setAvance(Number(e.target.value))}
                  className={inputClass}
                  required
                />
              </div>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">URL externa</label>
              <input value={urlEvidencia} onChange={(e) => setUrlEvidencia(e.target.value)} className={inputClass} />
            </div>
            {archivosExistentes.map((arch) => (
              <label key={arch.id} className="flex items-center gap-2 text-sm text-slate-600">
                <input
                  type="checkbox"
                  checked={archivosEliminar.includes(arch.id)}
                  onChange={(e) =>
                    setArchivosEliminar((prev) =>
                      e.target.checked ? [...prev, arch.id] : prev.filter((id) => id !== arch.id),
                    )
                  }
                />
                Eliminar: {arch.nombre}
              </label>
            ))}
            <PlanesFilePicker files={archivosNuevos} onChange={setArchivosNuevos} />
          </>
        )}
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className={btnSecondary}>
            Cancelar
          </button>
          <button type="submit" disabled={saving || loadingEvidencia} className={btnPrimary}>
            {saving ? "Guardando…" : isEdit ? "Actualizar evidencia" : "Registrar evidencia"}
          </button>
        </div>
      </form>
    </PlanesModal>
  );
}
