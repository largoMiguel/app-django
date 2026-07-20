import { NavLink, Outlet } from "react-router-dom";
import { Clock, Monitor, Users, ClipboardList } from "lucide-react";

const tabs = [
  { to: "/asistencia", end: true, label: "Resumen", icon: Clock },
  { to: "/asistencia/funcionarios", end: false, label: "Funcionarios", icon: Users },
  { to: "/asistencia/equipos", end: false, label: "Equipos", icon: Monitor },
  { to: "/asistencia/registros", end: false, label: "Registros", icon: ClipboardList },
];

export default function AsistenciaLayout() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900 sm:text-2xl">Asistencia</h1>
        <p className="mt-1 text-sm text-slate-600">
          Talento humano — funcionarios, equipos kiosk y registros del día.
        </p>
      </div>

      <nav className="flex flex-wrap gap-2 border-b border-slate-200 pb-1">
        {tabs.map(({ to, end, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              `inline-flex items-center gap-2 rounded-t-md px-4 py-2 text-sm font-medium transition-colors ${
                isActive
                  ? "border-b-2 border-[#0d6e8a] text-[#0d6e8a] bg-[#f0f9fc]"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
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
