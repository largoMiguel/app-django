import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { RefreshCw, Plus, Trash2, AlertTriangle } from "lucide-react";
import { picApi, type PicCargo } from "@/core/api/pic";
import { api } from "@/core/api/client";
import { formatApiError } from "@/core/api/errors";
import { PicLoading } from "./components/PicUi";
import { usePicYear } from "./PicYearContext";

interface UserOption {
  id: number;
  full_name: string;
  email: string;
  role?: string;
}

interface EncargadoPendiente {
  token: string;
  actividades: number;
}

function formatAplicacion(res: { actualizadas: number; sin_mapeo_encargado: string[] }) {
  const sin = res.sin_mapeo_encargado.length
    ? `\nSin mapeo en Excel: ${res.sin_mapeo_encargado.join(", ")}`
    : "";
  return `Asignadas ${res.actualizadas} actividades.${sin}`;
}

export default function PicEncargadosPage() {
  const { anio } = usePicYear();
  const [cargos, setCargos] = useState<PicCargo[]>([]);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [pendientes, setPendientes] = useState<EncargadoPendiente[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [etiqueta, setEtiqueta] = useState("");
  const [selectedUsers, setSelectedUsers] = useState<number[]>([]);
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([
      picApi.listCargos({ page_size: 100 }),
      api.get<{ results: UserOption[] }>("/users/", {
        params: { page_size: 200, role: "contratista", is_active: true },
      }),
      picApi.encargadosPendientes(anio),
    ])
      .then(([c, u, p]) => {
        setCargos(c.results);
        setUsers(u.data.results ?? []);
        setPendientes(p.encargados_pendientes);
      })
      .catch((err) => setError(formatApiError(err)))
      .finally(() => setLoading(false));
  }, [anio]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!etiqueta.trim()) return;
    setSaving(true);
    setError(null);
    setInfo(null);
    try {
      const res = await picApi.createCargo({ etiqueta: etiqueta.trim(), usuarios: selectedUsers });
      setEtiqueta("");
      setSelectedUsers([]);
      if (res.aplicacion) {
        setInfo(formatAplicacion(res.aplicacion));
      }
      load();
    } catch (err) {
      setError(formatApiError(err));
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleUser(cargo: PicCargo, userId: number) {
    const next = cargo.usuarios.includes(userId)
      ? cargo.usuarios.filter((id) => id !== userId)
      : [...cargo.usuarios, userId];
    setError(null);
    setInfo(null);
    try {
      const res = await picApi.updateCargo(cargo.id, { usuarios: next });
      if (res.aplicacion) {
        setInfo(formatAplicacion(res.aplicacion));
      }
      load();
    } catch (err) {
      setError(formatApiError(err));
    }
  }

  async function handleDelete(id: number) {
    if (!confirm("¿Eliminar este mapeo de cargo? Se recalcularán las asignaciones de actividades.")) {
      return;
    }
    try {
      await picApi.deleteCargo(id);
      load();
    } catch (err) {
      setError(formatApiError(err));
    }
  }

  async function handleAplicar() {
    setError(null);
    setInfo(null);
    try {
      const res = await picApi.aplicarCargos(anio);
      setInfo(formatAplicacion(res));
      load();
    } catch (err) {
      setError(formatApiError(err));
    }
  }

  function prefill(token: string) {
    setEtiqueta(token);
    setSelectedUsers([]);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  if (loading) return <PicLoading />;

  return (
    <div className="space-y-6">
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 whitespace-pre-wrap">
          {error}
        </div>
      )}
      {info && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 whitespace-pre-wrap">
          {info}
        </div>
      )}

      {pendientes.length > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <div className="mb-2 flex items-center gap-2 font-semibold">
            <AlertTriangle className="h-4 w-4" />
            Encargados del Excel sin mapear ({pendientes.length})
          </div>
          <p className="mb-3 text-xs text-amber-800">
            Cree un cargo por cada etiqueta y asigne el contratista. Clic en una etiqueta para usarla en el formulario.
          </p>
          <div className="flex flex-wrap gap-2">
            {pendientes.map((p) => (
              <button
                key={p.token}
                type="button"
                onClick={() => prefill(p.token)}
                className="rounded-full border border-amber-300 bg-white px-3 py-1 text-xs font-medium text-amber-900 hover:bg-amber-100"
              >
                {p.token} · {p.actividades} act.
              </button>
            ))}
          </div>
        </div>
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
          placeholder="Etiqueta del Excel (ej. ENFERMERA, PSICOLOGA)"
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
        <div>
          <div className="mb-1 text-xs font-semibold text-slate-600">Contratistas asignados</div>
          {users.length === 0 ? (
            <p className="text-sm text-slate-500">
              No hay contratistas.{" "}
              <Link to="/users" className="text-[#0e7490] hover:underline">
                Créelos en Usuarios
              </Link>{" "}
              con módulo PIC activo.
            </p>
          ) : (
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
          )}
        </div>
        <button
          type="submit"
          disabled={saving || !etiqueta.trim() || selectedUsers.length === 0}
          className="inline-flex items-center gap-2 rounded-lg bg-[#0e7490] px-4 py-2 text-sm text-white disabled:opacity-50"
        >
          <Plus className="h-4 w-4" />
          {saving ? "Guardando…" : "Agregar cargo y asignar actividades"}
        </button>
      </form>

      <div className="space-y-3">
        {cargos.map((c) => (
          <div key={c.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="font-semibold text-slate-900">{c.etiqueta}</div>
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
        {cargos.length === 0 && (
          <p className="text-sm text-slate-500">No hay cargos configurados. Use el formulario de arriba o un encargado pendiente.</p>
        )}
      </div>
    </div>
  );
}
