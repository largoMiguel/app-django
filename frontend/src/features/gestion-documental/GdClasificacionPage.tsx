import { useCallback, useEffect, useRef, useState } from "react";
import { Upload } from "lucide-react";
import { gestionDocumentalApi, type SerieDocumental } from "@/core/api/gestionDocumental";
import { formatApiError } from "@/core/api/errors";
import { useGdHeaderActions } from "./GdHeaderActionsContext";
import { GdCard, GdLoading, btnPrimary, btnSecondary, inputClass } from "./components/GdUi";

export default function GdClasificacionPage() {
  const { setHeaderActions } = useGdHeaderActions();
  const importRef = useRef<HTMLInputElement>(null);
  const [series, setSeries] = useState<SerieDocumental[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    codigo: "",
    nombre: "",
    es_subserie: false,
    retencion_gestion_anios: 2,
    retencion_central_anios: 5,
    disposicion_final: "CT",
  });

  const load = useCallback(() => {
    setLoading(true);
    gestionDocumentalApi.series
      .list({ page: 1, page_size: 100 })
      .then((r) => setSeries(r.results))
      .catch((err) => setError(formatApiError(err)))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleImport = useCallback(
    async (file: File) => {
      try {
        const r = await gestionDocumentalApi.series.importar(file);
        alert(`Importación: ${r.created} creadas, ${r.updated} actualizadas`);
        load();
      } catch (err) {
        setError(formatApiError(err));
      }
    },
    [load],
  );

  useEffect(() => {
    setHeaderActions(
      <>
        <input
          ref={importRef}
          type="file"
          className="hidden"
          accept=".xlsx,.xls"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void handleImport(f);
            e.target.value = "";
          }}
        />
        <button type="button" className={btnSecondary} onClick={() => importRef.current?.click()}>
          <Upload className="h-4 w-4" />
          Importar Excel TRD
        </button>
        <button type="button" className={btnPrimary} onClick={() => setShowForm((v) => !v)}>
          {showForm ? "Cancelar" : "Nueva serie"}
        </button>
      </>,
    );
    return () => setHeaderActions(null);
  }, [setHeaderActions, showForm, handleImport]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    try {
      await gestionDocumentalApi.series.create(form);
      setShowForm(false);
      load();
    } catch (err) {
      setError(formatApiError(err));
    }
  }

  if (loading) return <GdLoading />;

  return (
    <div className="space-y-4">
      {error && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-600">
        Columnas Excel: código, nombre, es_subserie, código_serie_padre, retención_gestión, retención_central,
        disposición (CT/S/E/MD).
      </div>

      {showForm && (
        <GdCard title="Nueva serie / subserie">
          <form onSubmit={handleCreate} className="grid gap-3 sm:grid-cols-2">
            <label className="block text-sm">
              <span className="mb-1 block text-slate-600">Código</span>
              <input className={inputClass} required value={form.codigo} onChange={(e) => setForm({ ...form, codigo: e.target.value })} />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block text-slate-600">Nombre</span>
              <input className={inputClass} required value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} />
            </label>
            <label className="flex items-center gap-2 text-sm sm:col-span-2">
              <input type="checkbox" checked={form.es_subserie} onChange={(e) => setForm({ ...form, es_subserie: e.target.checked })} />
              Es subserie
            </label>
            <label className="block text-sm">
              <span className="mb-1 block text-slate-600">Retención gestión (años)</span>
              <input type="number" className={inputClass} value={form.retencion_gestion_anios} onChange={(e) => setForm({ ...form, retencion_gestion_anios: Number(e.target.value) })} />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block text-slate-600">Retención central (años)</span>
              <input type="number" className={inputClass} value={form.retencion_central_anios} onChange={(e) => setForm({ ...form, retencion_central_anios: Number(e.target.value) })} />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block text-slate-600">Disposición final</span>
              <select className={inputClass} value={form.disposicion_final} onChange={(e) => setForm({ ...form, disposicion_final: e.target.value })}>
                <option value="CT">Conservación total</option>
                <option value="S">Selección</option>
                <option value="E">Eliminación</option>
                <option value="MD">Microfilmación/Digitalización</option>
              </select>
            </label>
            <div className="sm:col-span-2">
              <button type="submit" className={btnPrimary}>
                Guardar
              </button>
            </div>
          </form>
        </GdCard>
      )}

      <GdCard title="Series y subseries (CCD/TRD)">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs uppercase text-slate-500">
                <th className="py-2 pr-4">Código</th>
                <th className="py-2 pr-4">Nombre</th>
                <th className="py-2 pr-4">Tipo</th>
                <th className="py-2 pr-4">Ret. gestión</th>
                <th className="py-2 pr-4">Ret. central</th>
                <th className="py-2">Disposición</th>
              </tr>
            </thead>
            <tbody>
              {series.map((s) => (
                <tr key={s.id} className="border-b border-slate-100">
                  <td className="py-2 pr-4 font-mono text-xs">{s.codigo}</td>
                  <td className="py-2 pr-4">{s.nombre}</td>
                  <td className="py-2 pr-4">{s.es_subserie ? "Subserie" : "Serie"}</td>
                  <td className="py-2 pr-4">{s.retencion_gestion_anios}a</td>
                  <td className="py-2 pr-4">{s.retencion_central_anios}a</td>
                  <td className="py-2">{s.disposicion_final}</td>
                </tr>
              ))}
              {series.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-500">
                    Importe la TRD o cree series manualmente.
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
