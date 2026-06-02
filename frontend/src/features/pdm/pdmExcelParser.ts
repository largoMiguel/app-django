import * as XLSX from "xlsx";

export interface PdmLineaEstrategica {
  codigo_dane: string;
  entidad_territorial: string;
  nombre_plan: string;
  consecutivo: string;
  linea_estrategica: string;
}

export interface PdmIndicadorResultado {
  codigo_dane: string;
  entidad_territorial: string;
  nombre_plan: string;
  consecutivo: string;
  linea_estrategica: string;
  indicador_resultado: string;
  esta_pnd: string;
  meta_cuatrienio: number;
  transformacion_pnd: string;
}

export interface PdmIniciativaSgrRow {
  codigo_dane: string;
  entidad_territorial: string;
  nombre_plan: string;
  consecutivo: string;
  linea_estrategica: string;
  tipo_iniciativa: string;
  sector_mga: string;
  iniciativa_sgr: string;
  recursos_sgr_indicativos: number;
  bpin: string;
}

export interface PdmProductoExcelRow {
  codigo_dane: string;
  entidad_territorial: string;
  nombre_plan: string;
  codigo_indicador_producto: string;
  linea_estrategica: string;
  codigo_sector: string;
  sector_mga: string;
  codigo_programa: string;
  programa_mga: string;
  codigo_producto: string;
  producto_mga: string;
  codigo_indicador_producto_mga: string;
  indicador_producto_mga: string;
  personalizacion_indicador: string;
  unidad_medida: string;
  meta_cuatrienio: number;
  principal: string;
  codigo_ods: string;
  ods: string;
  tipo_acumulacion: string;
  programacion_2024: number;
  programacion_2025: number;
  programacion_2026: number;
  programacion_2027: number;
  total_2024: number;
  total_2025: number;
  total_2026: number;
  total_2027: number;
  bpin: string;
  [key: string]: string | number;
}

export interface PdmExcelData {
  lineas_estrategicas: PdmLineaEstrategica[];
  indicadores_resultado: PdmIndicadorResultado[];
  iniciativas_sgr: PdmIniciativaSgrRow[];
  productos_plan_indicativo: PdmProductoExcelRow[];
}

function findSheet(workbook: XLSX.WorkBook, nombres: string[]): string | null {
  for (const nombre of nombres) {
    const encontrada = workbook.SheetNames.find((s) => s.toLowerCase().trim() === nombre.toLowerCase().trim());
    if (encontrada) return encontrada;
  }
  return null;
}

function isHeaderRow(firstCell: string): boolean {
  const cell = firstCell.toLowerCase();
  return cell.includes("código") || cell.includes("codigo") || cell.includes("dane") || cell === "código dane";
}

function parsearLineasEstrategicas(sheet: XLSX.WorkSheet): PdmLineaEstrategica[] {
  const data = XLSX.utils.sheet_to_json<(string | number)[]>(sheet, { header: 1, defval: "" });
  const resultado: PdmLineaEstrategica[] = [];
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (!row[0]) continue;
    if (isHeaderRow(String(row[0] || ""))) continue;
    resultado.push({
      codigo_dane: String(row[0] || ""),
      entidad_territorial: String(row[1] || ""),
      nombre_plan: String(row[2] || ""),
      consecutivo: String(row[3] || ""),
      linea_estrategica: String(row[4] || ""),
    });
  }
  return resultado;
}

function parsearIndicadoresResultado(sheet: XLSX.WorkSheet): PdmIndicadorResultado[] {
  const data = XLSX.utils.sheet_to_json<(string | number)[]>(sheet, { header: 1, defval: "" });
  const resultado: PdmIndicadorResultado[] = [];
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (!row[0]) continue;
    if (isHeaderRow(String(row[0] || ""))) continue;
    resultado.push({
      codigo_dane: String(row[0] || ""),
      entidad_territorial: String(row[1] || ""),
      nombre_plan: String(row[2] || ""),
      consecutivo: String(row[3] || ""),
      linea_estrategica: String(row[4] || ""),
      indicador_resultado: String(row[5] || ""),
      esta_pnd: String(row[6] || ""),
      meta_cuatrienio: Number(row[7]) || 0,
      transformacion_pnd: String(row[8] || ""),
    });
  }
  return resultado;
}

function parsearIniciativasSGR(sheet: XLSX.WorkSheet): PdmIniciativaSgrRow[] {
  const data = XLSX.utils.sheet_to_json<(string | number)[]>(sheet, { header: 1, defval: "" });
  const resultado: PdmIniciativaSgrRow[] = [];
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (!row[0]) continue;
    if (isHeaderRow(String(row[0] || ""))) continue;
    resultado.push({
      codigo_dane: String(row[0] || ""),
      entidad_territorial: String(row[1] || ""),
      nombre_plan: String(row[2] || ""),
      consecutivo: String(row[3] || ""),
      linea_estrategica: String(row[4] || ""),
      tipo_iniciativa: String(row[5] || ""),
      sector_mga: String(row[6] || ""),
      iniciativa_sgr: String(row[7] || ""),
      recursos_sgr_indicativos: Number(row[8]) || 0,
      bpin: String(row[9] || ""),
    });
  }
  return resultado;
}

function parsearProductosPlanIndicativo(sheet: XLSX.WorkSheet): PdmProductoExcelRow[] {
  const data = XLSX.utils.sheet_to_json<(string | number)[]>(sheet, { header: 1, defval: "" });
  const resultado: PdmProductoExcelRow[] = [];
  for (let i = 2; i < data.length; i++) {
    const row = data[i];
    if (!row[0]) continue;
    resultado.push({
      codigo_dane: String(row[0] || ""),
      entidad_territorial: String(row[1] || ""),
      nombre_plan: String(row[2] || ""),
      codigo_indicador_producto: String(row[4] || ""),
      linea_estrategica: String(row[5] || ""),
      codigo_sector: String(row[6] || ""),
      sector_mga: String(row[7] || ""),
      codigo_programa: String(row[8] || ""),
      programa_mga: String(row[9] || ""),
      codigo_producto: String(row[10] || ""),
      producto_mga: String(row[11] || ""),
      codigo_indicador_producto_mga: String(row[12] || ""),
      indicador_producto_mga: String(row[13] || ""),
      personalizacion_indicador: String(row[14] || ""),
      unidad_medida: String(row[15] || ""),
      meta_cuatrienio: Number(row[16]) || 0,
      principal: String(row[17] || ""),
      codigo_ods: String(row[18] || ""),
      ods: String(row[19] || ""),
      tipo_acumulacion: String(row[20] || ""),
      programacion_2024: Number(row[21]) || 0,
      programacion_2025: Number(row[22]) || 0,
      programacion_2026: Number(row[23]) || 0,
      programacion_2027: Number(row[24]) || 0,
      recursos_propios_2024: Number(row[25]) || 0,
      sgp_educacion_2024: Number(row[26]) || 0,
      sgp_salud_2024: Number(row[27]) || 0,
      sgp_deporte_2024: Number(row[28]) || 0,
      sgp_cultura_2024: Number(row[29]) || 0,
      sgp_libre_inversion_2024: Number(row[30]) || 0,
      sgp_libre_destinacion_2024: Number(row[31]) || 0,
      sgp_alimentacion_escolar_2024: Number(row[32]) || 0,
      sgp_municipios_rio_magdalena_2024: Number(row[33]) || 0,
      sgp_apsb_2024: Number(row[34]) || 0,
      credito_2024: Number(row[35]) || 0,
      transferencias_cofinanciacion_departamento_2024: Number(row[36]) || 0,
      transferencias_cofinanciacion_nacion_2024: Number(row[37]) || 0,
      otros_2024: Number(row[38]) || 0,
      total_2024: Number(row[39]) || 0,
      recursos_propios_2025: Number(row[40]) || 0,
      sgp_educacion_2025: Number(row[41]) || 0,
      sgp_salud_2025: Number(row[42]) || 0,
      sgp_deporte_2025: Number(row[43]) || 0,
      sgp_cultura_2025: Number(row[44]) || 0,
      sgp_libre_inversion_2025: Number(row[45]) || 0,
      sgp_libre_destinacion_2025: Number(row[46]) || 0,
      sgp_alimentacion_escolar_2025: Number(row[47]) || 0,
      sgp_municipios_rio_magdalena_2025: Number(row[48]) || 0,
      sgp_apsb_2025: Number(row[49]) || 0,
      credito_2025: Number(row[50]) || 0,
      transferencias_cofinanciacion_departamento_2025: Number(row[51]) || 0,
      transferencias_cofinanciacion_nacion_2025: Number(row[52]) || 0,
      otros_2025: Number(row[53]) || 0,
      total_2025: Number(row[54]) || 0,
      recursos_propios_2026: Number(row[55]) || 0,
      sgp_educacion_2026: Number(row[56]) || 0,
      sgp_salud_2026: Number(row[57]) || 0,
      sgp_deporte_2026: Number(row[58]) || 0,
      sgp_cultura_2026: Number(row[59]) || 0,
      sgp_libre_inversion_2026: Number(row[60]) || 0,
      sgp_libre_destinacion_2026: Number(row[61]) || 0,
      sgp_alimentacion_escolar_2026: Number(row[62]) || 0,
      sgp_municipios_rio_magdalena_2026: Number(row[63]) || 0,
      sgp_apsb_2026: Number(row[64]) || 0,
      credito_2026: Number(row[65]) || 0,
      transferencias_cofinanciacion_departamento_2026: Number(row[66]) || 0,
      transferencias_cofinanciacion_nacion_2026: Number(row[67]) || 0,
      otros_2026: Number(row[68]) || 0,
      total_2026: Number(row[69]) || 0,
      recursos_propios_2027: Number(row[70]) || 0,
      sgp_educacion_2027: Number(row[71]) || 0,
      sgp_salud_2027: Number(row[72]) || 0,
      sgp_deporte_2027: Number(row[73]) || 0,
      sgp_cultura_2027: Number(row[74]) || 0,
      sgp_libre_inversion_2027: Number(row[75]) || 0,
      sgp_libre_destinacion_2027: Number(row[76]) || 0,
      sgp_alimentacion_escolar_2027: Number(row[77]) || 0,
      sgp_municipios_rio_magdalena_2027: Number(row[78]) || 0,
      sgp_apsb_2027: Number(row[79]) || 0,
      credito_2027: Number(row[80]) || 0,
      transferencias_cofinanciacion_departamento_2027: Number(row[81]) || 0,
      transferencias_cofinanciacion_nacion_2027: Number(row[82]) || 0,
      otros_2027: Number(row[83]) || 0,
      total_2027: Number(row[84]) || 0,
      bpin: String(row[85] || ""),
    });
  }
  return resultado;
}

export function parsearWorkbook(workbook: XLSX.WorkBook): PdmExcelData {
  const pdmData: PdmExcelData = {
    lineas_estrategicas: [],
    indicadores_resultado: [],
    iniciativas_sgr: [],
    productos_plan_indicativo: [],
  };

  const hojaLineas = findSheet(workbook, ["LÍNEAS ESTRATÉGICAS", "LINEAS ESTRATEGICAS", "Líneas Estratégicas"]);
  if (hojaLineas) pdmData.lineas_estrategicas = parsearLineasEstrategicas(workbook.Sheets[hojaLineas]);

  const hojaIndicadores = findSheet(workbook, ["INDICADORES DE RESULTADO", "Indicadores de Resultado"]);
  if (hojaIndicadores) pdmData.indicadores_resultado = parsearIndicadoresResultado(workbook.Sheets[hojaIndicadores]);

  const hojaIniciativas = findSheet(workbook, ["INICIATIVAS SGR", "Iniciativas SGR"]);
  if (hojaIniciativas) pdmData.iniciativas_sgr = parsearIniciativasSGR(workbook.Sheets[hojaIniciativas]);

  const hojaPlanIndicativo = findSheet(workbook, [
    "PLAN INDICATIVO - PRODUCTOS",
    "Plan Indicativo - Productos",
    "PLAN INDICATIVO-PRODUCTOS",
  ]);
  if (hojaPlanIndicativo) {
    pdmData.productos_plan_indicativo = parsearProductosPlanIndicativo(workbook.Sheets[hojaPlanIndicativo]);
  }

  return pdmData;
}

function leerArchivoExcel(file: File): Promise<XLSX.WorkBook> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        resolve(XLSX.read(data, { type: "array" }));
      } catch (error) {
        reject(error);
      }
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsArrayBuffer(file);
  });
}

export async function procesarArchivoExcel(file: File): Promise<PdmExcelData> {
  const workbook = await leerArchivoExcel(file);
  return parsearWorkbook(workbook);
}

const UPLOAD_PRODUCTO_FIELDS = [
  "codigo_dane",
  "entidad_territorial",
  "nombre_plan",
  "codigo_indicador_producto",
  "codigo_producto",
  "linea_estrategica",
  "codigo_sector",
  "sector_mga",
  "codigo_programa",
  "programa_mga",
  "codigo_producto_mga",
  "producto_mga",
  "codigo_indicador_producto_mga",
  "indicador_producto_mga",
  "personalizacion_indicador",
  "unidad_medida",
  "meta_cuatrienio",
  "principal",
  "codigo_ods",
  "ods",
  "tipo_acumulacion",
  "bpin",
  "programacion_2024",
  "programacion_2025",
  "programacion_2026",
  "programacion_2027",
  "total_2024",
  "total_2025",
  "total_2026",
  "total_2027",
] as const;

function normalizeCodigo(value: unknown): string {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

export function buildPdmUploadPayload(data: PdmExcelData) {
  const productosPorCodigo = new Map<string, Record<string, string | number | null>>();
  for (const producto of data.productos_plan_indicativo) {
    const codigo = normalizeCodigo(producto.codigo_producto);
    if (!codigo) continue;
    const row: Record<string, string | number | null> = { codigo_producto: codigo };
    for (const field of UPLOAD_PRODUCTO_FIELDS) {
      if (field === "codigo_producto") continue;
      row[field] = producto[field] ?? null;
    }
    productosPorCodigo.set(codigo, row);
  }

  const iniciativasPorConsecutivo = new Map<string, PdmIniciativaSgrRow>();
  for (const iniciativa of data.iniciativas_sgr) {
    const consecutivo = normalizeCodigo(iniciativa.consecutivo);
    if (!consecutivo) continue;
    iniciativasPorConsecutivo.set(consecutivo, { ...iniciativa, consecutivo });
  }

  return {
    productos_plan_indicativo: Array.from(productosPorCodigo.values()),
    iniciativas_sgr: Array.from(iniciativasPorConsecutivo.values()),
  };
}
