// C7 (DECISION-0053 C7, 2026-05-27) — finalizeRecoveryCase
//
// Finalização semântica pós-D-money após obligation atingir status terminal.
//
// Para obligation 'recovered':
//   - Atualiza payment_intents.payment_status → 'refunded_via_recovery'
//   - Insere evento PAYMENT_INTENT_REFUNDED_VIA_RECOVERY no event_outbox
//   - Tudo dentro do mesmo client (atômico com C3.1)
//
// Para obligation 'cancelled':
//   - NÃO altera payment_intents.payment_status
//   - Insere evento ACTOR_WALLET_RECOVERY_CANCELLED no event_outbox
//
// Regras:
//   - Não move dinheiro. Não toca bank_ledger/bank_transactions/bank_splits.
//   - Não cria reversal. Não chama requestReversal/executeReversal.
//   - Idempotente: segunda chamada para obligation 'recovered' + intent já
//     'refunded_via_recovery' retorna 'already_finalized'.
//   - event_id determinístico via outboxEventIdFromSeed (ON CONFLICT DO NOTHING).
//   - Status não-terminal → RecoveryFinalizationError sem nenhuma escrita.

import type { PoolClient } from 'pg';
import { getClientWithTenant } from '@core/database/pool';
import {
  insertEventOutboxRow,
  outboxEventIdFromSeed,
} from '@core/events/event-outbox.repository';
import { updatePaymentIntentStatusWithClient } from '@modules/payments/payment-intent-repository';

export type FinalizeResult =
  | 'finalized'
  | 'already_finalized'
  | 'cancelled_event_recorded';

export class RecoveryFinalizationError extends Error {
  constructor(
    public readonly code:
      | 'RECOVERY_OBLIGATION_NOT_FOUND'
      | 'RECOVERY_FINALIZATION_OBLIGATION_NOT_TERMINAL'
      | 'RECOVERY_FINALIZATION_UNEXPECTED_PAYMENT_STATUS',
    message: string
  ) {
    super(message);
    this.name = 'RecoveryFinalizationError';
  }
}

interface ObligationFinalizationRow {
  id: string;
  payment_intent_id: string;
  status: string;
  amount_cents: string;
  recovered_amount_cents: string;
  debtor_actor_id: string;
  creditor_actor_id: string;
}

export async function finalizeRecoveryCase(
  tenantId: string,
  obligationId: string,
  existingClient?: PoolClient
): Promise<FinalizeResult> {
  const client = existingClient ?? (await getClientWithTenant(tenantId));
  const ownClient = !existingClient;

  try {
    if (ownClient) await client.query('BEGIN');

    // ── 1. Load obligation ───────────────────────────────────────────────────

    const obligationResult = await client.query<ObligationFinalizationRow>(
      `SELECT id, payment_intent_id, status, amount_cents, recovered_amount_cents,
              debtor_actor_id, creditor_actor_id
         FROM actor_wallet_recovery_obligations
        WHERE tenant_id = $1 AND id = $2`,
      [tenantId, obligationId]
    );
    const obligation = obligationResult.rows[0];

    if (!obligation) {
      throw new RecoveryFinalizationError(
        'RECOVERY_OBLIGATION_NOT_FOUND',
        `Obligation ${obligationId} not found (tenant ${tenantId})`
      );
    }

    // ── 2. Non-terminal status → reject without writing ──────────────────────

    if (obligation.status !== 'recovered' && obligation.status !== 'cancelled') {
      throw new RecoveryFinalizationError(
        'RECOVERY_FINALIZATION_OBLIGATION_NOT_TERMINAL',
        `Obligation ${obligationId} has status '${obligation.status}' — expected 'recovered' or 'cancelled'`
      );
    }

    // ── 3a. Recovered path ───────────────────────────────────────────────────

    if (obligation.status === 'recovered') {
      const intentResult = await client.query<{ payment_status: string }>(
        `SELECT payment_status FROM payment_intents WHERE tenant_id = $1 AND id = $2`,
        [tenantId, obligation.payment_intent_id]
      );
      const paymentStatus = intentResult.rows[0]?.payment_status;

      // Idempotence: already finalized
      if (paymentStatus === 'refunded_via_recovery') {
        if (ownClient) await client.query('COMMIT');
        return 'already_finalized';
      }

      // C7 update only applies when intent has already been paid out via D-money.
      // For obligations created outside the D-money flow (income withholding against
      // 'pending'/'escrowed' intents), skip the payment_intent update gracefully.
      if (paymentStatus === 'released_to_actor_wallet') {
        await updatePaymentIntentStatusWithClient(
          client,
          tenantId,
          obligation.payment_intent_id,
          'refunded_via_recovery'
        );

        // Insert event (deterministic id — idempotent on replay)
        await insertEventOutboxRow(client, {
          tenantId,
          eventId: outboxEventIdFromSeed(`PAYMENT_INTENT_REFUNDED_VIA_RECOVERY:${tenantId}:${obligationId}`),
          eventType: 'PAYMENT_INTENT_REFUNDED_VIA_RECOVERY',
          payload: {
            obligation_id: obligationId,
            payment_intent_id: obligation.payment_intent_id,
            recovered_amount_cents: Number(obligation.recovered_amount_cents),
            debtor_actor_id: obligation.debtor_actor_id,
            creditor_actor_id: obligation.creditor_actor_id,
          },
        });
      }

      if (ownClient) await client.query('COMMIT');
      return 'finalized';
    }

    // ── 3b. Cancelled path ───────────────────────────────────────────────────

    // NÃO altera payment_intents.payment_status (mantém released_to_actor_wallet)
    await insertEventOutboxRow(client, {
      tenantId,
      eventId: outboxEventIdFromSeed(`ACTOR_WALLET_RECOVERY_CANCELLED:${tenantId}:${obligationId}`),
      eventType: 'ACTOR_WALLET_RECOVERY_CANCELLED',
      payload: {
        obligation_id: obligationId,
        payment_intent_id: obligation.payment_intent_id,
        debtor_actor_id: obligation.debtor_actor_id,
        creditor_actor_id: obligation.creditor_actor_id,
      },
    });

    if (ownClient) await client.query('COMMIT');
    return 'cancelled_event_recorded';

  } catch (e) {
    if (ownClient) await client.query('ROLLBACK').catch(() => {});
    throw e;
  } finally {
    if (ownClient) client.release();
  }
}
