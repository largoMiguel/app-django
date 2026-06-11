import { useState } from "react";
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
  const user = useAuthStore((s) => s.user);
  const location = useLocation();
  const copilotModules = getEntityCopilotModules(user?.entity);
  const showCopilot = shouldShowGlobalCopilot(location.pathname, user?.entity);

  return (
    <div className="flex min-h-screen overflow-x-clip overflow-y-hidden">
      <Sidebar />

      <main className="ml-16 min-w-0 flex-1 overflow-x-clip overflow-y-auto bg-[#f0f2f5]">
        <div className="p-6">
          <Outlet />
        </div>
      </main>

      {showCopilot && (
        <>
          {!showGlobalCopilot && (
            <button
              type="button"
              onClick={() => setShowGlobalCopilot(true)}
              className="fixed bottom-6 right-6 z-40 flex items-center gap-2 rounded-full bg-blue-600 px-4 py-3 text-sm font-medium text-white shadow-lg hover:bg-blue-700 transition-all"
            >
              <Bot className="h-5 w-5" />
              Copiloto
            </button>
          )}
          {showGlobalCopilot && (
            <CopilotPanel
              mode="global"
              modules={copilotModules}
              title="Copiloto SoftOne"
              onClose={() => setShowGlobalCopilot(false)}
              className="fixed bottom-4 right-4 z-50 w-[400px] max-h-[600px] shadow-2xl"
            />
          )}
        </>
      )}
    </div>
  );
}
