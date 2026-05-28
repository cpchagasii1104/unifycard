// C3.1 (DECISION-0055 D3, 2026-05-27) — drainRecoveryObligationsForCredit
//
// Income withholding síncrono: quando actor_wallet recebe crédito (D-money),
// drena obrigações ativas do devedor antes de liberar saldo.
//
// Regras:
//   - Obrigações elegíveis: status IN ('approved', 'partially_recovered')
//   - Ordem: FIFO por created_at ASC
//   - Teto: creditedAmountCents (nunca drena saldo antigo)
//   - Atomicidade: opera dentro do client externo (D-money transaction)
//   - Partial recovery não é erro; saldo insuficiente não é erro

import type { PoolClient } from 'pg';
import { debitActorWalletForRecovery } from '../wallet/actor-wallet-debit.service';
import { logFinancialEvent } from '@core/observability/financial-logger';

export interface DrainResult {
  totalDrainedCents: number;
  residualCreditCents: number;
  obligationsTouched: number;
  entriesCreated: number;
}

export async function drainRecoveryObligationsForCredit(
  tenantId: string,
  debtorActorId: string,
  creditedAmountCents: number,
  client: PoolClient
): Promise<DrainResult> {
  if (creditedAmountCents <= 0) {
    return { totalDrainedCents: 0, residualCreditCents: 0, obligationsTouched: 0, entriesCreated: 0 };
  }

  // Lock active obligations FIFO — FOR UPDATE serializes concurrent drain attempts.
  const obligationsResult = await client.query<{ id: string }>(
    `SELECT id
       FROM actor_wallet_recovery_obligations
      WHERE tenant_id = $1 AND debtor_actor_id = $2
        AND status IN ('approved', 'partially_recovered')
      ORDER BY created_at ASC
      FOR UPDATE`,
    [tenantId, debtorActorId]
  );

  if (obligationsResult.rows.length === 0) {
    return { totalDrainedCents: 0, residualCreditCents: creditedAmountCents, obligationsTouched: 0, entriesCreated: 0 };
  }

  let residualCreditCents = creditedAmountCents;
  let totalDrainedCents = 0;
  let obligationsTouched = 0;
  let entriesCreated = 0;

  for (const { id: obligationId } of obligationsResult.rows) {
    if (residualCreditCents <= 0) break;

    const result = await debitActorWalletForRecovery(
      tenantId,
      obligationId,
      client,
      residualCreditCents
    );

    if (result.result !== 'no_funds_available') {
      totalDrainedCents += result.amountDebited;
      residualCreditCents -= result.amountDebited;
      obligationsTouched++;
      if (result.entryId) entriesCreated++;

      logFinancialEvent({
        financial_event: 'income_withholding_applied',
        tenant_id: tenantId,
        actor_id: debtorActorId,
        amount_cents: result.amountDebited,
        reference_type: 'actor_wallet_recovery',
        reference_id: obligationId,
        metadata: { obligation_status: result.result },
      });
    }
  }

  return { totalDrainedCents, residualCreditCents, obligationsTouched, entriesCreated };
}
