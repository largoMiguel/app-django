import * as faceapi from "@vladmandic/face-api";

const MODEL_URL = "/models";

let modelsLoaded = false;
let loadingPromise: Promise<void> | null = null;

/** Canvas reutilizable para downscale (evita GC y acelera detección). */
let workCanvas: HTMLCanvasElement | null = null;
let workCtx: CanvasRenderingContext2D | null = null;

function getWorkCanvas(width: number, height: number): HTMLCanvasElement {
  if (!workCanvas) {
    workCanvas = document.createElement("canvas");
    workCtx = workCanvas.getContext("2d", { willReadFrequently: true });
  }
  if (workCanvas.width !== width || workCanvas.height !== height) {
    workCanvas.width = width;
    workCanvas.height = height;
  }
  return workCanvas;
}

/** Baja el video a ~320px de ancho para inferencia rápida. */
export function frameForDetection(video: HTMLVideoElement): HTMLCanvasElement | null {
  if (video.readyState < 2 || video.videoWidth === 0) return null;
  const targetW = 320;
  const scale = targetW / video.videoWidth;
  const w = targetW;
  const h = Math.max(1, Math.round(video.videoHeight * scale));
  const canvas = getWorkCanvas(w, h);
  const ctx = workCtx;
  if (!ctx) return null;
  ctx.drawImage(video, 0, 0, w, h);
  return canvas;
}

export type ModelLoadProgress = {
  phase: string;
  percent: number;
  backend?: string;
};

function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = window.setTimeout(() => reject(new Error(message)), ms);
    promise.then(
      (v) => {
        window.clearTimeout(t);
        resolve(v);
      },
      (err) => {
        window.clearTimeout(t);
        reject(err);
      },
    );
  });
}

async function initTfBackend(
  onProgress?: (p: ModelLoadProgress) => void,
): Promise<string> {
  const tf = faceapi.tf as unknown as {
    setBackend: (b: string) => Promise<boolean>;
    ready: () => Promise<void>;
    getBackend: () => string;
  };

  onProgress?.({ phase: "Iniciando motor de IA (WebGL)…", percent: 8 });
  try {
    const ok = await withTimeout(tf.setBackend("webgl"), 8_000, "WebGL timeout");
    if (ok) {
      await withTimeout(tf.ready(), 10_000, "WebGL ready timeout");
      return tf.getBackend() || "webgl";
    }
  } catch {
    /* fallback CPU */
  }

  onProgress?.({ phase: "WebGL no disponible — usando CPU…", percent: 12 });
  await tf.setBackend("cpu");
  await tf.ready();
  return tf.getBackend() || "cpu";
}

/**
 * Primera vez descarga ~7 MB (luego cache del navegador).
 * En PCs lentos o redes pobres puede tardar; use onProgress para UI.
 */
export async function loadFaceModels(
  onProgress?: (p: ModelLoadProgress) => void,
): Promise<void> {
  if (modelsLoaded) {
    onProgress?.({ phase: "Modelos listos", percent: 100 });
    return;
  }
  if (loadingPromise) return loadingPromise;

  loadingPromise = (async () => {
    const backend = await initTfBackend(onProgress);
    onProgress?.({ phase: "Descargando detector facial…", percent: 20, backend });

    await withTimeout(
      faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
      60_000,
      "No se pudo descargar el detector facial. Revise la red o recargue.",
    );

    onProgress?.({ phase: "Descargando puntos faciales…", percent: 40, backend });
    await withTimeout(
      faceapi.nets.faceLandmark68TinyNet.loadFromUri(MODEL_URL),
      60_000,
      "No se pudieron descargar los puntos faciales. Revise la red o recargue.",
    );

    onProgress?.({
      phase: "Descargando reconocimiento (~6 MB, espere)…",
      percent: 55,
      backend,
    });
    await withTimeout(
      faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
      180_000,
      "La descarga del modelo tardó demasiado. Revise la conexión de este equipo.",
    );

    onProgress?.({ phase: "Modelos listos", percent: 100, backend });
    modelsLoaded = true;
  })().catch((err) => {
    loadingPromise = null;
    modelsLoaded = false;
    throw err;
  });

  return loadingPromise;
}

export function areFaceModelsLoaded(): boolean {
  return modelsLoaded;
}

export type FaceCapture = {
  descriptor: number[];
  landmarks: faceapi.FaceLandmarks68;
};

function pointDistance(a: faceapi.Point, b: faceapi.Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function singleEyeAspectRatio(points: faceapi.Point[]): number {
  if (points.length < 6) return 0;
  const vertical1 = pointDistance(points[1], points[5]);
  const vertical2 = pointDistance(points[2], points[4]);
  const horizontal = pointDistance(points[0], points[3]);
  if (horizontal <= 0) return 0;
  return (vertical1 + vertical2) / (2 * horizontal);
}

export function eyeAspectRatio(landmarks: faceapi.FaceLandmarks68): number {
  const left = landmarks.getLeftEye();
  const right = landmarks.getRightEye();
  return (singleEyeAspectRatio(left) + singleEyeAspectRatio(right)) / 2;
}

/** |giro|: 0 = frontal. */
export function headTurnRatio(landmarks: faceapi.FaceLandmarks68): number {
  return Math.abs(headTurnSigned(landmarks));
}

/** Giro firmado: <0 izquierda, >0 derecha (coords del video, no espejo CSS). */
export function headTurnSigned(landmarks: faceapi.FaceLandmarks68): number {
  const jaw = landmarks.getJawOutline();
  const nosePoints = landmarks.getNose();
  const nose = nosePoints[Math.min(3, nosePoints.length - 1)];
  const minX = Math.min(...jaw.map((p) => p.x));
  const maxX = Math.max(...jaw.map((p) => p.x));
  const center = (minX + maxX) / 2;
  const half = (maxX - minX) / 2 || 1;
  return (nose.x - center) / half;
}

const FAST_OPTIONS = new faceapi.TinyFaceDetectorOptions({
  inputSize: 224,
  scoreThreshold: 0.4,
});

const ACCURATE_OPTIONS = new faceapi.TinyFaceDetectorOptions({
  inputSize: 320,
  scoreThreshold: 0.35,
});

/** ¿Hay una persona/rostro? Muy rápido (sin landmarks). */
export async function detectPersonPresent(video: HTMLVideoElement): Promise<boolean> {
  await loadFaceModels();
  const frame = frameForDetection(video);
  if (!frame) return false;
  const det = await faceapi.detectSingleFace(frame, FAST_OPTIONS);
  return Boolean(det);
}

/** Landmarks sobre frame pequeño — loop de liveness (modelo tiny). */
export async function detectLandmarks(
  video: HTMLVideoElement,
): Promise<faceapi.FaceLandmarks68 | null> {
  await loadFaceModels();
  const frame = frameForDetection(video);
  if (!frame) return null;
  const result = await faceapi.detectSingleFace(frame, FAST_OPTIONS).withFaceLandmarks(true);
  return result?.landmarks ?? null;
}

/** Descriptor + landmarks. */
export async function captureFace(video: HTMLVideoElement): Promise<FaceCapture | null> {
  await loadFaceModels();
  const frame = frameForDetection(video);
  if (!frame) return null;
  const result = await faceapi
    .detectSingleFace(frame, ACCURATE_OPTIONS)
    .withFaceLandmarks(true)
    .withFaceDescriptor();
  if (!result?.descriptor || !result.landmarks) return null;
  return {
    descriptor: Array.from(result.descriptor),
    landmarks: result.landmarks,
  };
}

/** @deprecated usar captureFace */
export async function captureFaceFromLandmarksPass(
  video: HTMLVideoElement,
): Promise<FaceCapture | null> {
  return captureFace(video);
}

export function captureFrameBase64(video: HTMLVideoElement, quality = 0.72): string | null {
  if (video.readyState < 2 || video.videoWidth === 0) return null;
  // Comprimir a máx 640px de ancho para modo cédula (más rápido de subir)
  const maxW = 640;
  const scale = Math.min(1, maxW / video.videoWidth);
  const w = Math.round(video.videoWidth * scale);
  const h = Math.round(video.videoHeight * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.drawImage(video, 0, 0, w, h);
  return canvas.toDataURL("image/jpeg", quality);
}

/** Preferir 640×480: suficiente y mucho más rápido que 720p/1080p. */
export const CAMERA_CONSTRAINTS: MediaStreamConstraints[] = [
  {
    video: {
      facingMode: { ideal: "user" },
      width: { ideal: 640 },
      height: { ideal: 480 },
      frameRate: { ideal: 24, max: 30 },
    },
    audio: false,
  },
  {
    video: { facingMode: { ideal: "user" }, width: { ideal: 480 }, height: { ideal: 360 } },
    audio: false,
  },
  { video: { facingMode: "user" }, audio: false },
  { video: true, audio: false },
];

export async function openCameraStream(): Promise<MediaStream> {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new DOMException("getUserMedia no disponible", "NotSupportedError");
  }
  let lastError: unknown;
  for (const constraints of CAMERA_CONSTRAINTS) {
    try {
      return await navigator.mediaDevices.getUserMedia(constraints);
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError instanceof Error
    ? lastError
    : new DOMException("No se pudo abrir la cámara", "NotReadableError");
}

export type LivenessState = "idle" | "need_face" | "need_blink" | "passed";

/**
 * Liveness rápido para kiosco: rostro estable + un parpadeo (o ~1.2s de presencia).
 * Sin giro obligatorio — eso va en el enrolamiento por poses.
 */
export class LivenessTracker {
  private blinkSeen = false;
  private earBaseline: number | null = null;
  private closedFrames = 0;
  private wasClosed = false;
  private faceMisses = 0;
  private faceSeenAt: number | null = null;
  private stableFrames = 0;

  reset() {
    this.blinkSeen = false;
    this.earBaseline = null;
    this.closedFrames = 0;
    this.wasClosed = false;
    this.faceMisses = 0;
    this.faceSeenAt = null;
    this.stableFrames = 0;
  }

  noteMiss(): LivenessState {
    this.faceMisses += 1;
    this.stableFrames = 0;
    if (this.faceMisses > 12) {
      this.reset();
      return "need_face";
    }
    if (this.passed) return "passed";
    return this.blinkSeen ? "passed" : "need_blink";
  }

  update(landmarks: faceapi.FaceLandmarks68): LivenessState {
    this.faceMisses = 0;
    this.stableFrames += 1;
    if (this.faceSeenAt === null) this.faceSeenAt = Date.now();

    const ear = eyeAspectRatio(landmarks);
    if (this.earBaseline === null) {
      this.earBaseline = Math.max(ear, 0.18);
    } else if (ear > this.earBaseline * 0.85) {
      this.earBaseline = this.earBaseline * 0.85 + ear * 0.15;
    }

    const baseline = Math.max(this.earBaseline, 0.16);
    const isClosed = ear < baseline * 0.78 || (ear < 0.19 && ear < baseline - 0.04);

    if (isClosed) {
      this.closedFrames += 1;
      this.wasClosed = true;
    } else {
      if (this.wasClosed && this.closedFrames >= 1) this.blinkSeen = true;
      this.closedFrames = 0;
      this.wasClosed = false;
    }

    const elapsed = this.faceSeenAt ? Date.now() - this.faceSeenAt : 0;
    // Presencia breve (~1.2s) o parpadeo → listo
    if (this.blinkSeen || (elapsed >= 1200 && this.stableFrames >= 4)) {
      this.blinkSeen = true;
      return "passed";
    }
    return "need_blink";
  }

  get passed(): boolean {
    return this.blinkSeen;
  }
}

export function livenessHint(state: LivenessState): string {
  switch (state) {
    case "need_face":
      return "Centre su rostro en el recuadro";
    case "need_blink":
      return "Mire a la cámara y parpadee";
    case "passed":
      return "Reconociendo…";
    default:
      return "Preparando cámara…";
  }
}

/** Poses de enrolamiento: frente → izquierda → derecha. */
export type EnrollPose = "front" | "left" | "right";

export const ENROLL_POSES: EnrollPose[] = ["front", "left", "right"];

export function enrollPoseLabel(pose: EnrollPose): string {
  switch (pose) {
    case "front":
      return "Mire de frente a la cámara";
    case "left":
      return "Gire un poco la cabeza a su izquierda";
    case "right":
      return "Gire un poco la cabeza a su derecha";
  }
}

/** ¿La pose actual coincide con la pedida? (coords cámara, no espejo CSS). */
export function matchesEnrollPose(landmarks: faceapi.FaceLandmarks68, pose: EnrollPose): boolean {
  const signed = headTurnSigned(landmarks);
  const abs = Math.abs(signed);
  // Usuario gira a SU izquierda → nariz se mueve a la derecha del frame de la cámara.
  if (pose === "front") return abs < 0.09;
  if (pose === "left") return signed > 0.1;
  return signed < -0.1;
}
