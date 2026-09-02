import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Upload, ArrowLeft } from "lucide-react";
import { gestionDocumentalApi, type ExpedienteDetail } from "@/core/api/gestionDocumental";
import { formatApiError } from "@/core/api/errors";
import { openAuthenticatedFile } from "@/core/api/client";
import { useGdHeaderActions } from "./GdHeaderActionsContext";
import { GdBadge, GdCard, GdLoading, btnPrimary, btnSecondary } from "./components/GdUi";

export default function GdExpedienteDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { setHeaderActions } = useGdHeaderActions();
  const uploadRef = useRef<HTMLInputElement>(null);
  const [exp, setExp] = useState<ExpedienteDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    if (!id) return;
    setLoading(true);
    gestionDocumentalApi.expedientes
      .get(Number(id))
      .then(setExp)
      .catch((err) => setError(formatApiError(err)))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const handleUpload = useCallback(
    async (file: File) => {
      if (!exp) return;
      try {
        await gestionDocumentalApi.expedientes.uploadDocumento(exp.id, file);
        load();
      } catch (err) {
        setError(formatApiError(err));
      }
    },
    [exp, load],
  );

  const handleCerrar = useCallback(async () => {
    if (!exp || !confirm("¿Cerrar este expediente?")) return;
    try {
      await gestionDocumentalApi.expedientes.cerrar(exp.id);
      load();
    } catch (err) {
      setError(formatApiError(err));
    }
  }, [exp, load]);

  useEffect(() => {
    setHeaderActions(
      <>
        <input
          ref={uploadRef}
          type="file"
          className="hidden"
          accept=".pdf,.doc,.docx,.xlsx,.png,.jpg"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void handleUpload(f);
            e.target.value = "";
          }}
        />
        <Link to="/gestion-documental/expedientes" className={`${btnSecondary} inline-flex gap-1`}>
          <ArrowLeft className="h-4 w-4" />
          Volver
        </Link>
        {exp?.estado === "abierto" && (
          <>
            <button type="button" className={btnPrimary} onClick={() => uploadRef.current?.click()}>
              <Upload className="h-4 w-4" />
              Subir documento
            </button>
            <button type="button" className={btnSecondary} onClick={() => void handleCerrar()}>
              Cerrar expediente
            </button>
          </>
        )}
      </>,
    );
    return () => setHeaderActions(null);
  }, [setHeaderActions, exp, handleCerrar, handleUpload]);

  if (loading) return <GdLoading />;
  if (error) return <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>;
  if (!exp) return null;

  return (
    <div className="space-y-4">
      <GdCard title={`${exp.codigo} — ${exp.titulo}`}>
        <div className="grid gap-2 text-sm sm:grid-cols-2">
          <div>
            <span className="text-slate-500">Serie:</span> {exp.serie_codigo} — {exp.serie_nombre}
          </div>
          <div>
            <span className="text-slate-500">Etapa:</span> {exp.etapa_label}
          </div>
          <div>
            <span className="text-slate-500">Estado:</span> <GdBadge>{exp.estado_label}</GdBadge>
          </div>
          <div>
            <span className="text-slate-500">Soporte:</span> {exp.soporte}
          </div>
        </div>
      </GdCard>

      <GdCard title="Hoja de control — documentos">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs uppercase text-slate-500">
                <th className="py-2 pr-4">Nombre</th>
                <th className="py-2 pr-4">Versión</th>
                <th className="py-2 pr-4">SHA-256</th>
                <th className="py-2">Acción</th>
              </tr>
            </thead>
            <tbody>
              {exp.documentos.map((d) => (
                <tr key={d.id} className="border-b border-slate-100">
                  <td className="py-2 pr-4">{d.nombre}</td>
                  <td className="py-2 pr-4">v{d.version}</td>
                  <td className="py-2 pr-4 font-mono text-xs">{d.sha256.slice(0, 16)}…</td>
                  <td className="py-2">
                    {d.archivo_url && (
                      <button type="button" className="text-[#0e7490] hover:underline" onClick={() => openAuthenticatedFile(d.archivo_url!)}>
                        Abrir
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {exp.documentos.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-6 text-center text-slate-500">
                    Sin documentos en el expediente.
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
