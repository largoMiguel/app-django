/// <reference lib="webworker" />

import { parsearWorkbook } from "@/features/pdm/pdmExcelParser";
import * as XLSX from "xlsx";

self.onmessage = async (event: MessageEvent<{ file: File }>) => {
  try {
    const { file } = event.data;
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(new Uint8Array(buffer), { type: "array" });
    const parsed = parsearWorkbook(workbook);
    self.postMessage({ ok: true, data: parsed });
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo procesar el archivo Excel.";
    self.postMessage({ ok: false, message });
  }
};
