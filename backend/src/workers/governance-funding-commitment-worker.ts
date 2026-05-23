// Governance Funding Commitment Worker — processa commitments (pending → valida saldo → treasury→escrow → PaymentIntent).
// Execucao atomica: UMA transacao — lock treasury, saldo consistente, transfer; rollback automatico em erro.

import { v4 as uuidv4 } from 'uuid';
import { getClientWithTenant } from '@core/database/pool';
import {
  claimNextPendingCommitments,
  markExecuted,
  markFailed,
} from '@modules/governance-funding-commitment/governance-funding-commitment.repository';
import { getTreasuryAccount } from '@modules/treasury/treasury-account-repository';
import { getAccountBalanceConsistent } from '@modules/bank/bank-ledger.repository';
import { bankTransactionService } from '@modules/bank/bank-transaction.service';
import { bankAccountService } from '@modules/bank/bank-account.service';
import { buildSystemAuthorship } from '@modules/bank/financial-authorship.helper';
import { createPaymentIntent } from '@modules/payments/payment-intent-repository';
import type { BankCurrency } from '@modules/bank/bank-account.types';

const INTERVAL_MS = 30_000;
const BATCH_LIMIT = 50;
const GATEWAY_GOVERNANCE_FUNDING = 'governance_funding';

async function runGovernanceFundingCommitmentCycle(): Promise<void> {
  try {
    const claimed = await claimNextPendingCommitments(BATCH_LIMIT);
    for (const c of claimed) {
      const client = await getClientWithTenant(c.tenantId);
      try {
        const treasury = await getTreasuryAccount(c.tenantId, c.treasuryAccountId);
        if (!treasury) {
          console.error('[GovernanceFundingCommitmentWorker] Treasury account not found', c.treasuryAccountId);
          await markFailed(c.tenantId, c.id);
          continue;
        }

        await bankAccountService.ensurePlatformAccounts(c.tenantId, (c.currency || 'BRL') as BankCurrency);
        const escrowAccount = await bankAccountService.getPlatformLifecycleAccount(
          c.tenantId,
          'escrow_payments',
          (c.currency || 'BRL') as BankCurrency
        );
        if (!escrowAccount) {
          console.error('[GovernanceFundingCommitmentWorker] Escrow account not found', c.tenantId);
          await markFailed(c.tenantId, c.id);
          continue;
        }

        await client.query('BEGIN');

        // LEI 4.7: Lock via dominio Bank (SELECT FOR UPDATE encapsulado)
        try {
          await bankAccountService.acquireAccountLock(c.tenantId, treasury.accountId, client);
        } catch (lockErr) {
          await client.query('ROLLBACK');
          await markFailed(c.tenantId, c.id);
          continue;
        }

        const balanceResult = await getAccountBalanceConsistent(
          c.tenantId,
          treasury.accountId,
          client
        );
        if (balanceResult.balanceCents < c.amountCents) {
          await client.query('ROLLBACK');
          console.warn('[GovernanceFundingCommitmentWorker] Insufficient balance', {
            commitmentId: c.id,
            treasuryAccountId: c.treasuryAccountId,
            required: c.amountCents,
            actual: balanceResult.balanceCents,
          });
          await markFailed(c.tenantId, c.id);
          continue;
        }

        const authorship = buildSystemAuthorship({ actingForAccountId: treasury.accountId });
        await bankTransactionService.transfer(c.tenantId, {
          eventId: uuidv4(),
          fromAccountId: treasury.accountId,
          toAccountId: escrowAccount.accountId,
          amountCents: c.amountCents,
          currency: (c.currency || 'BRL') as BankCurrency,
          transactionType: 'transfer',
          description: `Governance funding commitment: ${c.proposalId}`,
          referenceType: 'governance_funding_commitment',
          referenceId: c.id,
          treasurySource: 'treasury:governance',
          authorship,
          concept_id: 'escrow-hold',
        }, client);

        await client.query('COMMIT');

        await createPaymentIntent(c.tenantId, {
          referenceId: `governance_funding:${c.proposalId}`,
          gateway: GATEWAY_GOVERNANCE_FUNDING,
          actorId: null,
          amountCents: c.amountCents,
          currency: c.currency,
          // DECISION-0032 Fase 1 — vocabulário canônico (mapping 'CREATED' → 'pending' na migration
          // 20260530503000_payment_intents_normalize_status). Antes deste fix o INSERT violava CHECK
          // constraint e o intent nunca era criado, embora o bank_transaction.transfer já tivesse commitado
          // (linha 92 do worker) — escrow hold ficava órfão sem rastro de intent.
          status: 'pending',
          metadata: {
            source: 'governance_funding',
            proposal_id: c.proposalId,
            treasury_account_id: c.treasuryAccountId,
            project_reference: c.projectReference ?? undefined,
            commitment_id: c.id,
          },
        });

        await markExecuted(c.tenantId, c.id);
      } catch (err) {
        try {
          await client.query('ROLLBACK');
        } catch (_) {
          /* ignore rollback error */
        }
        console.error('[GovernanceFundingCommitmentWorker] Commitment failed', c.id, err);
        try {
          await markFailed(c.tenantId, c.id);
        } catch (e) {
          console.error('[GovernanceFundingCommitmentWorker] markFailed error', c.id, e);
        }
      } finally {
        client.release();
      }
    }
  } catch (err) {
    console.error('[GovernanceFundingCommitmentWorker] Cycle error:', err);
  }
}

let intervalId: ReturnType<typeof setInterval> | null = null;

export function startGovernanceFundingCommitmentWorker(): void {
  if (intervalId !== null) return;
  runGovernanceFundingCommitmentCycle().catch((err) =>
    console.error('[GovernanceFundingCommitmentWorker] Initial run error:', err)
  );
  intervalId = setInterval(runGovernanceFundingCommitmentCycle, INTERVAL_MS);
  console.log('[BOOT] Governance Funding Commitment Worker iniciado');
}
