import type { PdmActividad, PdmProducto, ResumenAnioBackend } from "@/core/api/pdm";

export type VistaPdm = "dashboard" | "productos" | "detalle" | "analisis" | "proyectos";

export interface ResumenProducto {
  id: number;
  codigo: string;
  producto: string;
  avance_anio?: number;
  estado_anio?: string;
  producto_mga?: string | null;
  indicador_producto_mga?: string | null;
  linea_estrategica?: string | null;
  sector?: string | null;
  programa_mga?: string | null;
  ods?: string | null;
  tipo_acumulacion?: string | null;
  bpin?: string | null;
  meta_cuatrienio?: number | null;
  unidad_medida?: string | null;
  programacion_2024: number;
  programacion_2025: number;
  programacion_2026: number;
  programacion_2027: number;
  total_2024: number;
  total_2025: number;
  total_2026: number;
  total_2027: number;
  total_cuatrienio: number;
  pto_definitivo_anio?: number;
  pagos_anio?: number;
  avance_financiero_anio?: number;
  porcentaje_ejecucion: number;
  responsable_secretaria?: number | null;
  responsable_secretaria_nombre?: string | null;
  resumen_por_anio?: Record<string, ResumenAnioBackend>;
  actividades: PdmActividad[];
}

export interface EstadisticasPdm {
  total_lineas_estrategicas: number;
  total_productos: number;
  total_iniciativas_sgr: number;
  presupuesto_total: number;
  presupuestoPorAnio: {
    anio2024: number;
    anio2025: number;
    anio2026: number;
    anio2027: number;
  };
  presupuesto_por_linea: { linea: string; total: number }[];
  presupuesto_por_sector: { sector: string; total: number }[];
}

export interface ResumenActividadesAnio {
  anio: number;
  meta_programada: number;
  meta_asignada: number;
  meta_disponible: number;
  meta_ejecutada: number;
  total_actividades: number;
  actividades_completadas: number;
  porcentaje_avance: number;
  actividades: PdmActividad[];
}

export interface ResumenEjecucionAnual {
  anios: { anio: number; pto_definitivo: number; pagos: number }[];
  totales: { pto_definitivo: number; pagos: number };
  ejecucion_por_linea?: { linea: string; total: number }[];
  ejecucion_por_sector?: { sector: string; total: number }[];
  ejecucion_sin_producto_plan?: {
    codigo_producto: string;
    pto_definitivo: number;
    anios?: number[];
    detalle_anios?: { anio: number; pto_definitivo: number }[];
  }[];
}

export interface PdmAnalisisEstadoDistribucion {
  pendiente: number;
  en_progreso: number;
  completado: number;
  por_ejecutar: number;
  total: number;
}

export interface PdmAnalisisResponse {
  anio_filtro: number | null;
  total_productos: number;
  avance_global: number;
  productos_al_100?: number;
  presupuesto: { pto_definitivo: number; pagos: number };
  estado_distribucion: PdmAnalisisEstadoDistribucion;
  metas_por_anio: { anio: number; programada: number; ejecutada: number; pct: number }[];
  por_linea: { linea: string; productos: number; avance_pct: number }[];
  por_sector_estado: {
    sector: string;
    total: number;
    completados: number;
    en_progreso: number;
    pendientes: number;
    por_ejecutar: number;
    avance_fisico_pct: number;
    avance_financiero_pct: number;
    avance_pct: number;
    pto_definitivo: number;
    pagos: number;
  }[];
  por_ods: { ods: string; productos: number; avance_pct: number; presupuesto: number }[];
  presupuestal_por_anio: {
    anio: number;
    plan: number;
    ejecucion: number;
    pagos: number;
    pct_pagado: number;
  }[];
  por_secretaria: {
    secretaria_id: number;
    secretaria: string;
    productos: number;
    completados: number;
    en_progreso: number;
    pendientes: number;
    por_ejecutar: number;
    avance_pct: number;
    pto_definitivo: number;
    pagos: number;
  }[];
}

export const ANIOS_PDM = [2024, 2025, 2026, 2027] as const;

/** Valor enviado al API para filtrar productos sin línea/sector en el plan. */
export const PDM_SIN_CLASIFICAR = "__sin__";

/** Etiqueta de ejecución huérfana (código no presente en el plan). */
export const PDM_SIN_PRODUCTO_EN_PLAN = "Sin producto en plan";

const META_DECIMALES = 4;
const META_EPSILON = 1e-6;

export function redondearMeta(valor: number): number {
  const factor = 10 ** META_DECIMALES;
  return Math.round(valor * factor) / factor;
}

export function metaDentroDeDisponible(meta: number, disponible: number): boolean {
  return meta > 0 && meta <= disponible + META_EPSILON;
}

export function formatearMoneda(valor: number | string | null | undefined): string {
  const numero = Number(valor || 0);
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(numero);
}

export function formatearNumero(valor: number | null | undefined): string {
  return new Intl.NumberFormat("es-CO", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 4,
  }).format(Number(valor || 0));
}

export function getColorProgreso(porcentaje: number): string {
  if (porcentaje < 25) return "danger";
  if (porcentaje < 50) return "warning";
  if (porcentaje < 75) return "info";
  return "success";
}

export function getColorEstadoProducto(estado: string): string {
  switch (estado) {
    case "COMPLETADO":
      return "success";
    case "EN_PROGRESO":
      return "info";
    case "PENDIENTE":
      return "warning";
    case "POR_EJECUTAR":
      return "secondary";
    default:
      return "secondary";
  }
}

export function getTextoEstadoProducto(estado: string): string {
  switch (estado) {
    case "COMPLETADO":
      return "Completado";
    case "EN_PROGRESO":
      return "En Progreso";
    case "PENDIENTE":
      return "Pendiente";
    case "POR_EJECUTAR":
      return "Por Ejecutar";
    default:
      return estado;
  }
}

export function mapProductoToResumen(producto: PdmProducto): ResumenProducto {
  const totalCuatrienio = producto.total_2024 + producto.total_2025 + producto.total_2026 + producto.total_2027;
  return {
    id: producto.id,
    codigo: producto.codigo_producto,
    producto: producto.producto_mga || producto.indicador_producto_mga || producto.personalizacion_indicador || "",
    producto_mga: producto.producto_mga,
    indicador_producto_mga: producto.indicador_producto_mga,
    linea_estrategica: producto.linea_estrategica,
    sector: producto.sector_mga,
    programa_mga: producto.programa_mga,
    ods: producto.ods,
    tipo_acumulacion: producto.tipo_acumulacion,
    bpin: producto.bpin,
    meta_cuatrienio: producto.meta_cuatrienio,
    unidad_medida: producto.unidad_medida,
    programacion_2024: producto.programacion_2024,
    programacion_2025: producto.programacion_2025,
    programacion_2026: producto.programacion_2026,
    programacion_2027: producto.programacion_2027,
    total_2024: producto.total_2024,
    total_2025: producto.total_2025,
    total_2026: producto.total_2026,
    total_2027: producto.total_2027,
    total_cuatrienio: totalCuatrienio,
    pto_definitivo_anio: producto.pto_definitivo_anio,
    pagos_anio: producto.pagos_anio,
    avance_financiero_anio: producto.avance_financiero_anio,
    porcentaje_ejecucion: producto.porcentaje_ejecucion || 0,
    avance_anio: producto.avance_anio,
    estado_anio: producto.estado_anio,
    responsable_secretaria: producto.responsable_secretaria,
    responsable_secretaria_nombre: producto.responsable_secretaria_nombre,
    resumen_por_anio: producto.resumen_por_anio,
    actividades: producto.actividades || [],
  };
}

export function getMetaAnio(producto: ResumenProducto, anio: number): number {
  switch (anio) {
    case 2024:
      return producto.programacion_2024;
    case 2025:
      return producto.programacion_2025;
    case 2026:
      return producto.programacion_2026;
    case 2027:
      return producto.programacion_2027;
    default:
      return 0;
  }
}

export function getPresupuestoAnio(producto: ResumenProducto, anio: number): number {
  switch (anio) {
    case 2024:
      return producto.total_2024;
    case 2025:
      return producto.total_2025;
    case 2026:
      return producto.total_2026;
    case 2027:
      return producto.total_2027;
    default:
      return 0;
  }
}

export function getEjecucionDefinitivoProductoAnio(producto: ResumenProducto): number {
  return Number(producto.pto_definitivo_anio || 0);
}

export function getAvanceFinancieroAnio(producto: ResumenProducto): number {
  if (producto.avance_financiero_anio != null) {
    return Number(producto.avance_financiero_anio);
  }
  const pto = getEjecucionDefinitivoProductoAnio(producto);
  const pagos = Number(producto.pagos_anio || 0);
  return pto > 0 ? Math.round((pagos / pto) * 1000) / 10 : 0;
}

export function resumenBackendPorAnio(
  producto: ResumenProducto,
  anio: number,
): ResumenAnioBackend | null {
  return producto.resumen_por_anio?.[String(anio)] ?? null;
}

export function obtenerResumenActividadesPorAnio(producto: ResumenProducto, anio: number): ResumenActividadesAnio {
  const backend = resumenBackendPorAnio(producto, anio);
  const actividades = producto.actividades.filter((a) => a.anio === anio);
  if (backend) {
    return {
      anio,
      meta_programada: backend.meta_programada,
      meta_asignada: backend.meta_asignada,
      meta_disponible: backend.meta_disponible,
      meta_ejecutada: backend.meta_ejecutada,
      total_actividades: backend.total_actividades,
      actividades_completadas: backend.actividades_completadas,
      porcentaje_avance: backend.porcentaje_avance,
      actividades,
    };
  }

  const metaProgramada = getMetaAnio(producto, anio);
  const metaAsignada = actividades.reduce((sum, a) => sum + Number(a.meta_ejecutar || 0), 0);
  const actividadesCompletadas = actividades.filter(
    (a) => a.tiene_evidencia === true || a.estado === "COMPLETADA",
  );
  const metaEjecutada = actividadesCompletadas.reduce((sum, a) => sum + Number(a.meta_ejecutar || 0), 0);
  let porcentajeAvance = 0;
  if (metaEjecutada > 0 && metaProgramada > 0) {
    porcentajeAvance = Math.min(100, (metaEjecutada / metaProgramada) * 100);
  }

  return {
    anio,
    meta_programada: metaProgramada,
    meta_asignada: metaAsignada,
    meta_disponible: Math.max(0, metaProgramada - metaAsignada),
    meta_ejecutada: metaEjecutada,
    total_actividades: actividades.length,
    actividades_completadas: actividadesCompletadas.length,
    porcentaje_avance: porcentajeAvance,
    actividades,
  };
}

export function getAvanceAnio(producto: ResumenProducto, anio: number, anioRef?: number): number {
  const backend = resumenBackendPorAnio(producto, anio);
  if (backend) return backend.porcentaje_avance;
  const tieneActividadesAnio = producto.actividades.some((a) => a.anio === anio);
  if (tieneActividadesAnio) {
    return obtenerResumenActividadesPorAnio(producto, anio).porcentaje_avance;
  }
  if (anioRef !== undefined && anio === anioRef && producto.avance_anio !== undefined) {
    return producto.avance_anio;
  }
  return obtenerResumenActividadesPorAnio(producto, anio).porcentaje_avance;
}

export function getEstadoProductoAnio(producto: ResumenProducto, anio: number, anioRef?: number): string {
  if (!producto.actividades.some((a) => a.anio === anio) && anioRef !== undefined && anio === anioRef && producto.estado_anio) {
    return producto.estado_anio;
  }
  const avance = getAvanceAnio(producto, anio, anioRef);
  const resumen = obtenerResumenActividadesPorAnio(producto, anio);
  if (anio > new Date().getFullYear() && resumen.meta_programada > 0) return "POR_EJECUTAR";
  if (avance >= 100) return "COMPLETADO";
  if (avance === 0 && resumen.total_actividades === 0) return "PENDIENTE";
  if (resumen.total_actividades > 0) return "EN_PROGRESO";
  return "PENDIENTE";
}

export function getEjecucionDefinitivoAnio(resumen: ResumenEjecucionAnual | null, anio: number): number {
  const item = resumen?.anios.find((a) => a.anio === anio);
  return Number(item?.pto_definitivo || 0);
}

export function getEjecucionTotalDefinitivo(resumen: ResumenEjecucionAnual | null): number {
  return Number(resumen?.totales?.pto_definitivo || 0);
}

/** @deprecated Use getEjecucionDefinitivoAnio */
export function getEjecucionPagosAnio(resumen: ResumenEjecucionAnual | null, anio: number): number {
  return getEjecucionDefinitivoAnio(resumen, anio);
}

/** @deprecated Use getEjecucionTotalDefinitivo */
export function getEjecucionTotalPagos(resumen: ResumenEjecucionAnual | null): number {
  return getEjecucionTotalDefinitivo(resumen);
}

export function getAniosConMetas(producto: ResumenProducto): number {
  return ANIOS_PDM.filter((anio) => getMetaAnio(producto, anio) > 0).length;
}

export function calcularMetaDisponible(producto: ResumenProducto, anio: number): number {
  const metaProgramada = getMetaAnio(producto, anio);
  const metaAsignada = producto.actividades
    .filter((a) => a.anio === anio)
    .reduce((sum, a) => sum + Number(a.meta_ejecutar || 0), 0);
  return redondearMeta(Math.max(0, metaProgramada - metaAsignada));
}

export function validarMetaActividad(
  producto: ResumenProducto,
  anio: number,
  metaEjecutar: number,
  actividadId?: number,
): { valido: boolean; mensaje: string; disponible: number } {
  const metaDisponible = calcularMetaDisponible(producto, anio);
  let metaActual = 0;
  if (actividadId) {
    const actividad = producto.actividades.find((a) => a.id === actividadId);
    if (actividad) metaActual = redondearMeta(Number(actividad.meta_ejecutar || 0));
  }
  const disponibleConActual = redondearMeta(metaDisponible + metaActual);
  const meta = redondearMeta(metaEjecutar);
  if (meta <= 0) {
    return { valido: false, mensaje: "La meta a ejecutar debe ser mayor a 0", disponible: disponibleConActual };
  }
  if (!metaDentroDeDisponible(meta, disponibleConActual)) {
    return {
      valido: false,
      mensaje: `La meta a ejecutar excede la disponible (${formatearNumero(disponibleConActual)} ${producto.unidad_medida || ""})`,
      disponible: disponibleConActual,
    };
  }
  return { valido: true, mensaje: "Meta válida", disponible: disponibleConActual };
}

export function getTextoEstadoActividad(estado: string): string {
  switch (estado) {
    case "COMPLETADA":
      return "Completada";
    case "EN_PROGRESO":
      return "En Progreso";
    case "PENDIENTE":
      return "Pendiente";
    case "CANCELADA":
      return "Cancelada";
    default:
      return estado;
  }
}

export function getColorEstadoActividad(estado: string): string {
  switch (estado) {
    case "COMPLETADA":
      return "success";
    case "EN_PROGRESO":
      return "info";
    case "PENDIENTE":
      return "warning";
    case "CANCELADA":
      return "secondary";
    default:
      return "secondary";
  }
}

export function statsFromApi(stats: {
  presupuesto_por_anio: Record<string, number>;
  presupuesto_total: number;
  presupuesto_por_linea: { linea: string; total: number }[];
  presupuesto_por_sector: { sector: string; total: number }[];
  total_lineas_estrategicas: number;
  total_productos: number;
  total_iniciativas_sgr: number;
}): EstadisticasPdm {
  return {
    total_lineas_estrategicas: stats.total_lineas_estrategicas,
    total_productos: stats.total_productos,
    total_iniciativas_sgr: stats.total_iniciativas_sgr,
    presupuesto_total: stats.presupuesto_total,
    presupuestoPorAnio: {
      anio2024: stats.presupuesto_por_anio["2024"] ?? stats.presupuesto_por_anio[2024 as unknown as string] ?? 0,
      anio2025: stats.presupuesto_por_anio["2025"] ?? 0,
      anio2026: stats.presupuesto_por_anio["2026"] ?? 0,
      anio2027: stats.presupuesto_por_anio["2027"] ?? 0,
    },
    presupuesto_por_linea: stats.presupuesto_por_linea,
    presupuesto_por_sector: stats.presupuesto_por_sector,
  };
}

export function formatFechaCorta(value?: string | null): string {
  if (!value) return "N/D";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("es-CO", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "America/Bogota",
  }).format(date);
}

export function formatFechaHora(value?: string | null): string {
  if (!value) return "N/D";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("es-CO", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Bogota",
  }).format(date);
}

export function esCodigoFuentePresupuestal(value?: string | null): boolean {
  if (!value) return false;
  return /^\d+(\.\d+)+$/.test(value.trim());
}

export function etiquetaFuentePresupuestal(fuente: { nombre: string; codigo_fuente?: string | null }): string {
  if (fuente.nombre && !esCodigoFuentePresupuestal(fuente.nombre)) {
    return fuente.nombre;
  }
  return fuente.nombre || fuente.codigo_fuente || "Sin Fuente";
}

export function fuentePresupuestalTieneValores(fuente: {
  pto_inicial?: number;
  adicion?: number;
  reduccion?: number;
  credito?: number;
  contracredito?: number;
  pto_definitivo?: number;
  pagos?: number;
}): boolean {
  return (
    (fuente.pto_inicial ?? 0) !== 0 ||
    (fuente.adicion ?? 0) !== 0 ||
    (fuente.reduccion ?? 0) !== 0 ||
    (fuente.credito ?? 0) !== 0 ||
    (fuente.contracredito ?? 0) !== 0 ||
    (fuente.pto_definitivo ?? 0) !== 0 ||
    (fuente.pagos ?? 0) !== 0
  );
}
