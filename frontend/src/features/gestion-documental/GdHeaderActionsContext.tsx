import { createContext, useContext, useState, type ReactNode } from "react";

interface GdHeaderActionsContextValue {
  headerActions: ReactNode | null;
  setHeaderActions: (actions: ReactNode | null) => void;
}

const GdHeaderActionsContext = createContext<GdHeaderActionsContextValue | null>(null);

export function GdHeaderActionsProvider({ children }: { children: ReactNode }) {
  const [headerActions, setHeaderActions] = useState<ReactNode | null>(null);
  return (
    <GdHeaderActionsContext.Provider value={{ headerActions, setHeaderActions }}>
      {children}
    </GdHeaderActionsContext.Provider>
  );
}

export function useGdHeaderActions() {
  const ctx = useContext(GdHeaderActionsContext);
  if (!ctx) {
    throw new Error("useGdHeaderActions debe usarse dentro de GdHeaderActionsProvider");
  }
  return ctx;
}
