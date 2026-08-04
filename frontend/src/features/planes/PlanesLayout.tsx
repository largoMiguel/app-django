import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import { LayoutDashboard, List, CalendarRange, BarChart3, ClipboardList } from "lucide-react";
import { PlanesYearProvider, usePlanesYear } from "./PlanesYearContext";

const tabs = [
  { to: "/planes", end: true, label: "Resumen", icon: LayoutDashboard },
  { to: "/planes/lista", end: false, label: "Planes", icon: List },
  { to: "/planes/cronograma", end: false, label: "Cronograma", icon: CalendarRange },
  { to: "/planes/informes", end: false, label: "Informes", icon: BarChart3 },
];

function PlanesLayoutInner() {
  const location = useLocation();
  const { anio, setAnio, aniosDisponibles } = usePlanesYear();
  const isResumen =
    location.pathname === "/planes" || location.pathname === "/planes/";

  const subtitle = location.pathname.includes("/lista")
    ? "Planes institucionales por vigencia (Decreto 612)"
    : location.pathname.includes("/cronograma")
      ? "Cronograma trimestral de actividades"
      : location.pathname.includes("/informes")
        ? "Informe trimestral en Excel"
        : location.pathname.match(/\/planes\/\d+/)
          ? "Detalle del plan y actividades"
          : "Seguimiento a los 12 planes del Decreto 612 de 2018";

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-[#3eafd4]/10 text-[#3eafd4]">
            <ClipboardList className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-[#111827] sm:text-2xl">Planes Institucionales</h1>
            <p className="mt-0.5 text-xs text-slate-500 sm:text-sm">{subtitle}</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Vigencia</label>
          <select
            value={anio}
            onChange={(e) => setAnio(Number(e.target.value))}
            className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:border-[#3eafd4] focus:outline-none focus:ring-1 focus:ring-[#3eafd4]"
          >
            {aniosDisponibles.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
          {isResumen && (
            <Link
              to="/planes/lista"
              className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-[#0e7490] hover:bg-slate-50"
            >
              Ver todos los planes →
            </Link>
          )}
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

export default function PlanesLayout() {
  return (
    <PlanesYearProvider>
      <PlanesLayoutInner />
    </PlanesYearProvider>
  );
}
