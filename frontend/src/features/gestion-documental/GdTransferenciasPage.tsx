import { useEffect, useState } from "react";
import { gestionDocumentalApi, type Transferencia } from "@/core/api/gestionDocumental";
import { formatApiError } from "@/core/api/errors";
import { useGdHeaderActions } from "./GdHeaderActionsContext";
import { GdBadge, GdCard, GdLoading, btnPrimary } from "./components/GdUi";

export default function GdTransferenciasPage() {
  const { setHeaderActions } = useGdHeaderActions();
  const [items, setItems] = useState<Transferencia[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  function load() {
    setLoading(true);
    gestionDocumentalApi.transferencias
      .list({ page: 1, page_size: 50 })
      .then((r) => setItems(r.results))
      .catch((err) => setError(formatApiError(err)))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    setHeaderActions(null);
    return () => setHeaderActions(null);
  }, [setHeaderActions]);

  async function ejecutar(id: number) {
    if (!confirm("¿Ejecutar transferencia? Cambiará la etapa archivística de los expedientes.")) return;
    try {
      await gestionDocumentalApi.transferencias.ejecutar(id);
      load();
    } catch (err) {
      setError(formatApiError(err));
    }
  }

  if (loading) return <GdLoading />;

  return (
    <div className="space-y-4">
      {error && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
        <strong>Transferencia primaria:</strong> archivo de gestión → central.{" "}
        <strong>Secundaria:</strong> central → histórico (Acuerdo AGN 002 de 2020).
      </div>

      <GdCard title="Transferencias documentales">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs uppercase text-slate-500">
                <th className="py-2 pr-4">Tipo</th>
                <th className="py-2 pr-4">Estado</th>
                <th className="py-2 pr-4">Expedientes</th>
                <th className="py-2 pr-4">Acta</th>
                <th className="py-2">Acción</th>
              </tr>
            </thead>
            <tbody>
              {items.map((t) => (
                <tr key={t.id} className="border-b border-slate-100">
                  <td className="py-2 pr-4">{t.tipo_label}</td>
                  <td className="py-2 pr-4">
                    <GdBadge tone={t.estado === "ejecutada" ? "success" : "warning"}>{t.estado_label}</GdBadge>
                  </td>
                  <td className="py-2 pr-4">{t.expedientes_count}</td>
                  <td className="py-2 pr-4">{t.acta || "—"}</td>
                  <td className="py-2">
                    {t.estado === "borrador" && (
                      <button type="button" className={btnPrimary} onClick={() => void ejecutar(t.id)}>
                        Ejecutar
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {items.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-slate-500">
                    No hay transferencias registradas.
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
