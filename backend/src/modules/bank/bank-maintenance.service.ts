/**
 * Operações de manutenção / backfill que devem permanecer no domínio Bank.
 * Scripts em `src/scripts/` apenas orquestram estas funções.
 */
import type { PoolClient } from 'pg';
import { pool } from '@core/database/pool';
import { bankAccountRepository } from './bank-account.repository';
import { bankLedgerRepository } from './bank-ledger.repository';

const E2E_MINT_REF_TYPE = 'e2e_system_liquidity_mint';
const E2E_MINT_DEBIT_JUSTIFICATION =
  'Backfill double-entry debit for e2e_system_liquidity_mint (contra system:liquidity_issuance)';

async function listMintTransactionsMissingDebit(
  client: PoolClient,
  referenceType: string
): Promise<Array<{ id: string; tenant_id: string; amount_cents: string }>> {
  const pending = await client.query<{
    id: string;
    tenant_id: string;
    amount_cents: string;
  }>(
    `
    SELECT bt.id, bt.tenant_id, bt.amount_cents::text
    FROM bank_transactions bt
    WHERE bt.reference_type = $1
      AND EXISTS (
        SELECT 1 FROM bank_ledger bl
        WHERE bl.transaction_id = bt.id AND bl.direction = 'credit'
      )
      AND NOT EXISTS (
        SELECT 1 FROM bank_ledger bl
        WHERE bl.transaction_id = bt.id AND bl.direction = 'debit'
      )
    ORDER BY bt.created_at
    `,
    [referenceType]
  );
  return pending.rows;
}

export async function runBackfillE2eMintLedgerDebits(): Promise<void> {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL ausente');
  }

  const client = await pool.connect();
  try {
    const pending = await listMintTransactionsMissingDebit(client, E2E_MINT_REF_TYPE);

    if (pending.length === 0) {
      console.log('Nada a corrigir (mints já balanceados ou sem crédito órfão).');
      return;
    }

    console.log(`Transações a corrigir: ${pending.length}`);

    await client.query('BEGIN');

    for (const row of pending) {
      const issuanceAccountId = await bankAccountRepository.getOrCreateSystemLiquidityIssuanceAccountId(
        client,
        row.tenant_id
      );
      const amount = Number(row.amount_cents);
      if (!Number.isFinite(amount) || amount <= 0) {
        throw new Error(`amount_cents inválido para tx ${row.id}`);
      }

      await bankLedgerRepository.insertMaintenanceLedgerDebit(
        client,
        row.tenant_id,
        issuanceAccountId,
        row.id,
        amount,
        E2E_MINT_DEBIT_JUSTIFICATION
      );

      console.log('OK:', {
        transaction_id: row.id,
        tenant_id: row.tenant_id,
        debit_account_id: issuanceAccountId,
        amount_cents: amount,
      });
    }

    await client.query('COMMIT');
    console.log('\nBackfill concluído.');

    const sums = await bankLedgerRepository.sumGlobalDebitCreditTotals();
    console.log('Totais ledger:', sums);
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}