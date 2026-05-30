import { Outlet } from "react-router-dom";
import Sidebar from "./Sidebar";

export default function AppLayout() {

  return (
    <div className="flex min-h-screen overflow-x-clip overflow-y-hidden">
      {/* Sidebar - ocupa toda la altura */}
      <Sidebar />

      {/* Contenido principal */}
      <main className="ml-16 min-w-0 flex-1 overflow-x-clip overflow-y-auto bg-[#f0f2f5]">
        <div className="p-6">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
