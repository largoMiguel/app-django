import { useCallback, useEffect, useState } from "react";
import { RefreshCw, Plus, Trash2 } from "lucide-react";
import { picApi, type PicCargo } from "@/core/api/pic";
import { api } from "@/core/api/client";
import { formatApiError } from "@/core/api/errors";
import { PicLoading } from "./components/PicUi";
import { usePicYear } from "./PicYearContext";

interface UserOption {
  id: number;
  full_name: string;
  email: string;
}

export default function PicEncargadosPage() {
  const { anio } = usePicYear();
  const [cargos, setCargos] = useState<PicCargo[]>([]);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [etiqueta, setEtiqueta] = useState("");
  const [selectedUsers, setSelectedUsers] = useState<number[]>([]);
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([
      picApi.listCargos({ page_size: 100 }),
      api.get<{ results: UserOption[] }>("/users/", { params: { page_size: 200 } }),
    ])
      .then(([c, u]) => {
        setCargos(c.results);
        setUsers(u.data.results ?? []);
      })
      .catch((err) => setError(formatApiError(err)))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!etiqueta.trim()) return;
    setSaving(true);
    try {
      await picApi.createCargo({ etiqueta: etiqueta.trim(), usuarios: selectedUsers });
      setEtiqueta("");
      setSelectedUsers([]);
      load();
    } catch (err) {
      alert(formatApiError(err));
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleUser(cargo: PicCargo, userId: number) {
    const next = cargo.usuarios.includes(userId)
      ? cargo.usuarios.filter((id) => id !== userId)
      : [...cargo.usuarios, userId];
    try {
      await picApi.updateCargo(cargo.id, { usuarios: next });
      load();
    } catch (err) {
      alert(formatApiError(err));
    }
  }

  async function handleDelete(id: number) {
    if (!confirm("¿Eliminar este mapeo de cargo?")) return;
    try {
      await picApi.deleteCargo(id);
      load();
    } catch (err) {
      alert(formatApiError(err));
    }
  }

  async function handleAplicar() {
    try {
      const res = await picApi.aplicarCargos(anio);
      alert(`Actualizadas ${res.actualizadas} actividades.${res.sin_mapeo_encargado.length ? ` Sin mapeo: ${res.sin_mapeo_encargado.join(", ")}` : ""}`);
    } catch (err) {
      alert(formatApiError(err));
    }
  }

  if (loading) return <PicLoading />;

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-[#b8e4ef] bg-[#f0f9fc] px-4 py-3 text-sm text-[#0d4f61]">
        Configure el mapeo entre el texto del Excel (<strong>ENCARGADO DE LA ACTIVIDAD</strong>) y los usuarios del
        sistema. Ej.: <code>ENFERMERA</code>, <code>PSICOLOGIA</code>, <code>ENFERMERA/ PSICOLGIA</code> (asigna varios).
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      <button
        type="button"
        onClick={handleAplicar}
        className="inline-flex items-center gap-2 rounded-lg border border-[#0e7490] px-4 py-2 text-sm font-medium text-[#0e7490] hover:bg-[#0e7490]/5"
      >
        <RefreshCw className="h-4 w-4" />
        Aplicar mapeo a actividades {anio}
      </button>

      <form onSubmit={handleCreate} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-3">
        <h3 className="font-semibold text-slate-800">Nuevo cargo</h3>
        <input
          value={etiqueta}
          onChange={(e) => setEtiqueta(e.target.value)}
          placeholder="Etiqueta exacta del Excel (ej. ENFERMERA)"
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
        <div className="max-h-40 overflow-y-auto rounded border border-slate-200 p-2 space-y-1">
          {users.map((u) => (
            <label key={u.id} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={selectedUsers.includes(u.id)}
                onChange={() =>
                  setSelectedUsers((prev) =>
                    prev.includes(u.id) ? prev.filter((x) => x !== u.id) : [...prev, u.id],
                  )
                }
              />
              {u.full_name || u.email}
            </label>
          ))}
        </div>
        <button
          type="submit"
          disabled={saving}
          className="inline-flex items-center gap-2 rounded-lg bg-[#0e7490] px-4 py-2 text-sm text-white disabled:opacity-50"
        >
          <Plus className="h-4 w-4" />
          Agregar cargo
        </button>
      </form>

      <div className="space-y-3">
        {cargos.map((c) => (
          <div key={c.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="font-semibold text-slate-900">{c.etiqueta}</div>
                <div className="text-xs text-slate-500">{c.etiqueta_norm}</div>
              </div>
              <button type="button" onClick={() => handleDelete(c.id)} className="text-red-500 hover:bg-red-50 rounded p-1">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
            <div className="mt-3 grid gap-1 sm:grid-cols-2">
              {users.map((u) => (
                <label key={u.id} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={c.usuarios.includes(u.id)}
                    onChange={() => handleToggleUser(c, u.id)}
                  />
                  {u.full_name || u.email}
                </label>
              ))}
            </div>
          </div>
        ))}
        {cargos.length === 0 && <p className="text-sm text-slate-500">No hay cargos configurados.</p>}
      </div>
    </div>
  );
}
