import { FileText, Building2, Users, BarChart3 } from "lucide-react";
import { UserButton } from "@clerk/react";
import { NavLink, useLocation } from "react-router-dom";
import { useState } from "react";
import { useAuthStore, primaryRole, canAccess, PERM } from "@/core/auth/store";
import { isUserModuleEnabled } from "@/core/auth/modules";

export default function Sidebar() {
  const [isExpanded, setIsExpanded] = useState(false);
  const { user } = useAuthStore();

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

  const userButtonAppearance = {
    elements: {
      avatarBox: "h-8 w-8 flex-shrink-0",
      userButtonPopoverCard: "shadow-xl",
    },
  };

  return (
    <aside
      onMouseEnter={() => setIsExpanded(true)}
      onMouseLeave={() => setIsExpanded(false)}
      className={`fixed left-0 top-0 z-20 flex min-h-0 flex-col border-r border-[#e3e6ea] bg-[#1c2536] transition-all duration-300 h-screen ${
        isExpanded ? "w-56" : "w-16"
      }`}
    >
      {/* Header: logo entidad + marca SoftOne360 */}
      <div
        className={`flex flex-shrink-0 items-center border-b border-[rgba(255,255,255,0.07)] px-3 transition-all duration-300 overflow-hidden ${
          isExpanded ? "h-[62px]" : "h-[52px]"
        }`}
      >
        <div className="flex items-center gap-2">
          <div
            className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-[#3eafd4] text-xs font-bold text-white overflow-hidden"
            title={entity?.name ?? "SoftOne360"}
          >
            {entityLogoUrl ? (
              <img src={entityLogoUrl} alt="Logo" className="h-full w-full object-cover" />
            ) : (
              <span>S1</span>
            )}
          </div>

          <div
            className={`transition-all duration-300 overflow-hidden ${
              isExpanded ? "w-40 opacity-100" : "w-0 opacity-0"
            }`}
          >
            <div className="text-sm font-bold text-white leading-tight whitespace-nowrap">SoftOne360</div>
            {entity?.name && (
              <div className="text-[0.62rem] text-[rgba(255,255,255,0.55)] leading-tight break-words pr-1">
                {entity.name}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Navegación scrollable */}
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <nav className="min-h-0 flex-1 space-y-1 overflow-y-auto overflow-x-hidden p-2">
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

          {usersMenuItem && (
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
          )}
        </nav>
      </div>

      {/* Usuario — un solo widget (UserButton + nombre/rol) */}
      <div className="flex-shrink-0 border-t border-[rgba(255,255,255,0.07)] p-2">
        {!isExpanded ? (
          <div className="flex justify-center py-1">
            <UserButton appearance={userButtonAppearance} />
          </div>
        ) : (
          <div className="flex items-center gap-2 min-w-0 px-1 py-1">
            <UserButton appearance={userButtonAppearance} />
            <div className="min-w-0 flex-1">
              <div className="text-[0.7rem] font-semibold text-white truncate">
                {user?.full_name || "Usuario"}
              </div>
              <div className="text-[0.65rem] text-[rgba(255,255,255,0.6)] truncate capitalize">
                {primaryRoleLabel}
              </div>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}
