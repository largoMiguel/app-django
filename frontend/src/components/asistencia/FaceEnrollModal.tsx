import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, CheckCircle2, Loader2, RefreshCw, X } from "lucide-react";
import { asistenciaApi, type Funcionario } from "@/core/api/asistencia";
import { formatApiError } from "@/core/api/errors";
import {
  captureFace,
  captureFrameBase64,
  loadFaceModels,
  livenessHint,
  LivenessTracker,
} from "@/core/face/faceApi";

const MAX_SAMPLES = 3;

type Props = {
  funcionario: Funcionario;
  onClose: () => void;
  onEnrolled: () => void;
};

export default function FaceEnrollModal({ funcionario, onClose, onEnrolled }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const livenessRef = useRef(new LivenessTracker());
  const [modelsReady, setModelsReady] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [samples, setSamples] = useState(0);
  const [hint, setHint] = useState("Preparando…");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setCameraReady(false);
  }, []);

  const startCamera = useCallback(async () => {
    setCameraError(null);
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        setCameraError("Este navegador no permite acceso a la cámara.");
        return;
      }
      stopCamera();
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      streamRef.current = stream;
      const video = videoRef.current;
      if (!video) return;
      video.srcObject = stream;
      video.muted = true;
      video.setAttribute("playsinline", "true");
      await video.play();
      setCameraReady(true);
    } catch {
      setCameraError("No se pudo acceder a la cámara.");
      setCameraReady(false);
    }
  }, [stopCamera]);

  useEffect(() => {
    let cancelled = false;
    void loadFaceModels()
      .then(() => {
        if (!cancelled) setModelsReady(true);
      })
      .catch(() => {
        if (!cancelled) setError("No se pudieron cargar los modelos faciales.");
      });
    void startCamera();
    return () => {
      cancelled = true;
      stopCamera();
    };
  }, [startCamera, stopCamera]);

  useEffect(() => {
    if (!cameraReady || !modelsReady || saving || done || samples >= MAX_SAMPLES) return;
    let raf = 0;
    const tick = async () => {
      const video = videoRef.current;
      if (!video || video.readyState < 2) {
        raf = requestAnimationFrame(tick);
        return;
      }
      try {
        const face = await captureFace(video);
        if (!face) {
          setHint(livenessHint("need_face"));
          livenessRef.current.reset();
        } else {
          const state = livenessRef.current.update(face.landmarks);
          setHint(livenessHint(state));
        }
      } catch {
        /* ignore frame errors */
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [cameraReady, modelsReady, saving, done, samples]);

  async function captureSample() {
    const video = videoRef.current;
    if (!video || saving || samples >= MAX_SAMPLES) return;
    if (!livenessRef.current.passed) {
      setError("Complete la verificación: parpadee y gire levemente la cabeza.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const face = await captureFace(video);
      const foto = captureFrameBase64(video);
      if (!face || !foto) {
        setError("No se detectó un rostro nítido. Intente de nuevo.");
        return;
      }
      await asistenciaApi.funcionarios.enrollFace(funcionario.id, {
        descriptor: face.descriptor,
        foto_base64: foto,
      });
      const next = samples + 1;
      setSamples(next);
      livenessRef.current.reset();
      if (next >= MAX_SAMPLES || funcionario.face_samples + next >= MAX_SAMPLES) {
        setDone(true);
        onEnrolled();
      }
    } catch (err) {
      setError(formatApiError(err));
    } finally {
      setSaving(false);
    }
  }

  const remaining = Math.max(0, MAX_SAMPLES - (funcionario.face_samples + samples));

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4">
      <div className="flex max-h-[95vh] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl bg-white shadow-xl sm:rounded-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 sm:px-6">
          <div>
            <h2 className="font-semibold text-slate-900">Enrolar rostro</h2>
            <p className="text-xs text-slate-500">{funcionario.nombre_completo}</p>
          </div>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="overflow-y-auto px-4 py-4 sm:px-6">
          <div className="relative aspect-[4/3] overflow-hidden rounded-xl bg-slate-900">
            <video
              ref={videoRef}
              playsInline
              muted
              autoPlay
              className="h-full w-full object-cover"
              style={{ transform: "scaleX(-1)" }}
            />
            {!cameraReady && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-slate-900/80 p-4 text-center text-sm text-white">
                <p>{cameraError || "Iniciando cámara…"}</p>
                <button
                  type="button"
                  onClick={() => void startCamera()}
                  className="inline-flex items-center gap-2 rounded-lg bg-[#3eafd4] px-3 py-1.5 text-xs font-semibold"
                >
                  <RefreshCw className="h-3.5 w-3.5" /> Reintentar
                </button>
              </div>
            )}
            <div className="pointer-events-none absolute inset-3 rounded-xl ring-2 ring-[#3eafd4]/40" />
            <div className="absolute bottom-2 left-2 right-2 rounded-lg bg-black/55 px-3 py-2 text-center text-xs text-white">
              {hint}
            </div>
          </div>

          <p className="mt-3 text-sm text-slate-600">
            Capture {remaining > 1 ? `hasta ${remaining} muestras` : "una muestra"} con buena luz
            frontal. Máximo {MAX_SAMPLES} por funcionario.
          </p>

          {error && (
            <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          )}

          {done && (
            <div className="mt-3 flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              Rostro enrolado correctamente.
            </div>
          )}
        </div>

        <div className="flex flex-col gap-2 border-t border-slate-200 bg-slate-50 px-4 py-3 sm:flex-row sm:justify-end sm:px-6">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-slate-300 px-4 py-2 text-sm hover:bg-white"
          >
            {done ? "Cerrar" : "Cancelar"}
          </button>
          {!done && (
            <button
              type="button"
              disabled={!cameraReady || !modelsReady || saving || remaining <= 0}
              onClick={() => void captureSample()}
              className="inline-flex items-center justify-center gap-2 rounded-md bg-[#0d6e8a] px-4 py-2 text-sm font-medium text-white hover:bg-[#0a5870] disabled:opacity-60"
            >
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Guardando…
                </>
              ) : (
                <>
                  <Camera className="h-4 w-4" /> Capturar muestra ({samples + funcionario.face_samples}/
                  {MAX_SAMPLES})
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
