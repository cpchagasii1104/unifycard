// Payout Worker — processa payout_requests (status = requested): seller_available → seller_payout.
// Execucao atomica: uma transacao — lock conta origem, saldo consistente, transfer. Anti-duplicacao via claim.

import { v4 as uuidv4 } from 'uuid';
import { getClientWithTenant } from '@core/database/pool';
import { claimNextRequestedPayouts, updatePayoutStatus } from '@modules/payouts/payout-repository';
import { bankAccountService } from '@modules/bank/bank-account.service';
import { bankTransactionService } from '@modules/bank/bank-transaction.service';
import { getAccountBalanceConsistent } from '@modules/bank/bank-ledger.repository';
import { buildSystemAuthorship } from '@modules/bank/financial-authorship.helper';
import type { BankCurrency } from '@modules/bank/bank-account.types';
import type { PayoutRequest } from '@modules/payouts/payout-repository';

const INTERVAL_MS = 10_000;
const BATCH_LIMIT = 50;
let intervalId: ReturnType<typeof setInterval> | null = null;

async function processPayout(payout: PayoutRequest): Promise<void> {
  const tenantId = payout.tenantId;
  await bankAccountService.ensurePlatformAccounts(tenantId, payout.currency as 'BRL');
  const sellerAvailableAccount = await bankAccountService.getPlatformLifecycleAccount(
    tenantId,
    'seller_available',
    payout.currency as 'BRL'
  );
  const sellerPayoutAccount = await bankAccountService.getPlatformLifecycleAccount(
    tenantId,
    'seller_payout',
    payout.currency as 'BRL'
  );
  if (!sellerAvailableAccount || !sellerPayoutAccount) {
    throw new Error('seller_available or seller_payout account not found');
  }

  const client = await getClientWithTenant(tenantId);
  try {
    await client.query('BEGIN');

    // LEI 4.7: Lock via dominio Bank (SELECT FOR UPDATE encapsulado)
    await bankAccountService.acquireAccountLock(tenantId, sellerAvailableAccount.accountId, client);

    const balanceResult = await getAccountBalanceConsistent(
      tenantId,
      sellerAvailableAccount.accountId,
      client
    );
    if (balanceResult.balanceCents < payout.amountCents) {
      await client.query('ROLLBACK');
      throw new Error('INSUFFICIENT_FUNDS');
    }

    const authorship = buildSystemAuthorship({ actingForAccountId: sellerAvailableAccount.accountId });
    await bankTransactionService.transfer(tenantId, {
      eventId: uuidv4(),
      fromAccountId: sellerAvailableAccount.accountId,
      toAccountId: sellerPayoutAccount.accountId,
      amountCents: payout.amountCents,
      currency: payout.currency as BankCurrency,
      transactionType: 'transfer',
      description: `Seller payout: ${payout.id}`,
      metadata: undefined,
      referenceType: 'seller_payout',
      referenceId: payout.id,
      treasurySource: 'treasury:settlement',
      authorship,
    }, client);

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

async function runPayoutCycle(): Promise<void> {
  try {
    const claimed = await claimNextRequestedPayouts(BATCH_LIMIT);
    for (const payout of claimed) {
      try {
        console.log('PROCESSING_PAYOUT_REQUEST', payout.id);
        await processPayout(payout);
        await updatePayoutStatus(payout.tenantId, payout.id, 'completed');
        console.log('PAYOUT_REQUEST_COMPLETED', payout.id);
      } catch (err) {
        console.error('[PayoutWorker] Payout failed', payout.id, err);
        try {
          await updatePayoutStatus(payout.tenantId, payout.id, 'failed');
        } catch (e) {
          console.error('[PayoutWorker] Failed to update status to failed', payout.id, e);
        }
      }
    }
  } catch (err) {
    console.error('[PayoutWorker] Cycle error:', err);
  }
}

export function startPayoutWorker(): void {
  if (intervalId !== null) return;
  runPayoutCycle().catch((err) => console.error('[PayoutWorker] Initial run error:', err));
  intervalId = setInterval(runPayoutCycle, INTERVAL_MS);
  console.log('[PayoutWorker] Started (interval 10s, batch limit 50)');
}
