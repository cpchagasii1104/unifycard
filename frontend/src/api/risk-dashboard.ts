// frontend/src/api/risk-dashboard.ts
// API client para Risk & Trust Command Center
// 🔴 BLINDAGEM: Frontend apenas reflete backend, não calcula

import { apiFetchJson } from './client';

/**
 * Overview do Risk Dashboard
 */
export interface RiskDashboardOverview {
  totalActors: number;
  // ╔═ ORIENTAÇÃO CANÔNICA ══════════════════════════════════════════
  // ║ STATUS:  CANÔNICO
  // ║ NORMA:   07_NOMENCLATURA_CANONICA §7 — frontend ESPELHA o contrato
  // ║          da API; não cria alias, não renomeia campo
  // ║ NÃO:     LOW|MEDIUM|HIGH|BLOCKED (divergia do banco → NaN na tela)
  // ║ EM VEZ:  low|medium|high|critical, do CHECK de trust_profiles
  // ╚════════════════════════════════════════════════════════════════
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
  openDisputes: number;
  averageResolutionTimeDays: number | null;
  totalFinancialVolumeCents: number;
  // `undefined` = o backend NÃO CONSEGUIU LER a fonte (tabela ausente,
  // leitura capturada). Zero afirmaria "não há"; indefinido admite que não
  // se sabe. A tela precisa mostrar a diferença — ver RiskCommandCenterPage.
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
    total: number;
  };
  openDisputes: number;
  resolvedDisputes: number;
  averageResolutionTimeDays: number | null;
  financialVolumeCents: number;
  escrowHeldCents: number;
  escrowReleasedCents: number;
  // `undefined` = o backend NÃO CONSEGUIU LER a fonte (tabela ausente,
  // leitura capturada). Zero afirmaria "não há"; indefinido admite que não
  // se sabe. A tela precisa mostrar a diferença — ver RiskCommandCenterPage.
  blockedPayouts: number | undefined;
  failedPayouts: number | undefined;
  abandonedAgreements: number | undefined;
  lastEventAt: string | null;
  lastBypassAt: string | null;
  lastDisputeAt: string | null;
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
  timestamp: string;
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

/**
 * Busca Overview do Risk Dashboard
 */
export async function getRiskDashboardOverview(): Promise<RiskDashboardOverview> {
  const data = await apiFetchJson<{ overview: RiskDashboardOverview }>('/risk/dashboard/overview');
  return data.overview;
}

/**
 * Lista Actor Risk Profiles com filtros
 */
export async function listActorRiskProfiles(filters: ActorRiskFilters = {}): Promise<ActorRiskProfile[]> {
  const queryParams = new URLSearchParams();
  if (filters.riskLevel) queryParams.append('riskLevel', filters.riskLevel);
  if (filters.minTrustScore !== undefined) queryParams.append('minTrustScore', filters.minTrustScore.toString());
  if (filters.maxTrustScore !== undefined) queryParams.append('maxTrustScore', filters.maxTrustScore.toString());
  if (filters.hasOpenDisputes) queryParams.append('hasOpenDisputes', 'true');
  if (filters.hasBypassDetected) queryParams.append('hasBypassDetected', 'true');
  if (filters.minFinancialVolumeCents !== undefined)
    queryParams.append('minFinancialVolumeCents', filters.minFinancialVolumeCents.toString());
  if (filters.limit) queryParams.append('limit', filters.limit.toString());
  if (filters.offset) queryParams.append('offset', filters.offset.toString());

  const data = await apiFetchJson<{ profiles: ActorRiskProfile[] }>(`/risk/dashboard/actors?${queryParams.toString()}`);
  return data.profiles;
}

/**
 * Busca Risk Profile detalhado de um actor
 */
export async function getActorRiskProfile(actorId: string): Promise<ActorRiskProfile> {
  const data = await apiFetchJson<{ profile: ActorRiskProfile }>(`/risk/dashboard/actors/${actorId}`);
  return data.profile;
}

/**
 * Busca Timeline consolidada de eventos de risco para um actor
 */
export async function getActorRiskTimeline(actorId: string): Promise<RiskTimelineEvent[]> {
  const data = await apiFetchJson<{ timeline: RiskTimelineEvent[] }>(`/risk/dashboard/actors/${actorId}/timeline`);
  return data.timeline;
}




