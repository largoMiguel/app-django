import { useEffect, useMemo, useState } from "react";
import {
  Briefcase,
  Check,
  Search,
  UserCheck,
  X,
  Plus,
  ArrowRight,
} from "lucide-react";
import type { Secretaria } from "@/core/api/entities";

interface Props {
  assignedIds: number[];
  assignedNames: string[];
  secretarias: Secretaria[];
  busy: boolean;
  onSave: (secretariaIds: number[], justificacion: string) => void;
}

export default function PQRSAssignmentPanel({
  assignedIds,
  assignedNames,
  secretarias,
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
    if (!q) return secretarias;
    return secretarias.filter((s) => s.nombre.toLowerCase().includes(q));
  }, [secretarias, search]);

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

  return (
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 bg-gradient-to-r from-[#1c2536] to-[#243044] px-4 py-3 text-white">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="flex items-center gap-2 text-sm font-semibold">
              <UserCheck className="h-4 w-4 text-[#3eafd4]" />
              {isAssigned ? "Dependencias asignadas" : "Asignar PQRS"}
            </h3>
            <p className="mt-0.5 text-xs text-white/70">
              {isAssigned
                ? "Selecciona una o más secretarías responsables de tramitar esta solicitud."
                : "Elige las secretarías que deben recibir y gestionar esta PQRS."}
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

      <div className="p-4 space-y-4">
        {/* Estado actual */}
        {isAssigned && (
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
              Asignación actual
            </p>
            <div className="flex flex-wrap gap-2">
              {assignedNames.map((nombre, i) => (
                <span
                  key={`${nombre}-${i}`}
                  className="inline-flex items-center gap-1.5 rounded-full border border-[#3eafd4]/30 bg-[#f0fbff] px-3 py-1 text-sm font-medium text-[#0e7490]"
                >
                  <Briefcase className="h-3.5 w-3.5" />
                  {nombre}
                </span>
              ))}
            </div>
          </div>
        )}

        {(editing || !isAssigned) && (
          <>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar secretaría…"
                className="w-full rounded-lg border border-slate-300 py-2 pl-9 pr-3 text-sm focus:border-[#3eafd4] focus:outline-none focus:ring-1 focus:ring-[#3eafd4]"
              />
            </div>

            {secretarias.length === 0 ? (
              <p className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
                No hay secretarías activas en esta entidad.
              </p>
            ) : filtered.length === 0 ? (
              <p className="text-center text-sm text-slate-500 py-4">
                Ninguna secretaría coincide con «{search}».
              </p>
            ) : (
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {filtered.map((s) => {
                  const isSelected = selected.includes(s.id);
                  const wasAssigned = assignedIds.includes(s.id);
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => toggle(s.id)}
                      className={`flex items-start gap-3 rounded-lg border-2 px-3 py-3 text-left transition-all ${
                        isSelected
                          ? "border-[#3eafd4] bg-[#f0fbff] shadow-sm"
                          : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
                      }`}
                    >
                      <div
                        className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${
                          isSelected
                            ? "border-[#3eafd4] bg-[#3eafd4] text-white"
                            : "border-slate-300 bg-white"
                        }`}
                      >
                        {isSelected && <Check className="h-3 w-3" strokeWidth={3} />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <span className="block text-sm font-medium text-slate-800 leading-snug">
                          {s.nombre}
                        </span>
                        {wasAssigned && (
                          <span className="mt-1 inline-block text-[0.65rem] font-medium uppercase tracking-wide text-[#0e7490]">
                            Asignada actualmente
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
              <span className="rounded-full bg-slate-100 px-2.5 py-1 font-medium">
                {selected.length} seleccionada{selected.length !== 1 ? "s" : ""}
              </span>
              {hasChanges && (
                <>
                  {added.length > 0 && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-emerald-800">
                      <Plus className="h-3 w-3" />
                      {added.length} nueva{added.length !== 1 ? "s" : ""}
                    </span>
                  )}
                  {removed.length > 0 && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2.5 py-1 text-red-700">
                      <X className="h-3 w-3" />
                      {removed.length} se quita{removed.length !== 1 ? "n" : ""}
                    </span>
                  )}
                </>
              )}
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-600">
                Comentario para el historial{" "}
                <span className="font-normal text-slate-400">(opcional)</span>
              </label>
              <textarea
                value={justificacion}
                onChange={(e) => setJustificacion(e.target.value)}
                rows={2}
                placeholder={
                  isAssigned
                    ? "Ej.: Se deriva también a Planeación por competencia compartida"
                    : "Ej.: Corresponde a Desarrollo Social por el tema planteado"
                }
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-[#3eafd4] focus:outline-none focus:ring-1 focus:ring-[#3eafd4]"
              />
            </div>

            <div className="flex flex-wrap gap-2 border-t border-slate-100 pt-3">
              {(isAssigned || hasChanges) && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={cancelChanges}
                  className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                >
                  Cancelar
                </button>
              )}
              <button
                type="button"
                disabled={selected.length === 0 || busy || (isAssigned && !hasChanges)}
                onClick={() => onSave(selected, justificacion)}
                className="inline-flex items-center gap-2 rounded-lg bg-[#3eafd4] px-4 py-2 text-sm font-semibold text-white hover:bg-[#2f9fc2] disabled:opacity-50"
              >
                {isAssigned ? "Actualizar asignación" : "Asignar PQRS"}
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </>
        )}

        {isAssigned && !editing && (
          <p className="text-xs text-slate-500">
            Al asignar o cambiar dependencias, los secretarios reciben correo (o se reintenta si
            el envío anterior falló). Usa «Cambiar» para agregar o quitar dependencias.
          </p>
        )}
      </div>
    </section>
  );
}
