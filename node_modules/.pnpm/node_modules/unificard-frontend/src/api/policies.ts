// frontend/src/api/policies.ts
// API client para Policy & Enforcement Engine
// 🔴 BLINDAGEM: Frontend apenas reflete backend, não aplica políticas automaticamente

import { apiFetchJson, apiFetch } from './client';

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
 * Policy Rule
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
  activatedAt: string | null;
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
 * Policy Decision
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
  expiresAt: string | null;
  revokedAt: string | null;
  revokedByUserId: string | null;
  revokedByActorId: string | null;
  revocationReason: string | null;
  metadata: Record<string, any> | null;
  createdAt: string;
  updatedAt: string;
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
  expiresAt?: string;
  metadata?: Record<string, any>;
}

/**
 * Input para revogar decisão
 */
export interface RevokePolicyDecisionInput {
  revocationReason: string;
}

/**
 * Lista políticas
 */
export async function listPolicies(filters: {
  policyType?: PolicyType;
  isActive?: boolean;
  limit?: number;
  offset?: number;
} = {}): Promise<PolicyRule[]> {
  const queryParams = new URLSearchParams();
  if (filters.policyType) queryParams.append('policyType', filters.policyType);
  if (filters.isActive !== undefined) queryParams.append('isActive', filters.isActive.toString());
  if (filters.limit) queryParams.append('limit', filters.limit.toString());
  if (filters.offset) queryParams.append('offset', filters.offset.toString());

  const data = await apiFetchJson<{ policies: PolicyRule[] }>(`/policies?${queryParams.toString()}`);
  return data.policies;
}

/**
 * Cria uma nova política
 */
export async function createPolicy(input: CreatePolicyInput): Promise<PolicyRule> {
  const data = await apiFetchJson<{ policy: PolicyRule }>('/policies', {
    method: 'POST',
    body: JSON.stringify(input),
  });
  return data.policy;
}

/**
 * Busca política por ID
 */
export async function getPolicy(policyId: string): Promise<PolicyRule> {
  const data = await apiFetchJson<{ policy: PolicyRule }>(`/policies/${policyId}`);
  return data.policy;
}

/**
 * Ativa uma política
 */
export async function activatePolicy(policyId: string): Promise<PolicyRule> {
  const data = await apiFetchJson<{ policy: PolicyRule }>(`/policies/${policyId}/activate`, {
    method: 'POST',
  });
  return data.policy;
}

/**
 * Desativa uma política
 */
export async function deactivatePolicy(policyId: string): Promise<PolicyRule> {
  const data = await apiFetchJson<{ policy: PolicyRule }>(`/policies/${policyId}/deactivate`, {
    method: 'POST',
  });
  return data.policy;
}

/**
 * Avalia políticas para um actor
 */
export async function evaluatePoliciesForActor(actorId: string): Promise<PolicyEvaluationResult[]> {
  const data = await apiFetchJson<{ evaluations: PolicyEvaluationResult[] }>(
    `/policies/evaluate/${actorId}`
  );
  return data.evaluations;
}

/**
 * Lista decisões
 */
export async function listDecisions(filters: {
  policyId?: string;
  actorId?: string;
  status?: PolicyDecisionStatus;
  limit?: number;
  offset?: number;
} = {}): Promise<PolicyDecision[]> {
  const queryParams = new URLSearchParams();
  if (filters.policyId) queryParams.append('policyId', filters.policyId);
  if (filters.actorId) queryParams.append('actorId', filters.actorId);
  if (filters.status) queryParams.append('status', filters.status);
  if (filters.limit) queryParams.append('limit', filters.limit.toString());
  if (filters.offset) queryParams.append('offset', filters.offset.toString());

  const data = await apiFetchJson<{ decisions: PolicyDecision[] }>(`/policy-decisions?${queryParams.toString()}`);
  return data.decisions;
}

/**
 * Aplica uma decisão de política
 */
export async function applyPolicyDecision(input: ApplyPolicyDecisionInput): Promise<PolicyDecision> {
  const data = await apiFetchJson<{ decision: PolicyDecision }>('/policy-decisions', {
    method: 'POST',
    body: JSON.stringify(input),
  });
  return data.decision;
}

/**
 * Busca decisão por ID
 */
export async function getDecision(decisionId: string): Promise<PolicyDecision> {
  const data = await apiFetchJson<{ decision: PolicyDecision }>(`/policy-decisions/${decisionId}`);
  return data.decision;
}

/**
 * Revoga uma decisão
 */
export async function revokeDecision(decisionId: string, revocationReason: string): Promise<PolicyDecision> {
  const data = await apiFetchJson<{ decision: PolicyDecision }>(`/policy-decisions/${decisionId}/revoke`, {
    method: 'POST',
    body: JSON.stringify({ revocationReason }),
  });
  return data.decision;
}

/**
 * Busca decisões ativas para um actor
 */
export async function getActiveDecisionsForActor(actorId: string): Promise<PolicyDecision[]> {
  const data = await apiFetchJson<{ decisions: PolicyDecision[] }>(
    `/policy-decisions/actor/${actorId}/active`
  );
  return data.decisions;
}




