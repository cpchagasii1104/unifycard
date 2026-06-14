// backend/src/core/financial-approval/payout-approval-policy.constants.ts
// F-PAYOUT-APPROVAL-POLICY-MATERIALIZATION — constantes canônicas (DECISION-0130).
//
// Faixa segura MVP (D4): teto institucional que NENHUMA policy/authority pode ultrapassar.
// Os valores são ratificação de DECISION-0130 D4 (não hardcode arbitrário) e também travados no
// banco (CHECK chk_fap_policy/authority_mvp_ceiling). O resolvedor aplica min(policy, authority, teto).

/** Único escopo materializado nesta frente. */
export const PAYOUT_APPROVAL_SCOPE = 'actor_wallet_payout' as const;

/** D4 — teto MVP por aprovação: R$ 500,00. */
export const PAYOUT_MVP_MAX_AMOUNT_CENTS = 50000 as const;

/** D4 — teto MVP diário por actor: R$ 1.500,00. */
export const PAYOUT_MVP_DAILY_LIMIT_CENTS = 150000 as const;

/** Códigos de decisão devolvidos ao cliente (estáveis; consumidos pela rota/guard/e2e). */
export type PayoutApprovalBlockCode =
  | 'PAYOUT_APPROVAL_POLICY_NOT_CONFIGURED'      // nenhuma policy ativa (tenant, scope)
  | 'PAYOUT_APPROVAL_AUTHORITY_NOT_FOUND'        // approver sem authority ativa
  | 'PAYOUT_APPROVER_CANNOT_BE_REQUESTER'        // D3 segregação
  | 'APPROVAL_POLICY_REQUIRES_MULTI_APPROVAL'    // D5 acima da faixa / requires_second_approval
  | 'PAYOUT_APPROVAL_AMOUNT_EXCEEDS_POLICY'      // <=teto MVP mas acima do cap da policy/authority
  | 'PAYOUT_APPROVAL_DAILY_LIMIT_EXCEEDED'       // D4 limite diário por actor
  | 'PAYOUT_APPROVAL_BLOCKED_KYC'                // D7 KYC não aprovado
  | 'PAYOUT_APPROVAL_BLOCKED_ATL'                // D7 ATL (actor bloqueado)
  | 'PAYOUT_APPROVAL_BLOCKED_RECOVERY'           // D7 recovery obligation ativa
  | 'PAYOUT_APPROVAL_BLOCKED_RISK'               // D7 risco alto/blocked
  | 'PAYOUT_APPROVAL_BLOCKED_DESTINATION';       // D7 destino fora do MVP (não internal_settlement)
