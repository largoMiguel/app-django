import type { LucideIcon } from "lucide-react";
import { BarChart3, FileBarChart2, FileSpreadsheet } from "lucide-react";

export type InformePdmTipo = "AVANCE" | "GESTION";

export type PdmInformePickerTipo = InformePdmTipo | "PLAN_ACCION";

export interface PdmInformeTypeDefinition {
  id: PdmInformePickerTipo;
  title: string;
  description: string;
  icon: LucideIcon;
  enabled: boolean;
  badge?: string;
}

export const PDM_INFORME_TYPES: PdmInformeTypeDefinition[] = [
  {
    id: "AVANCE",
    title: "Informe de Avance de PDM",
    description:
      "PDF institucional con resumen ejecutivo, avance por líneas, sectores y ODS, ejecución presupuestal y plan de acción con evidencias.",
    icon: BarChart3,
    enabled: true,
  },
  {
    id: "PLAN_ACCION",
    title: "Plan de Acción (Excel)",
    description:
      "Exportación inmediata del plan de acción por vigencia y dependencia: actividades, metas, responsables, avance y resúmenes por producto y secretaría.",
    icon: FileSpreadsheet,
    enabled: true,
  },
  {
    id: "GESTION",
    title: "Informe de Gestión",
    description:
      "Informe consolidado de gestión institucional del Plan de Desarrollo Municipal. Próximamente disponible.",
    icon: FileBarChart2,
    enabled: false,
    badge: "Próximamente",
  },
];

export function getPdmInformeType(id: PdmInformePickerTipo): PdmInformeTypeDefinition | undefined {
  return PDM_INFORME_TYPES.find((t) => t.id === id);
}

export const INFORME_PDM_TIPO_LABEL: Record<InformePdmTipo, string> = {
  AVANCE: "Informe de Avance de PDM",
  GESTION: "Informe de Gestión",
};
