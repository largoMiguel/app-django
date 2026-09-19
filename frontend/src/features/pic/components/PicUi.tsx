import type { ReactNode } from "react";
import { Loader2 } from "lucide-react";

export function PicLoading() {
  return (
    <div className="flex items-center justify-center py-16 text-slate-500">
      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
      Cargando…
    </div>
  );
}

export function PicCard({ title, icon, children, actions }: { title: string; icon?: ReactNode; children: ReactNode; actions?: ReactNode }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
          {icon}
          {title}
        </div>
        {actions}
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

export function formatCOP(value: string | number) {
  const n = typeof value === "string" ? parseFloat(value) : value;
  if (Number.isNaN(n)) return "$0";
  return new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(n);
}
