import axios, {
  type AxiosInstance,
  type InternalAxiosRequestConfig,
} from "axios";
import { useAuthStore } from "@/core/auth/store";
import { clearClientSession } from "@/core/auth/session";

const API_URL = import.meta.env.VITE_API_URL || "/api/v1";

export const api: AxiosInstance = axios.create({
  baseURL: API_URL,
  timeout: 15_000,
});

export const PUBLIC_API_BASE =
  import.meta.env.VITE_API_URL?.replace(/\/api\/v1\/?$/, "") || "";

let refreshing: Promise<string | null> | null = null;

async function refreshAccess(): Promise<string | null> {
  const { refreshToken, setTokens } = useAuthStore.getState();
  if (!refreshToken) return null;
  try {
    const { data } = await axios.post(`${API_URL}/auth/refresh`, {
      refresh: refreshToken,
    });
    setTokens(data.access, data.refresh ?? refreshToken);
    return data.access as string;
  } catch {
    clearClientSession();
    return null;
  }
}

async function fetchWithAuth(url: string): Promise<Response> {
  const absolute = url.startsWith("http") ? url : `${window.location.origin}${url}`;
  let token = useAuthStore.getState().accessToken;

  const doFetch = (t: string | null) =>
    fetch(absolute, {
      headers: t ? { Authorization: `Bearer ${t}` } : {},
    });

  let response = await doFetch(token);
  if (response.status === 401 && token) {
    refreshing ??= refreshAccess().finally(() => (refreshing = null));
    const newToken = await refreshing;
    if (newToken) {
      token = newToken;
      response = await doFetch(newToken);
    }
  }
  return response;
}

/** Descarga un archivo media protegido con JWT (reintenta refresh en 401). */
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

api.interceptors.request.use((cfg: InternalAxiosRequestConfig) => {
  const token = useAuthStore.getState().accessToken;
  if (token) cfg.headers.Authorization = `Bearer ${token}`;
  return cfg;
});

api.interceptors.response.use(
  (res) => res,
  async (err) => {
    const original = err.config as InternalAxiosRequestConfig & {
      _retry?: boolean;
    };
    if (
      err.response?.status === 401 &&
      !original._retry &&
      !original.url?.includes("/auth/")
    ) {
      original._retry = true;
      refreshing ??= refreshAccess().finally(() => (refreshing = null));
      const newToken = await refreshing;
      if (newToken) {
        original.headers.Authorization = `Bearer ${newToken}`;
        return api(original);
      }
    }
    return Promise.reject(err);
  },
);
