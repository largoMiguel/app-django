import { createContext, useContext, useState, type ReactNode } from "react";

interface PqrsHeaderActionsContextValue {
  headerActions: ReactNode | null;
  setHeaderActions: (actions: ReactNode | null) => void;
}

const PqrsHeaderActionsContext = createContext<PqrsHeaderActionsContextValue | null>(null);

export function PqrsHeaderActionsProvider({ children }: { children: ReactNode }) {
  const [headerActions, setHeaderActions] = useState<ReactNode | null>(null);
  return (
    <PqrsHeaderActionsContext.Provider value={{ headerActions, setHeaderActions }}>
      {children}
    </PqrsHeaderActionsContext.Provider>
  );
}

export function usePqrsHeaderActions() {
  const ctx = useContext(PqrsHeaderActionsContext);
  if (!ctx) {
    throw new Error("usePqrsHeaderActions debe usarse dentro de PqrsHeaderActionsProvider");
  }
  return ctx;
}
