import { useEffect, useMemo, useState } from "react";
import { ArrowRight, Check, Plus, Search, User, UserCheck, X } from "lucide-react";
import type { AppUser } from "@/core/api/users";

interface Props {
  assignedIds: number[];
  assignedNames: string[];
  contratistas: AppUser[];
  busy: boolean;
  onSave: (userIds: number[], justificacion: string) => void;
}

export default function PQRSUserAssignmentPanel({
  assignedIds,
  assignedNames,
  contratistas,
  busy,
  onSave,
}: Props) {
  const [selected, setSelected] = useState<number[]>(assignedIds);
  const [justificacion, setJustificacion] = useState("");
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState(assignedIds.length === 0);

  const assignedKey = useMemo(
    () => [...assignedIds].sort((a, b) => a - b).join(","),
    [assignedIds],
  );

  useEffect(() => {
    setSelected(assignedIds);
    setJustificacion("");
    setSearch("");
    setEditing(assignedIds.length === 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assignedKey]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return contratistas;
    return contratistas.filter(
      (u) =>
        u.full_name?.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q),
    );
  }, [contratistas, search]);

  const hasChanges = useMemo(() => {
    const a = [...assignedIds].sort((x, y) => x - y);
    const b = [...selected].sort((x, y) => x - y);
    return a.length !== b.length || a.some((id, i) => id !== b[i]);
  }, [assignedIds, selected]);

  const added = selected.filter((id) => !assignedIds.includes(id));
  const removed = assignedIds.filter((id) => !selected.includes(id));
  const isAssigned = assignedIds.length > 0;

  function toggle(id: number) {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  function cancelChanges() {
    setSelected(assignedIds);
    setJustificacion("");
    setSearch("");
    if (isAssigned) setEditing(false);
  }

  if (contratistas.length === 0) {
    return (
      <section className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
        No hay contratistas bajo su supervisión para delegar esta PQRS.
      </section>
    );
  }

  return (
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 bg-gradient-to-r from-emerald-800 to-emerald-700 px-4 py-3 text-white">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="flex items-center gap-2 text-sm font-semibold">
              <UserCheck className="h-4 w-4 text-emerald-200" />
              {isAssigned ? "Contratistas asignados" : "Asignar a contratista"}
            </h3>
            <p className="mt-0.5 text-xs text-white/70">
              Paso 2: delegue la gestión a uno o más contratistas de su secretaría.
            </p>
          </div>
          {isAssigned && !editing && (
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="shrink-0 rounded-md bg-white/10 px-3 py-1.5 text-xs font-medium hover:bg-white/20"
            >
              Cambiar
            </button>
          )}
        </div>
      </div>

      <div className="space-y-4 p-4">
        {isAssigned && (
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
              Delegación actual
            </p>
            <div className="flex flex-wrap gap-2">
              {assignedNames.map((nombre, i) => (
                <span
                  key={`${nombre}-${i}`}
                  className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-sm font-medium text-emerald-800"
                >
                  <User className="h-3.5 w-3.5" />
                  {nombre}
                </span>
              ))}
            </div>
          </div>
        )}

        {editing && (
          <>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar contratista..."
                className="w-full rounded-md border border-slate-300 py-2 pl-10 pr-4 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
            </div>

            <div className="max-h-48 space-y-1 overflow-y-auto rounded-md border border-slate-200 p-2">
              {filtered.length === 0 ? (
                <p className="py-4 text-center text-sm text-slate-400">Sin resultados</p>
              ) : (
                filtered.map((u) => {
                  const checked = selected.includes(u.id);
                  return (
                    <label
                      key={u.id}
                      className={`flex cursor-pointer items-center gap-3 rounded-md px-2 py-2 text-sm transition ${
                        checked ? "bg-emerald-50 ring-1 ring-emerald-200" : "hover:bg-slate-50"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggle(u.id)}
                        className="h-4 w-4 accent-emerald-600"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="font-medium text-slate-800">{u.full_name || u.email}</div>
                        <div className="truncate text-xs text-slate-500">{u.email}</div>
                      </div>
                    </label>
                  );
                })
              )}
            </div>

            {(added.length > 0 || removed.length > 0) && (
              <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                {added.length > 0 && (
                  <div className="flex items-center gap-1">
                    <Plus className="h-3 w-3" /> Se agregarán {added.length} contratista(s)
                  </div>
                )}
                {removed.length > 0 && (
                  <div className="flex items-center gap-1">
                    <X className="h-3 w-3" /> Se quitarán {removed.length} contratista(s)
                  </div>
                )}
              </div>
            )}

            <label className="block">
              <span className="mb-1 block text-xs font-semibold text-slate-600">
                Justificación (opcional)
              </span>
              <textarea
                value={justificacion}
                onChange={(e) => setJustificacion(e.target.value)}
                rows={2}
                placeholder="Motivo de la delegación..."
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
            </label>

            <div className="flex flex-wrap justify-end gap-2">
              {isAssigned && (
                <button
                  type="button"
                  onClick={cancelChanges}
                  disabled={busy}
                  className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm hover:bg-slate-50 disabled:opacity-60"
                >
                  Cancelar
                </button>
              )}
              <button
                type="button"
                disabled={busy || !hasChanges}
                onClick={() => onSave(selected, justificacion)}
                className="inline-flex items-center gap-1.5 rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
              >
                <Check className="h-4 w-4" />
                {busy ? "Guardando…" : "Guardar delegación"}
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </>
        )}
      </div>
    </section>
  );
}
