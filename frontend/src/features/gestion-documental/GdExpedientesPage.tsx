import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { gestionDocumentalApi, type ExpedienteListItem, type SerieDocumental } from "@/core/api/gestionDocumental";
import { formatApiError } from "@/core/api/errors";
import { useGdHeaderActions } from "./GdHeaderActionsContext";
import { GdBadge, GdCard, GdLoading, btnPrimary, inputClass } from "./components/GdUi";

export default function GdExpedientesPage() {
  const { setHeaderActions } = useGdHeaderActions();
  const [items, setItems] = useState<ExpedienteListItem[]>([]);
  const [series, setSeries] = useState<SerieDocumental[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ titulo: "", serie: 0, soporte: "electronico" });

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([
      gestionDocumentalApi.expedientes.list({ page: 1, page_size: 50 }),
      gestionDocumentalApi.series.list({ page: 1, page_size: 200 }),
    ])
      .then(([exp, ser]) => {
        setItems(exp.results);
        setSeries(ser.results);
        if (ser.results.length) setForm((f) => ({ ...f, serie: f.serie || ser.results[0].id }));
      })
      .catch((err) => setError(formatApiError(err)))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    setHeaderActions(
      <button
        type="button"
        className={btnPrimary}
        disabled={series.length === 0}
        onClick={() => setShowForm((v) => !v)}
      >
        {showForm ? "Cancelar" : "Nuevo expediente"}
      </button>,
    );
    return () => setHeaderActions(null);
  }, [setHeaderActions, showForm, series.length]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    try {
      await gestionDocumentalApi.expedientes.create(form);
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

      {showForm && (
        <GdCard title="Nuevo expediente">
          <form onSubmit={handleCreate} className="grid gap-3 sm:grid-cols-2">
            <label className="block text-sm sm:col-span-2">
              <span className="mb-1 block text-slate-600">Título / unidad documental</span>
              <input className={inputClass} required value={form.titulo} onChange={(e) => setForm({ ...form, titulo: e.target.value })} />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block text-slate-600">Serie / subserie</span>
              <select className={inputClass} value={form.serie} onChange={(e) => setForm({ ...form, serie: Number(e.target.value) })}>
                {series.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.codigo} — {s.nombre}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm">
              <span className="mb-1 block text-slate-600">Soporte</span>
              <select className={inputClass} value={form.soporte} onChange={(e) => setForm({ ...form, soporte: e.target.value })}>
                <option value="electronico">Electrónico</option>
                <option value="fisico">Físico</option>
                <option value="hibrido">Híbrido</option>
              </select>
            </label>
            <div className="sm:col-span-2">
              <button type="submit" className={btnPrimary}>
                Crear expediente
              </button>
            </div>
          </form>
        </GdCard>
      )}

      <GdCard title="Expedientes">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs uppercase text-slate-500">
                <th className="py-2 pr-4">Código</th>
                <th className="py-2 pr-4">Título</th>
                <th className="py-2 pr-4">Serie</th>
                <th className="py-2 pr-4">Etapa</th>
                <th className="py-2 pr-4">Estado</th>
                <th className="py-2">Docs</th>
              </tr>
            </thead>
            <tbody>
              {items.map((e) => (
                <tr key={e.id} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="py-2 pr-4">
                    <Link to={`/gestion-documental/expedientes/${e.id}`} className="font-medium text-[#0e7490] hover:underline">
                      {e.codigo}
                    </Link>
                  </td>
                  <td className="py-2 pr-4">{e.titulo}</td>
                  <td className="py-2 pr-4 text-xs">{e.serie_codigo}</td>
                  <td className="py-2 pr-4">{e.etapa_label}</td>
                  <td className="py-2 pr-4">
                    <GdBadge tone={e.estado === "abierto" ? "default" : "success"}>{e.estado_label}</GdBadge>
                  </td>
                  <td className="py-2">{e.documentos_count}</td>
                </tr>
              ))}
              {items.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-500">
                    No hay expedientes. Cree uno asociado a una serie TRD.
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
