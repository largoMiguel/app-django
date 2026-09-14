import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { secopApi, type SecopConfig } from "@/core/api/secop";

const CONFIG_CACHE_KEY = "secop_config_v1";
const CONFIG_TTL_MS = 30 * 60 * 1000;

function readCachedConfig(): SecopConfig | null {
  try {
    const raw = sessionStorage.getItem(CONFIG_CACHE_KEY);
    if (!raw) return null;
    const { savedAt, data } = JSON.parse(raw) as { savedAt: number; data: SecopConfig };
    if (Date.now() - savedAt > CONFIG_TTL_MS) return null;
    return data;
  } catch {
    return null;
  }
}

function writeCachedConfig(data: SecopConfig) {
  try {
    sessionStorage.setItem(CONFIG_CACHE_KEY, JSON.stringify({ savedAt: Date.now(), data }));
  } catch {
    /* ignore quota errors */
  }
}

interface SecopYearContextValue {
  anio: number;
  setAnio: (y: number) => void;
  aniosDisponibles: number[];
  loadingConfig: boolean;
  refrescar: () => Promise<void>;
}

const SecopYearContext = createContext<SecopYearContextValue | null>(null);

export function SecopYearProvider({ children }: { children: ReactNode }) {
  const [anio, setAnio] = useState(new Date().getFullYear());
  const [aniosDisponibles, setAniosDisponibles] = useState<number[]>([]);
  const [loadingConfig, setLoadingConfig] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const cached = readCachedConfig();
    if (cached) {
      setAniosDisponibles(cached.anios_disponibles);
      setAnio(cached.anio_default || new Date().getFullYear());
      setLoadingConfig(false);
    }
    secopApi
      .config()
      .then((cfg) => {
        if (cancelled) return;
        writeCachedConfig(cfg);
        setAniosDisponibles(cfg.anios_disponibles);
        setAnio(cfg.anio_default || new Date().getFullYear());
      })
      .catch(() => {
        if (!cancelled && !cached) setAniosDisponibles([new Date().getFullYear()]);
      })
      .finally(() => {
        if (!cancelled) setLoadingConfig(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function refrescar() {
    await secopApi.refrescar(anio);
    try {
      sessionStorage.removeItem(CONFIG_CACHE_KEY);
    } catch {
      /* ignore */
    }
  }

  return (
    <SecopYearContext.Provider value={{ anio, setAnio, aniosDisponibles, loadingConfig, refrescar }}>
      {children}
    </SecopYearContext.Provider>
  );
}

export function useSecopYear() {
  const ctx = useContext(SecopYearContext);
  if (!ctx) throw new Error("useSecopYear debe usarse dentro de SecopYearProvider");
  return ctx;
}
