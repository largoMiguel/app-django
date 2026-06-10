import { useEffect, useState } from "react";
import {
  Building2,
  Plus,
  Search,
  X,
  Save,
  ChevronRight,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { formatApiError } from "@/core/api/errors";
import { entitiesApi, type Entity } from "@/core/api/entities";
import { MODULES } from "@/core/modules";
import { finalizeSlugInput, sanitizeSlugInput, slugFromName } from "@/core/slug";

export default function SuperAdminEntitiesPage() {
  const navigate = useNavigate();
  const [items, setItems] = useState<Entity[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [showNew, setShowNew] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const response = await entitiesApi.listPaginated({
        page,
        page_size: 15,
        ...(search.trim() ? { search: search.trim() } : {}),
      });
      setItems(response.results);
      setTotal(response.count);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    load();
  }, [page, search]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-[#111827] sm:text-2xl flex items-center gap-2">
            <Building2 className="h-6 w-6 text-[#3eafd4]" /> Entidades
          </h1>
          <p className="mt-1 text-xs text-slate-600 sm:text-sm">
            Selecciona una entidad para gestionar sus módulos, administradores y secretarías.
          </p>
        </div>
        <button
          onClick={() => setShowNew(true)}
          className="flex items-center gap-2 rounded-md bg-[#3eafd4] px-4 py-2 text-sm font-medium text-white hover:bg-[#2f9fc2] self-start sm:self-auto"
        >
          <Plus className="h-4 w-4" /> Nueva entidad
        </button>
      </div>

      <div className="rounded-[0.6rem] border border-[#e9ecef] bg-white p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nombre, código o NIT..."
            className="w-full rounded-md border border-slate-300 py-2 pl-10 pr-4 text-sm focus:border-[#3eafd4] focus:outline-none focus:ring-1 focus:ring-[#3eafd4]"
          />
        </div>
      </div>

      {loading ? (
        <div className="rounded-lg border border-slate-200 bg-white p-8 text-center text-slate-500">
          Cargando…
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-300 bg-white p-12 text-center text-slate-500">
          <Building2 className="mx-auto mb-2 h-10 w-10 text-slate-300" />
          No hay entidades.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {items.map((e) => (
            <button
              key={e.id}
              onClick={() => navigate(`/superadmin/entities/${e.id}`)}
              className="group flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-4 text-left transition-all hover:border-[#3eafd4] hover:shadow-md"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="font-semibold text-slate-800 group-hover:text-[#0e7490]">
                    {e.name}
                  </h3>
                  <p className="text-xs text-slate-500">Código: {e.code}</p>
                  {e.nit && <p className="text-xs text-slate-500">NIT: {e.nit}</p>}
                </div>
                <ChevronRight className="h-5 w-5 flex-shrink-0 text-slate-400 group-hover:text-[#3eafd4]" />
              </div>
              <div className="flex flex-wrap gap-1">
                {e.enabled_modules.slice(0, 5).map((m) => (
                  <span
                    key={m}
                    className="rounded bg-[#f0fbff] px-1.5 py-0.5 text-[0.7rem] text-[#0e7490]"
                  >
                    {m}
                  </span>
                ))}
                {e.enabled_modules.length > 5 && (
                  <span className="text-[0.7rem] text-slate-500">
                    +{e.enabled_modules.length - 5}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1.5 text-xs">
                {e.is_active ? (
                  <>
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                    <span className="text-emerald-700">Activa</span>
                  </>
                ) : (
                  <>
                    <XCircle className="h-3.5 w-3.5 text-slate-400" />
                    <span className="text-slate-500">Inactiva</span>
                  </>
                )}
              </div>
            </button>
          ))}
        </div>
      )}
      {total > 15 && (
        <div className="flex items-center justify-between text-sm text-slate-600">
          <span>
            Mostrando {(page - 1) * 15 + 1} - {Math.min(page * 15, total)} de {total}
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="rounded border px-2 py-1 disabled:opacity-50"
            >
              Anterior
            </button>
            <button
              type="button"
              disabled={page * 15 >= total}
              onClick={() => setPage((p) => p + 1)}
              className="rounded border px-2 py-1 disabled:opacity-50"
            >
              Siguiente
            </button>
          </div>
        </div>
      )}

      {showNew && (
        <NewEntityModal
          onClose={() => setShowNew(false)}
          onCreated={(id) => {
            setShowNew(false);
            navigate(`/superadmin/entities/${id}`);
          }}
        />
      )}
    </div>
  );
}

type NewEntityForm = Partial<Entity>;

function NewEntityModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (id: number) => void;
}) {
  const [form, setForm] = useState<NewEntityForm>({
    name: "",
    code: "",
    nit: "",
    is_active: true,
    enable_pqrs: true,
    enable_users_admin: true,
    enable_reports_pdf: false,
    enable_ai_reports: false,
    enable_planes_institucionales: false,
    enable_contratacion: false,
    enable_pdm: false,
    enable_asistencia: false,
    enable_correspondencia: false,
    enable_presupuesto: false,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function set<K extends keyof NewEntityForm>(key: K, value: NewEntityForm[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(ev: React.FormEvent) {
    ev.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const payload = { ...form } as Partial<Entity>;
      if (payload.slug) {
        payload.slug = finalizeSlugInput(payload.slug);
      }
      const created = await entitiesApi.create(payload);
      onCreated(created.id);
    } catch (err) {
      const e = err as { response?: { data?: Record<string, unknown> } };
      setError(formatApiError(e, "Error al guardar."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/50" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <form
          onSubmit={handleSubmit}
          onClick={(e) => e.stopPropagation()}
          className="relative flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl bg-white shadow-2xl"
        >
          <div className="flex items-center justify-between border-b border-slate-200 bg-[#1c2536] px-6 py-3 text-white">
            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4" />
              <h2 className="text-base font-semibold">Nueva entidad</h2>
            </div>
            <button type="button" onClick={onClose} className="text-white/80 hover:text-white">
              <X className="h-5 w-5" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
            <section>
              <h3 className="text-xs font-bold uppercase tracking-wide text-slate-600 border-b border-slate-200 pb-1.5 mb-3">
                Información de la entidad
              </h3>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Nombre *">
                  <input
                    required
                    value={form.name || ""}
                    onChange={(e) => set("name", e.target.value)}
                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-[#3eafd4] focus:outline-none focus:ring-1 focus:ring-[#3eafd4]"
                  />
                </Field>
                <Field label="Código *">
                  <input
                    required
                    value={form.code || ""}
                    onChange={(e) => set("code", e.target.value)}
                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-[#3eafd4] focus:outline-none focus:ring-1 focus:ring-[#3eafd4]"
                  />
                </Field>
                <Field label="Slug (URL del portal)">
                  <input
                    value={form.slug || ""}
                    onChange={(e) => set("slug", sanitizeSlugInput(e.target.value))}
                    onBlur={(e) => set("slug", finalizeSlugInput(e.target.value))}
                    placeholder={form.name ? slugFromName(form.name) : "nombre-de-la-entidad"}
                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm font-mono focus:border-[#3eafd4] focus:outline-none focus:ring-1 focus:ring-[#3eafd4]"
                  />
                  {(form.slug || form.name) && (
                    <p className="mt-0.5 text-[0.65rem] text-slate-400 font-mono">
                      /portal/{form.slug || "(auto-generado)"}
                    </p>
                  )}
                </Field>
                <Field label="NIT">
                  <input
                    value={form.nit || ""}
                    onChange={(e) => set("nit", e.target.value)}
                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-[#3eafd4] focus:outline-none focus:ring-1 focus:ring-[#3eafd4]"
                  />
                </Field>
                <Field label="Email">
                  <input
                    value={form.email || ""}
                    onChange={(e) => set("email", e.target.value)}
                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-[#3eafd4] focus:outline-none focus:ring-1 focus:ring-[#3eafd4]"
                  />
                </Field>
              </div>
            </section>

            <section>
              <h3 className="text-xs font-bold uppercase tracking-wide text-slate-600 border-b border-slate-200 pb-1.5 mb-3">
                Módulos habilitados
              </h3>
              <div className="grid grid-cols-2 gap-2">
                {MODULES.map((m) => (
                  <label
                    key={m.key}
                    className="flex items-center gap-2 rounded-md border border-slate-200 px-3 py-2 text-sm cursor-pointer hover:bg-slate-50"
                  >
                    <input
                      type="checkbox"
                      checked={Boolean(form[m.flag])}
                      onChange={(e) =>
                        set(m.flag as keyof NewEntityForm, e.target.checked as never)
                      }
                      className="h-4 w-4 accent-[#3eafd4]"
                    />
                    <span className="text-slate-700">{m.label}</span>
                  </label>
                ))}
              </div>
            </section>

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
              <Save className="h-4 w-4" /> {saving ? "Creando…" : "Crear entidad"}
            </button>
          </div>
        </form>
      </div>
    </>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold text-slate-600">{label}</span>
      {children}
    </label>
  );
}
