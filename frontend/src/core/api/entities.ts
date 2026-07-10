import { api } from "@/core/api/client";

export interface Entity {
  id: number;
  name: string;
  code: string;
  nit: string | null;
  slug: string;
  description: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  logo_url: string | null;
  horario_atencion: string | null;
  tiempo_respuesta: string | null;
  is_active: boolean;
  enable_pqrs: boolean;
  enable_users_admin: boolean;
  enable_reports_pdf: boolean;
  enable_ai_reports: boolean;
  enable_planes_institucionales: boolean;
  enable_contratacion: boolean;
  enable_pdm: boolean;
  enable_pdm_chat: boolean;
  pdm_chat_intro: string | null;
  pdm_chat_sugerencias: string[] | null;
  enable_asistencia: boolean;
  enable_correspondencia: boolean;
  enable_presupuesto: boolean;
  enabled_modules: string[];
  plan_name: string | null;
  pdf_template_url: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface Secretaria {
  id: number;
  entity: number;
  entity_name?: string;
  nombre: string;
  is_active: boolean;
  created_at?: string;
}

export interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

function parsePaginated<T>(data: T[] | PaginatedResponse<T>): PaginatedResponse<T> {
  if (Array.isArray(data)) {
    return { count: data.length, next: null, previous: null, results: data };
  }
  return data;
}

export const entitiesApi = {
  listPaginated: (params?: Record<string, string | number>) =>
    api
      .get<Entity[] | PaginatedResponse<Entity>>("/entities/", { params })
      .then((r) => parsePaginated(r.data)),
  list: () =>
    entitiesApi.listPaginated().then((d) => d.results),
  get: (id: number) => api.get<Entity>(`/entities/${id}/`).then((r) => r.data),
  create: (payload: Partial<Entity>) =>
    api.post<Entity>("/entities/", payload).then((r) => r.data),
  update: (id: number, payload: Partial<Entity>) =>
    api.patch<Entity>(`/entities/${id}/`, payload).then((r) => r.data),
  remove: (id: number, confirmSlug: string) =>
    api.delete(`/entities/${id}/`, { params: { confirm: confirmSlug } }),
  mine: () => api.get<Entity>("/entities/mine/").then((r) => r.data),
  uploadPdfTemplate: (id: number, file: File) => {
    const fd = new FormData();
    fd.append("file", file);
    return api
      .post<{ pdf_template_url: string; filename: string; has_template: boolean }>(
        `/entities/${id}/pdf-template/`,
        fd,
        { headers: { "Content-Type": "multipart/form-data" } },
      )
      .then((r) => r.data);
  },
  deletePdfTemplate: (id: number) =>
    api.delete<{ has_template: boolean }>(`/entities/${id}/pdf-template/`).then((r) => r.data),
};

export const secretariasApi = {
  listPaginated: (entityId?: number, params?: Record<string, string | number>) =>
    api
      .get<Secretaria[] | PaginatedResponse<Secretaria>>(
        "/secretarias/",
        {
          params: { ...(entityId ? { entity: entityId } : {}), ...(params || {}) },
        },
      )
      .then((r) => parsePaginated(r.data)),
  list: (entityId?: number) =>
    secretariasApi.listPaginated(entityId).then((d) => d.results),
  create: (payload: Partial<Secretaria>) =>
    api.post<Secretaria>("/secretarias/", payload).then((r) => r.data),
  update: (id: number, payload: Partial<Secretaria>) =>
    api.patch<Secretaria>(`/secretarias/${id}/`, payload).then((r) => r.data),
  remove: (id: number) => api.delete(`/secretarias/${id}/`),
};
