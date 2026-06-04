import { api } from "@/core/api/client";

export interface AppUser {
  id: number;
  email: string;
  full_name: string;
  role: string;
  roles: string[];
  is_active: boolean;
  is_staff: boolean;
  is_superuser: boolean;
  entity: number | null;
  entity_name: string | null;
  secretaria: number | null;
  secretaria_nombre: string | null;
  date_joined?: string;
  last_login?: string | null;
  enabled_modules?: string[];
}

export interface CreateUserPayload {
  email: string;
  full_name: string;
  role: "admin" | "secretario" | "ciudadano" | "superadmin";
  password?: string;
  invite?: boolean;
  entity?: number | null;
  secretaria?: number | null;
  nueva_secretaria_nombre?: string;
  is_active?: boolean;
  enabled_modules?: string[];
}

export interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

function parsePaginated<T>(d: T[] | PaginatedResponse<T>): PaginatedResponse<T> {
  if (Array.isArray(d)) {
    return { count: d.length, next: null, previous: null, results: d };
  }
  return d;
}

export const usersApi = {
  listPaginated: (params?: Record<string, string | number>) =>
    api
      .get<AppUser[] | PaginatedResponse<AppUser>>("/users/", { params })
      .then((r) => parsePaginated(r.data)),
  list: (params?: Record<string, string | number>) =>
    usersApi.listPaginated(params).then((d) => d.results),
  create: (payload: CreateUserPayload) =>
    api.post<AppUser>("/users/", payload).then((r) => r.data),
  update: (id: number, payload: Partial<CreateUserPayload>) =>
    api.patch<AppUser>(`/users/${id}/`, payload).then((r) => r.data),
  deactivate: (id: number) => api.delete(`/users/${id}/`),
  purge: (id: number) => api.delete(`/users/${id}/`, { params: { purge: true } }),
};
