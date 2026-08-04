import { useEffect, useState } from "react";
import { secretariasApi, type Secretaria } from "@/core/api/entities";
import { planesApi, TRIMESTRE_OPTIONS, type PlanActividad, type PlanDetail } from "@/core/api/planes";
import { formatApiError } from "@/core/api/errors";
import { PlanesModal, btnPrimary, btnSecondary, inputClass } from "./components/PlanesUi";

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
    } else {
      setTrimestre(1);
      setNombre("");
      setDescripcion("");
      setMeta("");
      setIndicador("");
      setFechaInicio("");
      setFechaFin("");
      setSecretariaId(plan.responsable_secretaria ?? "");
    }
    setError(null);
  }, [open, actividad, plan]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!nombre.trim()) {
      setError("El nombre es requerido.");
      return;
    }
    if (!meta.trim()) {
      setError("La meta programada es requerida para calcular el avance.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const payload = {
        trimestre,
        nombre: nombre.trim(),
        descripcion,
        meta,
        indicador,
        fecha_inicio: fechaInicio || null,
        fecha_fin: fechaFin || null,
        responsable_secretaria: secretariaId ? Number(secretariaId) : null,
      };
      if (isEdit && actividad) {
        await planesApi.actividades.update(actividad.id, payload);
      } else {
        await planesApi.actividades.create({
          plan: plan.id,
          anio: plan.anio,
          ...payload,
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
    <PlanesModal open={open} title={isEdit ? "Editar actividad" : "Nueva actividad"} onClose={onClose} wide>
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
        )}
        <p className="text-sm text-slate-600">
          Defina la actividad o componente del plan. El avance y la evidencia de ejecución se registran después, por
          separado.
        </p>
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
          <label className="mb-1 block text-sm font-medium text-slate-700">Nombre *</label>
          <input value={nombre} onChange={(e) => setNombre(e.target.value)} className={inputClass} required />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Descripción</label>
          <textarea value={descripcion} onChange={(e) => setDescripcion(e.target.value)} className={inputClass} rows={2} />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Meta programada *</label>
            <input
              value={meta}
              onChange={(e) => setMeta(e.target.value)}
              className={inputClass}
              placeholder="Ej. 30 (cantidad objetivo del trimestre)"
              required
            />
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
        {isEdit && actividad && (
          <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
            Estado: <strong>{actividad.estado_label}</strong> · Avance: <strong>{actividad.avance}%</strong>
            {!actividad.tiene_evidencia && " — registre la evidencia de ejecución para reportar avance."}
          </div>
        )}
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className={btnSecondary}>
            Cancelar
          </button>
          <button type="submit" disabled={saving} className={btnPrimary}>
            {saving ? "Guardando…" : isEdit ? "Guardar actividad" : "Crear actividad"}
          </button>
        </div>
      </form>
    </PlanesModal>
  );
}
