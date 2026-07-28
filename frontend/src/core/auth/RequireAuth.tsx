import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "@clerk/react";
import SessionLoadingScreen from "@/components/ui/SessionLoadingScreen";
import EntitySelectModal from "@/features/auth/EntitySelectModal";
import { useAuthStore } from "./store";

export default function RequireAuth() {
  const { isLoaded, isSignedIn } = useAuth();
  const user = useAuthStore((s) => s.user);
  const location = useLocation();

  if (!isLoaded || (isSignedIn && !user)) {
    return <SessionLoadingScreen />;
  }

  if (!isSignedIn) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return (
    <>
      <EntitySelectModal />
      <Outlet />
    </>
  );
}
