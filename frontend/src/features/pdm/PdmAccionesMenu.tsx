import { useEffect, useRef, useState } from "react";
import { ChevronDown, FolderKanban, MoreHorizontal, RefreshCw, Upload } from "lucide-react";
import { pdmBtnPrimary } from "@/features/pdm/pdmLayout";

interface PdmAccionesMenuProps {
  onProyectos: () => void;
  onContratos: () => void;
  onEjecucion: () => void;
  onRecargarPdm: () => void;
  disabled?: boolean;
}

export default function PdmAccionesMenu({
  onProyectos,
  onContratos,
  onEjecucion,
  onRecargarPdm,
  disabled,
}: PdmAccionesMenuProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        className={pdmBtnPrimary}
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
          className="absolute right-0 z-50 mt-1 min-w-[220px] overflow-hidden rounded-[0.3rem] border border-slate-200 bg-white py-1 shadow-lg"
        >
          <button
            type="button"
            role="menuitem"
            className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm text-slate-700 hover:bg-slate-50"
            onClick={() => {
              setOpen(false);
              onProyectos();
            }}
          >
            <FolderKanban className="h-4 w-4 text-cyan-600" />
            Proyectos
          </button>
          <div className="my-1 border-t border-slate-100" />
          <button
            type="button"
            role="menuitem"
            className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm text-slate-700 hover:bg-slate-50"
            onClick={() => {
              setOpen(false);
              onContratos();
            }}
          >
            <Upload className="h-4 w-4 text-amber-600" />
            Contratos RPS
          </button>
          <button
            type="button"
            role="menuitem"
            className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm text-slate-700 hover:bg-slate-50"
            onClick={() => {
              setOpen(false);
              onEjecucion();
            }}
          >
            <Upload className="h-4 w-4 text-emerald-600" />
            Ejecución presupuestal
          </button>
          <button
            type="button"
            role="menuitem"
            className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm text-slate-700 hover:bg-slate-50"
            onClick={() => {
              setOpen(false);
              onRecargarPdm();
            }}
          >
            <RefreshCw className="h-4 w-4 text-blue-600" />
            Cargar nuevamente PDM
          </button>
        </div>
      )}
    </div>
  );
}
