import type { EstadoPQRS, TipoSolicitud } from "@/core/api/pqrs";

/** Etiquetas de tipo de solicitud (fuente única). */
export const TIPO_SOLICITUD_LABEL: Record<TipoSolicitud, string> = {
  peticion: "Petición",
  queja: "Queja",
  reclamo: "Reclamo",
  sugerencia: "Sugerencia",
  denuncia: "Denuncia",
  felicitacion: "Felicitación",
  solicitud_informacion: "Solicitud de información",
  copia: "Copia de documentos",
  otro: "Otro",
};

/** Etiquetas y clases Tailwind por estado. */
export const ESTADO_LABEL: Record<EstadoPQRS, { label: string; color: string }> = {
  recibida: { label: "Recibida", color: "bg-slate-100 text-slate-700" },
  asignada: { label: "Asignada", color: "bg-blue-100 text-blue-700" },
  en_proceso: { label: "En proceso", color: "bg-amber-100 text-amber-700" },
  respondida: { label: "Respondida", color: "bg-emerald-100 text-emerald-700" },
  rechazada_asignacion: { label: "Asig. rechazada", color: "bg-red-100 text-red-700" },
  cerrada: { label: "Cerrada", color: "bg-gray-100 text-gray-600" },
};

/** Colores hex para gráficos (Recharts). */
export const ESTADO_CHART_COLORS: Record<EstadoPQRS, string> = {
  recibida: "#64748b",
  asignada: "#3b82f6",
  en_proceso: "#f59e0b",
  respondida: "#10b981",
  rechazada_asignacion: "#ef4444",
  cerrada: "#6b7280",
};

/** Canal de llegada de la PQRS. */
export const CANAL_LLEGADA_LABEL: Record<string, string> = {
  web: "Web",
  presencial: "Presencial",
  email: "Email",
  telefono: "Teléfono",
  carta: "Carta",
  buzon: "Buzón de sugerencias",
  entrega_fisica: "Entrega física",
};

/** Roles de usuario (informes, UI). */
export const ROLE_LABEL: Record<string, string> = {
  admin: "Administrador",
  secretario: "Secretario(a)",
  ciudadano: "Ciudadano",
  superadmin: "Superadministrador",
};

export const TIPO_SOLICITUD_KEYS = Object.keys(TIPO_SOLICITUD_LABEL) as TipoSolicitud[];
export const ESTADO_KEYS = Object.keys(ESTADO_LABEL) as EstadoPQRS[];

export function labelTipo(tipo: string): string {
  return TIPO_SOLICITUD_LABEL[tipo as TipoSolicitud] ?? tipo;
}

export function labelEstado(estado: string): string {
  return ESTADO_LABEL[estado as EstadoPQRS]?.label ?? estado;
}

export function labelCanal(canal: string): string {
  return CANAL_LLEGADA_LABEL[canal] ?? canal;
}
