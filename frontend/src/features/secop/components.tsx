import type { ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  Bar,
  BarChart,
  Line,
  LineChart,
  Pie,
  PieChart,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Area,
  AreaChart,
} from "recharts";
import { TrendingDown, TrendingUp, Minus } from "lucide-react";
import { formatCOP, type SecopChartSpec } from "@/core/api/secop";

const PIE_COLORS = ["#3eafd4", "#1d4ed8", "#0e7490", "#6366f1", "#8b5cf6", "#f59e0b", "#10b981", "#ef4444"];

export function StatCard({
  label,
  value,
  sub,
  icon,
  accent = "border-l-[#3eafd4]",
  iconBg = "bg-[#3eafd4]",
  trend,
}: {
  label: string;
  value: string | number;
  sub?: string;
  icon: ReactNode;
  accent?: string;
  iconBg?: string;
  trend?: "up" | "down" | "stable" | null;
}) {
  return (
    <div className={`flex w-full items-center gap-3 rounded-xl border border-slate-200 border-l-4 bg-white px-5 py-5 shadow-sm ${accent}`}>
      <div className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl text-white ${iconBg}`}>
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <div className="text-xl font-bold text-slate-800">{value}</div>
          {trend === "up" && <TrendingUp className="h-4 w-4 text-emerald-600" />}
          {trend === "down" && <TrendingDown className="h-4 w-4 text-red-600" />}
          {trend === "stable" && <Minus className="h-4 w-4 text-slate-400" />}
        </div>
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
    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${colors[severidad] || colors.baja}`}>
      {severidad}
    </span>
  );
}

export function ProgressBar({ value, color = "bg-[#3eafd4]", label }: { value: number | null; color?: string; label?: string }) {
  if (value == null) return <span className="text-xs text-slate-400">N/D</span>;
  const pct = Math.min(Math.max(value, 0), 100);
  return (
    <div className="space-y-0.5">
      {label && <div className="text-[0.65rem] text-slate-500">{label}</div>}
      <div className="flex items-center gap-2">
        <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
          <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
        </div>
        <span className="w-10 text-right text-xs font-medium text-slate-600">{pct.toFixed(0)}%</span>
      </div>
    </div>
  );
}

export function SemaforoDot({ semaforo }: { semaforo: string }) {
  const colors: Record<string, string> = {
    verde: "bg-emerald-500",
    amarillo: "bg-amber-500",
    rojo: "bg-red-500",
    gris: "bg-slate-300",
  };
  return <span className={`inline-block h-2.5 w-2.5 rounded-full ${colors[semaforo] || colors.gris}`} title={semaforo} />;
}

export function MarkdownContent({ content, className = "" }: { content: string; className?: string }) {
  return (
    <div className={`prose prose-sm max-w-none prose-headings:text-slate-800 prose-p:text-slate-700 prose-strong:text-slate-900 prose-li:text-slate-700 ${className}`}>
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
    </div>
  );
}

function formatChartValue(value: number, formato?: string) {
  if (formato === "moneda") return formatCOP(value);
  if (formato === "porcentaje") return `${value.toFixed(1)}%`;
  return value.toLocaleString("es-CO");
}

export function DynamicChart({ spec }: { spec: SecopChartSpec }) {
  const data = spec.datos.map((d) => ({ name: d.label, value: d.valor }));
  const height = 240;

  if (spec.tipo === "pie") {
    return (
      <ChartCard title={spec.titulo}>
        <ResponsiveContainer width="100%" height={height}>
          <PieChart>
            <Pie data={data} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name }) => String(name).slice(0, 12)}>
              {data.map((_, i) => (
                <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
              ))}
            </Pie>
            <Tooltip formatter={(v) => formatChartValue(Number(v ?? 0), spec.formato)} />
          </PieChart>
        </ResponsiveContainer>
      </ChartCard>
    );
  }

  if (spec.tipo === "line") {
    return (
      <ChartCard title={spec.titulo}>
        <ResponsiveContainer width="100%" height={height}>
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="name" tick={{ fontSize: 10 }} />
            <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => formatChartValue(Number(v), spec.formato)} />
            <Tooltip formatter={(v) => formatChartValue(Number(v ?? 0), spec.formato)} />
            <Line type="monotone" dataKey="value" stroke="#3eafd4" strokeWidth={2} dot={{ r: 3 }} />
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>
    );
  }

  if (spec.tipo === "area") {
    return (
      <ChartCard title={spec.titulo}>
        <ResponsiveContainer width="100%" height={height}>
          <AreaChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="name" tick={{ fontSize: 10 }} />
            <YAxis tick={{ fontSize: 10 }} />
            <Tooltip formatter={(v) => formatChartValue(Number(v ?? 0), spec.formato)} />
            <Area type="monotone" dataKey="value" stroke="#3eafd4" fill="#3eafd4" fillOpacity={0.2} />
          </AreaChart>
        </ResponsiveContainer>
      </ChartCard>
    );
  }

  return (
    <ChartCard title={spec.titulo}>
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={data} layout={data.length > 5 ? "vertical" : "horizontal"} margin={{ left: 8, right: 16 }}>
          {data.length > 5 ? (
            <>
              <XAxis type="number" hide />
              <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 9 }} />
            </>
          ) : (
            <>
              <XAxis dataKey="name" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} />
            </>
          )}
          <Tooltip formatter={(v) => formatChartValue(Number(v ?? 0), spec.formato)} />
          <Bar dataKey="value" fill="#3eafd4" radius={[0, 4, 4, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}
