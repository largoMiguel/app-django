import { useCallback, useEffect, useState } from "react";
import { Upload } from "lucide-react";
import { gestionDocumentalApi, type InstrumentoArchivistico } from "@/core/api/gestionDocumental";
import { formatApiError } from "@/core/api/errors";
import { openAuthenticatedFile } from "@/core/api/client";
import { useGdHeaderActions } from "./GdHeaderActionsContext";
import { GdBadge, GdCard, GdLoading, btnPrimary, btnSecondary, inputClass } from "./components/GdUi";

const TIPOS = [
  { value: "ccd", label: "CCD" },
  { value: "trd", label: "TRD" },
  { value: "tvd", label: "TVD" },
  { value: "pgd", label: "PGD" },
  { value: "pinar", label: "PINAR" },
  { value: "fuid", label: "FUID" },
  { value: "sic", label: "SIC" },
  { value: "diagnostico", label: "Diagnóstico" },
];

const ESTADOS = [
  "borrador",
  "aprobado_comite",
  "presentado_consejo",
  "convalidado",
  "inscrito_rusd",
  "vigente",
];

export default function GdInstrumentosPage() {
  const { setHeaderActions } = useGdHeaderActions();
  const [items, setItems] = useState<InstrumentoArchivistico[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ tipo: "trd", vigencia: new Date().getFullYear(), titulo: "", estado: "borrador" });
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    gestionDocumentalApi.instrumentos
      .list({ page: 1, page_size: 50 })
      .then((r) => setItems(r.results))
      .catch((err) => setError(formatApiError(err)))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    setHeaderActions(
      <button type="button" className={btnPrimary} onClick={() => setShowForm((v) => !v)}>
        {showForm ? "Cancelar" : "Nuevo instrumento"}
      </button>,
    );
    return () => setHeaderActions(null);
  }, [setHeaderActions, showForm]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await gestionDocumentalApi.instrumentos.create(form);
      setShowForm(false);
      load();
    } catch (err) {
      setError(formatApiError(err));
    } finally {
      setSaving(false);
    }
  }

  async function handleUpload(id: number, file: File) {
    try {
      await gestionDocumentalApi.instrumentos.uploadArchivo(id, file);
      load();
    } catch (err) {
      setError(formatApiError(err));
    }
  }

  if (loading) return <GdLoading />;

  return (
    <div className="space-y-4">
      {error && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      {showForm && (
        <GdCard title="Registrar instrumento archivístico">
          <form onSubmit={handleCreate} className="grid gap-3 sm:grid-cols-2">
            <label className="block text-sm">
              <span className="mb-1 block text-slate-600">Tipo</span>
              <select className={inputClass} value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value })}>
                {TIPOS.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm">
              <span className="mb-1 block text-slate-600">Vigencia</span>
              <input
                type="number"
                className={inputClass}
                value={form.vigencia}
                onChange={(e) => setForm({ ...form, vigencia: Number(e.target.value) })}
              />
            </label>
            <label className="block text-sm sm:col-span-2">
              <span className="mb-1 block text-slate-600">Título</span>
              <input className={inputClass} value={form.titulo} onChange={(e) => setForm({ ...form, titulo: e.target.value })} />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block text-slate-600">Estado</span>
              <select className={inputClass} value={form.estado} onChange={(e) => setForm({ ...form, estado: e.target.value })}>
                {ESTADOS.map((s) => (
                  <option key={s} value={s}>
                    {s.replace(/_/g, " ")}
                  </option>
                ))}
              </select>
            </label>
            <div className="flex items-end sm:col-span-2">
              <button type="submit" className={btnPrimary} disabled={saving}>
                Guardar
              </button>
            </div>
          </form>
        </GdCard>
      )}

      <GdCard title="Instrumentos cargados">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs uppercase text-slate-500">
                <th className="py-2 pr-4">Tipo</th>
                <th className="py-2 pr-4">Vigencia</th>
                <th className="py-2 pr-4">Estado</th>
                <th className="py-2 pr-4">Archivo</th>
                <th className="py-2">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {items.map((i) => (
                <tr key={i.id} className="border-b border-slate-100">
                  <td className="py-3 pr-4 font-medium">{i.tipo_label}</td>
                  <td className="py-3 pr-4">{i.vigencia}</td>
                  <td className="py-3 pr-4">
                    <GdBadge tone={i.estado === "vigente" ? "success" : "default"}>{i.estado_label}</GdBadge>
                  </td>
                  <td className="py-3 pr-4">
                    {i.nombre_archivo ? (
                      <button
                        type="button"
                        className="text-[#0e7490] hover:underline"
                        onClick={() => i.archivo_url && openAuthenticatedFile(i.archivo_url)}
                      >
                        {i.nombre_archivo}
                      </button>
                    ) : (
                      <span className="text-slate-400">Sin archivo</span>
                    )}
                  </td>
                  <td className="py-3">
                    <label className={`${btnSecondary} cursor-pointer gap-1`}>
                      <Upload className="h-4 w-4" />
                      Subir
                      <input
                        type="file"
                        className="hidden"
                        accept=".pdf,.xlsx,.xls,.doc,.docx"
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) void handleUpload(i.id, f);
                          e.target.value = "";
                        }}
                      />
                    </label>
                  </td>
                </tr>
              ))}
              {items.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-slate-500">
                    No hay instrumentos registrados. Cargue TRD, CCD, PGD u otros formatos AGN.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </GdCard>
    </div>
  );
}
