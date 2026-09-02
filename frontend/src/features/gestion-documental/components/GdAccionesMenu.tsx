import { useEffect, useRef, useState } from "react";
import { ChevronDown, Download, MoreHorizontal } from "lucide-react";
import { btnPrimary } from "./GdUi";

export interface GdAccionItem {
  id: string;
  label: string;
  icon?: React.ReactNode;
  onClick?: () => void;
  /** Si se define, el ítem abre un input file oculto */
  accept?: string;
  onFile?: (file: File) => void;
  disabled?: boolean;
}

interface GdAccionesMenuProps {
  items: GdAccionItem[];
  disabled?: boolean;
}

export default function GdAccionesMenu({ items, disabled }: GdAccionesMenuProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const pendingFileHandler = useRef<((file: File) => void) | null>(null);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  if (items.length === 0) return null;

  function triggerFile(item: GdAccionItem) {
    pendingFileHandler.current = item.onFile ?? null;
    if (fileRef.current) {
      fileRef.current.accept = item.accept ?? "";
      fileRef.current.click();
    }
    setOpen(false);
  }

  return (
    <div className="relative" ref={ref}>
      <input
        ref={fileRef}
        type="file"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f && pendingFileHandler.current) pendingFileHandler.current(f);
          pendingFileHandler.current = null;
          e.target.value = "";
        }}
      />
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        className={btnPrimary}
        aria-expanded={open}
        aria-haspopup="menu"
      >
        <MoreHorizontal className="h-4 w-4" />
        Acciones
        <ChevronDown className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 z-50 mt-1 min-w-[240px] overflow-hidden rounded-[0.3rem] border border-slate-200 bg-white py-1 shadow-lg"
        >
          {items.map((item) => (
            <button
              key={item.id}
              type="button"
              role="menuitem"
              disabled={item.disabled}
              className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              onClick={() => {
                if (item.onFile) {
                  triggerFile(item);
                } else {
                  setOpen(false);
                  item.onClick?.();
                }
              }}
            >
              {item.icon ?? <Download className="h-4 w-4 text-slate-500" />}
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
