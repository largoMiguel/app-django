import type { LucideIcon } from "lucide-react";
import { BarChart3, FileSpreadsheet } from "lucide-react";

export type InformePlanTipo = "SEGUIMIENTO_D612";

export interface PlanesInformeTypeDefinition {
  id: InformePlanTipo | "TRIMESTRAL_EXCEL";
  title: string;
  description: string;
  icon: LucideIcon;
  enabled: boolean;
  badge?: string;
}

export const PLANES_INFORME_TYPES: PlanesInformeTypeDefinition[] = [
  {
    id: "SEGUIMIENTO_D612",
    title: "Informe de Seguimiento D612 (PDF)",
    description:
      "Informe de auditoría de control interno con actividades por plan, tablas de cumplimiento, gráficas y conclusiones con IA. Retención 7 días.",
    icon: BarChart3,
    enabled: true,
  },
  {
    id: "TRIMESTRAL_EXCEL",
    title: "Informe trimestral (Excel)",
    description:
      "Exportación inmediata del seguimiento de actividades y evidencias por vigencia y trimestre, conforme al Decreto 612 de 2018.",
    icon: FileSpreadsheet,
    enabled: true,
  },
];

export function getPlanesInformeType(id: string): PlanesInformeTypeDefinition | undefined {
  return PLANES_INFORME_TYPES.find((t) => t.id === id);
}

export const INFORME_PLAN_TIPO_LABEL: Record<InformePlanTipo, string> = {
  SEGUIMIENTO_D612: "Informe de Seguimiento D612",
};
