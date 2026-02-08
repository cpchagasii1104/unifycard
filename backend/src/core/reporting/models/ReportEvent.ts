// src/core/reporting/models/ReportEvent.ts
// Modelo de eventos de audit trail conforme REPORTING_DATA_MODEL.md

export type ReportActorType = 'SYSTEM' | 'AUDITOR' | 'USER';

export type ReportEventType =
  | 'REPORT_CREATED'
  | 'STATUS_CHANGED'
  | 'SEVERITY_CHANGED'
  | 'COMMENT_ADDED'
  | 'ACTION_TAKEN'
  | 'RISK_SCORE_UPDATED';

export interface ReportEvent {
  id: string; // UUID
  report_id: string; // UUID (FK lógico)
  actor_type: ReportActorType;
  actor_id?: string; // UUID (se aplicável)
  event_type: ReportEventType;
  metadata?: Record<string, any>; // JSONB
  createdAt: Date;
}

export interface ReportEventRow {
  id: string;
  report_id: string;
  actor_type: string;
  actor_id: string | null;
  event_type: string;
  metadata: Record<string, any> | null;
  createdAt: Date;
}







