import type { PdmExcelData } from "@/features/pdm/pdmExcelParser";

type WorkerSuccess = { ok: true; data: PdmExcelData };
type WorkerFailure = { ok: false; message: string };

export async function procesarArchivoExcelEnWorker(file: File): Promise<PdmExcelData> {
  if (typeof Worker === "undefined") {
    const { procesarArchivoExcel } = await import("@/features/pdm/pdmExcelParser");
    return procesarArchivoExcel(file);
  }

  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL("./pdmExcel.worker.ts", import.meta.url), { type: "module" });
    worker.onmessage = (event: MessageEvent<WorkerSuccess | WorkerFailure>) => {
      worker.terminate();
      const payload = event.data;
      if (payload.ok) resolve(payload.data);
      else reject(new Error(payload.message));
    };
    worker.onerror = (error) => {
      worker.terminate();
      reject(error);
    };
    worker.postMessage({ file });
  });
}
