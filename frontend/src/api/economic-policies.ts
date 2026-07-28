// src/api/economic-policies.ts
// F-ECONOMIC-POLICY-ADMIN-FRONT FATIA 3 — cliente do write/read API admin de economic_policies
// (backend: backend/src/modules/economy/policy-engine/economic-policy-admin.routes.ts, montado em
// /economy via economy.module.ts + app.builder.ts protectedScope).
//
// 🔒 Espelha o contrato do backend (Fatia 1 leitura + Fatia 2 escrita) SEM reinterpretar regra:
//   - NÃO existe PATCH/PUT — toda mudança de regra é uma NOVA VERSÃO (createEconomicPolicyVersion).
//   - A ÚNICA transição de status por esta tela é ativação draft→active (activateEconomicPolicy).
//   - bps é inteiro (0..10000); a soma das linhas de uma policy precisa fechar 10000 no backend —
//     esta camada NÃO recalcula nem corrige, apenas transporta o que a UI validou.
//   - tenantId e author (createdByActorId) são SEMPRE server-derived; nunca enviados pelo cliente.

import { apiFetch } from './client';

export type EconomicPolicyStatus = 'active' | 'draft' | 'deprecated';

export type EconomicPolicyType =
  | 'COMMISSION_SPLIT'
  | 'ACCESS_PASS'
  | 'HYBRID'
  | 'ZERO_FEE'
  | 'CONTRACTUAL';

export type EconomicPolicyLineType =
  | 'revenue_share'
  | 'platform_fee'
  | 'regional_fund'
  | 'reserve'
  | 'referral'
  | 'group_allocation'
  | 'channel_commission'
  | 'custom';

export type EconomicPolicyDestinationType =
  | 'receiver_actor'
  | 'actor_wallet'
  | 'platform_fees'
  | 'platform_revenue'
  | 'regional_fund'
  | 'risk_reserve'
  | 'referrer_actor_wallet'
  | 'group_wallet'
  | 'channel_actor_wallet'
  | 'escrow_payments'
  | 'custom';

/** Bases GRAVÁVEIS por um novo writer (DECISION-0178 D1/D4) — gross|net são legado read-only. */
export type EconomicPolicyAppliesToWritable =
  | 'gross_transaction'
  | 'commission_gross'
  | 'commission_distributable';

/** Leitura aceita os 5 valores físicos (histórico pode conter os 2 legados). */
export type EconomicPolicyAppliesTo = EconomicPolicyAppliesToWritable | 'gross' | 'net';

export type RegionalOriginBasis =
  | 'payer_identity_residence'
  | 'receiver_identity_residence'
  | 'receiver_company_operational'
  | 'receiver_company_hq'
  | 'service_location'
  | 'transaction_location'
  | 'explicit_economic_region';

export type RegionalFundLevel = 'planet' | 'country' | 'state' | 'city' | 'neighborhood';

export interface EconomicPolicyLine {
  id: string;
  policyId: string;
  lineType: EconomicPolicyLineType;
  destinationType: EconomicPolicyDestinationType;
  destinationKey: string | null;
  regionalOriginBasis: RegionalOriginBasis | null;
  regionalLevel: RegionalFundLevel | null;
  bps: number | null;
  fixedAmountCents: number | null;
  appliesTo: EconomicPolicyAppliesTo;
  conditionType: string | null;
  conditionJson: Record<string, unknown>;
  priority: number;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface EconomicPolicy {
  id: string;
  tenantId: string;
  policyCode: string;
  version: number;
  policyType: EconomicPolicyType;
  moduleContext: string;
  vertical: string | null;
  actorType: string | null;
  serviceType: string | null;
  pricingModel: string | null;
  settlementFlow: string | null;
  countryId: string | null;
  stateId: string | null;
  cityId: string | null;
  categoryId: string | null;
  channel: string | null;
  campaignId: string | null;
  priority: number;
  status: EconomicPolicyStatus;
  effectiveFrom: string;
  effectiveUntil: string | null;
  metadata: Record<string, unknown>;
  createdByActorId: string | null;
  changeReason: string | null;
  createdAt: string;
  updatedAt: string;
  lines: EconomicPolicyLine[];
}

export interface PolicyLineRequestBody {
  lineType: EconomicPolicyLineType;
  destinationType: EconomicPolicyDestinationType;
  destinationKey?: string | null;
  regionalOriginBasis?: RegionalOriginBasis | null;
  regionalLevel?: RegionalFundLevel | null;
  bps?: number | null;
  fixedAmountCents?: number | null;
  appliesTo: EconomicPolicyAppliesToWritable;
  conditionType?: string | null;
  conditionJson?: Record<string, unknown>;
  priority?: number;
  metadata?: Record<string, unknown>;
}

export interface CreatePolicyVersionRequestBody {
  policyCode: string;
  policyType: EconomicPolicyType;
  moduleContext: string;
  vertical?: string | null;
  actorType?: string | null;
  serviceType?: string | null;
  pricingModel?: string | null;
  settlementFlow?: string | null;
  countryId?: string | null;
  stateId?: string | null;
  cityId?: string | null;
  categoryId?: string | null;
  channel?: string | null;
  campaignId?: string | null;
  priority?: number;
  effectiveFrom: string;
  effectiveUntil?: string | null;
  metadata?: Record<string, unknown>;
  changeReason: string;
  lines: PolicyLineRequestBody[];
}

interface AdminPoliciesEnvelope {
  ok: boolean;
  data: EconomicPolicy[];
}

interface AdminPolicyEnvelope {
  ok: boolean;
  data: EconomicPolicy;
}

/**
 * GET /economy/admin/policies — lista as economic_policies (+linhas) do tenant autenticado.
 * admin-gated no backend (requireRole(['admin']) + economic_policy:manage); 401/403 propagam via
 * apiFetch (lançado como Error — ver mapEconomicPolicyError no consumidor).
 *
 * `includeDeprecated` (default true — espelha o default do backend, nenhuma mudança de
 * comportamento por omissão): passe `false` para esconder versões `deprecated` (ruído histórico
 * não-acionável, ex.: fixtures E2E). Filtro de LEITURA — nenhuma policy é apagada.
 */
export async function listEconomicPolicies(
  opts: { includeDeprecated?: boolean } = {}
): Promise<EconomicPolicy[]> {
  const qs = opts.includeDeprecated === false ? '?includeDeprecated=false' : '';
  const response = await apiFetch(`/economy/admin/policies${qs}`);
  const body: AdminPoliciesEnvelope = await response.json();
  return body?.data ?? [];
}

/**
 * POST /economy/admin/policies — publica uma NOVA VERSÃO de policy + linhas, atomicamente.
 * Nasce sempre 'draft' (Artigo V). NÃO é edição — nunca reaproveita o id de uma policy existente.
 */
export async function createEconomicPolicyVersion(
  body: CreatePolicyVersionRequestBody
): Promise<EconomicPolicy> {
  const response = await apiFetch('/economy/admin/policies', {
    method: 'POST',
    body: JSON.stringify(body),
  });
  const result: AdminPolicyEnvelope = await response.json();
  return result.data;
}

/**
 * POST /economy/admin/policies/:id/activate — a ÚNICA transição de status por esta tela
 * (draft → active). 409 se a policy já não estiver 'draft'.
 */
export async function activateEconomicPolicy(id: string): Promise<EconomicPolicy> {
  const response = await apiFetch(`/economy/admin/policies/${id}/activate`, {
    method: 'POST',
  });
  const result: AdminPolicyEnvelope = await response.json();
  return result.data;
}
