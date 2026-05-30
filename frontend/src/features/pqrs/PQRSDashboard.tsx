import { useMemo, useState } from "react";
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  LineChart,
  Line,
  Legend,
} from "recharts";
import { ClipboardList, CheckCircle2, XCircle, FileText, ArrowRight, TrendingUp, AlertTriangle, Clock, Users as UsersIcon, FileBarChart2 } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import type { EstadoPQRS, TipoSolicitud } from "@/core/api/pqrs";
import {
  ESTADO_CHART_COLORS,
  CANAL_LLEGADA_LABEL,
  labelEstado,
  labelTipo,
} from "@/features/pqrs/labels";
import { usePqrsStats } from "@/core/api/hooks/usePqrs";
import { formatApiError } from "@/core/api/errors";
import { useAuthStore, canAccess, PERM } from "@/core/auth/store";
import PQRSInformesPage from "./PQRSInformesPage";

const BAR_COLOR = "#6366f1";

const MESES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

// ─── Stat Card ────────────────────────────────────────────────────────
interface StatCardProps {
  icon: React.ReactNode;
  value: number;
  label: string;
  sub: string;
  accent: string;
  iconBg: string;
  onClick?: () => void;
}

function StatCard({ icon, value, label, sub, accent, iconBg, onClick }: StatCardProps) {
  return (
    <button
      onClick={onClick}
      className={`flex w-full items-center gap-3 rounded-xl bg-white px-5 py-5 shadow-sm border-l-4 ${accent} text-left transition-all hover:shadow-md hover:-translate-y-0.5 cursor-pointer`}
    >
      <div className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl text-white ${iconBg}`}>
        {icon}
      </div>
      <div>
        <div className="text-xl font-bold text-slate-800">{value}</div>
        <div className="text-[0.68rem] font-semibold uppercase tracking-wide text-slate-500">{label}</div>
        <div className="mt-0.5 text-[0.67rem] text-slate-400">{sub}</div>
      </div>
    </button>
  );
}

// ─── Chart card wrapper ───────────────────────────────────────────────
function ChartCard({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="rounded-xl bg-white shadow-sm overflow-hidden">
      <div className="flex items-center gap-2 bg-[#1d4ed8] px-5 py-3 text-white">
        {icon}
        <span className="font-semibold text-sm">{title}</span>
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

// ─── Custom Tooltip ───────────────────────────────────────────────────
function CustomTooltip({ active, payload }: { active?: boolean; payload?: { name: string; value: number }[] }) {
  if (active && payload && payload.length) {
    return (
      <div className="rounded-lg bg-white px-3 py-2 text-xs shadow-lg border border-slate-100">
        <span className="font-semibold text-slate-700">{payload[0].name}:</span>{" "}
        <span className="text-slate-600">{payload[0].value}</span>
      </div>
    );
  }
  return null;
}

// ─── Main component ───────────────────────────────────────────────────
export default function PQRSDashboard() {
  const user = useAuthStore((s) => s.user);
  const navigate = useNavigate();
  const [showInformes, setShowInformes] = useState(false);

  const canSeePqrs = canAccess(user, {
    roles: ["admin", "secretario", "ciudadano"],
    permissions: [PERM.PQRS_VIEW],
  });

  const isAdmin = canAccess(user, { roles: ["admin"], permissions: [PERM.PQRS_CHANGE] });
  const canSeeInformes = isAdmin && Boolean(user?.entity?.enable_reports_pdf);

  const {
    data: stats,
    isLoading: loading,
    isError,
    error,
  } = usePqrsStats({ enabled: canSeePqrs });

  const loadError = isError ? formatApiError(error, "No se pudieron cargar las estadísticas.") : null;

  const estadoCounts = stats?.by_estado ?? {};
  const totalPqrs = stats?.total ?? 0;
  const respondidas = stats?.respondidas ?? 0;
  const cerradas = stats?.cerradas ?? 0;
  const pendientes = stats?.pendientes ?? 0;
  const thisMonth = stats?.this_month ?? 0;
  const sinAsignar = stats?.sin_asignar ?? 0;
  const secretaryStats = stats?.by_secretaria ?? [];

  const donutData = useMemo(
    () => (Object.keys(estadoCounts) as EstadoPQRS[])
      .filter((e) => (estadoCounts[e] || 0) > 0)
      .map((e) => ({ name: labelEstado(e), value: estadoCounts[e]!, estado: e })),
    [estadoCounts],
  );

  const barData = useMemo(
    () =>
      Object.entries(stats?.by_tipo ?? {}).map(([key, value]) => ({
        name: labelTipo(key as TipoSolicitud),
        value,
      })),
    [stats?.by_tipo],
  );

  const timelineData = useMemo(
    () =>
      (stats?.timeline ?? []).map((row) => ({
        mes: MESES[row.month] ?? String(row.month),
        Recibidas: row.recibidas,
        Resueltas: row.resueltas,
      })),
    [stats?.timeline],
  );

  const canalData = useMemo(
    () =>
      Object.entries(stats?.by_canal ?? {}).map(([key, value]) => ({
        name: CANAL_LLEGADA_LABEL[key as keyof typeof CANAL_LLEGADA_LABEL] || key,
        value,
      })),
    [stats?.by_canal],
  );

  if (!canSeePqrs) {
    return (
      <div className="flex h-64 items-center justify-center text-slate-500 text-sm">
        No tienes módulos PQRS habilitados.
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center text-slate-500 text-sm animate-pulse">
        Cargando estadísticas…
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-2 text-center text-red-600 text-sm">
        <AlertTriangle className="h-8 w-8" />
        <p>{loadError}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-[#1d4ed8]/10 text-[#1d4ed8]">
            <TrendingUp className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-[#111827] sm:text-2xl">Análisis del Panel</h1>
            <p className="mt-0.5 text-xs text-slate-500 sm:text-sm">
              {totalPqrs} PQRS en total · {thisMonth} este mes
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 self-start sm:self-auto">
          {canSeeInformes && (
            <button
              onClick={() => setShowInformes(true)}
              className="flex items-center gap-2 rounded-[0.3rem] border border-[#3eafd4] px-4 py-2 text-sm font-medium text-[#3eafd4] transition-colors hover:bg-[#3eafd4] hover:text-white"
            >
              <FileBarChart2 className="h-4 w-4" />
              Informes
            </button>
          )}
          <Link
            to="/pqrs"
            className="flex items-center gap-2 rounded-[0.3rem] bg-[#3eafd4] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#2f9fc2]"
          >
            <FileText className="h-4 w-4" />
            Mis PQRS
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
      {/* Stats — 4 tarjetas principales clickeables */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={<ClipboardList className="h-5 w-5" />}
          value={totalPqrs}
          label="Total Recibidas"
          sub={`${thisMonth} este mes`}
          accent="border-[#1d4ed8]"
          iconBg="bg-[#1d4ed8]"
          onClick={() => navigate("/pqrs")}
        />
        <StatCard
          icon={<AlertTriangle className="h-5 w-5" />}
          value={pendientes}
          label="Pendientes"
          sub="Sin responder"
          accent="border-amber-500"
          iconBg="bg-amber-500"
          onClick={() => navigate("/pqrs?filtro=pendientes")}
        />
        <StatCard
          icon={<CheckCircle2 className="h-5 w-5" />}
          value={respondidas}
          label="Respondidas"
          sub="Aguardan cierre"
          accent="border-emerald-500"
          iconBg="bg-emerald-500"
          onClick={() => navigate("/pqrs?estado=respondida")}
        />
        <StatCard
          icon={<XCircle className="h-5 w-5" />}
          value={cerradas}
          label="Cerradas"
          sub="Completadas"
          accent="border-gray-400"
          iconBg="bg-gray-400"
          onClick={() => navigate("/pqrs?estado=cerrada")}
        />
      </div>

      {/* Timeline y Canal */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Timeline */}
        <ChartCard
          title="PQRS por Mes"
          icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-4 w-4"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12" /></svg>}
        >
          {totalPqrs === 0 ? (
            <div className="flex h-48 items-center justify-center text-sm text-slate-400">Sin datos</div>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={timelineData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis dataKey="mes" tick={{ fontSize: 10, fill: "#64748b" }} />
                <YAxis tick={{ fontSize: 10, fill: "#64748b" }} allowDecimals={false} />
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e2e8f0" }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Line type="monotone" dataKey="Recibidas" stroke="#6366f1" strokeWidth={2} dot={{ r: 3 }} />
                <Line type="monotone" dataKey="Resueltas" stroke="#10b981" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        {/* Por Canal */}
        <ChartCard
          title="Por Canal de Llegada"
          icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-4 w-4"><rect x="3" y="12" width="4" height="9"/><rect x="10" y="7" width="4" height="14"/><rect x="17" y="4" width="4" height="17"/></svg>}
        >
          {canalData.length === 0 ? (
            <div className="flex h-48 items-center justify-center text-sm text-slate-400">Sin datos</div>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={canalData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#64748b" }} />
                <YAxis tick={{ fontSize: 10, fill: "#64748b" }} allowDecimals={false} />
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e2e8f0" }} />
                <Bar dataKey="value" name="PQRS" fill="#6366f1" radius={[4, 4, 0, 0]}
                  label={{ position: "top", fill: "#64748b", fontSize: 11, fontWeight: 600 }} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>
      </div>

      {/* Charts — Donut y Por Tipo */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Donut */}
        <ChartCard
          title="Distribución por Estado"
          icon={
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-4 w-4">
              <path d="M12 2a10 10 0 1 0 10 10" />
              <path d="M12 2a10 10 0 0 1 10 10" strokeDasharray="15 100" />
            </svg>
          }
        >
          {donutData.length === 0 ? (
            <div className="flex h-64 items-center justify-center text-sm text-slate-400">Sin datos</div>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie
                  data={donutData}
                  cx="50%"
                  cy="50%"
                  innerRadius={70}
                  outerRadius={110}
                  paddingAngle={3}
                  dataKey="value"
                  labelLine={false}
                >
                  {donutData.map((entry) => (
                    <Cell key={entry.name} fill={ESTADO_CHART_COLORS[entry.estado] || "#94a3b8"} />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
                {/* Legend removed - will render custom below */}
              </PieChart>
            </ResponsiveContainer>
          )}
          {/* Custom Legend with values */}
          {donutData.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-3 justify-center border-t border-slate-100 pt-3">
              {donutData.map((entry) => (
                <div key={entry.name} className="flex items-center gap-1.5">
                  <span
                    className="inline-block h-3 w-3 rounded-sm"
                    style={{ backgroundColor: ESTADO_CHART_COLORS[entry.estado] || "#94a3b8" }}
                  />
                  <span className="text-xs text-slate-600 font-medium">
                    {entry.name} ({entry.value})
                  </span>
                </div>
              ))}
            </div>
          )}
        </ChartCard>

        {/* Bar */}
        <ChartCard
          title="PQRS por Tipo"
          icon={
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-4 w-4">
              <rect x="3" y="12" width="4" height="9" />
              <rect x="10" y="7" width="4" height="14" />
              <rect x="17" y="4" width="4" height="17" />
            </svg>
          }
        >
          {barData.length === 0 ? (
            <div className="flex h-64 items-center justify-center text-sm text-slate-400">Sin datos</div>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={barData} margin={{ top: 5, right: 10, left: -20, bottom: 50 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 10, fill: "#64748b" }}
                  angle={-35}
                  textAnchor="end"
                  interval={0}
                />
                <YAxis tick={{ fontSize: 10, fill: "#64748b" }} allowDecimals={false} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="value" name="PQRS por Tipo" fill={BAR_COLOR} radius={[4, 4, 0, 0]} label={{ position: "top", fill: "#64748b", fontSize: 12, fontWeight: 500 }} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>
      </div>

      {/* ── Seguimiento por Secretario (solo admin) ── */}
      {isAdmin && (
        <div className="rounded-xl bg-white shadow-sm overflow-hidden">
          <div className="flex items-center justify-between bg-[#1d4ed8] px-5 py-3 text-white">
            <div className="flex items-center gap-2">
              <UsersIcon className="h-4 w-4" />
              <span className="font-semibold text-sm">Seguimiento por Secretario</span>
            </div>
            {sinAsignar > 0 && (
              <span className="rounded-full bg-amber-400 px-2.5 py-0.5 text-[0.68rem] font-bold text-amber-900">
                {sinAsignar} sin asignar
              </span>
            )}
          </div>

          {secretaryStats.length === 0 ? (
            <div className="flex h-24 items-center justify-center text-sm text-slate-400">
              No hay PQRS asignadas a secretarios aún.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    <th className="px-4 py-3 text-left">Secretario</th>
                    <th className="px-3 py-3 text-center">Total</th>
                    <th className="px-3 py-3 text-center">
                      <span className="flex items-center justify-center gap-1">
                        <span className="h-2 w-2 rounded-full bg-emerald-500 inline-block" />
                        Respondidas
                      </span>
                    </th>
                    <th className="px-3 py-3 text-center">
                      <span className="flex items-center justify-center gap-1">
                        <span className="h-2 w-2 rounded-full bg-gray-400 inline-block" />
                        Cerradas
                      </span>
                    </th>
                    <th className="px-3 py-3 text-center">
                      <span className="flex items-center justify-center gap-1">
                        <span className="h-2 w-2 rounded-full bg-amber-400 inline-block" />
                        En Proceso
                      </span>
                    </th>
                    <th className="px-3 py-3 text-center">
                      <span className="flex items-center justify-center gap-1">
                        <span className="h-2 w-2 rounded-full bg-blue-400 inline-block" />
                        Pendientes
                      </span>
                    </th>
                    <th className="px-3 py-3 text-center">
                      <span className="flex items-center justify-center gap-1">
                        <Clock className="h-3 w-3 text-red-500" />
                        Vencidas
                      </span>
                    </th>
                    <th className="px-3 py-3 text-center">% Resueltas</th>
                  </tr>
                </thead>
                <tbody>
                  {secretaryStats.map((s, i) => {
                    const resueltas = s.respondidas + s.cerradas;
                    const pct = s.total > 0 ? Math.round((resueltas / s.total) * 100) : 0;
                    return (
                      <tr
                        key={i}
                        className="border-b border-slate-50 transition-colors hover:bg-slate-50"
                      >
                        <td className="px-4 py-3 font-medium text-slate-800">{s.nombre}</td>
                        <td className="px-3 py-3 text-center font-bold text-slate-700">{s.total}</td>
                        <td className="px-3 py-3 text-center">
                          <span className="font-semibold text-emerald-600">{s.respondidas}</span>
                        </td>
                        <td className="px-3 py-3 text-center">
                          <span className="text-gray-500">{s.cerradas}</span>
                        </td>
                        <td className="px-3 py-3 text-center">
                          <span className="text-amber-600">{s.en_proceso}</span>
                        </td>
                        <td className="px-3 py-3 text-center">
                          <span className="text-blue-600">{s.pendientes}</span>
                        </td>
                        <td className="px-3 py-3 text-center">
                          {s.vencidas > 0 ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-xs font-bold text-red-600">
                              <Clock className="h-3 w-3" />{s.vencidas}
                            </span>
                          ) : (
                            <span className="text-slate-300">—</span>
                          )}
                        </td>
                        <td className="px-3 py-3 text-center">
                          <div className="flex items-center justify-center gap-2">
                            <div className="h-1.5 w-16 rounded-full bg-slate-100 overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all ${
                                  pct >= 75 ? "bg-emerald-500" : pct >= 40 ? "bg-amber-400" : "bg-red-400"
                                }`}
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                            <span className={`text-xs font-semibold ${
                              pct >= 75 ? "text-emerald-600" : pct >= 40 ? "text-amber-600" : "text-red-500"
                            }`}>{pct}%</span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Modal Informes */}
      {canSeeInformes && showInformes && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 backdrop-blur-sm p-2 sm:p-4">
          <div className="w-full max-w-4xl max-h-[95vh] sm:max-h-[90vh] bg-white rounded-lg shadow-lg overflow-hidden flex flex-col">
            <div className="flex-1 overflow-y-auto bg-[#f0f2f5]">
              <div className="p-3 sm:p-6">
                <PQRSInformesPage onClose={() => setShowInformes(false)} />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
