// backend/src/modules/payout/payout-approval-policy.ts
// F-PAYOUT-APPROVE-ENDPOINT-CORE-AUTHORITY — CAMINHO B (DECISION-0129).
//
// 🔒 RESOLVEDOR FAIL-CLOSED DA POLÍTICA DE APROVAÇÃO DE PAYOUT.
//
// DECISION-0129 separa SOLICITAÇÃO (D1, já implementada) de APROVAÇÃO (D2). A aprovação
// pertence ao **Core Financeiro institucional**, resolvida por **política financeira explícita**
// (D2) + **faixa segura** com **1 aprovação no MVP** (D4). Os **valores/faixas concretos dependem
// de Clayton** e o código **NÃO hardcoda teto sem DECISION específica** (D6).
//
// Estado material HOJE (verificado 2026-06-14, dev 384):
//   - NÃO existe tabela de política/faixa de payout (payout_policies/financial_approval_policies/
//     financial_approvers AUSENTES; bank_policies vazia).
//   - NÃO existe coluna de autoridade de aprovação (can_approve_*/approve_payout AUSENTES).
//   - NÃO existe permission key `financial:approve_payout`; `organization_members` AUSENTE.
//   ⇒ NÃO há autoridade Core Financeiro material NEM faixa segura promulgada.
//
// Portanto este resolvedor é **FAIL-CLOSED por construção**: retorna sempre `configured:false`
// até que Clayton promulgue, via DECISION específica, (a) o modelo de autoridade Core Financeiro
// de aprovação (D2) e (b) a faixa segura de valor (D4/D6). Ele **NÃO inventa** um teto, **NÃO**
// lê grant comum (company_users/tenant_operator_grants) como autoridade, **NÃO** usa
// availableBalanceCents. A assinatura aceita o contexto material (tenant, operação, valor,
// solicitante, aprovador) para que a frente FUTURA (CAMINHO A) materialize a decisão real SEM
// alterar o call-site da rota.

/** Contexto material da decisão de aprovação (server-side; nada vem do body do cliente como autoridade). */
export interface PayoutApprovalPolicyInput {
  tenantId: string;
  /** Tipo canônico da operação aprovada (deve ser 'actor_wallet_payout'). */
  operationType: string;
  /** Valor solicitado em centavos (BIGINT-safe; comparado à faixa segura quando ela existir). */
  requestedAmountCents: number;
  /** Usuário que SOLICITOU (approval_requests.requested_by_user_id) — server-side. */
  requestedByUserId: string;
  /** Usuário que tenta APROVAR (req.user.id) — server-side. */
  approverUserId: string;
}

/**
 * Resultado da resolução de política. HOJE o resolvedor SÓ produz o ramo `configured:false`
 * (fail-closed). O ramo `configured:true` é uma **costura de tipo** para a frente FUTURA
 * (CAMINHO A) materializar a autoridade Core + a faixa segura — **nunca é retornado aqui**,
 * e NÃO carrega faixa/teto hardcoded (D6: valores dependem de DECISION de Clayton).
 */
// `code` é o discriminante string-literal (narrowing estável sob tsconfig.build `strict:false`).
export type PayoutApprovalPolicyResult =
  | {
      configured: false;
      /** Código estável devolvido pela rota quando a política está ausente. */
      code: 'PAYOUT_APPROVAL_POLICY_NOT_CONFIGURED';
      reason: string;
    }
  | {
      // 🚧 Costura para CAMINHO A (não produzida hoje). A frente futura define a forma concreta
      // da faixa/autoridade aqui, ancorada numa DECISION — sem hardcode neste arquivo.
      configured: true;
      code: 'PAYOUT_APPROVAL_POLICY_CONFIGURED';
    };

/** Mensagem canônica de ausência material (D2 autoridade + D4/D6 faixa). */
const NOT_CONFIGURED_REASON =
  'Nenhuma política de aprovação de payout promulgada: falta (D2) o modelo de autoridade do Core ' +
  'Financeiro institucional E (D4/D6) a faixa segura de valor (definida por Clayton via DECISION). ' +
  'Grants operacionais comuns, saldo disponível projetado e roles genéricas NÃO são autoridade de ' +
  'aprovação. Aprovação bloqueada (fail-closed) — nenhum payout é aprovado por HTTP.';

/**
 * Resolve a política de aprovação de payout. **FAIL-CLOSED**: sem política/faixa material promulgada,
 * retorna `configured:false`. NÃO move dinheiro, NÃO lê grant comum, NÃO usa availableBalanceCents,
 * NÃO hardcoda faixa. (DECISION-0129 D2/D4/D6.)
 */
export function resolvePayoutApprovalPolicy(
  _input: PayoutApprovalPolicyInput
): PayoutApprovalPolicyResult {
  // Sem substrato material de política/faixa/autoridade Core Financeiro (verificado: schema dev 384).
  // Enquanto Clayton não promulgar a faixa/autoridade via DECISION, a porta permanece fechada.
  return {
    configured: false,
    code: 'PAYOUT_APPROVAL_POLICY_NOT_CONFIGURED',
    reason: NOT_CONFIGURED_REASON,
  };
}
