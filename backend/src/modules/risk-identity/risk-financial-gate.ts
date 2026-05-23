/**

 * Único ponto de entrada para enforcement financeiro (identidade + risco + limites).

 * Ordem institucional: ver `authorityDecisionService` (ATL → KYC → GUARDA).

 */



import { authorityDecisionService } from '@core/compliance/authority-decision.service';

import type { RiskLevel } from './actor-risk.repository';



export interface FinancialRiskGateInput {

  actorId: string;

  action:

    | 'financial_transfer'

    | 'financial_payout'

    | 'financial_payment'

    | 'financial_reversal_request';

  /** Para aplicar teto por nível (transfer / payment / payout) */

  amountCents?: number;

}



/**

 * Deve ser chamado antes de qualquer mutação financeira iniciada pelo actor.

 */

export async function requireFinancialRiskClearance(

  tenantId: string,

  input: FinancialRiskGateInput

): Promise<{ riskLevel: RiskLevel; requiresStepUp: boolean }> {

  const evaluation = await authorityDecisionService.evaluateFinancialSensitiveAction(tenantId, {

    actorId: input.actorId,

    action: input.action,

    amountCents: input.amountCents,

  });



  authorityDecisionService.assertFinancialSensitiveAllowed(evaluation);



  if (!evaluation.riskLevel) {

    throw new Error('AUTHORITY_EVALUATION_MISSING_RISK_LEVEL');

  }



  return {

    riskLevel: evaluation.riskLevel as RiskLevel,

    requiresStepUp: evaluation.requiresStepUp,

  };

}