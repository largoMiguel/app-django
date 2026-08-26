import type { AIModuleKey } from "@/core/api/ai/types";

const KEY_PREFIX = "softone.ui.ai_insights_hidden";

export function isInsightsPanelHidden(module: AIModuleKey): boolean {
  try {
    return localStorage.getItem(`${KEY_PREFIX}.${module}`) === "1";
  } catch {
    return false;
  }
}

export function setInsightsPanelHidden(module: AIModuleKey, hidden: boolean): void {
  try {
    if (hidden) {
      localStorage.setItem(`${KEY_PREFIX}.${module}`, "1");
    } else {
      localStorage.removeItem(`${KEY_PREFIX}.${module}`);
    }
  } catch {
    /* ignore */
  }
}
