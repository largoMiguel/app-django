import { useCallback, useEffect, useRef, useState } from "react";
import {
  AlertCircle,
  Camera,
  CheckCircle2,
  Loader2,
  LogOut,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";
import {
  getKioskToken,
  kioskApi,
  setKioskToken,
  type KioskPunchResult,
  type KioskSession,
} from "@/core/api/asistencia";
import softoneLogo from "@/assets/logo_softone360.png";

type Feedback =
  | {
      kind: "success";
      title: string;
      tipo: string;
      hora: string;
      hint: string;
      progress: string;
    }
  | { kind: "error"; title: string; sub: string };

const SUCCESS_MS = 4500;

function uuidV4() {
  return crypto.randomUUID();
}

function formatTime(iso: string) {
  try {
    return new Date(iso).toLocaleTimeString("es-CO", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  } catch {
    return iso;
  }
}

export default function KioskPage() {
  const [token, setToken] = useState<string | null>(() => getKioskToken());
  const tokenRef = useRef<string | null>(token);
  const [session, setSession] = useState<KioskSession | null>(null);
  const [loadingSession, setLoadingSession] = useState(Boolean(getKioskToken()));
  const [pairCode, setPairCode] = useState("");
  const [pairing, setPairing] = useState(false);
  const [cedula, setCedula] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [clock, setClock] = useState(() => new Date());

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const cedulaRef = useRef<HTMLInputElement>(null);
  const submittingRef = useRef(false);
  const idempotencyRef = useRef<string | null>(null);
  const successTimerRef = useRef<number | null>(null);
  const cameraStartingRef = useRef(false);

  useEffect(() => {
    tokenRef.current = token;
  }, [token]);

  useEffect(() => {
    const id = window.setInterval(() => setClock(new Date()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setCameraReady(false);
  }, []);

  const startCamera = useCallback(async (attempt = 0): Promise<void> => {
    if (cameraStartingRef.current && attempt === 0) return;
    cameraStartingRef.current = true;
    setCameraError(null);

    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        setCameraError("Este navegador no permite acceso a la cámara.");
        return;
      }

      // Esperar a que el <video> esté en el DOM (evita fallo en el primer render).
      if (!videoRef.current) {
        if (attempt < 8) {
          await new Promise((r) => setTimeout(r, 120 + attempt * 40));
          return startCamera(attempt + 1);
        }
        setCameraError("No se pudo iniciar la vista de cámara. Pulse reintentar.");
        return;
      }

      if (streamRef.current) {
        const live = streamRef.current.getVideoTracks().some((t) => t.readyState === "live");
        if (live) {
          videoRef.current.srcObject = streamRef.current;
          try {
            await videoRef.current.play();
            setCameraReady(true);
            setCameraError(null);
          } catch {
            /* autoplay bloqueado temporalmente */
          }
          return;
        }
        stopCamera();
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "user",
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });
      streamRef.current = stream;

      const video = videoRef.current;
      if (!video) {
        stream.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
        if (attempt < 8) {
          await new Promise((r) => setTimeout(r, 150));
          return startCamera(attempt + 1);
        }
        setCameraError("Cámara obtenida pero la vista no está lista. Pulse reintentar.");
        return;
      }

      video.srcObject = stream;
      video.muted = true;
      video.setAttribute("playsinline", "true");
      await video.play();
      setCameraReady(true);
      setCameraError(null);
    } catch (err) {
      const name = err instanceof DOMException ? err.name : "";
      if (name === "NotAllowedError") {
        setCameraError("Permiso de cámara denegado. Active el permiso y pulse reintentar.");
      } else if (attempt < 3) {
        await new Promise((r) => setTimeout(r, 300 * (attempt + 1)));
        return startCamera(attempt + 1);
      } else {
        setCameraError("No se pudo acceder a la cámara. Pulse reintentar.");
      }
      setCameraReady(false);
    } finally {
      cameraStartingRef.current = false;
    }
  }, [stopCamera]);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    setLoadingSession(true);
    kioskApi
      .session(token)
      .then((data) => {
        if (!cancelled) setSession(data);
      })
      .catch(() => {
        if (!cancelled) {
          setKioskToken(null);
          setToken(null);
          setSession(null);
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingSession(false);
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  // Cámara solo al emparejar / montar kiosk — no al rotar token.
  useEffect(() => {
    if (!token || !session || loadingSession) return;
    const t = window.setTimeout(() => {
      void startCamera(0);
      cedulaRef.current?.focus();
    }, 80);
    return () => window.clearTimeout(t);
  }, [session?.equipo.id, loadingSession, token, session, startCamera]);

  useEffect(() => {
    return () => {
      stopCamera();
      if (successTimerRef.current) window.clearTimeout(successTimerRef.current);
    };
  }, [stopCamera]);

  function clearSuccessSoon() {
    if (successTimerRef.current) window.clearTimeout(successTimerRef.current);
    successTimerRef.current = window.setTimeout(() => {
      setFeedback(null);
      setCedula("");
      submittingRef.current = false;
      setSubmitting(false);
      idempotencyRef.current = null;
      cedulaRef.current?.focus();
    }, SUCCESS_MS);
  }

  function captureFrame(): string | null {
    const video = videoRef.current;
    if (!video || video.readyState < 2 || video.videoWidth === 0) return null;
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
    if (!pairCode.trim() || pairing) return;
    setPairing(true);
    setFeedback(null);
    try {
      const res = await kioskApi.pair(pairCode.trim());
      setKioskToken(res.device_token);
      tokenRef.current = res.device_token;
      setToken(res.device_token);
      setSession({
        equipo: res.equipo,
        entity: res.entity,
        asistencias_por_dia: res.asistencias_por_dia,
      });
      setPairCode("");
    } catch (err: unknown) {
      const data = (err as { response?: { data?: Record<string, unknown> } })?.response?.data;
      const detail =
        (typeof data?.pairing_code === "string" && data.pairing_code) ||
        (typeof data?.detail === "string" && data.detail) ||
        "Código inválido o expirado.";
      setFeedback({
        kind: "error",
        title: "No se pudo emparejar",
        sub: detail,
      });
    } finally {
      setPairing(false);
    }
  }

  async function handlePunch(e?: React.FormEvent) {
    e?.preventDefault();
    const currentToken = tokenRef.current;
    if (!currentToken || submittingRef.current || !cedula.trim()) return;
    if (feedback?.kind === "success") return;

    const foto = captureFrame();
    if (!foto) {
      setFeedback({
        kind: "error",
        title: "Cámara no lista",
        sub: cameraError || "Espere un segundo a que la cámara cargue y vuelva a intentar.",
      });
      void startCamera(0);
      return;
    }

    submittingRef.current = true;
    setSubmitting(true);
    setFeedback(null);
    if (!idempotencyRef.current) idempotencyRef.current = uuidV4();
    const key = idempotencyRef.current;

    try {
      const res: KioskPunchResult = await kioskApi.punch(currentToken, {
        cedula: cedula.trim(),
        foto_base64: foto,
        idempotency_key: key,
      });

      if (res.device_token) {
        setKioskToken(res.device_token);
        tokenRef.current = res.device_token;
        // No setToken: evita reiniciar cámara / sesión.
      }

      const hoy = res.marcaciones_hoy ?? 1;
      const total = res.marcaciones_totales ?? session?.asistencias_por_dia ?? 2;
      setFeedback({
        kind: "success",
        title: res.funcionario_nombre,
        tipo: res.tipo_label,
        hora: formatTime(res.hora),
        hint:
          res.hint ||
          (res.jornada_completa
            ? "Jornada completa por hoy."
            : `La próxima vez será: ${res.siguiente_tipo_label || "siguiente marcación"}.`),
        progress: `${hoy} de ${total}`,
      });
      setCedula("");
      clearSuccessSoon();
    } catch (err: unknown) {
      idempotencyRef.current = null;
      submittingRef.current = false;
      setSubmitting(false);
      const data = (err as { response?: { data?: Record<string, unknown> } })?.response?.data;
      let detail = "No se pudo registrar. Intente de nuevo.";
      if (typeof data?.detail === "string") detail = data.detail;
      else if (typeof data?.cedula === "string") detail = data.cedula;
      else if (Array.isArray(data?.cedula) && typeof data.cedula[0] === "string") {
        detail = data.cedula[0];
      }
      setFeedback({ kind: "error", title: "Registro no realizado", sub: detail });
    }
  }

  function handleLogout() {
    if (successTimerRef.current) window.clearTimeout(successTimerRef.current);
    stopCamera();
    setKioskToken(null);
    tokenRef.current = null;
    setToken(null);
    setSession(null);
    setFeedback(null);
    submittingRef.current = false;
    setSubmitting(false);
  }

  const jornadaLabel =
    session?.asistencias_por_dia === 4
      ? "Doble jornada · 4 marcaciones"
      : "Entrada y salida · 2 marcaciones";

  if (!token || loadingSession) {
    return (
      <div className="kiosk-shell flex min-h-screen items-center justify-center p-4 sm:p-8">
        <div className="w-full max-w-md overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl shadow-slate-200/60">
          <div className="bg-gradient-to-br from-brand-700 via-brand-600 to-brand-900 px-8 py-7 text-white">
            <div className="flex items-center gap-3">
              <img src={softoneLogo} alt="SoftOne360" className="h-10 w-10 rounded-xl bg-white/15 object-contain p-1" />
              <div>
                <p className="text-lg font-semibold tracking-tight">SoftOne360</p>
                <p className="text-xs text-white/70">Control de asistencia</p>
              </div>
            </div>
          </div>
          <div className="px-8 py-8">
            {loadingSession ? (
              <div className="flex flex-col items-center gap-3 py-6 text-slate-500">
                <Loader2 className="h-9 w-9 animate-spin text-brand-600" />
                <p className="text-sm">Verificando equipo…</p>
              </div>
            ) : (
              <>
                <div className="mb-6 text-center">
                  <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-xl bg-[#e8f6fa] text-[#0d6e8a]">
                    <ShieldCheck className="h-6 w-6" />
                  </div>
                  <h1 className="text-xl font-bold text-slate-900">Emparejar este equipo</h1>
                  <p className="mt-2 text-sm text-slate-500">
                    Ingrese el código de 6 dígitos generado en Asistencia → Equipos.
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
                    className="w-full rounded-xl border-2 border-slate-200 bg-slate-50 px-4 py-4 text-center font-mono text-3xl tracking-[0.35em] text-slate-900 outline-none transition focus:border-[#3eafd4] focus:bg-white focus:ring-2 focus:ring-[#3eafd4]/30"
                    autoFocus
                  />
                  <button
                    type="submit"
                    disabled={pairing || pairCode.length < 6}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#3eafd4] py-3.5 text-sm font-semibold text-white transition hover:bg-[#2f9fc2] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {pairing ? (
                      <>
                        <Loader2 className="h-5 w-5 animate-spin" /> Emparejando…
                      </>
                    ) : (
                      "Activar kiosk"
                    )}
                  </button>
                </form>
                {feedback?.kind === "error" && (
                  <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
                    <strong>{feedback.title}</strong>
                    <p className="mt-0.5">{feedback.sub}</p>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
        <style>{kioskShellCss}</style>
      </div>
    );
  }

  return (
    <div className="kiosk-shell relative min-h-screen">
      <header className="border-b border-slate-200/80 bg-white/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <img
              src={session?.entity.logo_url || softoneLogo}
              alt=""
              className="h-11 w-11 shrink-0 rounded-xl border border-slate-200 object-cover bg-white"
            />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-slate-900 sm:text-base">
                {session?.entity.name}
              </p>
              <p className="truncate text-xs text-slate-500">
                SoftOne360 · {session?.equipo.nombre}
                {session?.equipo.ubicacion ? ` · ${session.equipo.ubicacion}` : ""}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden text-right sm:block">
              <p className="font-mono text-lg font-semibold tabular-nums text-slate-800">
                {clock.toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
              </p>
              <p className="text-[11px] text-slate-400">{jornadaLabel}</p>
            </div>
            <button
              type="button"
              onClick={handleLogout}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50"
            >
              <LogOut className="h-3.5 w-3.5" /> Desvincular
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto grid max-w-6xl gap-5 p-4 sm:p-6 lg:grid-cols-[1.05fr_0.95fr] lg:gap-8 lg:p-8">
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="relative aspect-[4/3] bg-slate-900">
            <video
              ref={videoRef}
              playsInline
              muted
              autoPlay
              className="h-full w-full object-cover mirror"
            />
            <div className="pointer-events-none absolute inset-4 rounded-xl ring-2 ring-[#3eafd4]/35" />
            <div className="absolute left-3 top-3 rounded-full bg-white/95 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-700 shadow">
              SoftOne360
            </div>
            {cameraReady && !cameraError ? (
              <div className="absolute bottom-3 left-3 flex items-center gap-1.5 rounded-full bg-emerald-600/90 px-3 py-1 text-xs font-medium text-white">
                <Camera className="h-3.5 w-3.5" /> Cámara lista
              </div>
            ) : (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-slate-900/85 p-6 text-center">
                <p className="max-w-xs text-sm text-white/90">
                  {cameraError || "Iniciando cámara…"}
                </p>
                <button
                  type="button"
                  onClick={() => void startCamera(0)}
                  className="inline-flex items-center gap-2 rounded-lg bg-[#3eafd4] px-4 py-2 text-sm font-semibold text-white hover:bg-[#2f9fc2]"
                >
                  <RefreshCw className="h-4 w-4" /> Reintentar cámara
                </button>
              </div>
            )}
          </div>
        </section>

        <section className="flex flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#0d6e8a]">
            Registro de asistencia
          </p>
          <h2 className="mt-1 text-2xl font-bold text-slate-900 sm:text-3xl">
            Digite su cédula
          </h2>
          <p className="mt-2 text-sm text-slate-500">
            Pulse Enter o el botón. El sistema asigna automáticamente entrada o salida.
          </p>

          <form onSubmit={handlePunch} className="mt-6 flex flex-1 flex-col">
            <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Número de cédula
            </label>
            <input
              ref={cedulaRef}
              value={cedula}
              onChange={(e) => {
                if (submittingRef.current || feedback?.kind === "success") return;
                setCedula(e.target.value.replace(/\D/g, ""));
                if (feedback?.kind === "error") setFeedback(null);
              }}
              disabled={submitting || feedback?.kind === "success"}
              inputMode="numeric"
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
              placeholder="Ej. 1234567890"
              className="mt-2 w-full rounded-xl border-2 border-slate-200 bg-slate-50 px-4 py-4 text-2xl font-semibold tracking-wide text-slate-900 outline-none transition focus:border-[#3eafd4] focus:bg-white focus:ring-2 focus:ring-[#3eafd4]/25 disabled:opacity-60"
            />

            <button
              type="submit"
              disabled={submitting || !cedula.trim() || feedback?.kind === "success"}
              className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-[#3eafd4] py-4 text-lg font-semibold text-white shadow-md shadow-[#3eafd4]/25 transition hover:bg-[#2f9fc2] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitting ? (
                <>
                  <Loader2 className="h-6 w-6 animate-spin" /> Registrando…
                </>
              ) : (
                "Registrar asistencia"
              )}
            </button>

            <div className="mt-4 rounded-xl bg-slate-50 px-4 py-3 text-xs text-slate-500">
              <span className="font-semibold text-slate-700">Tip:</span> si ya marcó entrada, la
              siguiente será salida
              {session?.asistencias_por_dia === 4
                ? " (o salida/retorno de almuerzo según el orden del día)"
                : ""}
              .
            </div>
          </form>

          {feedback?.kind === "error" && (
            <div
              className="mt-4 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-red-800"
              role="alert"
            >
              <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
              <div>
                <p className="font-semibold">{feedback.title}</p>
                <p className="text-sm opacity-90">{feedback.sub}</p>
              </div>
            </div>
          )}
        </section>
      </main>

      {feedback?.kind === "success" && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/55 p-4 backdrop-blur-sm animate-in fade-in"
          role="alertdialog"
          aria-live="assertive"
        >
          <div className="w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="bg-gradient-to-br from-emerald-600 to-teal-600 px-6 py-8 text-center text-white">
              <CheckCircle2 className="mx-auto h-14 w-14" />
              <p className="mt-4 text-sm font-medium uppercase tracking-widest text-white/80">
                Registrado
              </p>
              <h3 className="mt-1 text-2xl font-bold sm:text-3xl">{feedback.title}</h3>
            </div>
            <div className="space-y-3 px-6 py-6 text-center">
              <p className="inline-flex rounded-full bg-[#e8f6fa] px-4 py-1.5 text-sm font-semibold text-[#0d6e8a]">
                {feedback.tipo}
              </p>
              <p className="text-2xl font-semibold tabular-nums text-slate-800">{feedback.hora}</p>
              <p className="text-sm text-slate-600">{feedback.hint}</p>
              <p className="text-xs text-slate-400">Marcación {feedback.progress} del día</p>
              <p className="pt-2 text-xs text-slate-400">
                Volviendo al inicio en unos segundos…
              </p>
            </div>
          </div>
        </div>
      )}

      <footer className="pb-4 text-center text-[11px] text-slate-400">
        SoftOne360 · app.softone360.com
      </footer>
      <style>{kioskShellCss}</style>
    </div>
  );
}

const kioskShellCss = `
  .kiosk-shell {
    background:
      radial-gradient(ellipse 70% 45% at 15% -10%, rgba(62, 175, 212, 0.18), transparent 55%),
      radial-gradient(ellipse 50% 40% at 100% 0%, rgba(37, 99, 235, 0.10), transparent 50%),
      #f8fafc;
    font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
  }
  .mirror { transform: scaleX(-1); }
`;
