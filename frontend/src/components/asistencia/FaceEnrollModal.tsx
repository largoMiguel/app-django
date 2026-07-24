import { useCallback, useEffect, useRef, useState } from "react";
import { CheckCircle2, Loader2, RefreshCw, X } from "lucide-react";
import { asistenciaApi, type Funcionario } from "@/core/api/asistencia";
import { formatApiError } from "@/core/api/errors";
import {
  captureFace,
  captureFrameBase64,
  detectLandmarks,
  ENROLL_POSES,
  enrollPoseLabel,
  loadFaceModels,
  matchesEnrollPose,
  openCameraStream,
  type EnrollPose,
} from "@/core/face/faceApi";

type Props = {
  funcionario: Funcionario;
  onClose: () => void;
  onEnrolled: () => void;
};

export default function FaceEnrollModal({ funcionario, onClose, onEnrolled }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const busyRef = useRef(false);
  const poseHoldRef = useRef(0);
  const [modelsReady, setModelsReady] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [poseIndex, setPoseIndex] = useState(() =>
    Math.min(funcionario.face_samples, ENROLL_POSES.length - 1),
  );
  const [samples, setSamples] = useState(0);
  const [hint, setHint] = useState("Preparando…");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const totalDone = funcionario.face_samples + samples;
  const currentPose: EnrollPose =
    ENROLL_POSES[Math.min(poseIndex, ENROLL_POSES.length - 1)] ?? "front";

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setCameraReady(false);
  }, []);

  const startCamera = useCallback(async () => {
    setCameraError(null);
    try {
      stopCamera();
      const stream = await openCameraStream();
      streamRef.current = stream;
      const video = videoRef.current;
      if (!video) {
        stream.getTracks().forEach((t) => t.stop());
        setCameraError("Vista de cámara no disponible. Reintente.");
        return;
      }
      video.srcObject = stream;
      video.muted = true;
      video.setAttribute("playsinline", "true");
      await video.play();
      setCameraReady(true);
      poseHoldRef.current = 0;
    } catch (err) {
      const name = err instanceof DOMException ? err.name : "";
      if (name === "NotAllowedError") {
        setCameraError("Permiso de cámara denegado. Actívelo y pulse reintentar.");
      } else {
        setCameraError("No se pudo acceder a la cámara. Pruebe otra webcam o reintente.");
      }
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

  const saveSample = useCallback(async () => {
    const video = videoRef.current;
    if (!video || busyRef.current || done || totalDone >= ENROLL_POSES.length) return;
    busyRef.current = true;
    setSaving(true);
    setError(null);
    setHint("Guardando muestra…");
    try {
      const face = await captureFace(video);
      const foto = captureFrameBase64(video);
      if (!face || !foto) {
        setError("No se detectó un rostro nítido. Intente de nuevo.");
        poseHoldRef.current = 0;
        return;
      }
      await asistenciaApi.funcionarios.enrollFace(funcionario.id, {
        descriptor: face.descriptor,
        foto_base64: foto,
      });
      const next = samples + 1;
      setSamples(next);
      const nextPose = Math.min(funcionario.face_samples + next, ENROLL_POSES.length - 1);
      setPoseIndex(nextPose);
      poseHoldRef.current = 0;
      if (funcionario.face_samples + next >= ENROLL_POSES.length) {
        setDone(true);
        setHint("Enrolamiento completo");
        onEnrolled();
      } else {
        setHint(enrollPoseLabel(ENROLL_POSES[nextPose]));
        onEnrolled();
      }
    } catch (err) {
      setError(formatApiError(err));
      poseHoldRef.current = 0;
    } finally {
      busyRef.current = false;
      setSaving(false);
    }
  }, [done, totalDone, samples, funcionario.id, funcionario.face_samples, onEnrolled]);

  useEffect(() => {
    if (!cameraReady || !modelsReady || saving || done || totalDone >= ENROLL_POSES.length) {
      return;
    }
    let cancelled = false;
    let timer = 0;

    const tick = async () => {
      if (cancelled || busyRef.current) {
        timer = window.setTimeout(tick, 80);
        return;
      }
      const video = videoRef.current;
      if (!video || video.readyState < 2) {
        timer = window.setTimeout(tick, 80);
        return;
      }
      try {
        const landmarks = await detectLandmarks(video);
        if (cancelled) return;
        if (!landmarks) {
          poseHoldRef.current = 0;
          setHint("Centre su rostro en el recuadro");
        } else if (matchesEnrollPose(landmarks, currentPose)) {
          poseHoldRef.current += 1;
          setHint(`${enrollPoseLabel(currentPose)} — ¡hold!`);
          // ~3 frames estables (~240ms) → captura automática
          if (poseHoldRef.current >= 3) {
            await saveSample();
            if (!cancelled) timer = window.setTimeout(tick, 120);
            return;
          }
        } else {
          poseHoldRef.current = 0;
          setHint(enrollPoseLabel(currentPose));
        }
      } catch {
        /* skip */
      }
      if (!cancelled) timer = window.setTimeout(tick, 80);
    };

    timer = window.setTimeout(tick, 50);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [cameraReady, modelsReady, saving, done, totalDone, currentPose, saveSample]);

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
              {saving ? "Guardando…" : hint}
            </div>
          </div>

          <div className="mt-3 flex flex-wrap gap-2 text-xs">
            {ENROLL_POSES.map((pose, i) => {
              const donePose = totalDone > i;
              const active = !done && totalDone === i;
              return (
                <span
                  key={pose}
                  className={`rounded-full px-2.5 py-1 font-medium ${
                    donePose
                      ? "bg-emerald-50 text-emerald-700"
                      : active
                        ? "bg-[#e8f6fa] text-[#0d6e8a]"
                        : "bg-slate-100 text-slate-500"
                  }`}
                >
                  {i + 1}.{" "}
                  {pose === "front" ? "Frente" : pose === "left" ? "Izquierda" : "Derecha"}
                </span>
              );
            })}
          </div>

          <p className="mt-3 text-sm text-slate-600">
            Tres muestras en posiciones distintas (frente, izquierda, derecha). La captura es
            automática al sostener la pose.
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

        <div className="flex flex-col gap-2 border-t border-slate-200 bg-slate-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <p className="text-xs text-slate-500">
            {saving ? (
              <span className="inline-flex items-center gap-1.5">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Guardando muestra…
              </span>
            ) : (
              `Muestras ${Math.min(totalDone, 3)}/3`
            )}
          </p>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-slate-300 px-4 py-2 text-sm hover:bg-white"
          >
            {done ? "Cerrar" : "Cancelar"}
          </button>
        </div>
      </div>
    </div>
  );
}
