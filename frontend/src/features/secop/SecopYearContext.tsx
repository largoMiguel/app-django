import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { secopApi } from "@/core/api/secop";

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
    secopApi
      .config()
      .then((cfg) => {
        if (cancelled) return;
        setAniosDisponibles(cfg.anios_disponibles);
        setAnio(cfg.anio_default || new Date().getFullYear());
      })
      .catch(() => {
        if (!cancelled) setAniosDisponibles([new Date().getFullYear()]);
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
