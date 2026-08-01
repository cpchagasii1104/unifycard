// backend/src/modules/risk-command-center/risk-dashboard.types.ts
// Risk & Trust Command Center - Tipos
// 🔴 BLINDAGEM: Apenas agregações read-only, nenhuma mutação
// 🔴 BLINDAGEM: Tudo determinístico e rastreável

// ╔═ ORIENTAÇÃO CANÔNICA ══════════════════════════════════════════
// ║ STATUS:  CANÔNICO
// ║ NORMA:   F-RISK-DASHBOARD, 2026-07-31 — risk-dashboard.service.ts (0 try/catch no arquivo
// ║          inteiro antes desta fatia; agreements/evidence_packs/payout_orders são schema-ghost)
// ║ NÃO:     métrica `number` não-opcional forçando `0` quando a leitura de origem falha —
// ║          `abandonedAgreements = 0` afirma "não há agreement abandonado"; não sabemos.
// ║ EM VEZ:  `number | undefined` — undefined é "não sabemos", nunca confundir com 0/zero.
// ╚════════════════════════════════════════════════════════════════

/**
 * Overview do Risk Dashboard
 */
export interface RiskDashboardOverview {
  totalActors: number;
  // Vocabulário governado por `trust_profiles.risk_level` CHECK
  // (low|medium|high|critical). NÃO usar MAIÚSCULA nem `BLOCKED`: até
  // 2026-07-31 este tipo divergia do banco e a contagem virava NaN.
  actorsByRiskLevel: {
    low: number;
    medium: number;
    high: number;
    critical: number;
  };
  totalBypassDetected: {
    last30Days: number;
    last90Days: number;
    last180Days: number;
  };
  openDisputes: number | undefined;
  averageResolutionTimeDays: number | null | undefined;
  totalFinancialVolumeCents: number;
  blockedPayouts: number | undefined;
  failedPayouts: number | undefined;
  abandonedAgreements: number | undefined;
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
  openDisputes: number | undefined;
  resolvedDisputes: number | undefined;
  averageResolutionTimeDays: number | null | undefined;
  financialVolumeCents: number;
  escrowHeldCents: number | undefined;
  escrowReleasedCents: number | undefined;
  blockedPayouts: number | undefined;
  failedPayouts: number | undefined;
  abandonedAgreements: number | undefined;
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





