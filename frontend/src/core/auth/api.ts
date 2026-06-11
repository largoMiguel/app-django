import { api } from "@/core/api/client";
import type { AuthUser } from "./store";

export const authApi = {
  me: () => api.get<AuthUser>("/auth/me").then((r) => r.data),
  updateMe: (payload: Pick<AuthUser, "email_firma">) =>
    api.patch<AuthUser>("/auth/me", payload).then((r) => r.data),
};
