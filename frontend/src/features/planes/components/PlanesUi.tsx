import { useRef, type ReactNode } from "react";
import { CloudUpload, Loader2, X } from "lucide-react";

export function PlanesCard({
  title,
  icon,
  children,
  className = "",
}: {
  title?: ReactNode;
  icon?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm ${className}`}>
      {title && (
        <div className="border-b border-slate-100 bg-slate-50/80 px-4 py-3 sm:px-5">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-800">
            {icon}
            {title}
          </h2>
        </div>
      )}
      <div className="p-4 sm:p-5">{children}</div>
    </div>
  );
}

export function PlanesModal({
  open,
  title,
  onClose,
  children,
  wide = false,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div
        className={`max-h-[90vh] w-full overflow-y-auto rounded-xl bg-white shadow-xl ${wide ? "max-w-3xl" : "max-w-lg"}`}
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
          <button type="button" onClick={onClose} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

export function PlanesBadge({
  children,
  tone = "slate",
}: {
  children: ReactNode;
  tone?: "slate" | "success" | "info" | "warning" | "danger";
}) {
  const tones = {
    slate: "bg-slate-100 text-slate-700",
    success: "bg-emerald-100 text-emerald-800",
    info: "bg-cyan-100 text-cyan-800",
    warning: "bg-amber-100 text-amber-800",
    danger: "bg-red-100 text-red-800",
  };
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${tones[tone]}`}>
      {children}
    </span>
  );
}

export function PlanesFilePicker({
  files,
  onChange,
  maxFiles = 5,
  accept = ".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg,.webp",
}: {
  files: File[];
  onChange: (files: File[]) => void;
  maxFiles?: number;
  accept?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        multiple
        accept={accept}
        className="hidden"
        onChange={(e) => {
          const picked = Array.from(e.target.files || []);
          onChange([...files, ...picked].slice(0, maxFiles));
          e.target.value = "";
        }}
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={files.length >= maxFiles}
        className="flex w-full items-center justify-center gap-2 rounded-lg border-2 border-dashed border-slate-200 px-4 py-6 text-sm text-slate-500 transition hover:border-[#3eafd4] hover:text-[#0e7490] disabled:opacity-50"
      >
        <CloudUpload className="h-5 w-5" />
        Subir archivos (máx. {maxFiles}, PDF/Office/imagen, 20 MB c/u)
      </button>
      {files.length > 0 && (
        <ul className="mt-2 space-y-1">
          {files.map((f, i) => (
            <li key={`${f.name}-${i}`} className="flex items-center justify-between rounded bg-slate-50 px-3 py-1.5 text-sm">
              <span className="truncate">{f.name}</span>
              <button
                type="button"
                onClick={() => onChange(files.filter((_, idx) => idx !== i))}
                className="text-red-500 hover:text-red-700"
              >
                <X className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function PlanesLoading({ message = "Cargando…" }: { message?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-12 text-slate-500">
      <Loader2 className="h-5 w-5 animate-spin" />
      {message}
    </div>
  );
}

export const inputClass =
  "w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-[#3eafd4] focus:outline-none focus:ring-1 focus:ring-[#3eafd4]";
export const btnPrimary =
  "inline-flex items-center justify-center rounded-lg bg-[#3eafd4] px-4 py-2 text-sm font-medium text-white hover:bg-[#35a0c4] disabled:opacity-50";
export const btnSecondary =
  "inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50";
