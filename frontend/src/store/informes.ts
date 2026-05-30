import { create } from "zustand";

interface InformesStore {
  isOpen: boolean;
  open: () => void;
  close: () => void;
}

export const useInformesStore = create<InformesStore>((set) => ({
  isOpen: false,
  open: () => set({ isOpen: true }),
  close: () => set({ isOpen: false }),
}));
