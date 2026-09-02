import { useEffect, useState } from "react";
import { Download } from "lucide-react";
import { gestionDocumentalApi } from "@/core/api/gestionDocumental";
import { formatApiError } from "@/core/api/errors";
import { useGdHeaderActions } from "./GdHeaderActionsContext";
import { GdCard, btnSecondary } from "./components/GdUi";

export default function GdInformesPage() {
  const { setHeaderActions } = useGdHeaderActions();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<string | null>(null);

  useEffect(() => {
    setHeaderActions(null);
    return () => setHeaderActions(null);
  }, [setHeaderActions]);

  async function exportar(tipo: "fuid" | "trd" | "transferencias", label: string) {
    setLoading(label);
    setError(null);
    try {
      await gestionDocumentalApi.exportExcel(tipo);
    } catch (err) {
      setError(formatApiError(err));
    } finally {
      setLoading(null);
    }
  }

  const exports = [
    { tipo: "fuid" as const, label: "Inventario FUID (Excel)", desc: "Formato Único de Inventario Documental — Anexo 3 AGN" },
    { tipo: "trd" as const, label: "TRD vigente (Excel)", desc: "Series, subseries, retención y disposición final" },
    { tipo: "transferencias" as const, label: "Transferencias (Excel)", desc: "Historial de transferencias primarias y secundarias" },
  ];

  return (
    <div className="space-y-4">
      {error && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {exports.map((e) => (
          <GdCard key={e.tipo} title={e.label}>
            <p className="mb-4 text-sm text-slate-600">{e.desc}</p>
            <button
              type="button"
              className={`${btnSecondary} gap-2`}
              disabled={loading === e.label}
              onClick={() => void exportar(e.tipo, e.label)}
            >
              <Download className="h-4 w-4" />
              {loading === e.label ? "Descargando…" : "Descargar Excel"}
            </button>
          </GdCard>
        ))}
      </div>
    </div>
  );
}
