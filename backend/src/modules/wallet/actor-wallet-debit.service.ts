// C3 (DECISION-0055, 2026-05-27) — debitActorWalletForRecovery
// Débito de actor_wallet (devedor) → user_wallet (credor/payer) para recovery pós-D-money.
//
// Escopo: recovery pós-D-money APENAS. Não é serviço genérico de débito.
// Clearance: approval_request approved + operation_type=actor_wallet_recovery.
// Atomicidade: transfer + entry + obligation update em único BEGIN/COMMIT.
//
// C3.1 (2026-05-27): aceita existingClient (para income withholding dentro do D-money)
//   e maxAmountCents (teto de drenagem = crédito recém-entrado).

import type { PoolClient } from 'pg';
import { v4 as uuidv4 } from 'uuid';
import { getClientWithTenant } from '@core/database/pool';
import { bankTransactionService } from '../bank/bank-transaction.service';
import { bankLedgerRepository } from '../bank/bank-ledger.repository';
import { buildSystemAuthorship } from '../bank/financial-authorship.helper';

export class ActorWalletDebitError extends Error {
  constructor(
    public readonly code:
      | 'RECOVERY_OBLIGATION_NOT_FOUND'
      | 'RECOVERY_APPROVAL_REQUIRED'
      | 'RECOVERY_APPROVAL_NOT_FOUND'
      | 'RECOVERY_APPROVAL_WRONG_TYPE'
      | 'RECOVERY_OBLIGATION_ALREADY_RECOVERED'
      | 'RECOVERY_OBLIGATION_CANCELLED'
      | 'RECOVERY_OBLIGATION_FAILED',
    message: string
  ) {
    super(message);
    this.name = 'ActorWalletDebitError';
  }
}

export interface RecoveryDebitResult {
  obligationId: string;
  result: 'recovered' | 'partially_recovered' | 'no_funds_available';
  amountDebited: number;
  recoveredTotal: number;
  entryId?: string;
  transactionId?: string;
}

interface ObligationRow {
  id: string;
  tenant_id: string;
  debtor_actor_id: string;
  debtor_account_id: string;
  creditor_actor_id: string;
  creditor_account_id: string;
  amount_cents: string;
  recovered_amount_cents: string;
  status: string;
  approval_request_id: string | null;
}

export async function debitActorWalletForRecovery(
  tenantId: string,
  obligationId: string,
  existingClient?: PoolClient,
  maxAmountCents?: number
): Promise<RecoveryDebitResult> {
  const client = existingClient ?? (await getClientWithTenant(tenantId));
  const ownClient = !existingClient;

  try {
    if (ownClient) {
      await client.query('BEGIN');
    }

    // ── 1. Load obligation ───────────────────────────────────────────────────────

    const obligationResult = await client.query<ObligationRow>(
      `SELECT id, tenant_id, debtor_actor_id, debtor_account_id,
              creditor_actor_id, creditor_account_id,
              amount_cents, recovered_amount_cents, status, approval_request_id
         FROM actor_wallet_recovery_obligations
        WHERE tenant_id = $1 AND id = $2`,
      [tenantId, obligationId]
    );
    const obligation = obligationResult.rows[0];

    if (!obligation) {
      throw new ActorWalletDebitError('RECOVERY_OBLIGATION_NOT_FOUND', `Obligation ${obligationId} not found`);
    }

    // ── 2. Validate status ───────────────────────────────────────────────────────

    if (obligation.status === 'pending_approval') {
      throw new ActorWalletDebitError('RECOVERY_APPROVAL_REQUIRED', 'Obligation is pending approval');
    }
    if (obligation.status === 'recovered') {
      throw new ActorWalletDebitError('RECOVERY_OBLIGATION_ALREADY_RECOVERED', 'Obligation already fully recovered');
    }
    if (obligation.status === 'cancelled') {
      throw new ActorWalletDebitError('RECOVERY_OBLIGATION_CANCELLED', 'Obligation cancelled');
    }
    if (obligation.status === 'failed') {
      throw new ActorWalletDebitError('RECOVERY_OBLIGATION_FAILED', 'Obligation failed');
    }
    // obligation.status is 'approved' or 'partially_recovered'

    // ── 3. Validate approval ─────────────────────────────────────────────────────

    if (!obligation.approval_request_id) {
      throw new ActorWalletDebitError('RECOVERY_APPROVAL_REQUIRED', 'No approval_request linked to obligation');
    }

    const approvalResult = await client.query<{ status: string; operation_type: string }>(
      `SELECT status, operation_type FROM approval_requests WHERE tenant_id = $1 AND id = $2`,
      [tenantId, obligation.approval_request_id]
    );
    const approval = approvalResult.rows[0];

    if (!approval) {
      throw new ActorWalletDebitError('RECOVERY_APPROVAL_NOT_FOUND', `Approval request ${obligation.approval_request_id} not found`);
    }
    if (approval.operation_type !== 'actor_wallet_recovery') {
      throw new ActorWalletDebitError('RECOVERY_APPROVAL_WRONG_TYPE', `Expected operation_type=actor_wallet_recovery, got ${approval.operation_type}`);
    }
    if (approval.status !== 'approved') {
      throw new ActorWalletDebitError('RECOVERY_APPROVAL_REQUIRED', `Approval status is '${approval.status}', expected 'approved'`);
    }

    // ── 4. Calculate amounts ─────────────────────────────────────────────────────

    const amountCents = Number(obligation.amount_cents);
    const recoveredSoFar = Number(obligation.recovered_amount_cents);
    const remaining = amountCents - recoveredSoFar;

    // Pass client so uncommitted credits (e.g. D-money within same TX) are visible.
    const balance = await bankLedgerRepository.calculateBalance(tenantId, obligation.debtor_account_id, client);
    let amountToRecover = Math.min(remaining, balance.balanceCents);
    if (maxAmountCents !== undefined) {
      amountToRecover = Math.min(amountToRecover, maxAmountCents);
    }

    // ── 5. No funds short-circuit ────────────────────────────────────────────────

    if (amountToRecover === 0) {
      if (ownClient) await client.query('COMMIT');
      return {
        obligationId,
        result: 'no_funds_available',
        amountDebited: 0,
        recoveredTotal: recoveredSoFar,
      };
    }

    // ── 6. Execute atomically ────────────────────────────────────────────────────

    const entryId = uuidv4();
    const authorship = buildSystemAuthorship({
      actingForAccountId: obligation.debtor_account_id,
      actingForActorId: obligation.debtor_actor_id,
    });

    const transferResult = await bankTransactionService.transfer(
      tenantId,
      {
        eventId: uuidv4(),
        fromAccountId: obligation.debtor_account_id,
        toAccountId: obligation.creditor_account_id,
        amountCents: amountToRecover,
        currency: 'BRL',
        transactionType: 'transfer',
        referenceType: 'actor_wallet_recovery',
        referenceId: entryId,
        concept_id: 'actor-wallet-recovery',
        description: `Recovery obligation ${obligationId}`,
        authorship,
      },
      client
    );

    await client.query(
      `INSERT INTO actor_wallet_recovery_obligation_entries
         (id, tenant_id, obligation_id, recovery_transaction_id, amount_cents)
       VALUES ($1, $2, $3, $4, $5)`,
      [entryId, tenantId, obligationId, transferResult.transactionId, amountToRecover]
    );

    const newRecoveredTotal = recoveredSoFar + amountToRecover;
    const newStatus = newRecoveredTotal >= amountCents ? 'recovered' : 'partially_recovered';

    await client.query(
      `UPDATE actor_wallet_recovery_obligations
          SET recovered_amount_cents = $1, status = $2, updated_at = NOW()
        WHERE tenant_id = $3 AND id = $4`,
      [newRecoveredTotal, newStatus, tenantId, obligationId]
    );

    if (ownClient) await client.query('COMMIT');

    return {
      obligationId,
      result: newStatus as 'recovered' | 'partially_recovered',
      amountDebited: amountToRecover,
      recoveredTotal: newRecoveredTotal,
      entryId,
      transactionId: transferResult.transactionId,
    };
  } catch (e) {
    if (ownClient) await client.query('ROLLBACK').catch(() => {});
    throw e;
  } finally {
    if (ownClient) client.release();
  }
}
