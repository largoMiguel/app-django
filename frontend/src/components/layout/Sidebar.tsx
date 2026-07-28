import { FileText, Building2, Users, BarChart3, LogOut, Clock, Mail, ChevronDown, type LucideIcon } from "lucide-react";
import { useClerk } from "@clerk/react";
import { NavLink, useLocation } from "react-router-dom";
import { useState } from "react";
import { authApi } from "@/core/auth/api";
import { accessibleNavRoutes, primaryRole, useAuthStore } from "@/core/auth/store";
import { clearClientSession } from "@/core/auth/session";

const NAV_ICONS: Record<string, LucideIcon> = {
  superadmin: Building2,
  pqrs: FileText,
  pdm: BarChart3,
  asistencia: Clock,
  correspondencia: Mail,
  users_admin: Users,
};

interface SidebarProps {
  mobileOpen?: boolean;
  onMobileClose?: () => void;
}

export default function Sidebar({ mobileOpen = false, onMobileClose }: SidebarProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [entityMenuOpen, setEntityMenuOpen] = useState(false);
  const [switchingEntity, setSwitchingEntity] = useState(false);
  const { user, setUser, setActiveEntityId, activeEntityId } = useAuthStore();
  const location = useLocation();

  const role = primaryRole(user);
  const entity = user?.entity;
  const memberships = user?.memberships ?? [];
  const navRoutes = accessibleNavRoutes(user);
  const mainItems = navRoutes.filter((item) => item.navSection === "main");
  const secondaryItems = navRoutes.filter((item) => item.navSection === "secondary");

  function isNavActive(item: { path: string; matchPaths: string[] }) {
    return item.matchPaths.some(
      (p) => location.pathname === p || location.pathname.startsWith(p + "/"),
    );
  }

  const entityLogoUrl = entity?.logo_url ?? null;
  const primaryRoleLabel = role || user?.roles[0] || "Usuario";
  const userInitial = (user?.full_name || user?.email || "U").charAt(0).toUpperCase();
  const clerk = useClerk();

  async function handleSignOut() {
    clearClientSession();
    await clerk.signOut({ redirectUrl: "/login" });
  }

  async function switchEntity(entityId: number) {
    if (entityId === activeEntityId || switchingEntity) return;
    setSwitchingEntity(true);
    setEntityMenuOpen(false);
    setActiveEntityId(entityId);
    try {
      const profile = await authApi.me();
      setUser(profile);
      onMobileClose?.();
    } finally {
      setSwitchingEntity(false);
    }
  }

  function renderNavItem(item: (typeof navRoutes)[number]) {
    const Icon = NAV_ICONS[item.moduleKey] ?? FileText;
    return (
      <NavLink
        key={item.path}
        to={item.path}
        onClick={() => onMobileClose?.()}
        className={() =>
          `group flex items-center gap-3 rounded-[0.3rem] px-3 py-2.5 text-sm transition-all ${
            isNavActive(item)
              ? "border-l-[3px] border-[#3eafd4] bg-[rgba(62,175,212,0.2)] pl-[calc(0.75rem-3px)] text-white"
              : "text-[rgba(255,255,255,0.6)] hover:bg-[rgba(255,255,255,0.07)] hover:text-white"
          }`
        }
      >
        <Icon className="h-5 w-5 flex-shrink-0" />
        <span
          className={`overflow-hidden whitespace-nowrap transition-all duration-300 ${
            isExpanded || mobileOpen ? "max-w-[120px] opacity-100" : "max-w-0 opacity-0"
          }`}
        >
          {item.label}
        </span>
      </NavLink>
    );
  }

  const asideClasses = `${
    mobileOpen ? "translate-x-0" : "-translate-x-full"
  } md:translate-x-0 fixed left-0 top-0 z-40 flex min-h-0 flex-col border-r border-[#e3e6ea] bg-[#1c2536] transition-all duration-300 h-screen ${
    isExpanded || mobileOpen ? "w-56" : "w-16"
  }`;

  return (
    <aside
      onMouseEnter={() => setIsExpanded(true)}
      onMouseLeave={() => setIsExpanded(false)}
      className={asideClasses}
    >
      <div
        className={`flex flex-shrink-0 items-center border-b border-[rgba(255,255,255,0.07)] px-3 transition-all duration-300 overflow-hidden ${
          isExpanded || mobileOpen ? "h-[62px]" : "h-[52px]"
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
              isExpanded || mobileOpen ? "w-40 opacity-100" : "w-0 opacity-0"
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

      {memberships.length > 1 && (isExpanded || mobileOpen) && (
        <div className="relative border-b border-[rgba(255,255,255,0.07)] px-2 py-2">
          <button
            type="button"
            onClick={() => setEntityMenuOpen((v) => !v)}
            className="flex w-full items-center justify-between rounded-md px-2 py-2 text-left text-xs text-white/80 hover:bg-white/5"
          >
            <span className="truncate">{entity?.name ?? "Entidad"}</span>
            <ChevronDown className={`h-4 w-4 shrink-0 transition ${entityMenuOpen ? "rotate-180" : ""}`} />
          </button>
          {entityMenuOpen && (
            <div className="absolute left-2 right-2 top-full z-50 mt-1 max-h-48 overflow-y-auto rounded-md border border-slate-700 bg-[#1c2536] py-1 shadow-lg">
              {memberships.map((m) => (
                <button
                  key={m.entity_id}
                  type="button"
                  disabled={switchingEntity}
                  onClick={() => void switchEntity(m.entity_id)}
                  className={`block w-full px-3 py-2 text-left text-xs hover:bg-white/10 ${
                    m.entity_id === activeEntityId ? "text-[#3eafd4]" : "text-white/80"
                  }`}
                >
                  {m.name}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <nav className="min-h-0 flex-1 space-y-1 overflow-y-auto overflow-x-hidden p-2">
          {mainItems.map(renderNavItem)}
          {secondaryItems.map(renderNavItem)}
        </nav>
      </div>

      <div className="flex-shrink-0 border-t border-[rgba(255,255,255,0.07)] p-2">
        <div
          className={`flex w-full min-w-0 items-center rounded-[0.3rem] px-1 py-1 transition-colors hover:bg-[rgba(255,255,255,0.07)] ${
            isExpanded || mobileOpen ? "gap-1" : "justify-center"
          }`}
        >
          <button
            type="button"
            onClick={() => clerk.openUserProfile()}
            title={user?.full_name || "Mi cuenta"}
            className={`flex min-w-0 items-center ${isExpanded || mobileOpen ? "min-w-0 flex-1 gap-2" : ""}`}
          >
            <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-[#3eafd4] text-sm font-bold text-white">
              {userInitial}
            </div>
            {(isExpanded || mobileOpen) && (
              <div className="min-w-0 flex-1 text-left">
                <div className="text-[0.7rem] font-semibold text-white truncate">
                  {user?.full_name || "Usuario"}
                </div>
                <div className="text-[0.65rem] text-[rgba(255,255,255,0.6)] truncate capitalize">
                  {primaryRoleLabel}
                </div>
              </div>
            )}
          </button>
          {(isExpanded || mobileOpen) && (
            <button
              type="button"
              onClick={handleSignOut}
              title="Cerrar sesión"
              className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-[0.3rem] text-[rgba(255,255,255,0.55)] transition-colors hover:bg-[rgba(255,255,255,0.1)] hover:text-white"
            >
              <LogOut className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
    </aside>
  );
}
