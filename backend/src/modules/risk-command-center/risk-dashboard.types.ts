// backend/src/modules/risk-command-center/risk-dashboard.types.ts
// Risk & Trust Command Center - Tipos
// 🔴 BLINDAGEM: Apenas agregações read-only, nenhuma mutação
// 🔴 BLINDAGEM: Tudo determinístico e rastreável

/**
 * Overview do Risk Dashboard
 */
export interface RiskDashboardOverview {
  totalActors: number;
  actorsByRiskLevel: {
    LOW: number;
    MEDIUM: number;
    HIGH: number;
    BLOCKED: number;
  };
  totalBypassDetected: {
    last30Days: number;
    last90Days: number;
    last180Days: number;
  };
  openDisputes: number;
  averageResolutionTimeDays: number | null;
  totalFinancialVolumeCents: number;
  blockedPayouts: number;
  failedPayouts: number;
  abandonedAgreements: number;
  currency: string;
}

/**
 * Actor Risk Profile (consolidado)
 */
export interface ActorRiskProfile {
  actorId: string;
  currentTrustScore: number;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'BLOCKED';
  totalEvents: number;
  positiveEvents: number;
  negativeEvents: number;
  bypassDetected: {
    last30Days: number;
    last90Days: number;
    last180Days: number;
    totalCents: number;
  };
  openDisputes: number;
  resolvedDisputes: number;
  averageResolutionTimeDays: number | null;
  financialVolumeCents: number;
  escrowHeldCents: number;
  escrowReleasedCents: number;
  blockedPayouts: number;
  failedPayouts: number;
  abandonedAgreements: number;
  lastEventAt: Date | null;
  lastBypassAt: Date | null;
  lastDisputeAt: Date | null;
  evidencePackIds: string[];
  agreementIds: string[];
  payoutOrderIds: string[];
  ledgerEntryIds: string[];
  currency: string;
}

/**
 * Timeline consolidada de eventos de risco
 */
export interface RiskTimelineEvent {
  eventId: string;
  timestamp: Date;
  eventType:
    | 'trust_event'
    | 'bypass_detected'
    | 'dispute_opened'
    | 'dispute_resolved'
    | 'escrow_created'
    | 'escrow_released'
    | 'payout_blocked'
    | 'payout_failed'
    | 'agreement_abandoned'
    | 'audit_action';
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  title: string;
  description: string;
  sourceType: 'trust' | 'evidence' | 'ledger' | 'escrow' | 'payout' | 'agreement' | 'audit';
  sourceId: string;
  evidencePackId: string | null;
  metadata: Record<string, any>;
}

/**
 * Filtros para busca de actors
 */
export interface ActorRiskFilters {
  riskLevel?: 'LOW' | 'MEDIUM' | 'HIGH' | 'BLOCKED';
  minTrustScore?: number;
  maxTrustScore?: number;
  hasOpenDisputes?: boolean;
  hasBypassDetected?: boolean;
  minFinancialVolumeCents?: number;
  limit?: number;
  offset?: number;
}





