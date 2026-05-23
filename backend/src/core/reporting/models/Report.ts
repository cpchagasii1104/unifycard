// src/core/reporting/models/Report.ts
// Modelo canônico de Report conforme REPORTING_DATA_MODEL.md

export type ReportTargetType =
  | 'GROUP'
  | 'USER'
  | 'COMPANY'
  | 'PROVIDER'
  | 'DRIVER'
  | 'SERVICE'
  | 'POST'
  | 'COMMENT'
  | 'TRANSACTION';

export type ReportReasonCode =
  | 'FRAUD'
  | 'SCAM'
  | 'ABUSE'
  | 'HARASSMENT'
  | 'INAPPROPRIATE_CONTENT'
  | 'SPAM'
  | 'IMPERSONATION'
  | 'OTHER';

export type ReportStatus = 'open' | 'under_review' | 'resolved' | 'dismissed';

export type ReportSeverity = 'low' | 'medium' | 'high';

export interface Report {
  id: string; // UUID
  reporter_user_id: string; // UUID
  target_type: ReportTargetType;
  target_id: string; // TEXT (não FK)
  module: string; // TEXT (ex: groups, marketplace, mobility)
  tenant_id: string; // UUID
  reason_code: ReportReasonCode;
  description?: string; // TEXT opcional
  status: ReportStatus;
  severity: ReportSeverity;
  risk_score?: number; // INTEGER
  createdAt: Date;
  updatedAt: Date;
  resolvedAt?: Date;
}

export interface ReportRow {
  id: string;
  reporter_user_id: string;
  target_type: string;
  target_id: string;
  module: string;
  tenant_id: string;
  reason_code: string;
  description: string | null;
  status: string;
  severity: string;
  risk_score: number | null;
  created_at: Date;
  updated_at: Date;
  resolved_at: Date | null;
}







