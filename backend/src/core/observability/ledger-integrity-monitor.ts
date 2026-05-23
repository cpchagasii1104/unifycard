// Ledger Integrity Monitor — verificação double-entry (debit = credit)

import type { Pool } from 'pg';

export async function checkLedgerIntegrity(pool: Pool) {
  const result = await pool.query(`
    SELECT
      SUM(CASE WHEN direction = 'debit' THEN amount_cents ELSE 0 END) as total_debit,
      SUM(CASE WHEN direction = 'credit' THEN amount_cents ELSE 0 END) as total_credit
    FROM bank_ledger
  `);

  const debit = Number(result.rows[0].total_debit || 0);
  const credit = Number(result.rows[0].total_credit || 0);

  if (debit !== credit) {
    throw new Error('LEDGER_DRIFT_DETECTED');
  }

  return {
    debit,
    credit,
    status: 'OK',
  };
}