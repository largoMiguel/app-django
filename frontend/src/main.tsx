import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { QueryClientProvider } from "@tanstack/react-query";
import AuthBootstrap from "@/core/auth/AuthBootstrap";
import ClerkProviderWithRouter from "@/core/auth/ClerkProviderWithRouter";
import { redirectWwwToApex } from "@/core/host";
import { queryClient } from "@/core/queryClient";
import App from "./App";
import "./index.css";

if (!redirectWwwToApex()) {
  ReactDOM.createRoot(document.getElementById("root")!).render(
    <React.StrictMode>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <ClerkProviderWithRouter>
            <AuthBootstrap>
              <App />
            </AuthBootstrap>
          </ClerkProviderWithRouter>
        </BrowserRouter>
      </QueryClientProvider>
    </React.StrictMode>,
  );
}
