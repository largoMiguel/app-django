export function GdCard({
  title,
  icon,
  children,
  actions,
}: {
  title: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
          {icon}
          {title}
        </div>
        {actions}
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

export function GdLoading() {
  return (
    <div className="flex items-center justify-center py-16 text-sm text-slate-500">Cargando gestión documental…</div>
  );
}

export function GdBadge({
  children,
  tone = "default",
}: {
  children: React.ReactNode;
  tone?: "default" | "warning" | "success";
}) {
  const cls =
    tone === "warning"
      ? "bg-amber-100 text-amber-800"
      : tone === "success"
        ? "bg-emerald-100 text-emerald-800"
        : "bg-slate-100 text-slate-700";
  return <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}>{children}</span>;
}

export const inputClass =
  "w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-[#3eafd4] focus:outline-none focus:ring-1 focus:ring-[#3eafd4]";
export const btnPrimary =
  "inline-flex items-center justify-center gap-2 rounded-lg bg-[#3eafd4] px-4 py-2 text-sm font-medium text-white hover:bg-[#35a0c4] disabled:opacity-50";
export const btnSecondary =
  "inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50";
