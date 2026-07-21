import * as faceapi from "@vladmandic/face-api";

const MODEL_URL = "/models";

let modelsLoaded = false;
let loadingPromise: Promise<void> | null = null;

export async function loadFaceModels(): Promise<void> {
  if (modelsLoaded) return;
  if (loadingPromise) return loadingPromise;
  loadingPromise = (async () => {
    await Promise.all([
      faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
      faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
      faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
    ]);
    modelsLoaded = true;
  })();
  return loadingPromise;
}

export type FaceCapture = {
  descriptor: number[];
  landmarks: faceapi.FaceLandmarks68;
};

function pointDistance(a: faceapi.Point, b: faceapi.Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function singleEyeAspectRatio(points: faceapi.Point[]): number {
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

/** Posición horizontal del rostro: 0 = centrado, >0.12 = girado. */
export function headTurnRatio(landmarks: faceapi.FaceLandmarks68): number {
  const jaw = landmarks.getJawOutline();
  const nose = landmarks.getNose()[3];
  const minX = Math.min(...jaw.map((p) => p.x));
  const maxX = Math.max(...jaw.map((p) => p.x));
  const center = (minX + maxX) / 2;
  const half = (maxX - minX) / 2 || 1;
  return Math.abs(nose.x - center) / half;
}

export async function captureFace(
  input: HTMLVideoElement | HTMLCanvasElement,
): Promise<FaceCapture | null> {
  await loadFaceModels();
  const options = new faceapi.TinyFaceDetectorOptions({
    inputSize: 416,
    scoreThreshold: 0.5,
  });
  const result = await faceapi
    .detectSingleFace(input, options)
    .withFaceLandmarks()
    .withFaceDescriptor();
  if (!result?.descriptor || !result.landmarks) return null;
  return {
    descriptor: Array.from(result.descriptor),
    landmarks: result.landmarks,
  };
}

export function captureFrameBase64(video: HTMLVideoElement, quality = 0.85): string | null {
  if (video.readyState < 2 || video.videoWidth === 0) return null;
  const canvas = document.createElement("canvas");
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.drawImage(video, 0, 0);
  return canvas.toDataURL("image/jpeg", quality);
}

export type LivenessState = "idle" | "need_face" | "need_blink" | "need_turn" | "passed";

export class LivenessTracker {
  private blinkSeen = false;
  private turnSeen = false;
  private earBaseline: number | null = null;
  private closedFrames = 0;

  reset() {
    this.blinkSeen = false;
    this.turnSeen = false;
    this.earBaseline = null;
    this.closedFrames = 0;
  }

  update(landmarks: faceapi.FaceLandmarks68): LivenessState {
    const ear = eyeAspectRatio(landmarks);
    if (this.earBaseline === null) {
      this.earBaseline = ear;
    } else {
      this.earBaseline = this.earBaseline * 0.9 + ear * 0.1;
    }

    const baseline = this.earBaseline ?? ear;
    if (ear < baseline * 0.65) {
      this.closedFrames += 1;
    } else if (this.closedFrames >= 2) {
      this.blinkSeen = true;
      this.closedFrames = 0;
    } else {
      this.closedFrames = 0;
    }

    if (headTurnRatio(landmarks) > 0.14) {
      this.turnSeen = true;
    }

    if (this.blinkSeen && this.turnSeen) return "passed";
    if (!this.blinkSeen) return "need_blink";
    return "need_turn";
  }

  get passed(): boolean {
    return this.blinkSeen && this.turnSeen;
  }
}

export function livenessHint(state: LivenessState): string {
  switch (state) {
    case "need_face":
      return "Centre su rostro en el recuadro";
    case "need_blink":
      return "Parpadee una vez";
    case "need_turn":
      return "Gire levemente la cabeza";
    case "passed":
      return "Verificación lista";
    default:
      return "Preparando cámara…";
  }
}
