import { NavLink, Outlet } from "react-router-dom";
import {
  LayoutDashboard,
  FileSearch,
  Archive,
  AlertTriangle,
  Sparkles,
  RefreshCw,
} from "lucide-react";
import { useState } from "react";
import { SecopYearProvider, useSecopYear } from "./SecopYearContext";

const tabs = [
  { to: "/contratacion", end: true, label: "Resumen", icon: LayoutDashboard },
  { to: "/contratacion/secop2", end: false, label: "SECOP II", icon: FileSearch },
  { to: "/contratacion/secop1", end: false, label: "SECOP I", icon: Archive },
  { to: "/contratacion/alertas", end: false, label: "Alertas", icon: AlertTriangle },
  { to: "/contratacion/ia", end: false, label: "Análisis IA", icon: Sparkles },
];

function SecopLayoutInner() {
  const { anio, setAnio, aniosDisponibles, loadingConfig, refrescar } = useSecopYear();
  const [refreshing, setRefreshing] = useState(false);

  async function onRefresh() {
    setRefreshing(true);
    try {
      await refrescar();
      window.location.reload();
    } finally {
      setRefreshing(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-[#3eafd4]/10 text-[#3eafd4]">
            <FileSearch className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-[#111827] sm:text-2xl">Contratación</h1>
            <p className="mt-0.5 text-xs text-slate-500 sm:text-sm">
              Análisis de contratos y procesos — datos abiertos Colombia
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Vigencia</label>
          <select
            value={anio}
            disabled={loadingConfig}
            onChange={(e) => setAnio(Number(e.target.value))}
            className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:border-[#3eafd4] focus:outline-none focus:ring-1 focus:ring-[#3eafd4]"
          >
            {(aniosDisponibles.length ? aniosDisponibles : [anio]).map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={onRefresh}
            disabled={refreshing}
            className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
            Actualizar datos
          </button>
        </div>
      </div>

      <nav className="flex flex-wrap gap-1 border-b border-slate-200">
        {tabs.map(({ to, end, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              `inline-flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${
                isActive
                  ? "border-[#3eafd4] text-[#0e7490]"
                  : "border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-800"
              }`
            }
          >
            <Icon className="h-4 w-4" />
            {label}
          </NavLink>
        ))}
      </nav>

      <Outlet />
    </div>
  );
}

export default function SecopLayout() {
  return (
    <SecopYearProvider>
      <SecopLayoutInner />
    </SecopYearProvider>
  );
}
