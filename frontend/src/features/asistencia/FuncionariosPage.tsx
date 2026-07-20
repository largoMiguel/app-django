import { useEffect, useState } from "react";
import { Plus, Search, Pencil, Trash2, X, Save } from "lucide-react";
import { asistenciaApi, type Funcionario } from "@/core/api/asistencia";
import { formatApiError } from "@/core/api/errors";
import { primaryRole, useAuthStore } from "@/core/auth/store";

const emptyForm = {
  cedula: "",
  nombres: "",
  apellidos: "",
  email: "",
  telefono: "",
  cargo: "",
  is_active: true,
};

export default function FuncionariosPage() {
  const role = primaryRole(useAuthStore((s) => s.user));
  const canDelete = role === "admin";
  const [items, setItems] = useState<Funcionario[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [modal, setModal] = useState<"create" | "edit" | null>(null);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const params: Record<string, string | number | boolean> = { page_size: 100 };
      if (search.trim()) params.search = search.trim();
      const res = await asistenciaApi.funcionarios.list(params);
      setItems(res.results);
    } catch (err) {
      setError(formatApiError(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const t = setTimeout(load, 300);
    return () => clearTimeout(t);
  }, [search]);

  function openCreate() {
    setForm(emptyForm);
    setEditId(null);
    setModal("create");
  }

  function openEdit(f: Funcionario) {
    setForm({
      cedula: f.cedula,
      nombres: f.nombres,
      apellidos: f.apellidos,
      email: f.email || "",
      telefono: f.telefono || "",
      cargo: f.cargo || "",
      is_active: f.is_active,
    });
    setEditId(f.id);
    setModal("edit");
  }

  async function save() {
    setSaving(true);
    setError(null);
    try {
      if (modal === "create") {
        await asistenciaApi.funcionarios.create(form);
      } else if (editId) {
        const update = {
          nombres: form.nombres,
          apellidos: form.apellidos,
          email: form.email,
          telefono: form.telefono,
          cargo: form.cargo,
          is_active: form.is_active,
        };
        await asistenciaApi.funcionarios.update(editId, update);
      }
      setModal(null);
      await load();
    } catch (err) {
      setError(formatApiError(err));
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: number) {
    if (!confirm("¿Eliminar este funcionario?")) return;
    try {
      await asistenciaApi.funcionarios.remove(id);
      await load();
    } catch (err) {
      setError(formatApiError(err));
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative max-w-md flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por cédula o nombre…"
            className="w-full rounded-lg border border-slate-300 py-2 pl-10 pr-3 text-sm focus:border-[#0d6e8a] focus:outline-none focus:ring-1 focus:ring-[#0d6e8a]"
          />
        </div>
        <button
          onClick={openCreate}
          className="inline-flex items-center gap-2 rounded-[0.3rem] bg-[#3eafd4] px-4 py-2 text-sm font-medium text-white hover:bg-[#2f9fc2]"
        >
          <Plus className="h-4 w-4" /> Nuevo funcionario
        </button>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs font-semibold uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3">Cédula</th>
              <th className="px-4 py-3">Nombre</th>
              <th className="px-4 py-3">Cargo</th>
              <th className="px-4 py-3">Estado</th>
              <th className="px-4 py-3 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                  Cargando…
                </td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                  No hay funcionarios registrados.
                </td>
              </tr>
            ) : (
              items.map((f) => (
                <tr key={f.id} className="hover:bg-slate-50/80">
                  <td className="px-4 py-3 font-mono text-slate-800">{f.cedula}</td>
                  <td className="px-4 py-3 text-slate-800">{f.nombre_completo}</td>
                  <td className="px-4 py-3 text-slate-600">{f.cargo || "—"}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                        f.is_active
                          ? "bg-emerald-50 text-emerald-700"
                          : "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {f.is_active ? "Activo" : "Inactivo"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => openEdit(f)}
                      className="mr-2 rounded p-1.5 text-slate-500 hover:bg-slate-100 hover:text-[#0d6e8a]"
                      title="Editar"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    {canDelete && (
                      <button
                        onClick={() => remove(f.id)}
                        className="rounded p-1.5 text-slate-500 hover:bg-red-50 hover:text-red-600"
                        title="Eliminar"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
              <h2 className="font-semibold text-slate-900">
                {modal === "create" ? "Nuevo funcionario" : "Editar funcionario"}
              </h2>
              <button onClick={() => setModal(null)} className="text-slate-400 hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-3 px-6 py-4">
              <label className="block text-sm">
                <span className="font-medium text-slate-700">Cédula *</span>
                <input
                  disabled={modal === "edit"}
                  value={form.cedula}
                  onChange={(e) => setForm((f) => ({ ...f, cedula: e.target.value }))}
                  className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 disabled:bg-slate-100"
                />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="block text-sm">
                  <span className="font-medium text-slate-700">Nombres *</span>
                  <input
                    value={form.nombres}
                    onChange={(e) => setForm((f) => ({ ...f, nombres: e.target.value }))}
                    className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2"
                  />
                </label>
                <label className="block text-sm">
                  <span className="font-medium text-slate-700">Apellidos *</span>
                  <input
                    value={form.apellidos}
                    onChange={(e) => setForm((f) => ({ ...f, apellidos: e.target.value }))}
                    className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2"
                  />
                </label>
              </div>
              <label className="block text-sm">
                <span className="font-medium text-slate-700">Cargo</span>
                <input
                  value={form.cargo}
                  onChange={(e) => setForm((f) => ({ ...f, cargo: e.target.value }))}
                  className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2"
                />
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.is_active}
                  onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.checked }))}
                  className="h-4 w-4 accent-[#0d6e8a]"
                />
                Activo
              </label>
            </div>
            <div className="flex justify-end gap-2 border-t border-slate-200 bg-slate-50 px-6 py-3">
              <button
                onClick={() => setModal(null)}
                className="rounded-md border border-slate-300 px-4 py-2 text-sm hover:bg-white"
              >
                Cancelar
              </button>
              <button
                onClick={save}
                disabled={saving || !form.cedula || !form.nombres || !form.apellidos}
                className="inline-flex items-center gap-2 rounded-md bg-[#0d6e8a] px-4 py-2 text-sm font-medium text-white hover:bg-[#0a5870] disabled:opacity-60"
              >
                <Save className="h-4 w-4" /> {saving ? "Guardando…" : "Guardar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
