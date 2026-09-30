import { useState } from "react";
import { Menu } from "lucide-react";
import { Outlet, useLocation } from "react-router-dom";
import { Bot } from "lucide-react";
import Sidebar from "./Sidebar";
import CopilotPanel from "@/components/ai/CopilotPanel";
import { useAuthStore } from "@/core/auth/store";
import {
  getEntityCopilotModules,
  shouldShowGlobalCopilot,
} from "@/core/ai/copilot";

export default function AppLayout() {
  const [showGlobalCopilot, setShowGlobalCopilot] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const user = useAuthStore((s) => s.user);
  const location = useLocation();
  const copilotModules = getEntityCopilotModules(user?.entity);
  const showCopilot = shouldShowGlobalCopilot(location.pathname, user?.entity);
  const copilotDocked = showCopilot && !showGlobalCopilot;

  return (
    <div className="flex h-screen min-h-0 overflow-x-clip overflow-y-hidden">
      <Sidebar mobileOpen={mobileNavOpen} onMobileClose={() => setMobileNavOpen(false)} />

      <div className="relative flex min-h-0 min-w-0 flex-1 flex-col md:ml-16">
        <header className="fixed inset-x-0 top-0 z-30 flex h-14 items-center gap-3 border-b border-slate-200 bg-white px-4 md:hidden">
          <button
            type="button"
            onClick={() => setMobileNavOpen(true)}
            className="rounded-lg p-2 text-slate-600 hover:bg-slate-100"
            aria-label="Abrir menú"
          >
            <Menu className="h-5 w-5" />
          </button>
          <span className="truncate text-sm font-semibold text-slate-800">
            {user?.entity?.name ?? "SoftOne360"}
          </span>
        </header>

        <main
          className={`min-h-0 min-w-0 flex-1 overflow-x-clip overflow-y-auto bg-[#f0f2f5] pt-14 md:pt-0 ${
            copilotDocked ? "mb-20" : ""
          }`}
        >
          <div className="p-4 sm:p-6">
            <Outlet />
          </div>
        </main>

        {copilotDocked && (
          <div className="pointer-events-none absolute inset-x-0 bottom-0 z-40 flex justify-end px-4 pb-4 sm:px-6">
            <button
              type="button"
              onClick={() => setShowGlobalCopilot(true)}
              className="pointer-events-auto flex items-center gap-2 rounded-full bg-blue-600 px-4 py-3 text-sm font-medium text-white shadow-lg transition-all hover:bg-blue-700"
            >
              <Bot className="h-5 w-5" />
              Copiloto
            </button>
          </div>
        )}
      </div>

      {mobileNavOpen && (
        <button
          type="button"
          className="fixed inset-0 z-30 bg-black/40 md:hidden"
          aria-label="Cerrar menú"
          onClick={() => setMobileNavOpen(false)}
        />
      )}

      {showCopilot && showGlobalCopilot && (
        <CopilotPanel
          mode="global"
          modules={copilotModules}
          title="Copiloto SoftOne"
          onClose={() => setShowGlobalCopilot(false)}
          className="fixed bottom-4 right-4 z-50 w-[min(400px,calc(100vw-2rem))] max-h-[600px] shadow-2xl"
        />
      )}
    </div>
  );
}
