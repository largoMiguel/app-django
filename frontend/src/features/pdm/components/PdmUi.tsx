import type { ReactNode } from "react";
import { Loader2, X } from "lucide-react";

export function PdmPageShell({ children }: { children: ReactNode }) {
  return <div className="mx-auto w-full max-w-[1600px] space-y-6 px-1 pb-8 sm:px-0">{children}</div>;
}

export function PdmPageHeader({
  title,
  subtitle,
  icon,
  actions,
}: {
  title: string;
  subtitle?: string;
  icon?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4 border-b border-slate-200 pb-5 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-slate-900">
          {icon}
          {title}
        </h1>
        {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function PdmCard({
  title,
  icon,
  children,
  className = "",
  headerClassName = "",
}: {
  title?: ReactNode;
  icon?: ReactNode;
  children: ReactNode;
  className?: string;
  headerClassName?: string;
}) {
  return (
    <div className={`overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm ${className}`}>
      {title && (
        <div className={`border-b border-slate-100 bg-slate-50/80 px-4 py-3 sm:px-5 ${headerClassName}`}>
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

export function PdmStatCard({
  label,
  value,
  hint,
  icon,
  onClick,
  accent = "slate",
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  icon?: ReactNode;
  onClick?: () => void;
  accent?: "slate" | "blue" | "cyan" | "amber" | "emerald" | "warning" | "info" | "success";
}) {
  const borders: Record<string, string> = {
    slate: "hover:border-slate-300",
    blue: "hover:border-blue-300",
    cyan: "hover:border-cyan-300",
    amber: "hover:border-amber-300",
    emerald: "hover:border-emerald-300",
    warning: "border-amber-200 hover:border-amber-400",
    info: "border-cyan-200 hover:border-cyan-400",
    success: "border-emerald-200 hover:border-emerald-400",
  };
  const Tag = onClick ? "button" : "div";
  return (
    <Tag
      type={onClick ? "button" : undefined}
      onClick={onClick}
      className={`w-full rounded-xl border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:shadow-md ${borders[accent]} ${onClick ? "cursor-pointer" : ""}`}
    >
      <div className="flex items-start gap-3">
        {icon && <div className="shrink-0 rounded-lg bg-slate-50 p-2">{icon}</div>}
        <div className="min-w-0 flex-1">
          <p className="text-2xl font-bold text-slate-900">{value}</p>
          <p className="text-sm font-medium text-slate-600">{label}</p>
          {hint && <p className="mt-0.5 text-xs text-slate-400">{hint}</p>}
        </div>
      </div>
    </Tag>
  );
}

export function PdmBadge({ children, tone = "slate" }: { children: ReactNode; tone?: string }) {
  const tones: Record<string, string> = {
    slate: "bg-slate-100 text-slate-700",
    success: "bg-emerald-100 text-emerald-800",
    info: "bg-cyan-100 text-cyan-800",
    warning: "bg-amber-100 text-amber-800",
    danger: "bg-red-100 text-red-800",
    secondary: "bg-slate-200 text-slate-700",
  };
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${tones[tone] || tones.slate}`}>
      {children}
    </span>
  );
}

export function PdmProgressBar({ value, tone = "blue", showLabel = true }: { value: number; tone?: string; showLabel?: boolean }) {
  const tones: Record<string, string> = {
    danger: "bg-red-500",
    warning: "bg-amber-500",
    info: "bg-cyan-500",
    success: "bg-emerald-500",
    blue: "bg-blue-600",
    primary: "bg-blue-600",
  };
  const pct = Math.min(100, Math.max(0, value));
  return (
    <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
      <div
        className={`flex h-full items-center justify-end rounded-full px-1 text-[10px] font-bold text-white transition-all ${tones[tone] || tones.blue}`}
        style={{ width: `${Math.max(pct, showLabel && pct > 8 ? pct : 0)}%`, minWidth: pct > 0 ? "2rem" : 0 }}
      >
        {showLabel && pct >= 12 ? `${pct.toFixed(0)}%` : null}
      </div>
    </div>
  );
}

export function PdmBtn({
  children,
  variant = "primary",
  size = "md",
  className = "",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "success" | "warning" | "danger" | "ghost" | "outline";
  size?: "sm" | "md" | "lg";
}) {
  const variants: Record<string, string> = {
    primary: "bg-blue-600 text-white hover:bg-blue-700",
    secondary: "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50",
    success: "bg-emerald-600 text-white hover:bg-emerald-700",
    warning: "bg-amber-500 text-white hover:bg-amber-600",
    danger: "border border-red-200 text-red-700 hover:bg-red-50",
    ghost: "text-slate-600 hover:bg-slate-100",
    outline: "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50",
  };
  const sizes: Record<string, string> = {
    sm: "px-2.5 py-1.5 text-xs",
    md: "px-3.5 py-2 text-sm",
    lg: "px-5 py-2.5 text-base",
  };
  return (
    <button
      type="button"
      className={`inline-flex items-center justify-center gap-1.5 rounded-lg font-medium transition disabled:opacity-50 ${variants[variant]} ${sizes[size]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

export function PdmSelect(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
      {...props}
    />
  );
}

export function PdmInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
      {...props}
    />
  );
}

export function PdmAlert({ children, tone = "info" }: { children: ReactNode; tone?: "info" | "warning" | "error" }) {
  const tones = {
    info: "border-cyan-200 bg-cyan-50 text-cyan-900",
    warning: "border-amber-200 bg-amber-50 text-amber-900",
    error: "border-red-200 bg-red-50 text-red-800",
  };
  return <div className={`rounded-lg border px-4 py-3 text-sm ${tones[tone]}`}>{children}</div>;
}

export function PdmLoadingOverlay({ message }: { message: string }) {
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-white/90 backdrop-blur-sm">
      <Loader2 className="h-10 w-10 animate-spin text-blue-600" />
      <p className="mt-4 text-sm text-slate-600">{message}</p>
    </div>
  );
}

export function PdmModal({
  open,
  title,
  headerTone = "slate",
  children,
  footer,
  onClose,
  wide,
}: {
  open: boolean;
  title: string;
  headerTone?: "slate" | "primary" | "success" | "cyan";
  children: ReactNode;
  footer?: ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  if (!open) return null;
  const headers = {
    slate: "bg-slate-800",
    primary: "bg-blue-700",
    success: "bg-emerald-700",
    cyan: "bg-cyan-600",
  };
  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-slate-900/50 p-0 sm:items-center sm:p-4">
      <div
        className={`flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-2xl bg-white shadow-xl sm:rounded-2xl ${wide ? "max-w-3xl" : "max-w-lg"}`}
        role="dialog"
        aria-modal
      >
        <div className={`flex items-center justify-between px-4 py-3 text-white sm:px-5 ${headers[headerTone]}`}>
          <h3 className="font-semibold">{title}</h3>
          <button type="button" onClick={onClose} className="rounded-lg p-1 hover:bg-white/20" aria-label="Cerrar">
            <X size={18} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 sm:p-5">{children}</div>
        {footer && <div className="flex flex-wrap justify-end gap-2 border-t border-slate-100 bg-slate-50 px-4 py-3 sm:px-5">{footer}</div>}
      </div>
    </div>
  );
}

export function PdmYearPills({ years, selected, onSelect }: { years: readonly number[]; selected: number; onSelect: (y: number) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {years.map((anio) => (
        <button
          key={anio}
          type="button"
          onClick={() => onSelect(anio)}
          className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${
            selected === anio ? "bg-blue-600 text-white shadow-sm" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
          }`}
        >
          {anio}
        </button>
      ))}
    </div>
  );
}
