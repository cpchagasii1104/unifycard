// Reconciliation Integrity Worker — verificação contínua de consistência (PaymentIntent, Payouts, Settlements, Ledger).
// Apenas leitura (SELECT). Nunca escreve em bank_transactions, bank_ledger ou bank_accounts.

import { pool } from '@core/database/pool';
import { checkLedgerIntegrity } from '@core/observability/ledger-integrity-monitor';

const INTERVAL_MS = 30_000;

async function runReconciliationChecks(): Promise<void> {
  try {
    // Verificação 1: PaymentIntents status='completed' sem settlement correspondente (tenant sem bank_settlements)
    const intentResult = await pool.query<{ id: string; tenant_id: string }>(`
      SELECT pi.id, pi.tenant_id
      FROM payment_intents pi
      LEFT JOIN bank_settlements bs ON bs.tenant_id = pi.tenant_id
      WHERE pi.status = 'completed' AND bs.id IS NULL
    `);
    for (const row of intentResult.rows) {
      console.error('INTENT_WITHOUT_SETTLEMENT', { intentId: row.id, tenantId: row.tenant_id });
    }

    // Verificação 2: Payouts status='completed' sem bank_settlement
    const payoutResult = await pool.query<{ id: string; tenant_id: string }>(`
      SELECT pr.id, pr.tenant_id
      FROM payout_requests pr
      LEFT JOIN bank_settlements bs ON bs.payout_id = pr.id
      WHERE pr.status = 'completed' AND bs.id IS NULL
    `);
    for (const row of payoutResult.rows) {
      console.error('PAYOUT_WITHOUT_SETTLEMENT', { payoutId: row.id, tenantId: row.tenant_id });
    }

    // Verificação 3: Ledger drift (double-entry: debit = credit)
    try {
      await checkLedgerIntegrity(pool);
    } catch {
      console.error('LEDGER_DRIFT_DETECTED');
    }
  } catch (err) {
    console.error('[ReconciliationWorker] Cycle error:', err);
  }
}

let intervalId: ReturnType<typeof setInterval> | null = null;

export function startReconciliationWorker(): void {
  if (intervalId !== null) return;
  runReconciliationChecks().catch((err) => console.error('[ReconciliationWorker] Initial run error:', err));
  intervalId = setInterval(runReconciliationChecks, INTERVAL_MS);
  console.log('[ReconciliationWorker] Started (interval 30s, read-only checks)');
}