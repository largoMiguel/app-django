import ModuleAIAlertsBanner from "./ModuleAIAlertsBanner";
import type { AIAlert } from "@/core/api/ai/types";

interface Props {
  onAlertClick?: (alert: AIAlert) => void;
}

/** @deprecated Usar ModuleAIAlertsBanner con module="pqrs" o "pdm". */
export default function AIAlertsBanner({ onAlertClick }: Props) {
  return <ModuleAIAlertsBanner module="pqrs" onAlertClick={onAlertClick} />;
}
