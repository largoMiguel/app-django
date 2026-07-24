import { useCallback, useEffect, useRef, useState } from "react";
import {
  AlertCircle,
  Camera,
  CheckCircle2,
  Loader2,
  LogOut,
  RefreshCw,
  ScanFace,
  ShieldCheck,
} from "lucide-react";
import {
  getKioskToken,
  kioskApi,
  setKioskToken,
  type KioskPunchResult,
  type KioskSession,
} from "@/core/api/asistencia";
import {
  captureFace,
  captureFrameBase64,
  detectLandmarks,
  detectPersonPresent,
  loadFaceModels,
  livenessHint,
  LivenessTracker,
  openCameraStream,
} from "@/core/face/faceApi";
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
  | { kind: "already"; title: string; sub: string }
  | { kind: "error"; title: string; sub: string };

const DETECT_INTERVAL_MS = 70;

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

function isAlreadyRegisteredError(data: Record<string, unknown> | undefined): boolean {
  if (!data) return false;
  if (data.code === "already_registered") return true;
  const detail = data.detail;
  return typeof detail === "string" && /ya registr/i.test(detail);
}

function applyPunchResult(
  res: KioskPunchResult,
  session: KioskSession | null,
  setFeedback: (f: Feedback) => void,
  setKioskTokenFn: (t: string) => void,
  tokenRef: React.MutableRefObject<string | null>,
) {
  if (res.device_token) {
    setKioskTokenFn(res.device_token);
    tokenRef.current = res.device_token;
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
        : `Próxima marcación (después de 5 min): ${res.siguiente_tipo_label || "siguiente"}.`),
    progress: `${hoy} de ${total}`,
  });
}

export default function KioskPage() {
  const [token, setToken] = useState<string | null>(() => getKioskToken());
  const tokenRef = useRef<string | null>(token);
  const [session, setSession] = useState<KioskSession | null>(null);
  const [loadingSession, setLoadingSession] = useState(Boolean(getKioskToken()));
  const [pairCode, setPairCode] = useState("");
  const [pairing, setPairing] = useState(false);
  const [fallbackMode, setFallbackMode] = useState(false);
  const [cedula, setCedula] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [modelsReady, setModelsReady] = useState(false);
  const [modelProgress, setModelProgress] = useState("Preparando reconocimiento…");
  const [livenessHintText, setLivenessHintText] = useState("Preparando reconocimiento…");
  const [clock, setClock] = useState(() => new Date());

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const cedulaRef = useRef<HTMLInputElement>(null);
  const submittingRef = useRef(false);
  const idempotencyRef = useRef<string | null>(null);
  const cameraStartingRef = useRef(false);
  const livenessRef = useRef(new LivenessTracker());
  const lastScanRef = useRef(0);
  const lockedRef = useRef(false); // tras éxito: no volver a escanear hasta reload

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
            /* autoplay blocked */
          }
          return;
        }
        stopCamera();
      }

      const stream = await openCameraStream();
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

  useEffect(() => {
    if (!token || !session || loadingSession || lockedRef.current) return;
    let cancelled = false;
    setModelProgress("Iniciando…");
    void loadFaceModels((p) => {
      if (!cancelled) setModelProgress(`${p.phase}${p.backend ? ` · ${p.backend}` : ""}`);
    })
      .then(() => {
        if (!cancelled) {
          setModelsReady(true);
          setModelProgress("Listo para reconocer");
          setLivenessHintText("Mire a la cámara y parpadee");
        }
      })
      .catch((err) => {
        if (!cancelled) {
          const msg =
            err instanceof Error
              ? err.message
              : "No se pudieron cargar los modelos faciales.";
          setCameraError(msg);
          setModelProgress("Error cargando modelos");
        }
      });
    const t = window.setTimeout(() => {
      void startCamera(0);
    }, 80);
    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
  }, [session?.equipo.id, loadingSession, token, session, startCamera]);

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, [stopCamera]);

  function lockSessionAfterSuccess() {
    lockedRef.current = true;
    submittingRef.current = true;
    setSubmitting(false);
    idempotencyRef.current = null;
    stopCamera();
  }

  const handleFacialPunch = useCallback(async (descriptor: number[]) => {
    const currentToken = tokenRef.current;
    if (!currentToken || submittingRef.current || lockedRef.current) return;
    if (feedback?.kind === "success" || feedback?.kind === "already") return;

    submittingRef.current = true;
    setSubmitting(true);
    setFeedback(null);
    if (!idempotencyRef.current) idempotencyRef.current = uuidV4();

    try {
      const res = await kioskApi.punchFacial(currentToken, {
        descriptor,
        idempotency_key: idempotencyRef.current,
        liveness_passed: true,
      });
      applyPunchResult(res, session, setFeedback, setKioskToken, tokenRef);
      lockSessionAfterSuccess();
    } catch (err: unknown) {
      idempotencyRef.current = null;
      submittingRef.current = false;
      setSubmitting(false);
      livenessRef.current.reset();
      const data = (err as { response?: { data?: Record<string, unknown>; status?: number } })
        ?.response?.data;
      const status = (err as { response?: { status?: number } })?.response?.status;
      let detail = "No se pudo registrar. Intente de nuevo.";
      if (typeof data?.detail === "string") detail = data.detail;
      if (isAlreadyRegisteredError(data)) {
        setFeedback({
          kind: "already",
          title: "Ya registró su asistencia",
          sub: detail,
        });
        stopCamera();
        lockedRef.current = true;
        return;
      }
      setFeedback({
        kind: "error",
        title: status === 404 ? "Rostro no reconocido" : "Registro no realizado",
        sub: detail,
      });
    }
  }, [feedback?.kind, session, stopCamera]);

  useEffect(() => {
    if (
      fallbackMode ||
      !cameraReady ||
      !modelsReady ||
      submitting ||
      lockedRef.current ||
      feedback?.kind === "success" ||
      feedback?.kind === "already"
    ) {
      return;
    }
    let cancelled = false;
    let timer = 0;

    const tick = async () => {
      if (cancelled || submittingRef.current || lockedRef.current) return;
      const video = videoRef.current;
      if (!video || video.readyState < 2) {
        timer = window.setTimeout(tick, DETECT_INTERVAL_MS);
        return;
      }
      try {
        const landmarks = await detectLandmarks(video);
        if (cancelled || submittingRef.current || lockedRef.current) return;
        if (!landmarks) {
          const state = livenessRef.current.noteMiss();
          setLivenessHintText(livenessHint(state === "need_face" ? "need_face" : state));
        } else {
          const state = livenessRef.current.update(landmarks);
          setLivenessHintText(livenessHint(state));
          if (state === "passed") {
            lastScanRef.current = Date.now();
            const face = await captureFace(video);
            if (face && !cancelled && !submittingRef.current && !lockedRef.current) {
              void handleFacialPunch(face.descriptor);
              return;
            }
            livenessRef.current.reset();
          }
        }
      } catch {
        /* frame skip */
      }
      if (!cancelled && !submittingRef.current && !lockedRef.current) {
        timer = window.setTimeout(tick, DETECT_INTERVAL_MS);
      }
    };

    timer = window.setTimeout(tick, 40);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [
    fallbackMode,
    cameraReady,
    modelsReady,
    submitting,
    feedback?.kind,
    handleFacialPunch,
  ]);

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
      setFeedback({ kind: "error", title: "No se pudo emparejar", sub: detail });
    } finally {
      setPairing(false);
    }
  }

  async function handlePunchCedula(e?: React.FormEvent) {
    e?.preventDefault();
    const currentToken = tokenRef.current;
    if (!currentToken || submittingRef.current || lockedRef.current || !cedula.trim()) return;
    if (feedback?.kind === "success" || feedback?.kind === "already") return;

    const video = videoRef.current;
    if (!video) {
      setFeedback({
        kind: "error",
        title: "Cámara no lista",
        sub: cameraError || "Espere a que la cámara cargue.",
      });
      return;
    }

    // Modo emergencia: exige una persona frente a la cámara.
    const present = await detectPersonPresent(video);
    if (!present) {
      setFeedback({
        kind: "error",
        title: "No hay persona en cámara",
        sub: "Colóquese frente al kiosco para registrar con cédula.",
      });
      return;
    }

    const foto = captureFrameBase64(video);
    if (!foto) {
      setFeedback({
        kind: "error",
        title: "Cámara no lista",
        sub: cameraError || "Espere a que la cámara cargue.",
      });
      return;
    }

    submittingRef.current = true;
    setSubmitting(true);
    setFeedback(null);
    if (!idempotencyRef.current) idempotencyRef.current = uuidV4();

    try {
      const res = await kioskApi.punch(currentToken, {
        cedula: cedula.trim(),
        foto_base64: foto,
        idempotency_key: idempotencyRef.current,
      });
      applyPunchResult(res, session, setFeedback, setKioskToken, tokenRef);
      setCedula("");
      lockSessionAfterSuccess();
    } catch (err: unknown) {
      idempotencyRef.current = null;
      submittingRef.current = false;
      setSubmitting(false);
      const data = (err as { response?: { data?: Record<string, unknown> } })?.response?.data;
      let detail = "No se pudo registrar. Intente de nuevo.";
      if (typeof data?.detail === "string") detail = data.detail;
      else if (typeof data?.cedula === "string") detail = data.cedula;
      if (isAlreadyRegisteredError(data)) {
        setFeedback({
          kind: "already",
          title: "Ya registró su asistencia",
          sub: detail,
        });
        stopCamera();
        lockedRef.current = true;
        return;
      }
      setFeedback({ kind: "error", title: "Registro no realizado", sub: detail });
    }
  }

  function handleLogout() {
    stopCamera();
    setKioskToken(null);
    tokenRef.current = null;
    setToken(null);
    setSession(null);
    setFeedback(null);
    submittingRef.current = false;
    lockedRef.current = false;
    setSubmitting(false);
    setFallbackMode(false);
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
              className="h-11 w-11 shrink-0 rounded-xl border border-slate-200 bg-white object-cover"
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
                {clock.toLocaleTimeString("es-CO", {
                  hour: "2-digit",
                  minute: "2-digit",
                  second: "2-digit",
                })}
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
        {feedback?.kind === "success" ? (
          <section className="col-span-full flex min-h-[70vh] flex-col items-center justify-center rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-600 to-teal-600 px-6 py-14 text-center text-white shadow-lg">
            <CheckCircle2 className="h-20 w-20" />
            <p className="mt-5 text-sm font-medium uppercase tracking-widest text-white/80">
              Registrado correctamente
            </p>
            <h3 className="mt-2 text-3xl font-bold sm:text-4xl">{feedback.title}</h3>
            <p className="mt-4 text-2xl font-semibold text-white/95">
              {feedback.tipo}
              <span className="mx-2 text-white/50">·</span>
              {feedback.hora}
            </p>
            <p className="mt-4 max-w-md text-base text-white/90">{feedback.hint}</p>
            <p className="mt-2 text-sm text-white/75">Marcaciones hoy: {feedback.progress}</p>
            <div className="mt-10 rounded-xl bg-white/15 px-5 py-4 text-sm text-white/95 backdrop-blur">
              <p className="font-semibold">Cámara cerrada</p>
              <p className="mt-1 text-white/80">
                Recargue la página (F5) para registrar a otra persona.
              </p>
              <p className="mt-1 text-xs text-white/70">
                La misma persona debe esperar al menos 5 minutos para la siguiente marcación.
              </p>
            </div>
          </section>
        ) : feedback?.kind === "already" ? (
          <section className="col-span-full flex min-h-[70vh] flex-col items-center justify-center rounded-2xl border border-amber-300 bg-gradient-to-br from-amber-500 to-orange-600 px-6 py-14 text-center text-white shadow-lg">
            <AlertCircle className="h-20 w-20" />
            <p className="mt-5 text-sm font-medium uppercase tracking-widest text-white/85">
              Atención
            </p>
            <h3 className="mt-2 text-3xl font-bold sm:text-4xl">{feedback.title}</h3>
            <p className="mt-4 max-w-lg text-lg text-white/95">{feedback.sub}</p>
            <div className="mt-10 rounded-xl bg-white/15 px-5 py-4 text-sm text-white/95 backdrop-blur">
              <p className="font-semibold">No se registró una nueva marcación</p>
              <p className="mt-1 text-white/80">
                Recargue la página (F5) para continuar con otra persona.
              </p>
            </div>
          </section>
        ) : (
          <>
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
                  {fallbackMode ? "Modo cédula" : "Reconocimiento facial"}
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
              {!fallbackMode ? (
                <>
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#0d6e8a]">
                    Registro automático
                  </p>
                  <h2 className="mt-1 flex items-center gap-2 text-2xl font-bold text-slate-900 sm:text-3xl">
                    <ScanFace className="h-7 w-7 text-[#3eafd4]" />
                    Reconocimiento facial
                  </h2>
                  <p className="mt-2 text-sm text-slate-500">
                    Mire a la cámara y parpadee; el registro es automático (sin guardar foto).
                  </p>

                  <div className="mt-6 flex flex-1 flex-col justify-center rounded-xl bg-slate-50 px-4 py-6 text-center">
                    {submitting ? (
                      <div className="flex flex-col items-center gap-3 text-slate-600">
                        <Loader2 className="h-10 w-10 animate-spin text-[#3eafd4]" />
                        <p className="font-medium">Registrando asistencia…</p>
                      </div>
                    ) : !modelsReady ? (
                      <div className="flex flex-col items-center gap-3 text-slate-600">
                        <Loader2 className="h-10 w-10 animate-spin text-[#3eafd4]" />
                        <p className="font-medium">Preparando reconocimiento</p>
                        <p className="max-w-sm text-sm text-slate-500">{modelProgress}</p>
                        <p className="max-w-sm text-xs text-slate-400">
                          La primera vez descarga ~7 MB. En este equipo puede tardar 1–3 min; luego
                          queda en caché.
                        </p>
                      </div>
                    ) : (
                      <>
                        <p className="text-lg font-semibold text-slate-800">{livenessHintText}</p>
                        <p className="mt-2 text-xs text-slate-500">{modelProgress}</p>
                      </>
                    )}
                  </div>

                  {cameraError && !modelsReady && (
                    <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
                      <p className="font-semibold">No se pudo preparar el reconocimiento</p>
                      <p className="mt-1">{cameraError}</p>
                      <button
                        type="button"
                        className="mt-2 text-xs font-semibold underline"
                        onClick={() => window.location.reload()}
                      >
                        Recargar página
                      </button>
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={() => {
                      setFallbackMode(true);
                      setTimeout(() => cedulaRef.current?.focus(), 100);
                    }}
                    className="mt-4 self-start text-xs text-slate-400 underline hover:text-slate-600"
                  >
                    Modo cédula (emergencia)
                  </button>
                </>
              ) : (
                <>
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-amber-700">
                    Respaldo
                  </p>
                  <h2 className="mt-1 text-2xl font-bold text-slate-900 sm:text-3xl">
                    Digite su cédula
                  </h2>
                  <p className="mt-2 text-sm text-slate-500">
                    Debe haber una persona frente a la cámara. Se guardará foto de evidencia.
                  </p>
                  <form onSubmit={handlePunchCedula} className="mt-6 flex flex-1 flex-col">
                    <input
                      ref={cedulaRef}
                      value={cedula}
                      onChange={(e) => setCedula(e.target.value.replace(/\D/g, ""))}
                      disabled={submitting}
                      inputMode="numeric"
                      placeholder="Número de cédula"
                      className="w-full rounded-xl border-2 border-slate-200 bg-slate-50 px-4 py-4 text-2xl font-semibold tracking-wide text-slate-900 outline-none focus:border-[#3eafd4] focus:bg-white"
                    />
                    <button
                      type="submit"
                      disabled={submitting || !cedula.trim()}
                      className="mt-4 rounded-xl bg-[#3eafd4] py-4 text-lg font-semibold text-white hover:bg-[#2f9fc2] disabled:opacity-50"
                    >
                      {submitting ? "Registrando…" : "Registrar con cédula"}
                    </button>
                  </form>
                  <button
                    type="button"
                    onClick={() => setFallbackMode(false)}
                    className="mt-4 self-start text-xs text-[#0d6e8a] underline"
                  >
                    Volver a reconocimiento facial
                  </button>
                </>
              )}

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
          </>
        )}
      </main>

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
