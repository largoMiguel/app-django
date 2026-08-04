import { useEffect, useMemo, useState } from "react";
import { type Secretaria } from "@/core/api/entities";
import {
  PLAN_ESTADO_OPTIONS,
  planesApi,
  type PlanCatalogoItem,
  type PlanListItem,
  type PlanWritePayload,
} from "@/core/api/planes";
import { formatApiError } from "@/core/api/errors";
import { PlanesModal, btnPrimary, btnSecondary, inputClass } from "./components/PlanesUi";

interface Props {
  open: boolean;
  onClose: () => void;
  plan?: PlanListItem | null;
  catalogo: PlanCatalogoItem[];
  secretarias: Secretaria[];
  defaultAnio: number;
  onSaved: () => void;
  onCatalogoCreated?: (item: PlanCatalogoItem) => void;
}

function slugCodigo(nombre: string): string {
  return nombre
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 64);
}

export default function PlanFormModal({
  open,
  onClose,
  plan,
  catalogo,
  secretarias,
  defaultAnio,
  onSaved,
  onCatalogoCreated,
}: Props) {
  const isEdit = Boolean(plan);
  const [catalogoId, setCatalogoId] = useState<number | "">("");
  const [anio, setAnio] = useState(defaultAnio);
  const [objetivo, setObjetivo] = useState("");
  const [secretariaId, setSecretariaId] = useState<number | "">("");
  const [estado, setEstado] = useState("BORRADOR");
  const [fechaPublicacion, setFechaPublicacion] = useState("");
  const [urlPublicacion, setUrlPublicacion] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showCustomForm, setShowCustomForm] = useState(false);
  const [customNombre, setCustomNombre] = useState("");
  const [customDescripcion, setCustomDescripcion] = useState("");
  const [creatingCustom, setCreatingCustom] = useState(false);

  const { decreto612, propios } = useMemo(() => {
    const d612: PlanCatalogoItem[] = [];
    const own: PlanCatalogoItem[] = [];
    for (const item of catalogo) {
      if (item.es_decreto612) d612.push(item);
      else own.push(item);
    }
    return { decreto612: d612, propios: own };
  }, [catalogo]);

  const estadoHint = PLAN_ESTADO_OPTIONS.find((o) => o.value === estado)?.hint ?? "";

  useEffect(() => {
    if (!open) return;
    if (plan) {
      setCatalogoId(plan.catalogo);
      setAnio(plan.anio);
      setObjetivo(plan.objetivo || "");
      setSecretariaId(plan.responsable_secretaria ?? "");
      setEstado(plan.estado);
      setFechaPublicacion(plan.fecha_publicacion || "");
      setUrlPublicacion(plan.url_publicacion || "");
    } else {
      setCatalogoId("");
      setAnio(defaultAnio);
      setObjetivo("");
      setSecretariaId("");
      setEstado("BORRADOR");
      setFechaPublicacion("");
      setUrlPublicacion("");
    }
    setError(null);
    setShowCustomForm(false);
    setCustomNombre("");
    setCustomDescripcion("");
  }, [open, plan, defaultAnio]);

  async function handleCreateCustomCatalogo(e: React.FormEvent) {
    e.preventDefault();
    const nombre = customNombre.trim();
    if (!nombre) {
      setError("Indique el nombre del plan propio.");
      return;
    }
    setCreatingCustom(true);
    setError(null);
    try {
      const codigo = slugCodigo(nombre) || `plan_propio_${Date.now()}`;
      const item = await planesApi.createCatalogo({
        codigo,
        nombre,
        descripcion: customDescripcion.trim(),
      });
      onCatalogoCreated?.(item);
      setCatalogoId(item.id);
      setShowCustomForm(false);
      setCustomNombre("");
      setCustomDescripcion("");
    } catch (err) {
      setError(formatApiError(err));
    } finally {
      setCreatingCustom(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isEdit && !catalogoId) {
      setError("Seleccione un plan del catálogo.");
      return;
    }
    setSaving(true);
    setError(null);
    const payload: PlanWritePayload = {
      catalogo_id: Number(catalogoId),
      anio,
      objetivo: objetivo.trim(),
      responsable_secretaria_id: secretariaId ? Number(secretariaId) : null,
      estado,
      fecha_publicacion: fechaPublicacion || null,
      url_publicacion: urlPublicacion.trim(),
    };
    try {
      if (isEdit && plan) {
        await planesApi.update(plan.id, payload);
      } else {
        await planesApi.create(payload);
      }
      onSaved();
    } catch (err) {
      setError(formatApiError(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <PlanesModal open={open} title={isEdit ? "Editar plan institucional" : "Crear plan institucional"} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
        )}
        {isEdit ? (
          <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
            <strong>{plan?.nombre}</strong>
            <span className="text-slate-500"> · {plan?.catalogo_codigo} · Vigencia {plan?.anio}</span>
          </div>
        ) : (
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Plan del catálogo *</label>
            <select
              value={catalogoId}
              onChange={(e) => setCatalogoId(e.target.value ? Number(e.target.value) : "")}
              className={inputClass}
              required
            >
              <option value="">Seleccionar…</option>
              {decreto612.length > 0 && (
                <optgroup label="Decreto 612">
                  {decreto612.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nombre}
                    </option>
                  ))}
                </optgroup>
              )}
              {propios.length > 0 && (
                <optgroup label="Planes propios de la entidad">
                  {propios.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nombre}
                    </option>
                  ))}
                </optgroup>
              )}
            </select>
            {!showCustomForm ? (
              <button
                type="button"
                onClick={() => setShowCustomForm(true)}
                className="mt-2 text-sm font-medium text-[#0e7490] hover:underline"
              >
                + Crear plan propio de la entidad
              </button>
            ) : (
              <div className="mt-3 space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
                <p className="text-sm font-medium text-slate-700">Nuevo plan propio</p>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600">Nombre del plan *</label>
                  <input
                    value={customNombre}
                    onChange={(e) => setCustomNombre(e.target.value)}
                    className={inputClass}
                    placeholder="Ej. Plan de modernización interna"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600">Descripción (opcional)</label>
                  <textarea
                    value={customDescripcion}
                    onChange={(e) => setCustomDescripcion(e.target.value)}
                    className={inputClass}
                    rows={2}
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handleCreateCustomCatalogo}
                    disabled={creatingCustom}
                    className={btnPrimary}
                  >
                    {creatingCustom ? "Creando…" : "Agregar al catálogo"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowCustomForm(false);
                      setCustomNombre("");
                      setCustomDescripcion("");
                    }}
                    className={btnSecondary}
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
        {!isEdit && (
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
        )}
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
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Estado del plan</label>
          <select value={estado} onChange={(e) => setEstado(e.target.value)} className={inputClass}>
            {PLAN_ESTADO_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          {estadoHint && <p className="mt-1 text-xs text-slate-500">{estadoHint}</p>}
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Fecha de publicación</label>
            <input
              type="date"
              value={fechaPublicacion}
              onChange={(e) => setFechaPublicacion(e.target.value)}
              className={inputClass}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">URL de publicación</label>
            <input
              value={urlPublicacion}
              onChange={(e) => setUrlPublicacion(e.target.value)}
              className={inputClass}
              placeholder="https://…"
            />
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className={btnSecondary}>
            Cancelar
          </button>
          <button type="submit" disabled={saving} className={btnPrimary}>
            {saving ? "Guardando…" : isEdit ? "Guardar cambios" : "Crear plan"}
          </button>
        </div>
      </form>
    </PlanesModal>
  );
}
