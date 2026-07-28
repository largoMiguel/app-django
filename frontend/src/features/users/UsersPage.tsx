import { useEffect, useMemo, useState } from "react";
import { Users, Plus, Pencil, Trash2, X, Save, Search, UserX } from "lucide-react";
import { formatApiError } from "@/core/api/errors";
import { usersApi, type AppUser, type CreateUserPayload } from "@/core/api/users";
import { entitiesApi, secretariasApi, type Entity, type Secretaria } from "@/core/api/entities";
import { useAuthStore, primaryRole } from "@/core/auth/store";
import { modulesForEntity, type ModuleDef } from "@/core/modules";
import {
  modalContainerClass,
  modalOverlayClass,
  modalPanelSmClass,
} from "@/components/ui/modalShell";

interface Props {
  isSuperAdmin?: boolean;
}

export default function UsersPage({ isSuperAdmin = false }: Props) {
  const { user } = useAuthStore();
  const role = primaryRole(user);
  const superMode = isSuperAdmin || role === "superadmin";
  const secretarioMode = role === "secretario" && !superMode;
  const actorEntityId = user?.entity?.id ?? null;

  const [items, setItems] = useState<AppUser[]>([]);
  const [secretarias, setSecretarias] = useState<Secretaria[]>([]);
  const [entities, setEntities] = useState<Entity[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [editing, setEditing] = useState<AppUser | null>(null);
  const [showNew, setShowNew] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const params: Record<string, string | number> = { page, page_size: 15 };
      if (search.trim()) params.search = search.trim();
      const [u, s] = await Promise.all([
        usersApi.listPaginated(params),
        secretariasApi.list(),
      ]);
      setItems(u.results);
      setTotal(u.count);
      setSecretarias(s);
      if (superMode) {
        setEntities(await entitiesApi.list());
      }
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    load();
  }, [superMode, page, search]);

  async function handleDeactivate(u: AppUser) {
    const entityId = superMode ? u.entity : actorEntityId;
    if (
      !confirm(
        entityId
          ? `¿Desvincular a ${u.email} de esta entidad?\n\nSi no pertenece a otras entidades, tampoco podrá iniciar sesión.`
          : `¿Desactivar al usuario ${u.email}?\n\nNo podrá iniciar sesión hasta reactivarlo.`,
      )
    ) {
      return;
    }
    try {
      await usersApi.deactivate(u.id, entityId ? { entity: entityId } : undefined);
      load();
    } catch (err) {
      alert(formatApiError(err, "No se pudo desvincular."));
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
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-[#111827] sm:text-2xl flex items-center gap-2">
            <Users className="h-6 w-6 text-[#3eafd4]" /> {superMode ? "Usuarios (todos)" : "Usuarios"}
          </h1>
          <p className="mt-1 text-xs text-slate-600 sm:text-sm">
            {superMode
              ? "Vista global de usuarios del sistema."
              : "Gestiona los usuarios de tu entidad."}
          </p>
        </div>
        <button
          onClick={() => setShowNew(true)}
          className="flex items-center gap-2 rounded-md bg-[#3eafd4] px-4 py-2 text-sm font-medium text-white hover:bg-[#2f9fc2] self-start sm:self-auto"
        >
          <Plus className="h-4 w-4" /> Nuevo usuario
        </button>
      </div>

      <div className="rounded-[0.6rem] border border-[#e9ecef] bg-white p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por email, nombre o rol..."
            className="w-full rounded-md border border-slate-300 py-2 pl-10 pr-4 text-sm focus:border-[#3eafd4] focus:outline-none focus:ring-1 focus:ring-[#3eafd4]"
          />
        </div>
      </div>

      <div className="rounded-[0.6rem] border border-[#e9ecef] bg-white">
        {/* Vista móvil: tarjetas */}
        <div className="divide-y divide-slate-100 md:hidden">
          {loading && (
            <div className="px-4 py-8 text-center text-slate-500">Cargando…</div>
          )}
          {!loading && items.length === 0 && (
            <div className="px-4 py-8 text-center text-slate-500">No hay usuarios.</div>
          )}
          {items.map((u) => (
            <div key={u.id} className="space-y-2 p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="font-medium text-slate-800">{u.full_name || u.email}</div>
                  <div className="text-xs text-slate-500">{u.email}</div>
                </div>
                <span className={`rounded px-2 py-0.5 text-[0.72rem] font-medium ${u.is_active ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>
                  {u.is_active ? "Activo" : "Inactivo"}
                </span>
              </div>
              <div className="flex flex-wrap gap-2 text-xs text-slate-600">
                <span className="rounded bg-[#f0fbff] px-1.5 py-0.5 text-[#0e7490]">{u.role || "—"}</span>
                {superMode && u.entity_name && <span>{u.entity_name}</span>}
                {u.secretaria_nombre && <span>{u.secretaria_nombre}</span>}
                {u.supervisor_name && <span>Sup: {u.supervisor_name}</span>}
              </div>
              <div className="flex justify-end gap-1">
                <button onClick={() => setEditing(u)} className="rounded p-1.5 text-slate-500 hover:bg-slate-100">
                  <Pencil className="h-4 w-4" />
                </button>
                <button onClick={() => handleDeactivate(u)} className="rounded p-1.5 text-slate-500 hover:bg-amber-50">
                  <UserX className="h-4 w-4" />
                </button>
                <button onClick={() => handlePurge(u)} className="rounded p-1.5 text-slate-500 hover:bg-red-50">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Vista escritorio: tabla */}
        <div className="hidden overflow-x-auto md:block">
          <table className="w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left font-semibold text-slate-700">Email</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-700">Nombre</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-700">Rol</th>
                {superMode && <th className="px-4 py-3 text-left font-semibold text-slate-700">Entidad</th>}
                <th className="px-4 py-3 text-left font-semibold text-slate-700">Secretaría</th>
                {!superMode && <th className="px-4 py-3 text-left font-semibold text-slate-700">Supervisor</th>}
                <th className="px-4 py-3 text-left font-semibold text-slate-700">Estado</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td colSpan={superMode ? 7 : 7} className="px-4 py-8 text-center text-slate-500">Cargando…</td></tr>
              )}
              {!loading && items.length === 0 && (
                <tr><td colSpan={superMode ? 7 : 7} className="px-4 py-8 text-center text-slate-500">No hay usuarios.</td></tr>
              )}
              {items.map((u) => (
                <tr key={u.id} className="border-t border-slate-100 hover:bg-slate-50/60">
                  <td className="px-4 py-3 font-medium text-slate-800">{u.email}</td>
                  <td className="px-4 py-3 text-slate-600">{u.full_name || "—"}</td>
                  <td className="px-4 py-3">
                    <span className="rounded bg-[#f0fbff] px-1.5 py-0.5 text-[0.72rem] text-[#0e7490]">{u.role || "—"}</span>
                  </td>
                  {superMode && <td className="px-4 py-3 text-slate-600">{u.entity_name || "—"}</td>}
                  <td className="px-4 py-3 text-slate-600">{u.secretaria_nombre || "—"}</td>
                  {!superMode && <td className="px-4 py-3 text-slate-600">{u.supervisor_name || "—"}</td>}
                  <td className="px-4 py-3">
                    <span className={`rounded px-2 py-0.5 text-[0.72rem] font-medium ${u.is_active ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>
                      {u.is_active ? "Activo" : "Inactivo"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-1">
                      <button onClick={() => setEditing(u)} className="rounded p-1.5 text-slate-500 hover:bg-slate-100 hover:text-[#0e7490]" title="Editar">
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button onClick={() => handleDeactivate(u)} className="rounded p-1.5 text-slate-500 hover:bg-amber-50 hover:text-amber-700" title="Desactivar">
                        <UserX className="h-4 w-4" />
                      </button>
                      <button onClick={() => handlePurge(u)} className="rounded p-1.5 text-slate-500 hover:bg-red-50 hover:text-red-600" title="Eliminar definitivamente">
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

      {(showNew || editing) && (
        <UserModal
          initial={editing}
          superMode={superMode}
          secretarioMode={secretarioMode}
          secretarias={secretarias}
          entities={entities}
          actorEntity={user?.entity ?? null}
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
  initial,
  superMode,
  secretarioMode,
  secretarias,
  entities,
  actorEntity,
  onClose,
  onSaved,
}: {
  initial: AppUser | null;
  superMode: boolean;
  secretarioMode: boolean;
  secretarias: Secretaria[];
  entities: Entity[];
  actorEntity: import("@/core/auth/store").AuthEntity | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<CreateUserPayload & { nueva_secretaria_nombre?: string; is_active?: boolean }>(
    initial
      ? {
          email: initial.email,
          full_name: initial.full_name,
          role: (initial.role || "secretario") as CreateUserPayload["role"],
          entity: initial.entity,
          secretaria: initial.secretaria,
          is_active: initial.is_active,
          enabled_modules: initial.enabled_modules || [],
        }
      : {
          email: "",
          full_name: "",
          role: secretarioMode ? "contratista" : "secretario",
          entity: superMode ? null : undefined,
          secretaria: null,
          password: "",
          invite: false,
          is_active: true,
        },
  );
  const [createNewSec, setCreateNewSec] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [membershipConfirm, setMembershipConfirm] = useState<{
    entityName: string;
    role: string;
    payload: CreateUserPayload;
  } | null>(null);
  const [secretarios, setSecretarios] = useState<AppUser[]>([]);

  const targetEntityId = superMode ? form.entity : actorEntity?.id ?? null;

  const secretariasFiltradas = useMemo(() => {
    if (!superMode) return secretarias;
    if (!form.entity) return [];
    return secretarias.filter((s) => s.entity === form.entity);
  }, [secretarias, form.entity, superMode]);

  // Módulos disponibles para asignar al secretario (subset de los de la entidad activa)
  const entityForModules = useMemo(() => {
    if (superMode) return entities.find((e) => e.id === form.entity) || null;
    return actorEntity;
  }, [superMode, entities, form.entity, actorEntity]);
  const modulosDisponibles = useMemo(
    () => modulesForEntity(entityForModules as Entity | null).filter((m: ModuleDef) => m.scope === "all"),
    [entityForModules],
  );

  useEffect(() => {
    if (form.role !== "contratista" || secretarioMode) {
      setSecretarios([]);
      return;
    }
    const params: Record<string, string | number> = { role: "secretario", page_size: 100 };
    if (targetEntityId) params.entity = targetEntityId;
    usersApi.list(params).then(setSecretarios).catch(() => setSecretarios([]));
  }, [form.role, secretarioMode, targetEntityId]);

  function toggleModule(key: string) {
    setForm((f) => {
      const cur = new Set(f.enabled_modules || []);
      if (cur.has(key)) cur.delete(key);
      else cur.add(key);
      return { ...f, enabled_modules: Array.from(cur) };
    });
  }

  async function submitPayload(payload: CreateUserPayload & { is_active?: boolean; nueva_secretaria_nombre?: string }) {
    if (initial) {
      delete payload.invite;
      await usersApi.update(initial.id, payload);
    } else {
      if (payload.invite) delete payload.password;
      const result = await usersApi.create(payload);
      if (result.membership_added) {
        alert(`Se agregó la membresía de ${result.email} en esta entidad.`);
      }
    }
    onSaved();
  }

  async function handleSubmit(ev: React.FormEvent) {
    ev.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const payload: CreateUserPayload & { is_active?: boolean; nueva_secretaria_nombre?: string } = { ...form };
      if (payload.role !== "secretario" && payload.role !== "contratista") {
        delete payload.secretaria;
        delete payload.nueva_secretaria_nombre;
        delete payload.supervisor;
        payload.enabled_modules = [];
      } else if (createNewSec) {
        delete payload.secretaria;
      } else {
        delete payload.nueva_secretaria_nombre;
      }
      if (!payload.password) delete payload.password;

      if (!initial && payload.email.trim()) {
        const lookup = await usersApi.lookupEmail(payload.email.trim());
        if (lookup.exists && lookup.memberships?.length) {
          const alreadyHere = lookup.memberships.some((m) => m.entity_id === targetEntityId);
          if (alreadyHere) {
            setError("El usuario ya pertenece a esta entidad.");
            return;
          }
          const other = lookup.memberships[0];
          setMembershipConfirm({
            entityName: other.entity_name,
            role: payload.role,
            payload,
          });
          return;
        }
      }

      await submitPayload(payload);
    } catch (err) {
      setError(formatApiError(err, "Error al guardar."));
    } finally {
      setSaving(false);
    }
  }

  async function confirmMembershipAdd() {
    if (!membershipConfirm) return;
    setSaving(true);
    setError(null);
    try {
      await submitPayload(membershipConfirm.payload);
      setMembershipConfirm(null);
    } catch (err) {
      setError(formatApiError(err, "Error al agregar membresía."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <div className={modalOverlayClass} onClick={onClose} />
      <div className={modalContainerClass}>
        <form
          onSubmit={handleSubmit}
          onClick={(e) => e.stopPropagation()}
          className={modalPanelSmClass}
        >
          <div className="flex items-center justify-between border-b border-slate-200 bg-[#1c2536] px-6 py-3 text-white">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              <h2 className="text-base font-semibold">{initial ? "Editar usuario" : "Nuevo usuario"}</h2>
            </div>
            <button type="button" onClick={onClose} className="text-white/80 hover:text-white">
              <X className="h-5 w-5" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1 block text-xs font-semibold text-slate-600">Email *</span>
                <input
                  required
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-[#3eafd4] focus:outline-none focus:ring-1 focus:ring-[#3eafd4]"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-semibold text-slate-600">Nombre completo *</span>
                <input
                  required
                  value={form.full_name}
                  onChange={(e) => setForm((f) => ({ ...f, full_name: e.target.value }))}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-[#3eafd4] focus:outline-none focus:ring-1 focus:ring-[#3eafd4]"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-semibold text-slate-600">Rol *</span>
                <select
                  required
                  value={form.role}
                  onChange={(e) => setForm((f) => ({ ...f, role: e.target.value as CreateUserPayload["role"] }))}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-[#3eafd4] focus:outline-none focus:ring-1 focus:ring-[#3eafd4]"
                >
                  {superMode && <option value="superadmin">Superadmin</option>}
                  {!secretarioMode && <option value="admin">Admin</option>}
                  {!secretarioMode && <option value="secretario">Secretario</option>}
                  <option value="contratista">Contratista</option>
                  {!secretarioMode && <option value="ciudadano">Ciudadano</option>}
                </select>
              </label>
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
              <label className="block">
                <span className="mb-1 block text-xs font-semibold text-slate-600">
                  {initial
                    ? "Nueva contraseña (opcional)"
                    : form.invite
                      ? "Contraseña (no aplica con invitación)"
                      : "Contraseña"}
                </span>
                <input
                  type="password"
                  disabled={!initial && Boolean(form.invite)}
                  value={form.password || ""}
                  onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                  placeholder={
                    initial
                      ? "Dejar vacío para no cambiar"
                      : form.invite
                        ? "Se enviará invitación por email"
                        : "Mínimo 8 caracteres (vacío = auto-generada)"
                  }
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-[#3eafd4] focus:outline-none focus:ring-1 focus:ring-[#3eafd4] disabled:bg-slate-100"
                />
              </label>
              {superMode && (
                <label className="col-span-2 block">
                  <span className="mb-1 block text-xs font-semibold text-slate-600">Entidad</span>
                  <select
                    value={form.entity ?? ""}
                    onChange={(e) => setForm((f) => ({ ...f, entity: e.target.value ? Number(e.target.value) : null }))}
                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-[#3eafd4] focus:outline-none focus:ring-1 focus:ring-[#3eafd4]"
                  >
                    <option value="">— Sin entidad —</option>
                    {entities.map((e) => (
                      <option key={e.id} value={e.id}>{e.name}</option>
                    ))}
                  </select>
                </label>
              )}
            </div>

            {form.role === "secretario" && !secretarioMode && (
              <div className="rounded-md border border-slate-200 bg-slate-50 p-3 space-y-2">
                <div className="flex items-center gap-3 text-sm">
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="radio"
                      checked={!createNewSec}
                      onChange={() => setCreateNewSec(false)}
                      className="accent-[#3eafd4]"
                    />
                    Seleccionar existente
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="radio"
                      checked={createNewSec}
                      onChange={() => setCreateNewSec(true)}
                      className="accent-[#3eafd4]"
                    />
                    Crear nueva
                  </label>
                </div>
                {!createNewSec ? (
                  <select
                    required
                    value={form.secretaria ?? ""}
                    onChange={(e) => setForm((f) => ({ ...f, secretaria: Number(e.target.value) }))}
                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-[#3eafd4] focus:outline-none focus:ring-1 focus:ring-[#3eafd4]"
                  >
                    <option value="">— Selecciona secretaría —</option>
                    {secretariasFiltradas.map((s) => (
                      <option key={s.id} value={s.id}>{s.nombre}{superMode ? ` (${s.entity_name})` : ""}</option>
                    ))}
                  </select>
                ) : (
                  <input
                    required
                    value={form.nueva_secretaria_nombre || ""}
                    onChange={(e) => setForm((f) => ({ ...f, nueva_secretaria_nombre: e.target.value }))}
                    placeholder="Nombre de la nueva secretaría"
                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-[#3eafd4] focus:outline-none focus:ring-1 focus:ring-[#3eafd4]"
                  />
                )}
              </div>
            )}

            {(form.role === "secretario" || form.role === "contratista") && modulosDisponibles.length > 0 && (
              <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
                <div className="mb-2 text-xs font-semibold text-slate-600">
                  Módulos asignados al {form.role}
                </div>
                <p className="mb-2 text-xs text-slate-500">
                  Solo se muestran los módulos activos en la entidad.
                </p>
                <div className="grid grid-cols-2 gap-1.5">
                  {modulosDisponibles.map((m) => (
                    <label key={m.key} className="flex items-center gap-1.5 rounded px-1.5 py-1 hover:bg-white text-sm cursor-pointer">
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

            {form.role === "contratista" && !secretarioMode && (
              <label className="block">
                <span className="mb-1 block text-xs font-semibold text-slate-600">Supervisor (secretario) *</span>
                <select
                  required
                  value={form.supervisor ?? ""}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      supervisor: e.target.value ? Number(e.target.value) : null,
                    }))
                  }
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-[#3eafd4] focus:outline-none focus:ring-1 focus:ring-[#3eafd4]"
                >
                  <option value="">— Selecciona secretario —</option>
                  {secretarios.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.full_name || s.email}
                    </option>
                  ))}
                </select>
              </label>
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
            {error && <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
          </div>
          <div className="flex justify-end gap-2 border-t border-slate-200 bg-slate-50 px-6 py-3">
            <button type="button" onClick={onClose} className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm hover:bg-slate-50">
              Cancelar
            </button>
            <button type="submit" disabled={saving} className="flex items-center gap-1.5 rounded-md bg-[#3eafd4] px-4 py-2 text-sm font-medium text-white hover:bg-[#2f9fc2] disabled:opacity-60">
              <Save className="h-4 w-4" /> {saving ? "Guardando…" : "Guardar"}
            </button>
          </div>
        </form>
      </div>

      {membershipConfirm && (
        <>
          <div className={`${modalOverlayClass} z-[60]`} onClick={() => setMembershipConfirm(null)} />
          <div className={`${modalContainerClass} z-[60]`}>
            <div className={`${modalPanelSmClass} max-w-md p-6`}>
              <h3 className="text-base font-semibold text-slate-900">Usuario existente</h3>
              <p className="mt-2 text-sm text-slate-600">
                <strong>{membershipConfirm.payload.email}</strong> ya existe en{" "}
                <strong>{membershipConfirm.entityName}</strong>. ¿Agregarlo también a esta entidad como{" "}
                <strong>{membershipConfirm.role}</strong>?
              </p>
              <div className="mt-4 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setMembershipConfirm(null)}
                  className="rounded-md border border-slate-300 px-4 py-2 text-sm hover:bg-slate-50"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => void confirmMembershipAdd()}
                  className="rounded-md bg-[#3eafd4] px-4 py-2 text-sm font-medium text-white hover:bg-[#2f9fc2] disabled:opacity-60"
                >
                  {saving ? "Agregando…" : "Agregar a esta entidad"}
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
}
