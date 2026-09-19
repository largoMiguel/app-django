import { Loader2, type ReactNode } from "lucide-react";

export const inputClass =
  "h-10 w-full rounded-[0.3rem] border border-slate-300 px-3 text-sm text-slate-700 focus:border-[#3eafd4] focus:outline-none focus:ring-1 focus:ring-[#3eafd4]";

export const btnPrimary =
  "inline-flex items-center justify-center gap-2 rounded-[0.3rem] bg-[#3eafd4] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#2f9fc2] disabled:opacity-50";

export const btnSecondary =
  "inline-flex items-center justify-center gap-2 rounded-[0.3rem] border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50";

export function PqrsCard({
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

export function PqrsLoading({ label = "Cargando…" }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-12 text-sm text-slate-500">
      <Loader2 className="h-5 w-5 animate-spin text-[#3eafd4]" />
      {label}
    </div>
  );
}
