// Financial Reconciliation Engine — compara ledger com transações e detecta discrepâncias.
// Apenas leitura (SELECT). Nenhum INSERT, UPDATE ou DELETE.

import type { Pool } from 'pg';

/**
 * Executa verificações de reconciliação financeira.
 * Detecta: transações sem ledger, ledger sem transação, desbalanceamento por transação.
 */
export async function runFinancialReconciliation(pool: Pool): Promise<void> {
  const client = await pool.connect();
  try {
    // 1) Transações sem nenhuma entrada no ledger
    const noLedgerResult = await client.query<{ id: string }>(`
      SELECT t.id
      FROM bank_transactions t
      LEFT JOIN bank_ledger l ON t.id = l.transaction_id
      WHERE l.transaction_id IS NULL
      LIMIT 20
    `);
    if (noLedgerResult.rows.length > 0) {
      const ids = noLedgerResult.rows.map((r) => r.id);
      console.error('TRANSACTION_WITHOUT_LEDGER', ids);
    }

    // 2) Entradas de ledger cujo transaction_id não existe em bank_transactions
    const noTxResult = await client.query<{ transaction_id: string }>(`
      SELECT DISTINCT transaction_id
      FROM bank_ledger
      WHERE transaction_id IS NOT NULL
        AND transaction_id NOT IN (SELECT id FROM bank_transactions)
      LIMIT 20
    `);
    if (noTxResult.rows.length > 0) {
      console.error('LEDGER_WITHOUT_TRANSACTION', noTxResult.rows.map((r) => r.transaction_id));
    }

    // 3) Por transação: débito total deve igualar crédito total (split invariant)
    const imbalanceResult = await client.query<{ transaction_id: string; debit: string; credit: string }>(`
      SELECT
        transaction_id,
        SUM(CASE WHEN direction = 'debit' THEN amount_cents ELSE 0 END)::text AS debit,
        SUM(CASE WHEN direction = 'credit' THEN amount_cents ELSE 0 END)::text AS credit
      FROM bank_ledger
      WHERE transaction_id IS NOT NULL
      GROUP BY transaction_id
      HAVING SUM(CASE WHEN direction = 'debit' THEN amount_cents ELSE 0 END) !=
             SUM(CASE WHEN direction = 'credit' THEN amount_cents ELSE 0 END)
      LIMIT 20
    `);
    if (imbalanceResult.rows.length > 0) {
      console.error(
        'TRANSACTION_IMBALANCE',
        imbalanceResult.rows.map((r) => ({ transaction_id: r.transaction_id, debit: r.debit, credit: r.credit }))
      );
    }
  } catch (err) {
    console.warn('[FinancialReconciliation] Run failed (non-fatal):', err);
  } finally {
    client.release();
  }
}