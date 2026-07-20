import { useEffect, useState } from "react";
import { Plus, Key, ShieldOff, Trash2, X, Save, Copy, Check } from "lucide-react";
import { asistenciaApi, type EquipoRegistro } from "@/core/api/asistencia";
import { formatApiError } from "@/core/api/errors";
import { primaryRole, useAuthStore } from "@/core/auth/store";

export default function EquiposPage() {
  const role = primaryRole(useAuthStore((s) => s.user));
  const canDelete = role === "admin";
  const [items, setItems] = useState<EquipoRegistro[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ nombre: "", ubicacion: "" });
  const [saving, setSaving] = useState(false);
  const [pairingCode, setPairingCode] = useState<{ code: string; equipo: string } | null>(null);
  const [copied, setCopied] = useState(false);

  async function load() {
    setLoading(true);
    try {
      setItems(await asistenciaApi.equipos.list());
    } catch (err) {
      setError(formatApiError(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function create() {
    setSaving(true);
    try {
      await asistenciaApi.equipos.create(form);
      setShowCreate(false);
      setForm({ nombre: "", ubicacion: "" });
      await load();
    } catch (err) {
      setError(formatApiError(err));
    } finally {
      setSaving(false);
    }
  }

  async function generatePairing(equipo: EquipoRegistro) {
    try {
      const res = await asistenciaApi.equipos.pairing(equipo.id);
      setPairingCode({ code: res.pairing_code, equipo: equipo.nombre });
      setCopied(false);
    } catch (err) {
      setError(formatApiError(err));
    }
  }

  async function revoke(id: number) {
    if (!confirm("¿Revocar el acceso de este equipo? Deberá emparejarse de nuevo.")) return;
    try {
      await asistenciaApi.equipos.revoke(id);
      await load();
    } catch (err) {
      setError(formatApiError(err));
    }
  }

  async function remove(id: number) {
    if (!confirm("¿Eliminar este equipo?")) return;
    try {
      await asistenciaApi.equipos.remove(id);
      await load();
    } catch (err) {
      setError(formatApiError(err));
    }
  }

  function copyCode() {
    if (!pairingCode) return;
    navigator.clipboard.writeText(pairingCode.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button
          onClick={() => setShowCreate(true)}
          className="inline-flex items-center gap-2 rounded-[0.3rem] bg-[#3eafd4] px-4 py-2 text-sm font-medium text-white hover:bg-[#2f9fc2]"
        >
          <Plus className="h-4 w-4" /> Nuevo equipo
        </button>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {pairingCode && (
        <div className="rounded-xl border-2 border-[#0d6e8a] bg-[#f0f9fc] p-6 text-center">
          <p className="text-sm text-[#0d4f61]">
            Código para <strong>{pairingCode.equipo}</strong> — válido 15 minutos
          </p>
          <p className="mt-3 font-mono text-4xl font-bold tracking-[0.3em] text-[#0d6e8a]">
            {pairingCode.code}
          </p>
          <p className="mt-2 text-xs text-slate-600">
            Ingrese este código en el kiosk web del equipo (/kiosk)
          </p>
          <button
            onClick={copyCode}
            className="mt-4 inline-flex items-center gap-2 rounded-lg bg-[#0d6e8a] px-4 py-2 text-sm text-white"
          >
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            {copied ? "Copiado" : "Copiar código"}
          </button>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {loading ? (
          <div className="col-span-full py-8 text-center text-slate-500">Cargando…</div>
        ) : items.length === 0 ? (
          <div className="col-span-full py-8 text-center text-slate-500">
            No hay equipos registrados.
          </div>
        ) : (
          items.map((e) => (
            <div
              key={e.id}
              className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-semibold text-slate-900">{e.nombre}</h3>
                  {e.ubicacion && (
                    <p className="mt-0.5 text-sm text-slate-500">{e.ubicacion}</p>
                  )}
                </div>
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                    e.is_paired
                      ? "bg-emerald-50 text-emerald-700"
                      : "bg-amber-50 text-amber-700"
                  }`}
                >
                  {e.is_paired ? "Emparejado" : "Sin emparejar"}
                </span>
              </div>
              {e.last_seen_at && (
                <p className="mt-2 text-xs text-slate-400">
                  Última actividad: {new Date(e.last_seen_at).toLocaleString()}
                </p>
              )}
              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  onClick={() => generatePairing(e)}
                  className="inline-flex items-center gap-1.5 rounded-md bg-[#0d6e8a] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#0a5870]"
                >
                  <Key className="h-3.5 w-3.5" /> Generar código
                </button>
                {e.is_paired && (
                  <button
                    onClick={() => revoke(e.id)}
                    className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 px-3 py-1.5 text-xs hover:bg-slate-50"
                  >
                    <ShieldOff className="h-3.5 w-3.5" /> Revocar
                  </button>
                )}
                {canDelete && (
                  <button
                    onClick={() => remove(e.id)}
                    className="inline-flex items-center gap-1.5 rounded-md border border-red-200 px-3 py-1.5 text-xs text-red-600 hover:bg-red-50"
                  >
                    <Trash2 className="h-3.5 w-3.5" /> Eliminar
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b px-6 py-4">
              <h2 className="font-semibold">Nuevo equipo kiosk</h2>
              <button onClick={() => setShowCreate(false)}>
                <X className="h-5 w-5 text-slate-400" />
              </button>
            </div>
            <div className="space-y-3 px-6 py-4">
              <label className="block text-sm">
                <span className="font-medium">Nombre *</span>
                <input
                  value={form.nombre}
                  onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value }))}
                  placeholder="Recepción principal"
                  className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2"
                />
              </label>
              <label className="block text-sm">
                <span className="font-medium">Ubicación</span>
                <input
                  value={form.ubicacion}
                  onChange={(e) => setForm((f) => ({ ...f, ubicacion: e.target.value }))}
                  placeholder="Edificio administrativo"
                  className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2"
                />
              </label>
            </div>
            <div className="flex justify-end gap-2 border-t bg-slate-50 px-6 py-3">
              <button
                onClick={() => setShowCreate(false)}
                className="rounded-md border px-4 py-2 text-sm"
              >
                Cancelar
              </button>
              <button
                onClick={create}
                disabled={saving || !form.nombre.trim()}
                className="inline-flex items-center gap-2 rounded-md bg-[#0d6e8a] px-4 py-2 text-sm text-white disabled:opacity-60"
              >
                <Save className="h-4 w-4" /> Crear
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
