import { useEffect, useState } from "react";
import { secretariasApi, type Secretaria } from "@/core/api/entities";
import {
  ESTADO_ACTIVIDAD_OPTIONS,
  planesApi,
  TRIMESTRE_OPTIONS,
  type PlanActividad,
  type PlanDetail,
} from "@/core/api/planes";
import { formatApiError } from "@/core/api/errors";
import { PlanesFilePicker, PlanesModal, btnPrimary, btnSecondary, inputClass } from "./components/PlanesUi";

interface Props {
  open: boolean;
  onClose: () => void;
  plan: PlanDetail;
  actividad: PlanActividad | null;
  onSaved: () => void;
}

export default function ActividadFormModal({ open, onClose, plan, actividad, onSaved }: Props) {
  const isEdit = Boolean(actividad);
  const [secretarias, setSecretarias] = useState<Secretaria[]>([]);
  const [trimestre, setTrimestre] = useState(1);
  const [nombre, setNombre] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [meta, setMeta] = useState("");
  const [indicador, setIndicador] = useState("");
  const [fechaInicio, setFechaInicio] = useState("");
  const [fechaFin, setFechaFin] = useState("");
  const [secretariaId, setSecretariaId] = useState<number | "">("");
  const [estado, setEstado] = useState("PENDIENTE");
  const [avance, setAvance] = useState(0);
  const [evidenciaDesc, setEvidenciaDesc] = useState("");
  const [evidenciaUrl, setEvidenciaUrl] = useState("");
  const [archivosNuevos, setArchivosNuevos] = useState<File[]>([]);
  const [archivosEliminar, setArchivosEliminar] = useState<number[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    secretariasApi.list().then(setSecretarias).catch(() => setSecretarias([]));
  }, []);

  useEffect(() => {
    if (!open) return;
    if (actividad) {
      setTrimestre(actividad.trimestre);
      setNombre(actividad.nombre);
      setDescripcion(actividad.descripcion || "");
      setMeta(actividad.meta || "");
      setIndicador(actividad.indicador || "");
      setFechaInicio(actividad.fecha_inicio || "");
      setFechaFin(actividad.fecha_fin || "");
      setSecretariaId(actividad.responsable_secretaria ?? "");
      setEstado(actividad.estado);
      setAvance(actividad.avance);
      setEvidenciaDesc(actividad.evidencia?.descripcion || "");
      setEvidenciaUrl(actividad.evidencia?.url_evidencia || "");
    } else {
      setTrimestre(1);
      setNombre("");
      setDescripcion("");
      setMeta("");
      setIndicador("");
      setFechaInicio("");
      setFechaFin("");
      setSecretariaId(plan.responsable_secretaria ?? "");
      setEstado("PENDIENTE");
      setAvance(0);
      setEvidenciaDesc("");
      setEvidenciaUrl("");
    }
    setArchivosNuevos([]);
    setArchivosEliminar([]);
    setError(null);
  }, [open, actividad, plan]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!nombre.trim()) {
      setError("El nombre es requerido.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      let actId = actividad?.id;
      if (isEdit && actId) {
        await planesApi.actividades.update(actId, {
          trimestre,
          nombre: nombre.trim(),
          descripcion,
          meta,
          indicador,
          fecha_inicio: fechaInicio || null,
          fecha_fin: fechaFin || null,
          responsable_secretaria: secretariaId ? Number(secretariaId) : null,
          estado,
          avance,
        });
      } else {
        const created = await planesApi.actividades.create({
          plan: plan.id,
          anio: plan.anio,
          trimestre,
          nombre: nombre.trim(),
          descripcion,
          meta,
          indicador,
          fecha_inicio: fechaInicio || null,
          fecha_fin: fechaFin || null,
          responsable_secretaria: secretariaId ? Number(secretariaId) : null,
          estado,
          avance,
        });
        actId = created.id;
      }

      const hasEvidenciaInput =
        evidenciaDesc.trim() || evidenciaUrl.trim() || archivosNuevos.length > 0 || actividad?.tiene_evidencia;

      if (hasEvidenciaInput && actId) {
        const payload = {
          descripcion: evidenciaDesc.trim() || "Evidencia de cumplimiento",
          url_evidencia: evidenciaUrl.trim() || undefined,
          archivos: archivosNuevos.length ? archivosNuevos : undefined,
          archivos_eliminar: archivosEliminar.length ? archivosEliminar : undefined,
        };
        if (actividad?.tiene_evidencia) {
          await planesApi.actividades.actualizarEvidencia(actId, payload);
        } else if (evidenciaDesc.trim() || evidenciaUrl.trim() || archivosNuevos.length) {
          await planesApi.actividades.registrarEvidencia(actId, payload);
        }
      }

      onSaved();
    } catch (err) {
      setError(formatApiError(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <PlanesModal open={open} title={isEdit ? "Editar actividad" : "Nueva actividad"} onClose={onClose} wide>
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Trimestre *</label>
            <select value={trimestre} onChange={(e) => setTrimestre(Number(e.target.value))} className={inputClass}>
              {TRIMESTRE_OPTIONS.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Estado</label>
            <select value={estado} onChange={(e) => setEstado(e.target.value)} className={inputClass}>
              {ESTADO_ACTIVIDAD_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Nombre *</label>
          <input value={nombre} onChange={(e) => setNombre(e.target.value)} className={inputClass} required />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Descripción</label>
          <textarea value={descripcion} onChange={(e) => setDescripcion(e.target.value)} className={inputClass} rows={2} />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Meta</label>
            <input value={meta} onChange={(e) => setMeta(e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Indicador</label>
            <input value={indicador} onChange={(e) => setIndicador(e.target.value)} className={inputClass} />
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Fecha inicio</label>
            <input type="date" value={fechaInicio} onChange={(e) => setFechaInicio(e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Fecha fin</label>
            <input type="date" value={fechaFin} onChange={(e) => setFechaFin(e.target.value)} className={inputClass} />
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Secretaría responsable</label>
            <select
              value={secretariaId}
              onChange={(e) => setSecretariaId(e.target.value ? Number(e.target.value) : "")}
              className={inputClass}
            >
              <option value="">Sin asignar</option>
              {secretarias.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.nombre}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Avance (%)</label>
            <input
              type="number"
              min={0}
              max={100}
              value={avance}
              onChange={(e) => setAvance(Number(e.target.value))}
              className={inputClass}
            />
          </div>
        </div>

        <div className="border-t border-slate-200 pt-4">
          <h4 className="mb-3 text-sm font-semibold text-slate-800">Evidencia (opcional)</h4>
          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Descripción evidencia</label>
              <textarea
                value={evidenciaDesc}
                onChange={(e) => setEvidenciaDesc(e.target.value)}
                className={inputClass}
                rows={2}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">URL externa</label>
              <input value={evidenciaUrl} onChange={(e) => setEvidenciaUrl(e.target.value)} className={inputClass} />
            </div>
            {actividad?.evidencia?.archivos?.map((arch) => (
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
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className={btnSecondary}>
            Cancelar
          </button>
          <button type="submit" disabled={saving} className={btnPrimary}>
            {saving ? "Guardando…" : isEdit ? "Guardar cambios" : "Crear actividad"}
          </button>
        </div>
      </form>
    </PlanesModal>
  );
}
