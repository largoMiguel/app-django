import { useCallback, useEffect, useRef, useState } from "react";
import {
  Camera,
  CheckCircle2,
  Loader2,
  LogOut,
  ScanLine,
  ShieldCheck,
  AlertCircle,
} from "lucide-react";
import {
  getKioskToken,
  kioskApi,
  setKioskToken,
  type KioskSession,
} from "@/core/api/asistencia";

type Feedback =
  | { kind: "success"; title: string; sub: string }
  | { kind: "error"; title: string; sub: string };

function uuidV4() {
  return crypto.randomUUID();
}

export default function KioskPage() {
  const [token, setToken] = useState<string | null>(() => getKioskToken());
  const [session, setSession] = useState<KioskSession | null>(null);
  const [loadingSession, setLoadingSession] = useState(Boolean(getKioskToken()));
  const [pairCode, setPairCode] = useState("");
  const [pairing, setPairing] = useState(false);
  const [cedula, setCedula] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const cedulaRef = useRef<HTMLInputElement>(null);
  const idempotencyRef = useRef<string | null>(null);

  const startCamera = useCallback(async () => {
    setCameraError(null);
    try {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
    } catch {
      setCameraError("No se pudo acceder a la cámara. Verifique permisos del navegador.");
    }
  }, []);

  useEffect(() => {
    if (!token) return;
    setLoadingSession(true);
    kioskApi
      .session(token)
      .then(setSession)
      .catch(() => {
        setKioskToken(null);
        setToken(null);
        setSession(null);
      })
      .finally(() => setLoadingSession(false));
  }, [token]);

  useEffect(() => {
    if (token && session) {
      startCamera();
      cedulaRef.current?.focus();
    }
    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, [token, session, startCamera]);

  useEffect(() => {
    if (feedback?.kind === "success") {
      const t = setTimeout(() => setFeedback(null), 5000);
      return () => clearTimeout(t);
    }
  }, [feedback]);

  function captureFrame(): string | null {
    const video = videoRef.current;
    if (!video || video.videoWidth === 0) return null;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(video, 0, 0);
    return canvas.toDataURL("image/jpeg", 0.85);
  }

  async function handlePair(e: React.FormEvent) {
    e.preventDefault();
    if (!pairCode.trim()) return;
    setPairing(true);
    setFeedback(null);
    try {
      const res = await kioskApi.pair(pairCode.trim());
      setKioskToken(res.device_token);
      setToken(res.device_token);
      setSession({
        equipo: res.equipo,
        entity: res.entity,
        asistencias_por_dia: res.asistencias_por_dia,
      });
      setPairCode("");
    } catch (err: unknown) {
      const detail =
        (err as { response?: { data?: { pairing_code?: string; detail?: string } } })?.response
          ?.data?.pairing_code ||
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
        "Código inválido o expirado.";
      setFeedback({
        kind: "error",
        title: "Emparejamiento fallido",
        sub: typeof detail === "string" ? detail : "Revise el código e intente de nuevo.",
      });
    } finally {
      setPairing(false);
    }
  }

  async function handlePunch(e?: React.FormEvent) {
    e?.preventDefault();
    if (!token || submitting || !cedula.trim()) return;

    const foto = captureFrame();
    if (!foto) {
      setFeedback({
        kind: "error",
        title: "Foto requerida",
        sub: cameraError || "Espere a que la cámara esté lista.",
      });
      return;
    }

    if (!idempotencyRef.current) {
      idempotencyRef.current = uuidV4();
    }

    setSubmitting(true);
    setFeedback(null);
    try {
      const res = await kioskApi.punch(token, {
        cedula: cedula.trim(),
        foto_base64: foto,
        idempotency_key: idempotencyRef.current,
      });
      if (res.device_token) {
        setKioskToken(res.device_token);
        setToken(res.device_token);
      }
      idempotencyRef.current = null;
      setFeedback({
        kind: "success",
        title: res.funcionario_nombre,
        sub: `${res.tipo_label} — ${new Date(res.hora).toLocaleTimeString()}`,
      });
      setCedula("");
      cedulaRef.current?.focus();
    } catch (err: unknown) {
      idempotencyRef.current = null;
      const data = (err as { response?: { data?: Record<string, unknown> } })?.response?.data;
      const detail =
        (typeof data?.detail === "string" && data.detail) ||
        (typeof data?.cedula === "string" && data.cedula) ||
        "No se pudo registrar. Intente de nuevo.";
      setFeedback({ kind: "error", title: "Registro no realizado", sub: detail });
    } finally {
      setSubmitting(false);
    }
  }

  function handleLogout() {
    setKioskToken(null);
    setToken(null);
    setSession(null);
    streamRef.current?.getTracks().forEach((t) => t.stop());
  }

  if (!token || loadingSession) {
    return (
      <div className="kiosk-root flex min-h-screen items-center justify-center p-6">
        <div className="kiosk-panel w-full max-w-md p-8">
          {loadingSession ? (
            <div className="flex flex-col items-center gap-4 py-8 text-[var(--kiosk-muted)]">
              <Loader2 className="h-10 w-10 animate-spin text-[var(--kiosk-accent)]" />
              <p>Verificando equipo…</p>
            </div>
          ) : (
            <>
              <div className="mb-8 text-center">
                <ShieldCheck className="mx-auto h-12 w-12 text-[var(--kiosk-accent)]" />
                <h1 className="kiosk-title mt-4 text-2xl">Emparejar equipo</h1>
                <p className="mt-2 text-sm text-[var(--kiosk-muted)]">
                  Ingrese el código de 6 dígitos generado desde el panel de Asistencia.
                </p>
              </div>
              <form onSubmit={handlePair} className="space-y-4">
                <input
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={8}
                  value={pairCode}
                  onChange={(e) => setPairCode(e.target.value.replace(/\D/g, ""))}
                  placeholder="000000"
                  className="kiosk-input text-center text-3xl tracking-[0.4em]"
                  autoFocus
                />
                <button type="submit" disabled={pairing || pairCode.length < 6} className="kiosk-btn w-full">
                  {pairing ? (
                    <>
                      <Loader2 className="h-5 w-5 animate-spin" /> Emparejando…
                    </>
                  ) : (
                    "Activar kiosk"
                  )}
                </button>
              </form>
              {feedback && (
                <div
                  className={`mt-4 rounded-lg px-4 py-3 text-sm ${
                    feedback.kind === "error"
                      ? "bg-red-500/15 text-red-100"
                      : "bg-emerald-500/15 text-emerald-100"
                  }`}
                >
                  <strong>{feedback.title}</strong>
                  <p className="mt-0.5 opacity-90">{feedback.sub}</p>
                </div>
              )}
            </>
          )}
        </div>
        <style>{kioskStyles}</style>
      </div>
    );
  }

  return (
    <div className="kiosk-root min-h-screen">
      <header className="kiosk-header flex items-center justify-between px-6 py-4">
        <div className="flex items-center gap-4">
          {session?.entity.logo_url && (
            <img
              src={session.entity.logo_url}
              alt=""
              className="h-10 w-10 rounded-full object-cover ring-2 ring-white/20"
            />
          )}
          <div>
            <p className="text-xs uppercase tracking-widest text-[var(--kiosk-muted)]">SoftOne</p>
            <h1 className="kiosk-title text-lg">{session?.entity.name}</h1>
            <p className="text-xs text-[var(--kiosk-muted)]">
              {session?.equipo.nombre}
              {session?.equipo.ubicacion ? ` · ${session.equipo.ubicacion}` : ""}
            </p>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-[var(--kiosk-muted)] hover:bg-white/10 hover:text-white"
        >
          <LogOut className="h-4 w-4" /> Desvincular
        </button>
      </header>

      <main className="mx-auto grid max-w-6xl gap-6 p-6 lg:grid-cols-2 lg:gap-8 lg:p-8">
        <section className="kiosk-panel overflow-hidden">
          <div className="relative aspect-[4/3] bg-black">
            <video
              ref={videoRef}
              playsInline
              muted
              className="h-full w-full object-cover mirror"
            />
            <div className="pointer-events-none absolute inset-0 border-2 border-[var(--kiosk-accent)]/40 m-4 rounded-lg" />
            {!cameraError ? (
              <div className="absolute bottom-3 left-3 flex items-center gap-2 rounded-full bg-black/60 px-3 py-1 text-xs text-white">
                <Camera className="h-3.5 w-3.5 text-emerald-400" /> Cámara activa
              </div>
            ) : (
              <div className="absolute inset-0 flex items-center justify-center bg-black/80 p-6 text-center text-sm text-red-200">
                {cameraError}
              </div>
            )}
          </div>
        </section>

        <section className="kiosk-panel flex flex-col p-6 lg:p-8">
          <ScanLine className="h-8 w-8 text-[var(--kiosk-accent)]" />
          <h2 className="kiosk-title mt-3 text-2xl">Registrar asistencia</h2>
          <p className="mt-1 text-sm text-[var(--kiosk-muted)]">
            Digite la cédula y pulse Enter. El tipo se asigna automáticamente (
            {session?.asistencias_por_dia === 4 ? "4 marcaciones" : "2 marcaciones"} por día).
          </p>

          <form onSubmit={handlePunch} className="mt-8 flex flex-1 flex-col">
            <label className="text-xs font-semibold uppercase tracking-wide text-[var(--kiosk-muted)]">
              Cédula del funcionario
            </label>
            <input
              ref={cedulaRef}
              value={cedula}
              onChange={(e) => setCedula(e.target.value.replace(/\s/g, ""))}
              disabled={submitting}
              inputMode="numeric"
              autoComplete="off"
              placeholder="Ej. 1234567890"
              className="kiosk-input mt-2 text-2xl"
            />

            <button
              type="submit"
              disabled={submitting || !cedula.trim()}
              className="kiosk-btn mt-6 w-full py-4 text-lg"
            >
              {submitting ? (
                <>
                  <Loader2 className="h-6 w-6 animate-spin" /> Registrando…
                </>
              ) : (
                "Registrar"
              )}
            </button>
          </form>

          {feedback && (
            <div
              className={`mt-6 flex items-start gap-3 rounded-xl px-4 py-4 ${
                feedback.kind === "success"
                  ? "bg-emerald-500/20 text-emerald-50"
                  : "bg-red-500/20 text-red-50"
              }`}
              role="alert"
            >
              {feedback.kind === "success" ? (
                <CheckCircle2 className="h-6 w-6 shrink-0 text-emerald-300" />
              ) : (
                <AlertCircle className="h-6 w-6 shrink-0 text-red-300" />
              )}
              <div>
                <p className="font-semibold text-lg">{feedback.title}</p>
                <p className="text-sm opacity-90">{feedback.sub}</p>
              </div>
            </div>
          )}
        </section>
      </main>
      <style>{kioskStyles}</style>
    </div>
  );
}

const kioskStyles = `
  @import url('https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,400;9..40,600;9..40,700&family=Instrument+Serif&display=swap');

  .kiosk-root {
    --kiosk-bg: #0a1628;
    --kiosk-panel: rgba(255,255,255,0.06);
    --kiosk-border: rgba(255,255,255,0.12);
    --kiosk-text: #f0f4f8;
    --kiosk-muted: rgba(240,244,248,0.65);
    --kiosk-accent: #2eb8d4;
    font-family: 'DM Sans', system-ui, sans-serif;
    color: var(--kiosk-text);
    background:
      radial-gradient(ellipse 80% 50% at 50% -20%, rgba(46,184,212,0.25), transparent),
      radial-gradient(ellipse 60% 40% at 100% 100%, rgba(13,110,138,0.2), transparent),
      var(--kiosk-bg);
  }
  .kiosk-title { font-family: 'Instrument Serif', Georgia, serif; font-weight: 400; }
  .kiosk-header { border-bottom: 1px solid var(--kiosk-border); backdrop-filter: blur(8px); }
  .kiosk-panel {
    background: var(--kiosk-panel);
    border: 1px solid var(--kiosk-border);
    border-radius: 1rem;
    backdrop-filter: blur(12px);
  }
  .kiosk-input {
    width: 100%;
    border-radius: 0.75rem;
    border: 2px solid var(--kiosk-border);
    background: rgba(0,0,0,0.25);
    padding: 1rem 1.25rem;
    color: var(--kiosk-text);
    outline: none;
    transition: border-color 0.2s;
  }
  .kiosk-input:focus { border-color: var(--kiosk-accent); }
  .kiosk-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    border-radius: 0.75rem;
    background: linear-gradient(135deg, #2eb8d4, #0d6e8a);
    font-weight: 600;
    color: white;
    transition: opacity 0.2s, transform 0.15s;
  }
  .kiosk-btn:hover:not(:disabled) { transform: translateY(-1px); }
  .kiosk-btn:disabled { opacity: 0.5; cursor: not-allowed; }
  .mirror { transform: scaleX(-1); }
`;
