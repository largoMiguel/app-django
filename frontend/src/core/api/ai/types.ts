export interface AIAlert {
  id: number;
  alert_type: string;
  severity: "low" | "medium" | "high" | "critical";
  title: string;
  message: string;
  score: number | null;
  object_type: string;
  object_id: number | null;
  metadata: Record<string, unknown>;
  is_read: boolean;
  is_dismissed: boolean;
  created_at: string;
}

export interface CopilotResponse {
  reply: string;
  sources: Array<Record<string, unknown>>;
  conversation_id: number;
}

export interface PQRSDraftResponse {
  draft: string;
  tipo_solicitud: string;
  normativa: string;
  model?: string;
}

export interface ComplianceStats {
  total: number;
  respondidas: number;
  pct_en_termo: number;
  en_termo: number;
  vencidas_abiertas: number;
  avg_response_days: number | null;
  aging: Record<string, number>;
  compliance_score: number;
  by_tipo: Array<Record<string, unknown>>;
  timeline_yoy: Array<Record<string, unknown>>;
}

export interface SLARisk {
  pqrs_id: number;
  numero_radicado: string;
  asunto: string;
  estado: string;
  risk_score: number;
  factors: string[];
  assigned_to_nombre: string | null;
}

export interface AIInsight {
  title: string;
  text: string;
  severity: "low" | "medium" | "high";
  score?: number;
  source?: "ai" | "rule";
}

export interface SemanticSearchResult {
  content_type: string;
  object_id: number;
  texto: string;
  similarity: number;
  metadata: Record<string, unknown>;
}

export interface PQRSStatusLookup {
  found: boolean;
  numero_radicado?: string;
  estado?: string;
  tipo_solicitud?: string;
  asunto?: string;
  fecha_solicitud?: string;
  fecha_vencimiento?: string;
  fecha_respuesta?: string;
  tiene_respuesta?: boolean;
}

export type AIModuleKey = "pqrs" | "pdm";
