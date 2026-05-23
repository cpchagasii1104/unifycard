/**
 * Prompt 53 — enforcement sem tocar dinheiro: permissões / step-up / limites.
 */

import { getOrCreateProfile, type RiskLevel } from './actor-risk.repository';
export { resolveActorIdForWalletOwner } from '@modules/identity/actor-ssot.service';

export type FinancialRiskAction =
  | 'financial_transfer'
  | 'financial_payout'
  | 'financial_payment'
  | 'financial_reversal_request';

export interface ActorPermissionCheck {
  allowed: boolean;
  riskLevel: RiskLevel;
  reason?: string;
  /** high → biometria/OTP sugerido */
  requiresStepUp?: boolean;
  /** medium → limites reduzidos (caller deve aplicar caps) */
  reducedLimits?: boolean;
}

const FINANCIAL_ACTIONS = new Set<string>([
  'financial_transfer',
  'financial_payout',
  'financial_payment',
  'financial_reversal_request',
]);

/**
 * Valida se o actor pode executar ação; não altera ledger nem saldo.
 */
export async function checkActorPermissions(
  tenantId: string,
  actorId: string,
  action: string
): Promise<ActorPermissionCheck> {
  const profile = await getOrCreateProfile(tenantId, actorId);
  const level = profile.riskLevel;
  const isFinancial = FINANCIAL_ACTIONS.has(action);

  if (isFinancial && level === 'blocked') {
    return {
      allowed: false,
      riskLevel: level,
      reason: 'ACTOR_RISK_BLOCKED',
    };
  }

  if (isFinancial && level === 'high') {
    return {
      allowed: true,
      riskLevel: level,
      requiresStepUp: true,
      reason: 'ACTOR_RISK_STEP_UP_REQUIRED',
    };
  }

  if (isFinancial && level === 'medium') {
    return {
      allowed: true,
      riskLevel: level,
      reducedLimits: true,
    };
  }

  return { allowed: true, riskLevel: level };
}

/**
 * Bloqueia execução se não permitido (para rotas financeiras).
 */
export async function assertActorFinancialPermission(
  tenantId: string,
  actorId: string,
  action: FinancialRiskAction
): Promise<ActorPermissionCheck> {
  const r = await checkActorPermissions(tenantId, actorId, action);
  if (!r.allowed) {
    const err = new Error(r.reason || 'ACTOR_RISK_BLOCKED');
    (err as Error & { statusCode?: number; permissionCheck?: ActorPermissionCheck }).statusCode = 403;
    (err as Error & { permissionCheck?: ActorPermissionCheck }).permissionCheck = r;
    throw err;
  }
  return r;
}