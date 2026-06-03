import type { Clerk } from "@clerk/react";

declare global {
  interface Window {
    Clerk?: Clerk;
  }
}

export {};
