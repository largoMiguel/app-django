import type { ReactNode } from "react";

export function StatCard({
  label,
  value,
  sub,
  icon,
  accent = "border-l-[#3eafd4]",
  iconBg = "bg-[#3eafd4]",
}: {
  label: string;
  value: string | number;
  sub?: string;
  icon: ReactNode;
  accent?: string;
  iconBg?: string;
}) {
  return (
    <div className={`flex w-full items-center gap-3 rounded-xl border border-slate-200 border-l-4 bg-white px-5 py-5 shadow-sm ${accent}`}>
      <div className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl text-white ${iconBg}`}>
        {icon}
      </div>
      <div>
        <div className="text-xl font-bold text-slate-800">{value}</div>
        <div className="text-[0.68rem] font-semibold uppercase tracking-wide text-slate-500">{label}</div>
        {sub && <div className="mt-0.5 text-[0.67rem] text-slate-400">{sub}</div>}
      </div>
    </div>
  );
}

export function ChartCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="bg-[#1d4ed8] px-4 py-2.5 text-sm font-semibold text-white">{title}</div>
      <div className="p-4">{children}</div>
    </div>
  );
}

export function SeverityBadge({ severidad }: { severidad: string }) {
  const colors: Record<string, string> = {
    critica: "bg-red-100 text-red-800",
    alta: "bg-orange-100 text-orange-800",
    media: "bg-amber-100 text-amber-800",
    baja: "bg-slate-100 text-slate-700",
  };
  return (
    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${colors[severidad] || colors.baja}`}>
      {severidad}
    </span>
  );
}
