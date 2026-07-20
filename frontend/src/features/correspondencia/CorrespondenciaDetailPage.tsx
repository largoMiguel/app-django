import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Paperclip, Trash2 } from "lucide-react";
import {
  correspondenciaApi,
  type CorrespondenciaDetail,
} from "@/core/api/correspondencia";
import { formatApiError } from "@/core/api/errors";

function slaBadge(status: CorrespondenciaDetail["sla_status"]) {
  const map = {
    en_plazo: "bg-emerald-50 text-emerald-700",
    por_vencer: "bg-amber-50 text-amber-700",
    vencida: "bg-red-50 text-red-700",
    cerrado: "bg-slate-100 text-slate-600",
  } as const;
  const labels = {
    en_plazo: "En plazo",
    por_vencer: "Por vencer",
    vencida: "Vencida",
    cerrado: "Cerrado",
  } as const;
  return (
    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${map[status]}`}>
      {labels[status]}
    </span>
  );
}

export default function CorrespondenciaDetailPage() {
  const { id } = useParams();
  const [item, setItem] = useState<CorrespondenciaDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [respuesta, setRespuesta] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() {
    if (!id) return;
    setLoading(true);
    try {
      const data = await correspondenciaApi.get(Number(id));
      setItem(data);
      setRespuesta(data.respuesta_texto || "");
      setError(null);
    } catch (err) {
      setError(formatApiError(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [id]);

  async function handleResponder() {
    if (!item) return;
    setBusy(true);
    try {
      setItem(await correspondenciaApi.responder(item.id, respuesta));
    } catch (err) {
      setError(formatApiError(err));
    } finally {
      setBusy(false);
    }
  }

  async function handleCerrar() {
    if (!item) return;
    setBusy(true);
    try {
      setItem(await correspondenciaApi.cerrar(item.id));
    } catch (err) {
      setError(formatApiError(err));
    } finally {
      setBusy(false);
    }
  }

  async function handleUpload(file: File | null, tipo: string) {
    if (!item || !file) return;
    setBusy(true);
    try {
      await correspondenciaApi.uploadAnexo(item.id, file, tipo);
      await load();
    } catch (err) {
      setError(formatApiError(err));
    } finally {
      setBusy(false);
    }
  }

  async function handleDeleteAnexo(anexoId: number) {
    if (!item) return;
    setBusy(true);
    try {
      await correspondenciaApi.deleteAnexo(item.id, anexoId);
      await load();
    } catch (err) {
      setError(formatApiError(err));
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <div className="py-12 text-center text-slate-500">Cargando…</div>;
  if (error && !item) {
    return (
      <div className="rounded-[0.3rem] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
        {error}
      </div>
    );
  }
  if (!item) return null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          to={`/correspondencia/${item.sentido}`}
          className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-[#0e7490]"
        >
          <ArrowLeft className="h-4 w-4" /> Volver
        </Link>
        <div className="flex items-center gap-2">
          {slaBadge(item.sla_status)}
          <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600">
            {item.estado_label}
          </span>
        </div>
      </div>

      {error && (
        <div className="rounded-[0.3rem] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="rounded-xl border-l-4 border-l-[#3eafd4] bg-white p-5 shadow-sm">
        <div className="font-mono text-sm text-[#0e7490]">{item.numero_radicado}</div>
        <h2 className="mt-1 text-xl font-bold text-[#111827]">{item.asunto}</h2>
        <p className="mt-2 text-sm text-slate-600">{item.descripcion || "Sin descripción."}</p>
        <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <div className="text-xs uppercase text-slate-400">Sentido</div>
            <div className="capitalize text-slate-800">{item.sentido}</div>
          </div>
          <div>
            <div className="text-xs uppercase text-slate-400">Tipología</div>
            <div className="text-slate-800">{item.tipologia_label}</div>
          </div>
          <div>
            <div className="text-xs uppercase text-slate-400">Secretaría</div>
            <div className="text-slate-800">{item.secretaria_nombre}</div>
          </div>
          <div>
            <div className="text-xs uppercase text-slate-400">Remitente</div>
            <div className="text-slate-800">{item.remitente_nombre}</div>
          </div>
          <div>
            <div className="text-xs uppercase text-slate-400">Destinatario</div>
            <div className="text-slate-800">{item.destinatario_nombre}</div>
          </div>
          <div>
            <div className="text-xs uppercase text-slate-400">Vencimiento</div>
            <div className="text-slate-800">
              {new Date(item.fecha_vencimiento).toLocaleDateString("es-CO")} ({item.dias_habiles_respuesta}{" "}
              hábiles)
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="mb-3 font-semibold text-[#111827]">Anexos</h3>
          <div className="mb-3 flex flex-wrap gap-2">
            <label className="cursor-pointer rounded-[0.3rem] border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50">
              <Paperclip className="mr-1 inline h-3.5 w-3.5" />
              Solicitud
              <input
                type="file"
                className="hidden"
                onChange={(e) => handleUpload(e.target.files?.[0] || null, "solicitud")}
              />
            </label>
            <label className="cursor-pointer rounded-[0.3rem] border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50">
              <Paperclip className="mr-1 inline h-3.5 w-3.5" />
              Respuesta
              <input
                type="file"
                className="hidden"
                onChange={(e) => handleUpload(e.target.files?.[0] || null, "respuesta")}
              />
            </label>
          </div>
          <ul className="divide-y divide-slate-100 text-sm">
            {item.anexos.length === 0 ? (
              <li className="py-3 text-slate-400">Sin anexos.</li>
            ) : (
              item.anexos.map((a) => (
                <li key={a.id} className="flex items-center justify-between gap-2 py-2">
                  <div>
                    <div className="font-medium text-slate-800">{a.nombre}</div>
                    <div className="text-xs text-slate-400">{a.tipo}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    {a.url && (
                      <a
                        href={a.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs font-medium text-[#3eafd4] hover:underline focus:outline-none"
                      >
                        Ver
                      </a>
                    )}
                    <button
                      onClick={() => handleDeleteAnexo(a.id)}
                      disabled={busy}
                      className="text-slate-400 hover:text-red-500"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </li>
              ))
            )}
          </ul>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="mb-3 font-semibold text-[#111827]">Responder / cerrar</h3>
          <textarea
            rows={5}
            value={respuesta}
            onChange={(e) => setRespuesta(e.target.value)}
            placeholder="Texto de respuesta oficial…"
            className="w-full rounded-[0.3rem] border border-slate-300 px-3 py-2 text-sm"
          />
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              onClick={handleResponder}
              disabled={busy || !respuesta.trim()}
              className="rounded-[0.3rem] bg-[#3eafd4] px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
            >
              Guardar respuesta
            </button>
            <button
              onClick={handleCerrar}
              disabled={busy}
              className="rounded-[0.3rem] border border-slate-200 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50"
            >
              Cerrar radicado
            </button>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="mb-3 font-semibold text-[#111827]">Historial</h3>
        <ol className="space-y-3">
          {item.eventos.map((ev) => (
            <li key={ev.id} className="border-l-2 border-[#3eafd4]/40 pl-3 text-sm">
              <div className="font-medium text-slate-800">{ev.tipo.replace(/_/g, " ")}</div>
              <div className="text-xs text-slate-500">
                {new Date(ev.created_at).toLocaleString("es-CO")}
                {ev.actor_nombre ? ` · ${ev.actor_nombre}` : ""}
              </div>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
