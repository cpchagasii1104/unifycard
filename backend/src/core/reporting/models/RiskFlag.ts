// src/core/reporting/models/RiskFlag.ts
// Modelo de flags de risco conforme REPORTING_DATA_MODEL.md

export type RiskLevel = 'GREEN' | 'YELLOW' | 'RED';

export interface RiskFlag {
  id: string; // UUID
  target_type: string; // ENUM (mesmo que ReportTargetType)
  target_id: string; // TEXT
  module: string; // TEXT
  tenant_id: string; // UUID
  risk_level: RiskLevel;
  risk_score: number; // INTEGER
  last_evaluated_at: Date;
  created_at: Date;
}

export interface RiskFlagRow {
  id: string;
  target_type: string;
  target_id: string;
  module: string;
  tenant_id: string;
  risk_level: string;
  risk_score: number;
  last_evaluated_at: Date;
  created_at: Date;
}






