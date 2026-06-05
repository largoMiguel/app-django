import axios, {
  type AxiosInstance,
  type InternalAxiosRequestConfig,
} from "axios";
import {
  forceClerkSignOut,
  parseAuthErrorCode,
} from "@/core/auth/authErrors";
import { getClerkToken } from "@/core/auth/clerkToken";
import { clearClientSession } from "@/core/auth/session";

const API_URL = import.meta.env.VITE_API_URL || "/api/v1";

export const api: AxiosInstance = axios.create({
  baseURL: API_URL,
  timeout: 15_000,
});

export const PUBLIC_API_BASE =
  import.meta.env.VITE_API_URL?.replace(/\/api\/v1\/?$/, "") || "";

async function fetchWithAuth(url: string): Promise<Response> {
  const absolute = url.startsWith("http") ? url : `${window.location.origin}${url}`;
  const token = await getClerkToken();

  const response = await fetch(absolute, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });

  if (response.status === 401 && token) {
    const body = await response.clone().json().catch(() => ({}));
    const blockCode = parseAuthErrorCode({ response: { data: body } });
    clearClientSession();
    await forceClerkSignOut(blockCode);
    if (!window.location.pathname.startsWith("/login")) {
      window.location.href = "/login";
    }
  }

  return response;
}

/** Descarga un archivo media protegido con token Clerk. */
export async function fetchAuthenticatedFile(url: string): Promise<Blob> {
  const response = await fetchWithAuth(url);
  if (!response.ok) {
    throw new Error("No se pudo abrir el archivo.");
  }
  return response.blob();
}

export async function downloadAuthenticatedFile(url: string, filename: string): Promise<void> {
  const blob = await fetchAuthenticatedFile(url);
  const blobUrl = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = blobUrl;
  anchor.download = filename;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000);
}

export async function openAuthenticatedFile(url: string): Promise<void> {
  const blob = await fetchAuthenticatedFile(url);
  const blobUrl = URL.createObjectURL(blob);
  window.open(blobUrl, "_blank");
  setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000);
}

api.interceptors.request.use(async (cfg: InternalAxiosRequestConfig) => {
  const token = await getClerkToken();
  if (token) cfg.headers.Authorization = `Bearer ${token}`;
  return cfg;
});

api.interceptors.response.use(
  (res) => res,
  async (err) => {
    if (err.response?.status === 401) {
      const blockCode = parseAuthErrorCode(err);
      clearClientSession();
      await forceClerkSignOut(blockCode);
      if (!window.location.pathname.startsWith("/login")) {
        window.location.href = "/login";
      }
    }
    return Promise.reject(err);
  },
);
