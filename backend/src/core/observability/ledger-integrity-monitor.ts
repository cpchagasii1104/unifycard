// Ledger Integrity Monitor — verificação double-entry (debit = credit)
// 🔴 DECISION-0149 (tenant-loop): bank_ledger tem RLS+FORCE. Sob unificard_app uma soma global retornaria 0
// (falso "OK"). Padrão canônico cross-tenant: descobrir tenants por `tenants` (registry NÃO-RLS) + somar
// debit/credit POR tenant com app.current_tenant. Invariante double-entry por-tenant (mais forte) + global.
// SEM bypass/infra-role.

import type { Pool } from 'pg';
import { runQueriesWithTenant } from '@core/database/pool';

export async function checkLedgerIntegrity(pool: Pool) {
  const tenants = (await pool.query<{ id: string }>(`SELECT id FROM tenants`)).rows;
  let debit = 0;
  let credit = 0;
  for (const t of tenants) {
    const rows = await runQueriesWithTenant<{ total_debit: string | null; total_credit: string | null }>(
      t.id,
      `SELECT
         SUM(CASE WHEN direction = 'debit' THEN amount_cents ELSE 0 END) AS total_debit,
         SUM(CASE WHEN direction = 'credit' THEN amount_cents ELSE 0 END) AS total_credit
       FROM bank_ledger`
    );
    const d = Number(rows[0]?.total_debit || 0);
    const c = Number(rows[0]?.total_credit || 0);
    if (d !== c) {
      throw new Error(`LEDGER_DRIFT_DETECTED (tenant=${t.id})`);
    }
    debit += d;
    credit += c;
  }

  if (debit !== credit) {
    throw new Error('LEDGER_DRIFT_DETECTED');
  }

  return {
    debit,
    credit,
    status: 'OK',
  };
}