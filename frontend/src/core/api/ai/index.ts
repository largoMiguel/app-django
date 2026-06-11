export * from "./types";
export { sharedAiApi } from "./shared";
export { pqrsAiApi } from "./pqrs";
export { pdmAiApi } from "./pdm";

import { sharedAiApi } from "./shared";
import { pqrsAiApi } from "./pqrs";
import { pdmAiApi } from "./pdm";

/** Compatibilidad: cliente unificado (preferir APIs por módulo). */
export const aiApi = {
  ...sharedAiApi,
  alerts: sharedAiApi.alerts,
  pqrsInsights: pqrsAiApi.insights,
  pqrsCompliance: pqrsAiApi.compliance,
  pqrsDraft: pqrsAiApi.draft,
  semanticSearch: pqrsAiApi.search,
  pqrsStatusLookup: pqrsAiApi.statusLookup,
  globalCopilot: pqrsAiApi.globalCopilot,
  pdmInsights: pdmAiApi.insights,
  pdmAnomalies: pdmAiApi.anomalies,
  pdmReport: pdmAiApi.report,
  pdmCopilot: pdmAiApi.copilot,
};
