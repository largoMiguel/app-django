import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  Building2,
  Save,
  Users as UsersIcon,
  Briefcase,
  Settings,
  Trash2,
  UserX,
  Plus,
  Pencil,
  X,
  Copy,
  Check,
  MessageCircle,
  BarChart3,
  ExternalLink,
  Upload,
  FileText,
} from "lucide-react";
import { pdmApi } from "@/core/api/pdm";
import type { PdmChatAnalytics } from "@/core/api/pdmChatPublic";
import { formatApiError } from "@/core/api/errors";
import { entitiesApi, secretariasApi, type Entity, type Secretaria } from "@/core/api/entities";
import { usersApi, type AppUser, type CreateUserPayload } from "@/core/api/users";
import { MODULES, modulesForEntity } from "@/core/modules";
import { finalizeSlugInput, sanitizeSlugInput } from "@/core/slug";

type Tab = "info" | "users" | "secretarias";

export default function EntityDetailPage() {
  const { id } = useParams<{ id: string }>();
  const entityId = Number(id);
  const navigate = useNavigate();
  const [entity, setEntity] = useState<Entity | null>(null);
  const [tab, setTab] = useState<Tab>("info");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setLoadError(null);
    try {
      setEntity(await entitiesApi.get(entityId));
    } catch {
      setEntity(null);
      setLoadError("No se pudo cargar la entidad.");
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    if (!Number.isFinite(entityId)) return;
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entityId]);

  if (!Number.isFinite(entityId)) {
    return (
      <div className="rounded-lg bg-white p-8 text-center text-slate-600">
        <p>Identificador de entidad inválido.</p>
        <button
          onClick={() => navigate("/superadmin/entities")}
          className="mt-4 text-sm text-[#0e7490] hover:underline"
        >
          Volver a entidades
        </button>
      </div>
    );
  }

  if (loading) {
    return <div className="rounded-lg bg-white p-8 text-center text-slate-500">Cargando…</div>;
  }

  if (loadError || !entity) {
    return (
      <div className="rounded-lg bg-white p-8 text-center text-slate-600">
        <p>{loadError || "Entidad no encontrada."}</p>
        <button
          onClick={() => navigate("/superadmin/entities")}
          className="mt-4 text-sm text-[#0e7490] hover:underline"
        >
          Volver a entidades
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <button
            onClick={() => navigate("/superadmin/entities")}
            className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-[#0e7490]"
          >
            <ArrowLeft className="h-4 w-4" /> Volver a entidades
          </button>
          <h1 className="mt-2 text-2xl font-bold text-[#111827] flex items-center gap-2">
            <Building2 className="h-6 w-6 text-[#3eafd4]" /> {entity.name}
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Código <span className="font-mono">{entity.code}</span>
            {entity.nit && (
              <>
                {" · NIT "}
                <span className="font-mono">{entity.nit}</span>
              </>
            )}
            <span
              className={`ml-2 rounded px-1.5 py-0.5 text-[0.7rem] font-medium ${
                entity.is_active
                  ? "bg-emerald-100 text-emerald-700"
                  : "bg-slate-100 text-slate-600"
              }`}
            >
              {entity.is_active ? "Activa" : "Inactiva"}
            </span>
          </p>
        </div>
      </div>

      <div className="border-b border-slate-200">
        <div className="flex gap-1">
          <TabBtn icon={<Settings className="h-4 w-4" />} active={tab === "info"} onClick={() => setTab("info")}>
            Información y módulos
          </TabBtn>
          <TabBtn icon={<UsersIcon className="h-4 w-4" />} active={tab === "users"} onClick={() => setTab("users")}>
            Usuarios
          </TabBtn>
          <TabBtn icon={<Briefcase className="h-4 w-4" />} active={tab === "secretarias"} onClick={() => setTab("secretarias")}>
            Secretarías
          </TabBtn>
        </div>
      </div>

        {tab === "info" && <InfoTab entity={entity} onSaved={load} onDeleted={() => navigate("/superadmin/entities")} />}
      {tab === "users" && <UsersTab entity={entity} />}
      {tab === "secretarias" && <SecretariasTab entity={entity} />}
    </div>
  );
}

function TabBtn({
  active,
  onClick,
  children,
  icon,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  icon: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 border-b-2 px-3 py-2.5 text-sm transition-colors ${
        active
          ? "border-[#3eafd4] text-[#0e7490] font-semibold"
          : "border-transparent text-slate-500 hover:text-slate-700"
      }`}
    >
      {icon}
      {children}
    </button>
  );
}

// ---------------- INFO TAB ----------------

function InfoTab({
  entity,
  onSaved,
  onDeleted,
}: {
  entity: Entity;
  onSaved: () => void;
  onDeleted: () => void;
}) {
  const [form, setForm] = useState<Partial<Entity>>(entity);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  function set<K extends keyof Entity>(key: K, value: Entity[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function save(ev: React.FormEvent) {
    ev.preventDefault();
    setSaving(true);
    setMsg(null);
    try {
      const payload = { ...form };
      if (payload.slug) {
        payload.slug = finalizeSlugInput(payload.slug);
      }
      await entitiesApi.update(entity.id, payload);
      setMsg({ kind: "ok", text: "Cambios guardados." });
      onSaved();
    } catch (err) {
      setMsg({ kind: "err", text: formatApiError(err, "Error al guardar.") });
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
    <form onSubmit={save} className="space-y-5 rounded-lg border border-slate-200 bg-white p-5">
      <section>
        <h3 className="mb-3 text-xs font-bold uppercase tracking-wide text-slate-600 border-b border-slate-200 pb-1.5">
          Datos generales
        </h3>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Nombre">
            <input
              value={form.name || ""}
              onChange={(e) => set("name", e.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-[#3eafd4] focus:outline-none focus:ring-1 focus:ring-[#3eafd4]"
            />
          </Field>
          <Field label="Código">
            <input
              value={form.code || ""}
              onChange={(e) => set("code", e.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-[#3eafd4] focus:outline-none focus:ring-1 focus:ring-[#3eafd4]"
            />
          </Field>
          <Field label="Slug (URL del portal)" hint={`/portal/${form.slug || "..."}`}>
            <input
              value={form.slug || ""}
              onChange={(e) => set("slug", sanitizeSlugInput(e.target.value))}
              onBlur={(e) => set("slug", finalizeSlugInput(e.target.value))}
              placeholder="nombre-de-la-entidad"
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm font-mono focus:border-[#3eafd4] focus:outline-none focus:ring-1 focus:ring-[#3eafd4]"
            />
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
          <Field label="Teléfono">
            <input
              value={form.phone || ""}
              onChange={(e) => set("phone", e.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-[#3eafd4] focus:outline-none focus:ring-1 focus:ring-[#3eafd4]"
            />
          </Field>
          <Field label="Dirección">
            <input
              value={form.address || ""}
              onChange={(e) => set("address", e.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-[#3eafd4] focus:outline-none focus:ring-1 focus:ring-[#3eafd4]"
            />
          </Field>
        </div>
        <div className="mt-3 grid grid-cols-1 gap-3">
          <Field label="URL del logo">
            <input
              type="url"
              value={form.logo_url || ""}
              onChange={(e) => set("logo_url", e.target.value)}
              placeholder="https://ejemplo.com/logo.png"
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-[#3eafd4] focus:outline-none focus:ring-1 focus:ring-[#3eafd4]"
            />
          </Field>
          {form.logo_url && (
            <div className="flex items-center gap-3">
              <span className="text-xs text-slate-500">Vista previa:</span>
              <img
                src={form.logo_url}
                alt="Logo"
                className="h-10 w-10 rounded-full object-cover border border-slate-200"
                onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
              />
            </div>
          )}
        </div>
        <div className="mt-3">
          <Field label="Descripción">
            <textarea
              value={form.description || ""}
              onChange={(e) => set("description", e.target.value)}
              rows={2}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-[#3eafd4] focus:outline-none focus:ring-1 focus:ring-[#3eafd4]"
            />
          </Field>
        </div>
        <label className="mt-3 flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={form.is_active ?? true}
            onChange={(e) => set("is_active", e.target.checked)}
            className="h-4 w-4 accent-[#3eafd4]"
          />
          <span className="text-slate-700">Entidad activa</span>
        </label>
      </section>

      {form.enable_reports_pdf && (
        <ReportTemplateSection entity={entity} form={form} set={set} onSaved={onSaved} />
      )}

      <section>
        <h3 className="mb-3 text-xs font-bold uppercase tracking-wide text-slate-600 border-b border-slate-200 pb-1.5">
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
                onChange={(e) => set(m.flag as keyof Entity, e.target.checked as never)}
                className="h-4 w-4 accent-[#3eafd4]"
              />
              <span className="text-slate-700">{m.label}</span>
            </label>
          ))}
        </div>
        {form.enable_pdm_chat && !form.enable_pdm && (
          <p className="mt-2 text-xs text-amber-700">
            El chat requiere que el módulo PDM también esté activo.
          </p>
        )}
      </section>

      {form.enable_pdm_chat && (
        <PdmChatSection entity={entity} slug={form.slug || entity.slug} />
      )}

      {msg && (
        <div
          className={`rounded border px-3 py-2 text-sm ${
            msg.kind === "ok"
              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
              : "border-red-200 bg-red-50 text-red-700"
          }`}
        >
          {msg.text}
        </div>
      )}

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={saving}
          className="flex items-center gap-1.5 rounded-md bg-[#3eafd4] px-4 py-2 text-sm font-medium text-white hover:bg-[#2f9fc2] disabled:opacity-60"
        >
          <Save className="h-4 w-4" /> {saving ? "Guardando…" : "Guardar cambios"}
        </button>
      </div>
    </form>

    <DeleteEntitySection entity={entity} onDeleted={onDeleted} />
    </>
  );
}

function ReportTemplateSection({
  entity,
  form,
  set,
  onSaved,
}: {
  entity: Entity;
  form: Partial<Entity>;
  set: <K extends keyof Entity>(key: K, value: Entity[K]) => void;
  onSaved: () => void;
}) {
  const [uploading, setUploading] = useState(false);
  const [templateMsg, setTemplateMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  async function handleUpload(ev: React.ChangeEvent<HTMLInputElement>) {
    const file = ev.target.files?.[0];
    ev.target.value = "";
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".pdf")) {
      setTemplateMsg({ kind: "err", text: "Solo se aceptan archivos PDF." });
      return;
    }
    setUploading(true);
    setTemplateMsg(null);
    try {
      const result = await entitiesApi.uploadPdfTemplate(entity.id, file);
      set("pdf_template_url", result.pdf_template_url);
      setTemplateMsg({ kind: "ok", text: `Membrete cargado: ${result.filename}` });
      onSaved();
    } catch (err) {
      setTemplateMsg({ kind: "err", text: formatApiError(err, "Error al subir el membrete PDF.") });
    } finally {
      setUploading(false);
    }
  }

  async function handleDeleteTemplate() {
    setUploading(true);
    setTemplateMsg(null);
    try {
      await entitiesApi.deletePdfTemplate(entity.id);
      set("pdf_template_url", null);
      setTemplateMsg({ kind: "ok", text: "Membrete eliminado." });
      onSaved();
    } catch (err) {
      setTemplateMsg({ kind: "err", text: formatApiError(err, "Error al eliminar el membrete.") });
    } finally {
      setUploading(false);
    }
  }

  return (
    <section>
      <h3 className="mb-3 text-xs font-bold uppercase tracking-wide text-slate-600 border-b border-slate-200 pb-1.5">
        Plantilla de informes PQRS
      </h3>
      <p className="mb-3 text-xs text-slate-500">
        Sube el membrete institucional PDF que se usará como fondo al generar informes PQRS.
      </p>

      <div className="rounded-md border border-slate-200 bg-slate-50 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm text-slate-700">
            <FileText className="h-4 w-4 text-[#3eafd4]" />
            <span>
              Membrete PDF:{" "}
              <strong>{form.pdf_template_url ? "Configurado" : "Sin membrete"}</strong>
            </span>
          </div>
          <div className="flex items-center gap-2">
            <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100">
              <Upload className="h-3.5 w-3.5" />
              {uploading ? "Subiendo…" : form.pdf_template_url ? "Reemplazar" : "Subir PDF"}
              <input
                type="file"
                accept="application/pdf,.pdf"
                className="hidden"
                disabled={uploading}
                onChange={handleUpload}
              />
            </label>
            {form.pdf_template_url && (
              <button
                type="button"
                onClick={handleDeleteTemplate}
                disabled={uploading}
                className="rounded-md border border-red-200 bg-white px-3 py-2 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-60"
              >
                Eliminar
              </button>
            )}
          </div>
        </div>
        {form.pdf_template_url && (
          <p className="mt-2 truncate text-[0.68rem] text-slate-500">{form.pdf_template_url}</p>
        )}
        {templateMsg && (
          <p
            className={`mt-2 text-xs ${
              templateMsg.kind === "ok" ? "text-emerald-700" : "text-red-700"
            }`}
          >
            {templateMsg.text}
          </p>
        )}
      </div>
    </section>
  );
}

function DeleteEntitySection({ entity, onDeleted }: { entity: Entity; onDeleted: () => void }) {
  const [confirmSlug, setConfirmSlug] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete() {
    if (confirmSlug !== entity.slug) {
      setError(`Escriba exactamente "${entity.slug}" para confirmar.`);
      return;
    }
    if (
      !confirm(
        `¿Eliminar permanentemente "${entity.name}"?\n\nSe borrarán PQRS, PDM, usuarios, secretarías y archivos asociados. Esta acción no se puede deshacer.`,
      )
    ) {
      return;
    }
    setDeleting(true);
    setError(null);
    try {
      await entitiesApi.remove(entity.id, entity.slug);
      onDeleted();
    } catch (err) {
      setError(formatApiError(err, "No se pudo eliminar la entidad."));
    } finally {
      setDeleting(false);
    }
  }

  return (
    <section className="mt-6 rounded-lg border border-red-200 bg-red-50/50 p-5">
      <h3 className="mb-2 flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-red-800">
        <Trash2 className="h-4 w-4" /> Zona peligrosa
      </h3>
      <p className="mb-4 text-sm text-red-900/80">
        Elimina la entidad y <strong>todos</strong> sus datos: PQRS, PDM, usuarios, secretarías y archivos en media.
        No se puede deshacer.
      </p>
      <label className="mb-3 block text-sm text-red-900">
        Escriba <span className="font-mono font-semibold">{entity.slug}</span> para confirmar
        <input
          value={confirmSlug}
          onChange={(e) => setConfirmSlug(e.target.value)}
          className="mt-1 w-full max-w-md rounded-md border border-red-300 bg-white px-3 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
          placeholder={entity.slug}
        />
      </label>
      {error && (
        <div className="mb-3 rounded border border-red-200 bg-white px-3 py-2 text-sm text-red-700">{error}</div>
      )}
      <button
        type="button"
        disabled={deleting || confirmSlug !== entity.slug}
        onClick={() => void handleDelete()}
        className="flex items-center gap-1.5 rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
      >
        <Trash2 className="h-4 w-4" /> {deleting ? "Eliminando…" : "Eliminar entidad permanentemente"}
      </button>
    </section>
  );
}

// ---------------- USERS TAB ----------------

function UsersTab({ entity }: { entity: Entity }) {
  const [users, setUsers] = useState<AppUser[]>([]);
  const [secretarias, setSecretarias] = useState<Secretaria[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<AppUser | null>(null);
  const [showNew, setShowNew] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const [u, s] = await Promise.all([
        usersApi.list({ entity: entity.id }),
        secretariasApi.list(entity.id),
      ]);
      setUsers(u);
      setSecretarias(s);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entity.id]);

  async function handleDeactivate(u: AppUser) {
    if (!confirm(`¿Desactivar al usuario ${u.email}?\n\nNo podrá iniciar sesión hasta reactivarlo.`)) return;
    try {
      await usersApi.deactivate(u.id);
      load();
    } catch (err) {
      alert(formatApiError(err, "No se pudo desactivar."));
    }
  }

  async function handlePurge(u: AppUser) {
    if (
      !confirm(
        `¿Eliminar DEFINITIVAMENTE al usuario ${u.email}?\n\nSe borrará de SoftOne y Clerk. Esta acción no se puede deshacer.`,
      )
    ) {
      return;
    }
    const typed = prompt(`Escribe "${u.email}" para confirmar:`);
    if (typed !== u.email) return;
    try {
      await usersApi.purge(u.id);
      load();
    } catch (err) {
      alert(formatApiError(err, "No se pudo eliminar."));
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button
          onClick={() => setShowNew(true)}
          className="flex items-center gap-2 rounded-md bg-[#3eafd4] px-4 py-2 text-sm font-medium text-white hover:bg-[#2f9fc2]"
        >
          <Plus className="h-4 w-4" /> Nuevo usuario
        </button>
      </div>

      <div className="rounded-[0.6rem] border border-[#e9ecef] bg-white">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left font-semibold text-slate-700">Nombre</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-700">Email</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-700">Rol</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-700">Secretaría</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-700">Estado</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-slate-500">
                    Cargando…
                  </td>
                </tr>
              )}
              {!loading && users.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-slate-500">
                    Esta entidad aún no tiene usuarios.
                  </td>
                </tr>
              )}
              {users.map((u) => (
                <tr key={u.id} className="border-t border-slate-100 hover:bg-slate-50/60">
                  <td className="px-4 py-3 font-medium text-slate-800">{u.full_name}</td>
                  <td className="px-4 py-3 text-slate-600">{u.email}</td>
                  <td className="px-4 py-3">
                    <span className="rounded bg-[#f0fbff] px-1.5 py-0.5 text-[0.72rem] text-[#0e7490]">
                      {u.role}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{u.secretaria_nombre || "—"}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded px-2 py-0.5 text-[0.72rem] font-medium ${
                        u.is_active
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {u.is_active ? "Activo" : "Inactivo"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-1">
                      <button
                        onClick={() => setEditing(u)}
                        className="rounded p-1.5 text-slate-500 hover:bg-slate-100 hover:text-[#0e7490]"
                        title="Editar"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDeactivate(u)}
                        className="rounded p-1.5 text-slate-500 hover:bg-amber-50 hover:text-amber-700"
                        title="Desactivar"
                      >
                        <UserX className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handlePurge(u)}
                        className="rounded p-1.5 text-slate-500 hover:bg-red-50 hover:text-red-600"
                        title="Eliminar definitivamente"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {(showNew || editing) && (
        <UserModal
          entity={entity}
          secretarias={secretarias}
          initial={editing}
          onClose={() => {
            setShowNew(false);
            setEditing(null);
          }}
          onSaved={() => {
            setShowNew(false);
            setEditing(null);
            load();
          }}
        />
      )}
    </div>
  );
}

function UserModal({
  entity,
  secretarias,
  initial,
  onClose,
  onSaved,
}: {
  entity: Entity;
  secretarias: Secretaria[];
  initial: AppUser | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<CreateUserPayload & { is_active?: boolean }>(
    initial
      ? {
          email: initial.email,
          full_name: initial.full_name,
          role: (initial.role || "admin") as CreateUserPayload["role"],
          entity: entity.id,
          secretaria: initial.secretaria,
          is_active: initial.is_active,
          enabled_modules: initial.enabled_modules || [],
        }
      : {
          email: "",
          full_name: "",
          role: "admin",
          entity: entity.id,
          secretaria: null,
          password: "",
          invite: false,
          is_active: true,
          enabled_modules: [],
        },
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const modulosDisponibles = useMemo(
    () => modulesForEntity(entity).filter((m) => m.scope === "all"),
    [entity],
  );

  function toggleModule(key: string) {
    setForm((f) => {
      const cur = new Set(f.enabled_modules || []);
      if (cur.has(key)) cur.delete(key);
      else cur.add(key);
      return { ...f, enabled_modules: Array.from(cur) };
    });
  }

  async function submit(ev: React.FormEvent) {
    ev.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const payload: CreateUserPayload & { is_active?: boolean } = { ...form, entity: entity.id };
      if (payload.role !== "secretario") {
        delete payload.secretaria;
        payload.enabled_modules = [];
      }
      if (!payload.password) delete payload.password;
      if (initial) {
        delete payload.invite;
        await usersApi.update(initial.id, payload);
      } else {
        if (payload.invite) delete payload.password;
        await usersApi.create(payload);
      }
      onSaved();
    } catch (err) {
      setError(formatApiError(err, "Error al guardar."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/50" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <form
          onSubmit={submit}
          onClick={(e) => e.stopPropagation()}
          className="relative flex max-h-[92vh] w-full max-w-xl flex-col overflow-hidden rounded-xl bg-white shadow-2xl"
        >
          <div className="flex items-center justify-between border-b border-slate-200 bg-[#1c2536] px-6 py-3 text-white">
            <h2 className="text-base font-semibold">
              {initial ? "Editar usuario" : "Nuevo usuario"}
            </h2>
            <button type="button" onClick={onClose} className="text-white/80 hover:text-white">
              <X className="h-5 w-5" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Nombre *">
                <input
                  required
                  value={form.full_name}
                  onChange={(e) => setForm((f) => ({ ...f, full_name: e.target.value }))}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-[#3eafd4] focus:outline-none focus:ring-1 focus:ring-[#3eafd4]"
                />
              </Field>
              <Field label="Email *">
                <input
                  required
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-[#3eafd4] focus:outline-none focus:ring-1 focus:ring-[#3eafd4]"
                />
              </Field>
              <Field label="Rol *">
                <select
                  value={form.role}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, role: e.target.value as CreateUserPayload["role"] }))
                  }
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-[#3eafd4] focus:outline-none focus:ring-1 focus:ring-[#3eafd4]"
                >
                  <option value="admin">Admin</option>
                  <option value="secretario">Secretario</option>
                </select>
              </Field>
              {!initial && (
                <label className="col-span-2 flex items-center gap-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={Boolean(form.invite)}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, invite: e.target.checked }))
                    }
                  />
                  Enviar invitación por email (el usuario define su contraseña)
                </label>
              )}
              <Field
                label={
                  initial
                    ? "Nueva contraseña (opcional)"
                    : form.invite
                      ? "Contraseña (no aplica con invitación)"
                      : "Contraseña *"
                }
              >
                <input
                  type="password"
                  required={!initial && !form.invite}
                  disabled={!initial && Boolean(form.invite)}
                  minLength={initial || form.invite ? undefined : 8}
                  value={form.password || ""}
                  placeholder={
                    initial
                      ? "Dejar vacío para no cambiar"
                      : form.invite
                        ? "Se enviará invitación por email"
                        : undefined
                  }
                  onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-[#3eafd4] focus:outline-none focus:ring-1 focus:ring-[#3eafd4] disabled:bg-slate-100"
                />
              </Field>
            </div>

            {form.role === "secretario" && (
              <>
                <Field label="Secretaría *">
                  <select
                    required
                    value={form.secretaria ?? ""}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, secretaria: Number(e.target.value) }))
                    }
                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-[#3eafd4] focus:outline-none focus:ring-1 focus:ring-[#3eafd4]"
                  >
                    <option value="">— Selecciona —</option>
                    {secretarias.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.nombre}
                      </option>
                    ))}
                  </select>
                </Field>
                {modulosDisponibles.length > 0 && (
                  <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
                    <div className="mb-2 text-xs font-semibold text-slate-600">
                      Módulos asignados al secretario
                    </div>
                    <div className="grid grid-cols-2 gap-1.5">
                      {modulosDisponibles.map((m) => (
                        <label
                          key={m.key}
                          className="flex items-center gap-1.5 rounded px-1.5 py-1 hover:bg-white text-sm cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            checked={(form.enabled_modules || []).includes(m.key)}
                            onChange={() => toggleModule(m.key)}
                            className="h-4 w-4 accent-[#3eafd4]"
                          />
                          <span className="text-slate-700">{m.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}

            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.is_active ?? true}
                onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.checked }))}
                className="h-4 w-4 accent-[#3eafd4]"
              />
              <span className="text-slate-700">Usuario activo</span>
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

// ---------------- SECRETARIAS TAB ----------------

function SecretariasTab({ entity }: { entity: Entity }) {
  const [items, setItems] = useState<Secretaria[]>([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState("");
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    try {
      setItems(await secretariasApi.list(entity.id));
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entity.id]);

  async function create() {
    if (!newName.trim()) return;
    setSaving(true);
    try {
      await secretariasApi.create({ entity: entity.id, nombre: newName.trim(), is_active: true });
      setNewName("");
      load();
    } finally {
      setSaving(false);
    }
  }

  async function rename(s: Secretaria) {
    const nombre = prompt("Nuevo nombre", s.nombre);
    if (!nombre || nombre === s.nombre) return;
    await secretariasApi.update(s.id, { nombre });
    load();
  }

  async function remove(s: Secretaria) {
    if (!confirm(`¿Eliminar la secretaría "${s.nombre}"?`)) return;
    await secretariasApi.remove(s.id);
    load();
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="Nombre de la nueva secretaría"
          className="flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-[#3eafd4] focus:outline-none focus:ring-1 focus:ring-[#3eafd4]"
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              create();
            }
          }}
        />
        <button
          onClick={create}
          disabled={saving || !newName.trim()}
          className="flex items-center gap-1.5 rounded-md bg-[#3eafd4] px-4 py-2 text-sm font-medium text-white hover:bg-[#2f9fc2] disabled:opacity-60"
        >
          <Plus className="h-4 w-4" /> Crear
        </button>
      </div>

      <div className="rounded-[0.6rem] border border-[#e9ecef] bg-white">
        {loading ? (
          <div className="p-6 text-center text-slate-500">Cargando…</div>
        ) : items.length === 0 ? (
          <div className="p-6 text-center text-slate-500">No hay secretarías para esta entidad.</div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {items.map((s) => (
              <li key={s.id} className="flex items-center justify-between px-4 py-3">
                <div>
                  <div className="font-medium text-slate-800">{s.nombre}</div>
                  <div className="text-xs text-slate-500">
                    {s.is_active ? "Activa" : "Inactiva"}
                  </div>
                </div>
                <div className="flex gap-1">
                  <button
                    onClick={() => rename(s)}
                    className="rounded p-1.5 text-slate-500 hover:bg-slate-100 hover:text-[#0e7490]"
                    title="Renombrar"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => remove(s)}
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
    </div>
  );
}

function PdmChatSection({ entity, slug }: { entity: Entity; slug: string }) {
  const [copied, setCopied] = useState<"url" | "embed" | null>(null);
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [analytics, setAnalytics] = useState<PdmChatAnalytics | null>(null);
  const [loadingAnalytics, setLoadingAnalytics] = useState(false);

  const prodUrl = `https://app.softone360.com/chat/${slug}`;
  const embedSnippet = `<script src="https://app.softone360.com/embed/pdm-chat.js" data-entity="${slug}"></script>`;

  async function copyText(text: string, kind: "url" | "embed") {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(kind);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      /* ignore */
    }
  }

  async function loadAnalytics() {
    setShowAnalytics(true);
    setLoadingAnalytics(true);
    try {
      setAnalytics(await pdmApi.chatAnalytics(slug));
    } catch {
      setAnalytics(null);
    } finally {
      setLoadingAnalytics(false);
    }
  }

  return (
    <section className="rounded-lg border border-[#b8e8f5] bg-[#f0fbff] p-4">
      <h3 className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-[#0e7490]">
        <MessageCircle className="h-4 w-4" />
        Chat IA del PDM (público)
      </h3>
      <p className="mb-3 text-sm text-slate-600">
        Chat ciudadano para consultar el PDM de <strong>{entity.name}</strong> en tiempo real.
        Se activa automáticamente al guardar con este módulo habilitado.
      </p>

      <div className="space-y-3">
        <div>
          <label className="mb-1 block text-xs font-semibold text-slate-600">URL pública (producción)</label>
          <div className="flex items-center gap-2">
            <input
              readOnly
              value={prodUrl}
              className="flex-1 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-mono text-slate-700"
            />
            <button
              type="button"
              onClick={() => void copyText(prodUrl, "url")}
              className="flex items-center gap-1 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm hover:bg-slate-50"
            >
              {copied === "url" ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
              Copiar
            </button>
            <a
              href={prodUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm hover:bg-slate-50"
            >
              <ExternalLink className="h-4 w-4" />
            </a>
          </div>
        </div>

        <div>
          <label className="mb-1 block text-xs font-semibold text-slate-600">
            Snippet para gov.co (botón flotante + iframe)
          </label>
          <div className="flex items-start gap-2">
            <textarea
              readOnly
              rows={2}
              value={embedSnippet}
              className="flex-1 rounded-md border border-slate-300 bg-white px-3 py-2 text-xs font-mono text-slate-700"
            />
            <button
              type="button"
              onClick={() => void copyText(embedSnippet, "embed")}
              className="flex shrink-0 items-center gap-1 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm hover:bg-slate-50"
            >
              {copied === "embed" ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
              Copiar
            </button>
          </div>
        </div>

        <button
          type="button"
          onClick={() => void loadAnalytics()}
          className="flex items-center gap-1.5 rounded-md border border-[#3eafd4] bg-white px-3 py-2 text-sm text-[#0e7490] hover:bg-[#e0f7fc]"
        >
          <BarChart3 className="h-4 w-4" />
          Ver analítica de preguntas (30 días)
        </button>
      </div>

      {showAnalytics && (
        <>
          <div className="fixed inset-0 z-50 bg-black/50" onClick={() => setShowAnalytics(false)} />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div
              className="relative max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-xl bg-white p-6 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                onClick={() => setShowAnalytics(false)}
                className="absolute right-4 top-4 text-slate-400 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
              <h3 className="mb-4 text-lg font-semibold text-slate-800">Analítica del chat PDM</h3>
              {loadingAnalytics ? (
                <p className="text-sm text-slate-500">Cargando…</p>
              ) : analytics ? (
                <div className="space-y-4 text-sm">
                  <div className="grid grid-cols-3 gap-3">
                    <div className="rounded-lg bg-slate-50 p-3 text-center">
                      <div className="text-2xl font-bold text-[#0e7490]">{analytics.total_conversaciones}</div>
                      <div className="text-xs text-slate-500">Conversaciones</div>
                    </div>
                    <div className="rounded-lg bg-slate-50 p-3 text-center">
                      <div className="text-2xl font-bold text-[#0e7490]">{analytics.total_mensajes}</div>
                      <div className="text-xs text-slate-500">Mensajes</div>
                    </div>
                    <div className="rounded-lg bg-slate-50 p-3 text-center">
                      <div className="text-2xl font-bold text-[#0e7490]">
                        {analytics.promedio_mensajes_por_conversacion}
                      </div>
                      <div className="text-xs text-slate-500">Prom./conv.</div>
                    </div>
                  </div>
                  {analytics.ultimas_preguntas.length > 0 && (
                    <div>
                      <h4 className="mb-2 font-semibold text-slate-700">Últimas preguntas</h4>
                      <ul className="max-h-48 space-y-1 overflow-y-auto text-xs text-slate-600">
                        {analytics.ultimas_preguntas.map((q, i) => (
                          <li key={i} className="rounded border border-slate-100 bg-slate-50 px-2 py-1.5">
                            {q.pregunta}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-sm text-slate-500">Sin datos o sin permisos para ver analítica.</p>
              )}
            </div>
          </div>
        </>
      )}
    </section>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="mb-1 flex items-baseline gap-2">
        <span className="text-xs font-semibold text-slate-600">{label}</span>
        {hint && <span className="text-[0.65rem] font-mono text-slate-400 truncate max-w-[180px]">{hint}</span>}
      </div>
      {children}
    </label>
  );
}
