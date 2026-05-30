import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuthStore } from "./store";

export default function RequireAuth() {
  const token = useAuthStore((s) => s.accessToken);
  const location = useLocation();
  if (!token) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }
  return <Outlet />;
}
