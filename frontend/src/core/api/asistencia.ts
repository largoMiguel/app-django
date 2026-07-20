import axios from "axios";
import { api } from "@/core/api/client";
import type { PaginatedResponse } from "@/core/api/entities";

export interface Funcionario {
  id: number;
  entity: number;
  cedula: string;
  nombres: string;
  apellidos: string;
  nombre_completo: string;
  email: string;
  telefono: string;
  cargo: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface EquipoRegistro {
  id: number;
  entity: number;
  entity_name?: string;
  nombre: string;
  ubicacion: string;
  is_active: boolean;
  is_paired: boolean;
  paired_at: string | null;
  last_seen_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface RegistroAsistencia {
  id: number;
  entity: number;
  funcionario: number;
  funcionario_nombre: string;
  funcionario_cedula: string;
  equipo: number;
  equipo_nombre: string;
  tipo: string;
  tipo_label: string;
  fecha_hora: string;
  foto_url: string | null;
  created_at: string;
}

export interface AsistenciaStats {
  total_funcionarios: number;
  total_registros: number;
  registros_hoy: number;
  entradas_hoy: number;
  salidas_hoy: number;
  funcionarios_presentes: number;
  promedio_asistencia_semanal: number;
  asistencias_por_dia: number;
}

export interface PairingResponse {
  pairing_code: string;
  expires_in_seconds: number;
}

function parsePaginated<T>(data: T[] | PaginatedResponse<T>): PaginatedResponse<T> {
  if (Array.isArray(data)) {
    return { count: data.length, next: null, previous: null, results: data };
  }
  return data;
}

export const asistenciaApi = {
  stats: () => api.get<AsistenciaStats>("/asistencia/stats").then((r) => r.data),

  funcionarios: {
    list: (params?: Record<string, string | number | boolean>) =>
      api
        .get<Funcionario[] | PaginatedResponse<Funcionario>>("/asistencia/funcionarios", { params })
        .then((r) => parsePaginated(r.data)),
    create: (payload: Partial<Funcionario>) =>
      api.post<Funcionario>("/asistencia/funcionarios", payload).then((r) => r.data),
    update: (id: number, payload: Partial<Funcionario>) =>
      api.put<Funcionario>(`/asistencia/funcionarios/${id}`, payload).then((r) => r.data),
    remove: (id: number) => api.delete(`/asistencia/funcionarios/${id}`),
  },

  equipos: {
    list: () => api.get<EquipoRegistro[]>("/asistencia/equipos").then((r) => r.data),
    create: (payload: Partial<EquipoRegistro>) =>
      api.post<EquipoRegistro>("/asistencia/equipos", payload).then((r) => r.data),
    update: (id: number, payload: Partial<EquipoRegistro>) =>
      api.put<EquipoRegistro>(`/asistencia/equipos/${id}`, payload).then((r) => r.data),
    remove: (id: number) => api.delete(`/asistencia/equipos/${id}`),
    pairing: (id: number) =>
      api.post<PairingResponse>(`/asistencia/equipos/${id}/pairing`).then((r) => r.data),
    revoke: (id: number) => api.post(`/asistencia/equipos/${id}/revoke`),
  },

  registros: {
    list: (params?: Record<string, string | number>) =>
      api
        .get<RegistroAsistencia[] | PaginatedResponse<RegistroAsistencia>>("/asistencia/registros", {
          params,
        })
        .then((r) => parsePaginated(r.data)),
    exportUrl: (params?: Record<string, string>) => {
      const qs = new URLSearchParams(params as Record<string, string>).toString();
      const base = import.meta.env.VITE_API_URL || "/api/v1";
      return `${base}/asistencia/registros/export${qs ? `?${qs}` : ""}`;
    },
  },
};

const PUBLIC_BASE = `${import.meta.env.VITE_API_URL?.replace(/\/api\/v1\/?$/, "") || ""}/api/v1/public`;

export interface KioskSession {
  equipo: { id: number; nombre: string; ubicacion: string };
  entity: { id: number; name: string; logo_url: string | null };
  asistencias_por_dia: number;
  secuencia_tipos?: string[];
}

export interface KioskPairResult {
  device_token: string;
  equipo: { id: number; nombre: string; ubicacion: string };
  entity: { id: number; name: string; logo_url: string | null };
  asistencias_por_dia: number;
}

export interface KioskPunchResult {
  registro: RegistroAsistencia;
  mensaje: string;
  tipo_label: string;
  funcionario_nombre: string;
  hora: string;
  hint?: string;
  marcaciones_hoy?: number;
  marcaciones_totales?: number;
  jornada_completa?: boolean;
  siguiente_tipo?: string | null;
  siguiente_tipo_label?: string | null;
  device_token?: string;
}

const kioskClient = axios.create({
  baseURL: PUBLIC_BASE,
  timeout: 30_000,
});

export function getKioskToken(): string | null {
  return localStorage.getItem("softone.kiosk.token");
}

export function setKioskToken(token: string | null) {
  if (token) localStorage.setItem("softone.kiosk.token", token);
  else localStorage.removeItem("softone.kiosk.token");
}

export const kioskApi = {
  pair: (pairing_code: string) =>
    kioskClient.post<KioskPairResult>("/asistencia/kiosk/pair", { pairing_code }).then((r) => r.data),

  session: (token: string) =>
    kioskClient
      .get<KioskSession>("/asistencia/kiosk/session", {
        headers: { Authorization: `Bearer ${token}` },
      })
      .then((r) => r.data),

  punch: (
    token: string,
    payload: { cedula: string; foto_base64: string; idempotency_key: string },
  ) =>
    kioskClient
      .post<KioskPunchResult>("/asistencia/kiosk/registros", payload, {
        headers: { Authorization: `Bearer ${token}` },
      })
      .then((r) => r.data),
};
