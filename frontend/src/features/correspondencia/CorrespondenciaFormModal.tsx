import { useEffect, useState } from "react";
import {
  CANAL_OPTIONS,
  SLA_OPTIONS,
  TIPOLOGIA_OPTIONS,
  correspondenciaApi,
  type CorrespondenciaWritePayload,
} from "@/core/api/correspondencia";
import { secretariasApi, type Secretaria } from "@/core/api/entities";
import { formatApiError } from "@/core/api/errors";
import { useAuthStore } from "@/core/auth/store";

export default function CorrespondenciaFormModal({
  defaultSentido,
  onClose,
  onCreated,
}: {
  defaultSentido: "entrada" | "salida";
  onClose: () => void;
  onCreated: (id: number) => void;
}) {
  const user = useAuthStore((s) => s.user);
  const [secretarias, setSecretarias] = useState<Secretaria[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<CorrespondenciaWritePayload>({
    sentido: defaultSentido,
    tipologia: "oficio",
    remitente_nombre: "",
    destinatario_nombre: "",
    canal: "digital",
    asunto: "",
    descripcion: "",
    numero_folios: 1,
    secretaria_id: user?.secretaria?.id || 0,
    dias_habiles_respuesta: 15,
    contacto_email: "",
    contacto_direccion: "",
  });

  useEffect(() => {
    const entityId = user?.entity?.id;
    if (!entityId) return;
    secretariasApi.list(entityId).then((list) => {
      setSecretarias(list.filter((s) => s.is_active !== false));
      if (!form.secretaria_id && list.length) {
        const preferred =
          user?.secretaria?.id && list.find((s) => s.id === user.secretaria?.id)
            ? user.secretaria.id
            : list[0].id;
        setForm((f) => ({ ...f, secretaria_id: preferred }));
      }
    });
  }, [user?.entity?.id]);

  function set<K extends keyof CorrespondenciaWritePayload>(
    key: K,
    value: CorrespondenciaWritePayload[K],
  ) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const created = await correspondenciaApi.create(form);
      onCreated(created.id);
    } catch (err) {
      setError(formatApiError(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 pt-10">
      <div className="w-full max-w-2xl rounded-xl border border-slate-200 bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <h2 className="text-lg font-semibold text-[#111827]">Radicar correspondencia</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700">
            ✕
          </button>
        </div>
        <form onSubmit={submit} className="space-y-4 px-5 py-4">
          {error && (
            <div className="rounded-[0.3rem] border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          )}
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-sm">
              <span className="mb-1 block text-slate-600">Sentido</span>
              <select
                value={form.sentido}
                onChange={(e) => set("sentido", e.target.value as "entrada" | "salida")}
                className="w-full rounded-[0.3rem] border border-slate-300 px-3 py-2"
              >
                <option value="entrada">Entrada</option>
                <option value="salida">Salida</option>
              </select>
            </label>
            <label className="text-sm">
              <span className="mb-1 block text-slate-600">Tipología</span>
              <select
                value={form.tipologia}
                onChange={(e) => set("tipologia", e.target.value)}
                className="w-full rounded-[0.3rem] border border-slate-300 px-3 py-2"
              >
                {TIPOLOGIA_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm">
              <span className="mb-1 block text-slate-600">Canal</span>
              <select
                value={form.canal}
                onChange={(e) => set("canal", e.target.value)}
                className="w-full rounded-[0.3rem] border border-slate-300 px-3 py-2"
              >
                {CANAL_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm">
              <span className="mb-1 block text-slate-600">SLA (días hábiles)</span>
              <select
                value={form.dias_habiles_respuesta}
                onChange={(e) => set("dias_habiles_respuesta", Number(e.target.value))}
                className="w-full rounded-[0.3rem] border border-slate-300 px-3 py-2"
              >
                {SLA_OPTIONS.map((d) => (
                  <option key={d} value={d}>
                    {d} días
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label className="block text-sm">
            <span className="mb-1 block text-slate-600">Secretaría</span>
            <select
              value={form.secretaria_id || ""}
              onChange={(e) => set("secretaria_id", Number(e.target.value))}
              required
              className="w-full rounded-[0.3rem] border border-slate-300 px-3 py-2"
            >
              <option value="" disabled>
                Seleccionar…
              </option>
              {secretarias.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.nombre}
                </option>
              ))}
            </select>
          </label>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-sm">
              <span className="mb-1 block text-slate-600">Remitente</span>
              <input
                required
                value={form.remitente_nombre}
                onChange={(e) => set("remitente_nombre", e.target.value)}
                className="w-full rounded-[0.3rem] border border-slate-300 px-3 py-2"
              />
            </label>
            <label className="text-sm">
              <span className="mb-1 block text-slate-600">Destinatario</span>
              <input
                required
                value={form.destinatario_nombre}
                onChange={(e) => set("destinatario_nombre", e.target.value)}
                className="w-full rounded-[0.3rem] border border-slate-300 px-3 py-2"
              />
            </label>
          </div>

          {form.canal === "correo" && (
            <label className="block text-sm">
              <span className="mb-1 block text-slate-600">Correo de contacto</span>
              <input
                type="email"
                required
                value={form.contacto_email || ""}
                onChange={(e) => set("contacto_email", e.target.value)}
                className="w-full rounded-[0.3rem] border border-slate-300 px-3 py-2"
              />
            </label>
          )}
          {form.canal === "fisico" && (
            <label className="block text-sm">
              <span className="mb-1 block text-slate-600">Dirección</span>
              <input
                required
                value={form.contacto_direccion || ""}
                onChange={(e) => set("contacto_direccion", e.target.value)}
                className="w-full rounded-[0.3rem] border border-slate-300 px-3 py-2"
              />
            </label>
          )}

          <label className="block text-sm">
            <span className="mb-1 block text-slate-600">Asunto</span>
            <input
              required
              value={form.asunto}
              onChange={(e) => set("asunto", e.target.value)}
              className="w-full rounded-[0.3rem] border border-slate-300 px-3 py-2"
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-slate-600">Descripción</span>
            <textarea
              rows={3}
              value={form.descripcion || ""}
              onChange={(e) => set("descripcion", e.target.value)}
              className="w-full rounded-[0.3rem] border border-slate-300 px-3 py-2"
            />
          </label>

          <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-[0.3rem] border border-slate-200 px-4 py-2 text-sm text-slate-600"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="rounded-[0.3rem] bg-[#3eafd4] px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
            >
              {saving ? "Guardando…" : "Radicar"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
