// backend/src/modules/trust/trust.types.ts
// Camada de Trust, Reputação e Detecção de Bypass/Fraude
// 🔴 BLINDAGEM: Nenhum score editável manualmente
// 🔴 BLINDAGEM: Nenhuma decisão sem evidência
// 🔴 BLINDAGEM: Append-only em TrustEvents

/**
 * Nível de risco
 */
export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'BLOCKED';

/**
 * Severidade do evento de trust
 */
// ╔═ ORIENTAÇÃO CANÔNICA ══════════════════════════════════════════
// ║ STATUS:  CANÔNICO
// ║ NORMA:   docs/01_normative/07_NOMENCLATURA_CANONICA.md §4.34
// ║ NÃO:     LOW/MEDIUM/HIGH — vocabulário de PRIORITY colado em campo severity
// ║          (exatamente o "não são sinônimos" que §4.34 proíbe)
// ║ EM VEZ:  CRITICAL/ERROR/WARNING/INFO/AUDIT
// ╚════════════════════════════════════════════════════════════════
export type TrustEventSeverity = 'CRITICAL' | 'ERROR' | 'WARNING' | 'INFO' | 'AUDIT';

/**
 * Tipo de evento de trust
 */
export type TrustEventType =
  | 'agreement_bypass_attempted'
  | 'escrow_bypass_attempted'
  | 'dispute_opened'
  | 'dispute_lost'
  | 'dispute_won'
  | 'agreement_respected'
  | 'escrow_completed_successfully'
  | 'repeated_cancellation'
  | 'off_platform_signal_detected'
  | 'payment_on_time'
  | 'service_completed_successfully'
  | 'positive_review'
  | 'negative_review'
  | 'bypass_attempt_detected'
  | 'off_platform_contact_shared';

/**
 * Tipo de contexto do evento
 */
export type TrustEventContextType = 'event' | 'booking' | 'bundle' | 'service_order' | 'agreement' | 'escrow' | 'thread' | 'rfq';

/**
 * Trust Profile (Perfil de Confiança)
 * 
 * REGRAS:
 * - Score calculado automaticamente (0-100)
 * - RiskLevel derivado do score
 * - Nunca editável manualmente
 */
export interface TrustProfile {
  profileId: string;
  tenantId: string;
  actorId: string;
  currentScore: number; // 0-100
  riskLevel: RiskLevel;
  totalEvents: number;
  positiveEvents: number;
  negativeEvents: number;
  lastEventAt: Date | null;
  lastupdatedAt: string;
  createdAt: string;
}

/**
 * Trust Event (Evento de Confiança)
 * 
 * REGRAS:
 * - Append-only: eventos são adicionados, nunca removidos
 * - Imutável após criação
 * - Sempre vinculado a EvidencePack
 */
export interface TrustEvent {
  eventId: string;
  tenantId: string;
  actorId: string;
  eventType: TrustEventType;
  severity: TrustEventSeverity;
  scoreImpact: number; // Impacto no score (+ ou -)
  contextType: TrustEventContextType;
  contextId: string;
  evidencePackId: string; // Obrigatório: sempre deve ter evidência
  metadata: Record<string, any> | null;
  createdAt: string;
}

/**
 * Trust Score Snapshot (Histórico de Score)
 * 
 * REGRAS:
 * - Append-only: snapshots são criados, nunca editados
 * - Usado para histórico e análise
 */
export interface TrustScoreSnapshot {
  snapshotId: string;
  tenantId: string;
  actorId: string;
  score: number;
  riskLevel: RiskLevel;
  triggeredByEventId: string | null;
  metadata: Record<string, any> | null;
  createdAt: string;
}

/**
 * Input para registrar evento de trust
 */
export interface RegisterTrustEventInput {
  actorId: string;
  eventType: TrustEventType;
  severity: TrustEventSeverity;
  contextType: TrustEventContextType;
  contextId: string;
  evidencePackId: string;
  metadata?: Record<string, any>;
}

/**
 * Input para verificar se pode prosseguir com ação
 */
export interface CanProceedInput {
  action: string;
  actorId: string;
  contextType?: TrustEventContextType;
  contextId?: string;
}

/**
 * Resultado da verificação
 */
export interface CanProceedResult {
  canProceed: boolean;
  reason?: string;
  riskLevel: RiskLevel;
  currentScore: number;
}

/**
 * Filtros para buscar trust profiles
 */
export interface TrustProfileFilters {
  actorId?: string;
  riskLevel?: RiskLevel;
  minScore?: number;
  maxScore?: number;
  limit?: number;
  offset?: number;
}

/**
 * Filtros para buscar trust events
 */
export interface TrustEventFilters {
  actorId?: string;
  eventType?: TrustEventType;
  severity?: TrustEventSeverity;
  contextType?: TrustEventContextType;
  contextId?: string;
  limit?: number;
  offset?: number;
}


