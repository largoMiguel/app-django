import { useEffect, useState } from "react";
import { type Secretaria } from "@/core/api/entities";
import { planesApi, type PlanCatalogoItem, type PlanWritePayload } from "@/core/api/planes";
import { formatApiError } from "@/core/api/errors";
import { PlanesModal, btnPrimary, btnSecondary, inputClass } from "./components/PlanesUi";

interface Props {
  open: boolean;
  onClose: () => void;
  catalogo: PlanCatalogoItem[];
  secretarias: Secretaria[];
  defaultAnio: number;
  onSaved: () => void;
}

export default function PlanFormModal({ open, onClose, catalogo, secretarias, defaultAnio, onSaved }: Props) {
  const [catalogoId, setCatalogoId] = useState<number | "">("");
  const [anio, setAnio] = useState(defaultAnio);
  const [nombre, setNombre] = useState("");
  const [objetivo, setObjetivo] = useState("");
  const [secretariaId, setSecretariaId] = useState<number | "">("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setAnio(defaultAnio);
      setCatalogoId("");
      setNombre("");
      setObjetivo("");
      setSecretariaId("");
      setError(null);
    }
  }, [open, defaultAnio]);

  useEffect(() => {
    if (catalogoId) {
      const item = catalogo.find((c) => c.id === Number(catalogoId));
      if (item && !nombre) setNombre(item.nombre);
    }
  }, [catalogoId, catalogo, nombre]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!catalogoId) {
      setError("Seleccione un plan del catálogo.");
      return;
    }
    setSaving(true);
    setError(null);
    const payload: PlanWritePayload = {
      catalogo_id: Number(catalogoId),
      anio,
      nombre: nombre.trim() || undefined,
      objetivo: objetivo.trim(),
      responsable_secretaria_id: secretariaId ? Number(secretariaId) : null,
    };
    try {
      await planesApi.create(payload);
      onSaved();
    } catch (err) {
      setError(formatApiError(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <PlanesModal open={open} title="Crear plan institucional" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
        )}
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Plan del catálogo *</label>
          <select
            value={catalogoId}
            onChange={(e) => setCatalogoId(e.target.value ? Number(e.target.value) : "")}
            className={inputClass}
            required
          >
            <option value="">Seleccionar…</option>
            {catalogo.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nombre} {c.es_decreto612 ? "(D612)" : ""}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Vigencia (año) *</label>
          <input
            type="number"
            value={anio}
            onChange={(e) => setAnio(Number(e.target.value))}
            className={inputClass}
            required
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Nombre</label>
          <input value={nombre} onChange={(e) => setNombre(e.target.value)} className={inputClass} />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Objetivo</label>
          <textarea value={objetivo} onChange={(e) => setObjetivo(e.target.value)} className={inputClass} rows={3} />
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
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className={btnSecondary}>
            Cancelar
          </button>
          <button type="submit" disabled={saving} className={btnPrimary}>
            {saving ? "Guardando…" : "Crear plan"}
          </button>
        </div>
      </form>
    </PlanesModal>
  );
}
