import { FileText, LogOut, Building2, Users, BarChart3 } from "lucide-react";
import softOneLogo from "@/assets/logo_softone360.png";
import { NavLink, useNavigate, useLocation } from "react-router-dom";
import { useState } from "react";
import { useAuthStore, primaryRole, canAccess, PERM } from "@/core/auth/store";
import { isUserModuleEnabled } from "@/core/auth/modules";
import { authApi } from "@/core/auth/api";
import { clearClientSession } from "@/core/auth/session";

export default function Sidebar() {
  const [isExpanded, setIsExpanded] = useState(false);
  const navigate = useNavigate();
  const { user, refreshToken } = useAuthStore();

  const role = primaryRole(user);
  const entity = user?.entity;

  const menuItems: { path: string; icon: typeof FileText; label: string; matchPaths?: string[] }[] = [];
  let usersMenuItem: { path: string; icon: typeof FileText; label: string } | null = null;
  
  const canViewPqrs =
    entity?.enable_pqrs &&
    isUserModuleEnabled(user, "enable_pqrs") &&
    canAccess(user, {
      roles: ["admin", "secretario", "ciudadano"],
      permissions: [PERM.PQRS_VIEW],
    });
  const canManageUsers =
    entity?.enable_users_admin &&
    isUserModuleEnabled(user, "enable_users_admin") &&
    canAccess(user, { roles: ["admin"], permissions: [PERM.USER_VIEW] });
  const canViewPdm =
    entity?.enable_pdm &&
    isUserModuleEnabled(user, "enable_pdm") &&
    canAccess(user, { roles: ["admin", "secretario"] });

  if (role === "superadmin") {
    menuItems.push({ path: "/superadmin/entities", icon: Building2, label: "Entidades" });
  }
  if (canViewPqrs) {
    menuItems.push({ path: "/dashboard", icon: FileText, label: "PQRS", matchPaths: ["/dashboard", "/pqrs"] });
  }
  if (canViewPdm) {
    menuItems.push({ path: "/pdm", icon: BarChart3, label: "PDM", matchPaths: ["/pdm"] });
  }
  if (canManageUsers) {
    usersMenuItem = { path: "/users", icon: Users, label: "Usuarios" };
  }

  const location = useLocation();

  function isNavActive(item: { path: string; matchPaths?: string[] }) {
    const paths = item.matchPaths ?? [item.path];
    return paths.some((p) => location.pathname === p || location.pathname.startsWith(p + "/"));
  }

  const entityLogoUrl = entity?.logo_url ?? null;

  const primaryRoleLabel = role || user?.roles[0] || "Usuario";

  async function handleLogout() {
    try {
      if (refreshToken) await authApi.logout(refreshToken);
    } catch {
      /* ignore */
    }
    clearClientSession();
    navigate("/login", { replace: true });
  }

  return (
    <aside
      onMouseEnter={() => setIsExpanded(true)}
      onMouseLeave={() => setIsExpanded(false)}
      className={`fixed left-0 top-0 z-20 flex flex-col border-r border-[#e3e6ea] bg-[#1c2536] transition-all duration-300 h-screen overflow-hidden ${
        isExpanded ? "w-56" : "w-16"
      }`}
    >
      {/* Header: logo entidad + marca SoftOne360 */}
      <div
        className={`flex items-center border-b border-[rgba(255,255,255,0.07)] px-3 transition-all duration-300 overflow-hidden ${
          isExpanded ? "h-[62px]" : "h-[52px]"
        }`}
      >
        <div className="flex items-center gap-2">
          {/* Ícono: logo de entidad o S1 fallback — siempre visible */}
          <div
            className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-[#3eafd4] text-xs font-bold text-white overflow-hidden"
            title={entity?.name ?? "SoftOne360"}
          >
            {entityLogoUrl
              ? <img src={entityLogoUrl} alt="Logo" className="h-full w-full object-cover" />
              : <span>S1</span>
            }
          </div>

          {/* Texto: app + nombre entidad — visible al expandir */}
          <div
            className={`transition-all duration-300 overflow-hidden ${
              isExpanded ? "w-40 opacity-100" : "w-0 opacity-0"
            }`}
          >
            <div className="text-sm font-bold text-white leading-tight whitespace-nowrap">
              SoftOne360
            </div>
            {entity?.name && (
              <div className="text-[0.62rem] text-[rgba(255,255,255,0.55)] leading-tight break-words pr-1">
                {entity.name}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Navegación */}
      <nav className="flex-1 space-y-1 overflow-y-auto overflow-x-hidden p-2">
        {menuItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={() =>
              `group flex items-center gap-3 rounded-[0.3rem] px-3 py-2.5 text-sm transition-all ${
                isNavActive(item)
                  ? "border-l-[3px] border-[#3eafd4] bg-[rgba(62,175,212,0.2)] pl-[calc(0.75rem-3px)] text-white"
                  : "text-[rgba(255,255,255,0.6)] hover:bg-[rgba(255,255,255,0.07)] hover:text-white"
              }`
            }
          >
            <item.icon className="h-5 w-5 flex-shrink-0" />
            <span
              className={`overflow-hidden whitespace-nowrap transition-all duration-300 ${
                isExpanded ? "max-w-[120px] opacity-100" : "max-w-0 opacity-0"
              }`}
            >
              {item.label}
            </span>
          </NavLink>
        ))}
      </nav>

      {/* Usuarios button - segunda sección */}
      {usersMenuItem && (
        <div className="overflow-hidden border-t border-[rgba(255,255,255,0.07)] p-2">
          <NavLink
            to={usersMenuItem.path}
            className={({ isActive }) =>
              `group flex items-center gap-3 rounded-[0.3rem] px-3 py-2.5 text-sm transition-all ${
                isActive
                  ? "border-l-[3px] border-[#3eafd4] bg-[rgba(62,175,212,0.2)] pl-[calc(0.75rem-3px)] text-white"
                  : "text-[rgba(255,255,255,0.6)] hover:bg-[rgba(255,255,255,0.07)] hover:text-white"
              }`
            }
          >
            <usersMenuItem.icon className="h-5 w-5 flex-shrink-0" />
            <span
              className={`overflow-hidden whitespace-nowrap transition-all duration-300 ${
                isExpanded ? "max-w-[120px] opacity-100" : "max-w-0 opacity-0"
              }`}
            >
              {usersMenuItem.label}
            </span>
          </NavLink>
        </div>
      )}

      {/* Usuario - parte inferior */}
      <div className="border-t border-[rgba(255,255,255,0.07)] p-2">
        {/* Notificaciones y Logout en modo colapsado */}
        {!isExpanded && (
          <div className="flex flex-col items-center gap-2">
            <div className="flex h-[30px] w-[30px] flex-shrink-0 items-center justify-center rounded-full bg-white overflow-hidden">
              <img src={softOneLogo} alt="SoftOne360" className="h-full w-full object-contain p-0.5" />
            </div>
            <button
              onClick={handleLogout}
              className="rounded-md p-1 text-[#f04438] border border-[#f04438] transition-colors hover:bg-[#f04438] hover:text-white"
              title="Cerrar sesión"
            >
              <LogOut className="h-5 w-5" />
            </button>
          </div>
        )}

        {/* Usuario expandido */}
        {isExpanded && (
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <div className="flex h-[30px] w-[30px] flex-shrink-0 items-center justify-center rounded-full bg-white overflow-hidden">
                  <img src={softOneLogo} alt="SoftOne360" className="h-full w-full object-contain p-0.5" />
                </div>
                <div className="text-left min-w-0 max-w-[160px]">
                  <div className="text-[0.7rem] font-semibold text-white truncate overflow-hidden">{user?.full_name || "Usuario"}</div>
                  <div className="text-[0.65rem] text-[rgba(255,255,255,0.6)] truncate overflow-hidden">{primaryRoleLabel}</div>
                </div>
              </div>
              <button
                onClick={handleLogout}
                className="rounded-md p-1 text-[#f04438] border border-[#f04438] transition-colors hover:bg-[#f04438] hover:text-white flex-shrink-0"
                title="Cerrar sesión"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}
