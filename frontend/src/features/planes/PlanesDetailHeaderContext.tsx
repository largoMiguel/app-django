import { createContext, useContext, useState, type ReactNode } from "react";

interface PlanesDetailHeaderContextValue {
  headerActions: ReactNode | null;
  setHeaderActions: (actions: ReactNode | null) => void;
}

const PlanesDetailHeaderContext = createContext<PlanesDetailHeaderContextValue | null>(null);

export function PlanesDetailHeaderProvider({ children }: { children: ReactNode }) {
  const [headerActions, setHeaderActions] = useState<ReactNode | null>(null);
  return (
    <PlanesDetailHeaderContext.Provider value={{ headerActions, setHeaderActions }}>
      {children}
    </PlanesDetailHeaderContext.Provider>
  );
}

export function usePlanesDetailHeader() {
  const ctx = useContext(PlanesDetailHeaderContext);
  if (!ctx) {
    throw new Error("usePlanesDetailHeader debe usarse dentro de PlanesDetailHeaderProvider");
  }
  return ctx;
}
