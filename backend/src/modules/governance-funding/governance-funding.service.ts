// Governance Funding Service — cria PaymentIntent para financiamento aprovado pela governança.
// Não escreve em bank_transactions nem bank_ledger; usa payment-intent-repository (payments).

import {
  getFundingByProposalId,
  createFundingRequest,
  markFundingFunded,
  markFundingFailed,
} from './governance-funding.repository';
import { createPaymentIntent } from '@modules/payments/payment-intent-repository';

export interface ExecuteFundingParams {
  tenantId: string;
  proposalId: string;
  treasuryAccountId: string;
  projectReference: string | null;
  amountCents: number;
  currency: string;
}

const GATEWAY_GOVERNANCE_FUNDING = 'governance_funding';

/**
 * Idempotente por proposalId. Cria funding request se não existir, cria PaymentIntent, marca funded ou failed.
 */
export async function executeFunding(params: ExecuteFundingParams): Promise<void> {
  const { tenantId, proposalId, treasuryAccountId, projectReference, amountCents, currency } = params;

  const existing = await getFundingByProposalId(tenantId, proposalId);
  if (existing?.status === 'funded') return;
  if (existing?.status === 'failed') return;

  let fundingId: string;
  if (!existing) {
    const created = await createFundingRequest(tenantId, {
      proposalId,
      treasuryAccountId,
      projectReference,
      amountCents,
      currency,
    });
    fundingId = created.id;
  } else {
    fundingId = existing.id;
  }

  try {
    await createPaymentIntent(tenantId, {
      referenceId: `governance_funding:${proposalId}`,
      gateway: GATEWAY_GOVERNANCE_FUNDING,
      actorId: null,
      amountCents,
      currency,
      // DECISION-0032 Fase 1 — vocabulário canônico do enum payment_intents.payment_status (11 valores
      // do CHECK; mapping 'CREATED' → 'pending' na migration 20260530503000_payment_intents_normalize_status).
      status: 'pending',
      metadata: {
        source: 'governance_funding',
        proposal_id: proposalId,
        treasury_account_id: treasuryAccountId,
        project_reference: projectReference ?? undefined,
      },
    });
    await markFundingFunded(tenantId, fundingId);
  } catch (err) {
    console.error('[GovernanceFunding] executeFunding failed', { proposalId, fundingId, err });
    await markFundingFailed(tenantId, fundingId);
    throw err;
  }
}