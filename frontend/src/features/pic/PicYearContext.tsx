import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

interface PicYearContextValue {
  anio: number;
  setAnio: (y: number) => void;
  aniosDisponibles: number[];
}

const PicYearContext = createContext<PicYearContextValue | null>(null);

export function PicYearProvider({ children }: { children: ReactNode }) {
  const current = new Date().getFullYear();
  const aniosDisponibles = useMemo(
    () => [current + 1, current, current - 1, current - 2],
    [current],
  );
  const [anio, setAnio] = useState(current);

  return (
    <PicYearContext.Provider value={{ anio, setAnio, aniosDisponibles }}>
      {children}
    </PicYearContext.Provider>
  );
}

export function usePicYear() {
  const ctx = useContext(PicYearContext);
  if (!ctx) throw new Error("usePicYear debe usarse dentro de PicYearProvider");
  return ctx;
}
