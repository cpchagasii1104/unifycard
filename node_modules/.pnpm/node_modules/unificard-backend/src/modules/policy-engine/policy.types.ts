// backend/src/modules/policy-engine/policy.types.ts
// Policy & Enforcement Engine - Tipos
// 🔴 BLINDAGEM: Nenhuma sanção automática
// 🔴 BLINDAGEM: Todas as decisões são explícitas e humanas
// 🔴 BLINDAGEM: Tudo reversível apenas via nova decisão

/**
 * Tipo de política
 */
export type PolicyType = 'feature_throttling' | 'temporary_block' | 'manual_review_required';

/**
 * Ação permitida pela política
 */
export type PolicyAction =
  | 'limit_rfq_creation'
  | 'limit_booking_creation'
  | 'limit_messaging'
  | 'limit_payouts'
  | 'block_rfq_creation'
  | 'block_booking_creation'
  | 'block_messaging'
  | 'block_payouts'
  | 'require_review_rfq'
  | 'require_review_booking'
  | 'require_review_payout';

/**
 * Condições para ativação da política
 */
export interface PolicyCondition {
  minRiskLevel?: 'LOW' | 'MEDIUM' | 'HIGH' | 'BLOCKED';
  maxTrustScore?: number;
  minTrustScore?: number;
  hasOpenDisputes?: boolean;
  bypassDetectedLast30Days?: number;
  bypassDetectedLast90Days?: number;
  financialVolumeCents?: number;
  customConditions?: Record<string, any>;
}

/**
 * Policy Rule (regra declarativa, versionada)
 */
export interface PolicyRule {
  policyId: string;
  tenantId: string;
  name: string;
  description: string;
  policyType: PolicyType;
  version: number;
  conditions: PolicyCondition;
  actions: PolicyAction[];
  isActive: boolean;
  activatedAt: Date | null;
  activatedByUserId: string | null;
  metadata: Record<string, any> | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * Status de uma decisão de política
 */
export type PolicyDecisionStatus = 'PENDING' | 'ACTIVE' | 'REVOKED' | 'EXPIRED';

/**
 * Policy Decision (decisão aplicada a um actor)
 */
export interface PolicyDecision {
  decisionId: string;
  tenantId: string;
  policyId: string;
  policyVersion: number;
  actorId: string;
  status: PolicyDecisionStatus;
  appliedActions: PolicyAction[];
  reason: string;
  appliedByUserId: string;
  appliedByActorId: string;
  evidencePackId: string | null;
  expiresAt: Date | null;
  revokedAt: Date | null;
  revokedByUserId: string | null;
  revokedByActorId: string | null;
  revocationReason: string | null;
  metadata: Record<string, any> | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * Input para criar política
 */
export interface CreatePolicyInput {
  name: string;
  description: string;
  policyType: PolicyType;
  conditions: PolicyCondition;
  actions: PolicyAction[];
  metadata?: Record<string, any>;
}

/**
 * Input para aplicar decisão de política
 */
export interface ApplyPolicyDecisionInput {
  policyId: string;
  actorId: string;
  reason: string;
  expiresAt?: Date;
  metadata?: Record<string, any>;
}

/**
 * Input para revogar decisão
 */
export interface RevokePolicyDecisionInput {
  decisionId: string;
  revocationReason: string;
}

/**
 * Resultado da avaliação de política
 */
export interface PolicyEvaluationResult {
  policyId: string;
  policyName: string;
  policyVersion: number;
  matches: boolean;
  matchedConditions: string[];
  recommendedActions: PolicyAction[];
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  explanation: string;
}

/**
 * Filtros para buscar políticas
 */
export interface PolicyFilters {
  policyType?: PolicyType;
  isActive?: boolean;
  limit?: number;
  offset?: number;
}

/**
 * Filtros para buscar decisões
 */
export interface PolicyDecisionFilters {
  policyId?: string;
  actorId?: string;
  status?: PolicyDecisionStatus;
  limit?: number;
  offset?: number;
}





