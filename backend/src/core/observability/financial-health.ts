// Ledger Drift Auto Guard + Financial Health — saúde financeira agregada

import type { Pool } from 'pg';
import { checkLedgerIntegrity } from './ledger-integrity-monitor';
import { getFinancialMetrics } from './financial-metrics';

export async function getFinancialHealth(pool: Pool) {
  const ledger = await checkLedgerIntegrity(pool);
  const metrics = getFinancialMetrics();

  return {
    status: 'OK',
    ledger,
    metrics,
    timestamp: new Date().toISOString(),
  };
}