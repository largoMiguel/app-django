import { useCallback, useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Mail, CheckCircle2, AlertTriangle, Loader2 } from "lucide-react";
import {
  googleIntegrationApi,
  type GoogleGmailStatus,
} from "@/core/api/googleIntegration";
import { formatApiError } from "@/core/api/errors";

export default function CorreoInstitucionalPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [status, setStatus] = useState<GoogleGmailStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const data = await googleIntegrationApi.status();
      setStatus(data);
    } catch (e) {
      setErr(formatApiError(e, "No se pudo cargar el estado de Gmail."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const connected = searchParams.get("connected");
    const error = searchParams.get("error");
    if (connected === "1") {
      setNotice("Gmail conectado correctamente.");
      setSearchParams({}, { replace: true });
      void load();
    } else if (error) {
      setErr(`Error al conectar Gmail: ${error}`);
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, setSearchParams, load]);

  async function handleConnect() {
    setBusy(true);
    setErr(null);
    try {
      const { authorize_url } = await googleIntegrationApi.connect();
      window.location.href = authorize_url;
    } catch (e) {
      setErr(formatApiError(e, "No se pudo iniciar la conexión con Google."));
      setBusy(false);
    }
  }

  async function handleDisconnect() {
    if (!window.confirm("¿Desconectar Gmail de este usuario?")) return;
    setBusy(true);
    setErr(null);
    try {
      await googleIntegrationApi.disconnect();
      setNotice("Gmail desconectado.");
      await load();
    } catch (e) {
      setErr(formatApiError(e, "No se pudo desconectar."));
    } finally {
      setBusy(false);
    }
  }

  const connected =
    status?.connected && !status.requires_reauthorization && status.google_email;

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <div className="mb-6">
        <Link to="/pqrs" className="text-sm text-slate-500 hover:text-slate-800">
          ← Volver a PQRS
        </Link>
        <h1 className="mt-2 text-2xl font-semibold text-slate-900">Correo institucional</h1>
        <p className="mt-1 text-sm text-slate-600">
          Conecte su cuenta Google institucional para enviar respuestas PQRS desde su propio
          correo (aparecerán en Enviados de Gmail).
        </p>
      </div>

      {notice && (
        <div className="mb-4 rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {notice}
        </div>
      )}
      {err && (
        <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {err}
        </div>
      )}

      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        {loading ? (
          <div className="flex items-center gap-2 text-slate-600">
            <Loader2 className="h-5 w-5 animate-spin" />
            Cargando…
          </div>
        ) : connected ? (
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="mt-0.5 h-6 w-6 text-emerald-600" />
              <div>
                <p className="font-medium text-slate-900">Gmail conectado</p>
                <p className="text-sm text-slate-600">{status?.google_email}</p>
                <p className="mt-1 text-xs text-emerald-700">Activo</p>
              </div>
            </div>
            <button
              type="button"
              disabled={busy}
              onClick={() => void handleDisconnect()}
              className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              {busy ? "Procesando…" : "DESCONECTAR"}
            </button>
          </div>
        ) : status?.requires_reauthorization ? (
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 h-6 w-6 text-amber-600" />
              <div>
                <p className="font-medium text-slate-900">Reautorización necesaria</p>
                <p className="text-sm text-slate-600">{status.google_email}</p>
              </div>
            </div>
            <button
              type="button"
              disabled={busy}
              onClick={() => void handleConnect()}
              className="rounded-md bg-[#3eafd4] px-4 py-2 text-sm font-semibold text-white hover:bg-[#35a0c4] disabled:opacity-50"
            >
              {busy ? "Redirigiendo…" : "CONECTAR CON GOOGLE"}
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <Mail className="mt-0.5 h-6 w-6 text-slate-500" />
              <p className="text-sm text-slate-700">Gmail no conectado</p>
            </div>
            <button
              type="button"
              disabled={busy}
              onClick={() => void handleConnect()}
              className="rounded-md bg-[#3eafd4] px-4 py-2 text-sm font-semibold text-white hover:bg-[#35a0c4] disabled:opacity-50"
            >
              {busy ? "Redirigiendo…" : "CONECTAR CON GOOGLE"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
