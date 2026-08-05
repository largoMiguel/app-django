import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

interface PlanesYearContextValue {
  anio: number;
  setAnio: (y: number) => void;
  aniosDisponibles: number[];
}

const PlanesYearContext = createContext<PlanesYearContextValue | null>(null);

export function PlanesYearProvider({ children }: { children: ReactNode }) {
  const currentYear = new Date().getFullYear();
  const aniosDisponibles = useMemo(
    () => [currentYear - 1, currentYear, currentYear + 1],
    [currentYear],
  );
  const [anio, setAnio] = useState(currentYear);

  return (
    <PlanesYearContext.Provider value={{ anio, setAnio, aniosDisponibles }}>
      {children}
    </PlanesYearContext.Provider>
  );
}

export function usePlanesYear() {
  const ctx = useContext(PlanesYearContext);
  if (!ctx) throw new Error("usePlanesYear debe usarse dentro de PlanesYearProvider");
  return ctx;
}
