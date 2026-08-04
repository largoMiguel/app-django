import { useEffect, useMemo, useState } from "react";
import { planesApi, type PlanActividad } from "@/core/api/planes";
import { formatApiError } from "@/core/api/errors";
import { PlanesFilePicker, PlanesModal, btnPrimary, btnSecondary, inputClass } from "./components/PlanesUi";

interface Props {
  open: boolean;
  onClose: () => void;
  actividad: PlanActividad;
  onSaved: () => void;
}

function parseMeta(value: string): number | null {
  const match = value.trim().replace(",", ".").match(/\d+(?:\.\d+)?/);
  return match ? Number(match[0]) : null;
}

export default function EvidenciaFormModal({ open, onClose, actividad, onSaved }: Props) {
  const [descripcion, setDescripcion] = useState("");
  const [cantidadEjecutada, setCantidadEjecutada] = useState("");
  const [urlEvidencia, setUrlEvidencia] = useState("");
  const [archivosNuevos, setArchivosNuevos] = useState<File[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const metaProgramada = parseMeta(actividad.meta || "");
  const ejecutadoPrevio = actividad.total_ejecutado ?? 0;
  const cantidadNum = parseMeta(cantidadEjecutada) ?? 0;
  const avancePreview = useMemo(() => {
    if (!metaProgramada || metaProgramada <= 0) return null;
    const total = ejecutadoPrevio + cantidadNum;
    return Math.min(100, Math.round((total / metaProgramada) * 100));
  }, [metaProgramada, ejecutadoPrevio, cantidadNum]);

  useEffect(() => {
    if (!open) return;
    setDescripcion("");
    setCantidadEjecutada("");
    setUrlEvidencia("");
    setArchivosNuevos([]);
    setError(null);
  }, [open, actividad.id]);

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
    if (!urlEvidencia.trim() && archivosNuevos.length === 0) {
      setError("Adjunte al menos un archivo o una URL externa.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await planesApi.actividades.registrarEvidencia(actividad.id, {
        descripcion: descripcion.trim(),
        cantidad_ejecutada: cantidadNum,
        url_evidencia: urlEvidencia.trim() || undefined,
        archivos: archivosNuevos,
      });
      onSaved();
    } catch (err) {
      setError(formatApiError(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <PlanesModal open={open} title="Registrar evidencia de ejecución" onClose={onClose} wide>
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
          {ejecutadoPrevio > 0 && (
            <>
              {" "}
              · Ya ejecutado: <strong>{ejecutadoPrevio}</strong>
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
            step="any"
            value={cantidadEjecutada}
            onChange={(e) => setCantidadEjecutada(e.target.value)}
            className={inputClass}
            placeholder={actividad.meta ? `Ej. 10 de ${actividad.meta}` : "Ej. 10"}
          />
          {avancePreview !== null && (
            <p className="mt-1 text-xs text-slate-500">
              Avance estimado de la actividad tras este registro: <strong>{avancePreview}%</strong>
            </p>
          )}
        </div>
        <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
          Debe adjuntar <strong>al menos uno</strong>: URL externa <em>o</em> archivo(s). No es necesario los dos.
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">
            URL externa <span className="font-normal text-slate-500">(opcional si adjunta archivo)</span>
          </label>
          <input value={urlEvidencia} onChange={(e) => setUrlEvidencia(e.target.value)} className={inputClass} />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">
            Archivos <span className="font-normal text-slate-500">(opcional si indica URL)</span>
          </label>
          <PlanesFilePicker files={archivosNuevos} onChange={setArchivosNuevos} />
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className={btnSecondary}>
            Cancelar
          </button>
          <button type="submit" disabled={saving} className={btnPrimary}>
            {saving ? "Guardando…" : "Registrar evidencia"}
          </button>
        </div>
      </form>
    </PlanesModal>
  );
}
