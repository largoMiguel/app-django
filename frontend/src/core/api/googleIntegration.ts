import { api } from "./client";

export type GoogleGmailStatus = {
  connected: boolean;
  google_email?: string;
  status?: string;
  requires_reauthorization?: boolean;
};

export const googleIntegrationApi = {
  status: () =>
    api.get<GoogleGmailStatus>("/integrations/google/status").then((r) => r.data),

  connect: () =>
    api.post<{ authorize_url: string }>("/integrations/google/connect").then((r) => r.data),

  disconnect: () =>
    api.delete<{ connected: boolean }>("/integrations/google/disconnect").then((r) => r.data),
};
