import { FileText, Building2, Users, BarChart3, type LucideIcon } from "lucide-react";
import { UserButton } from "@clerk/react";
import { NavLink, useLocation } from "react-router-dom";
import { useState } from "react";
import { accessibleNavRoutes, primaryRole, useAuthStore } from "@/core/auth/store";

const NAV_ICONS: Record<string, LucideIcon> = {
  superadmin: Building2,
  pqrs: FileText,
  pdm: BarChart3,
  users_admin: Users,
};

export default function Sidebar() {
  const [isExpanded, setIsExpanded] = useState(false);
  const { user } = useAuthStore();
  const location = useLocation();

  const role = primaryRole(user);
  const entity = user?.entity;
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

  const userButtonAppearance = {
    elements: {
      avatarBox: "h-8 w-8 flex-shrink-0",
      userButtonPopoverCard: "shadow-xl",
    },
  };

  function renderNavItem(item: (typeof navRoutes)[number]) {
    const Icon = NAV_ICONS[item.moduleKey] ?? FileText;
    return (
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
        <Icon className="h-5 w-5 flex-shrink-0" />
        <span
          className={`overflow-hidden whitespace-nowrap transition-all duration-300 ${
            isExpanded ? "max-w-[120px] opacity-100" : "max-w-0 opacity-0"
          }`}
        >
          {item.label}
        </span>
      </NavLink>
    );
  }

  return (
    <aside
      onMouseEnter={() => setIsExpanded(true)}
      onMouseLeave={() => setIsExpanded(false)}
      className={`fixed left-0 top-0 z-20 flex min-h-0 flex-col border-r border-[#e3e6ea] bg-[#1c2536] transition-all duration-300 h-screen ${
        isExpanded ? "w-56" : "w-16"
      }`}
    >
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

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <nav className="min-h-0 flex-1 space-y-1 overflow-y-auto overflow-x-hidden p-2">
          {mainItems.map(renderNavItem)}
          {secondaryItems.map(renderNavItem)}
        </nav>
      </div>

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
