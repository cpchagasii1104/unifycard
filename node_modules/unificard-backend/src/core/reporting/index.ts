// src/core/reporting/index.ts
// Exportações do Reporting Core

export { default as reportingRoutes } from './reporting.routes';
export { reportingService } from './reporting.service';
export { reportingRepository } from './reporting.repository';
export { riskScoringEngine } from './ai/RiskScoringEngine';
export { reportingPolicy } from './policies/ReportingPolicy';

// Types
export type {
  Report,
  ReportTargetType,
  ReportReasonCode,
  ReportStatus,
  ReportSeverity,
} from './models/Report';

export type {
  ReportEvent,
  ReportActorType,
  ReportEventType,
} from './models/ReportEvent';

export type {
  RiskFlag,
  RiskLevel,
} from './models/RiskFlag';






