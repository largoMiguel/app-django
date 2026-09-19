import { NavLink, Outlet, useLocation } from "react-router-dom";
import { LayoutDashboard, List, Users, HeartPulse } from "lucide-react";
import { primaryRole, useAuthStore } from "@/core/auth/store";
import { PicYearProvider, usePicYear } from "./PicYearContext";

const tabs = [
  { to: "/pic", end: true, label: "Resumen", icon: LayoutDashboard },
  { to: "/pic/actividades", end: false, label: "Actividades", icon: List },
  { to: "/pic/encargados", end: false, label: "Encargados", icon: Users, adminOnly: true },
];

function PicLayoutInner() {
  const location = useLocation();
  const { anio, setAnio, aniosDisponibles } = usePicYear();
  const role = primaryRole(useAuthStore().user);
  const isDetail = Boolean(location.pathname.match(/\/pic\/actividades\/\d+/));

  const subtitle = location.pathname.includes("/encargados")
    ? "Mapeo de cargos del Excel a usuarios responsables"
    : location.pathname.includes("/actividades")
      ? "Seguimiento de actividades PIC por trimestre"
      : location.pathname.match(/\/pic\/actividades\/\d+/)
        ? "Detalle de actividad y ejecuciones"
        : "Plan de Intervenciones Colectivas — seguimiento y valor a cobrar";

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-[#0e7490]/10 text-[#0e7490]">
            <HeartPulse className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-[#111827] sm:text-2xl">PIC</h1>
            <p className="mt-0.5 text-xs text-slate-500 sm:text-sm">{subtitle}</p>
          </div>
        </div>
        {!isDetail && (
          <div className="flex flex-wrap items-center gap-2">
            <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Vigencia</label>
            <select
              value={anio}
              onChange={(e) => setAnio(Number(e.target.value))}
              className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:border-[#0e7490] focus:outline-none focus:ring-1 focus:ring-[#0e7490]"
            >
              {aniosDisponibles.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {!isDetail && (
        <nav className="flex flex-wrap gap-1 border-b border-slate-200">
          {tabs
            .filter((t) => !t.adminOnly || role === "admin")
            .map(({ to, end, label, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                className={({ isActive }) =>
                  `inline-flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${
                    isActive
                      ? "border-[#0e7490] text-[#0e7490]"
                      : "border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-800"
                  }`
                }
              >
                <Icon className="h-4 w-4" />
                {label}
              </NavLink>
            ))}
        </nav>
      )}

      <Outlet />
    </div>
  );
}

export default function PicLayout() {
  return (
    <PicYearProvider>
      <PicLayoutInner />
    </PicYearProvider>
  );
}
