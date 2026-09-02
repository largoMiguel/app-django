import { useCallback, useEffect, useState } from "react";
import { gestionDocumentalApi, type FuidRegistro } from "@/core/api/gestionDocumental";
import { formatApiError } from "@/core/api/errors";
import { useGdHeaderActions } from "./GdHeaderActionsContext";
import { GdCard, GdLoading, btnPrimary } from "./components/GdUi";

export default function GdInventarioPage() {
  const { setHeaderActions } = useGdHeaderActions();
  const [items, setItems] = useState<FuidRegistro[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    gestionDocumentalApi.fuid
      .list({ page: 1, page_size: 100 })
      .then((r) => setItems(r.results))
      .catch((err) => setError(formatApiError(err)))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const generar = useCallback(async () => {
    setGenerating(true);
    try {
      const r = await gestionDocumentalApi.fuid.generarDesdeExpedientes();
      alert(`${r.created} registro(s) FUID generados desde expedientes.`);
      load();
    } catch (err) {
      setError(formatApiError(err));
    } finally {
      setGenerating(false);
    }
  }, [load]);

  useEffect(() => {
    setHeaderActions(
      <button type="button" className={btnPrimary} disabled={generating} onClick={() => void generar()}>
        Generar FUID desde expedientes
      </button>,
    );
    return () => setHeaderActions(null);
  }, [setHeaderActions, generating, generar]);

  if (loading) return <GdLoading />;

  return (
    <div className="space-y-4">
      {error && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      <GdCard title="Formato Único de Inventario Documental (Anexo 3 AGN)">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs uppercase text-slate-500">
                <th className="py-2 pr-3">Código</th>
                <th className="py-2 pr-3">Serie</th>
                <th className="py-2 pr-3">Unidad documental</th>
                <th className="py-2 pr-3">Fechas</th>
                <th className="py-2 pr-3">Soporte</th>
                <th className="py-2">Folios</th>
              </tr>
            </thead>
            <tbody>
              {items.map((r) => (
                <tr key={r.id} className="border-b border-slate-100">
                  <td className="py-2 pr-3 font-mono text-xs">{r.codigo}</td>
                  <td className="py-2 pr-3 text-xs">{r.serie_nombre}</td>
                  <td className="py-2 pr-3">{r.unidad_documental}</td>
                  <td className="py-2 pr-3 text-xs">
                    {r.fecha_inicial || "S.F."} — {r.fecha_final || "S.F."}
                  </td>
                  <td className="py-2 pr-3 text-xs">
                    {r.soporte_fisico && "F "}
                    {r.soporte_electronico && "E"}
                  </td>
                  <td className="py-2">{r.folios}</td>
                </tr>
              ))}
              {items.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-500">
                    Genere el inventario desde expedientes o expórtelo en Informes.
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
