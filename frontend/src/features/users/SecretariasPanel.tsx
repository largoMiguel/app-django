import { useEffect, useState } from "react";
import { Briefcase, Pencil, Plus, Save, Trash2, X } from "lucide-react";
import { formatApiError } from "@/core/api/errors";
import { secretariasApi, type Secretaria } from "@/core/api/entities";
import {
  modalContainerClass,
  modalOverlayClass,
  modalPanelSmClass,
} from "@/components/ui/modalShell";

interface Props {
  entityId: number;
  entityName?: string;
  compact?: boolean;
}

export default function SecretariasPanel({ entityId, entityName, compact = false }: Props) {
  const [items, setItems] = useState<Secretaria[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modal, setModal] = useState<"create" | Secretaria | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      setItems(await secretariasApi.list(entityId));
    } catch (err) {
      setError(formatApiError(err, "No se pudieron cargar las secretarías."));
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!entityId) return;
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entityId]);

  async function remove(s: Secretaria) {
    if (
      !confirm(
        `¿Eliminar la secretaría "${s.nombre}"?\n\nNo se puede eliminar si tiene correspondencia u otros registros vinculados.`,
      )
    ) {
      return;
    }
    setError(null);
    try {
      await secretariasApi.remove(s.id);
      await load();
    } catch (err) {
      setError(formatApiError(err, "No se pudo eliminar la secretaría."));
    }
  }

  return (
    <div className={compact ? "space-y-3" : "space-y-4"}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          {!compact && (
            <h2 className="flex items-center gap-2 text-lg font-semibold text-[#111827]">
              <Briefcase className="h-5 w-5 text-[#3eafd4]" />
              Secretarías
            </h2>
          )}
          <p className="text-xs text-slate-500 sm:text-sm">
            {entityName
              ? `Dependencias de ${entityName}. Créelas aquí antes de asignar secretarios o contratistas.`
              : "Cree secretarías sin necesidad de crear un usuario."}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setModal("create")}
          className="flex items-center gap-1.5 rounded-md bg-[#3eafd4] px-4 py-2 text-sm font-medium text-white hover:bg-[#2f9fc2]"
        >
          <Plus className="h-4 w-4" /> Nueva secretaría
        </button>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      <div className="rounded-[0.6rem] border border-[#e9ecef] bg-white">
        {loading ? (
          <div className="p-6 text-center text-slate-500">Cargando…</div>
        ) : items.length === 0 ? (
          <div className="p-6 text-center text-slate-500">
            No hay secretarías. Use <strong>Nueva secretaría</strong> para crear la primera.
          </div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {items.map((s) => (
              <li key={s.id} className="flex items-center justify-between gap-3 px-4 py-3">
                <div>
                  <div className="font-medium text-slate-800">{s.nombre}</div>
                  <div className="text-xs text-slate-500">{s.is_active ? "Activa" : "Inactiva"}</div>
                </div>
                <div className="flex shrink-0 gap-1">
                  <button
                    type="button"
                    onClick={() => setModal(s)}
                    className="rounded p-1.5 text-slate-500 hover:bg-slate-100 hover:text-[#0e7490]"
                    title="Editar"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => void remove(s)}
                    className="rounded p-1.5 text-slate-500 hover:bg-red-50 hover:text-red-600"
                    title="Eliminar"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {modal && (
        <SecretariaModal
          entityId={entityId}
          initial={modal === "create" ? null : modal}
          onClose={() => setModal(null)}
          onSaved={() => {
            setModal(null);
            void load();
          }}
        />
      )}
    </div>
  );
}

function SecretariaModal({
  entityId,
  initial,
  onClose,
  onSaved,
}: {
  entityId: number;
  initial: Secretaria | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [nombre, setNombre] = useState(initial?.nombre ?? "");
  const [isActive, setIsActive] = useState(initial?.is_active ?? true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(ev: React.FormEvent) {
    ev.preventDefault();
    const trimmed = nombre.trim();
    if (!trimmed) {
      setError("El nombre es obligatorio.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      if (initial) {
        await secretariasApi.update(initial.id, { nombre: trimmed, is_active: isActive });
      } else {
        await secretariasApi.create({
          entity: entityId,
          nombre: trimmed,
          is_active: isActive,
        });
      }
      onSaved();
    } catch (err) {
      setError(formatApiError(err, "No se pudo guardar la secretaría."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <div className={modalOverlayClass} onClick={onClose} />
      <div className={modalContainerClass}>
        <form
          onSubmit={submit}
          onClick={(e) => e.stopPropagation()}
          className={modalPanelSmClass}
        >
          <div className="flex items-center justify-between border-b border-slate-200 bg-[#1c2536] px-6 py-3 text-white">
            <h2 className="text-base font-semibold">
              {initial ? "Editar secretaría" : "Nueva secretaría"}
            </h2>
            <button type="button" onClick={onClose} className="text-white/80 hover:text-white">
              <X className="h-5 w-5" />
            </button>
          </div>
          <div className="space-y-4 px-6 py-5">
            <label className="block">
              <span className="mb-1 block text-xs font-semibold text-slate-600">Nombre *</span>
              <input
                required
                autoFocus
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                placeholder="Ej. Secretaría de Salud"
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-[#3eafd4] focus:outline-none focus:ring-1 focus:ring-[#3eafd4]"
              />
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                className="h-4 w-4 accent-[#3eafd4]"
              />
              <span className="text-slate-700">Secretaría activa</span>
            </label>
            {error && (
              <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {error}
              </div>
            )}
          </div>
          <div className="flex justify-end gap-2 border-t border-slate-200 bg-slate-50 px-6 py-3">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm hover:bg-slate-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-1.5 rounded-md bg-[#3eafd4] px-4 py-2 text-sm font-medium text-white hover:bg-[#2f9fc2] disabled:opacity-60"
            >
              <Save className="h-4 w-4" /> {saving ? "Guardando…" : "Guardar"}
            </button>
          </div>
        </form>
      </div>
    </>
  );
}
