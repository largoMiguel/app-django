import { NavLink, Outlet, useLocation } from "react-router-dom";
import { Clock, Monitor, Users, ClipboardList } from "lucide-react";

const tabs = [
  { to: "/asistencia", end: true, label: "Resumen", icon: Clock },
  { to: "/asistencia/funcionarios", end: false, label: "Funcionarios", icon: Users },
  { to: "/asistencia/equipos", end: false, label: "Equipos", icon: Monitor },
  { to: "/asistencia/registros", end: false, label: "Registros", icon: ClipboardList },
];

export default function AsistenciaLayout() {
  const location = useLocation();
  const subtitle =
    location.pathname.includes("/funcionarios")
      ? "Alta y gestión de funcionarios"
      : location.pathname.includes("/equipos")
        ? "Equipos kiosk y emparejamiento"
        : location.pathname.includes("/registros")
          ? "Historial de marcaciones y exportación"
          : "Talento humano — control de asistencia institucional";

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-[#3eafd4]/10 text-[#3eafd4]">
            <Clock className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-[#111827] sm:text-2xl">Asistencia</h1>
            <p className="mt-0.5 text-xs text-slate-500 sm:text-sm">{subtitle}</p>
          </div>
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
