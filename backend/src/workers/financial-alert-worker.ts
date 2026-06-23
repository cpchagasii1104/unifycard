// Financial Alert Worker — detecta anomalias e cria alertas em financial_alerts.
// Não altera bank_transactions, bank_ledger nem bank_accounts. Somente leitura em dados financeiros + INSERT em financial_alerts.

import { pool } from '@core/database/pool';
import { isFinancialWorkerEnabled } from './financial-worker-gate';
import {
  createFinancialAlert,
  hasUnresolvedAlert,
} from '@modules/alerts/financial-alert-repository';

const INTERVAL_MS = 60_000;
const LARGE_PAYOUT_THRESHOLD_CENTS = 1_000_000;

async function runAlertCycle(): Promise<void> {
  try {
    // A) Payout muito grande (amount_cents > 1_000_000)
    const largePayouts = await pool.query<{ id: string; tenant_id: string; amount_cents: string }>(`
      SELECT id, tenant_id, amount_cents
      FROM payout_requests
      WHERE amount_cents > $1
    `, [LARGE_PAYOUT_THRESHOLD_CENTS]);
    for (const row of largePayouts.rows) {
      const already = await hasUnresolvedAlert(row.tenant_id, 'LARGE_PAYOUT', row.id);
      if (!already) {
        await createFinancialAlert(row.tenant_id, {
          alertType: 'LARGE_PAYOUT',
          referenceId: row.id,
          severity: 'warning',
          message: `Payout muito grande: ${row.amount_cents} centavos (payout_id=${row.id})`,
        });
      }
    }

    // B) Settlement falhou (bank_settlements status = failed)
    const failedSettlements = await pool.query<{ id: string; tenant_id: string }>(`
      SELECT id, tenant_id FROM bank_settlements WHERE status = 'failed'
    `);
    for (const row of failedSettlements.rows) {
      const already = await hasUnresolvedAlert(row.tenant_id, 'SETTLEMENT_FAILED', row.id);
      if (!already) {
        await createFinancialAlert(row.tenant_id, {
          alertType: 'SETTLEMENT_FAILED',
          referenceId: row.id,
          severity: 'critical',
          message: `Settlement falhou (settlement_id=${row.id})`,
        });
      }
    }

    // C) Payout falhou (payout_requests status = failed)
    const failedPayouts = await pool.query<{ id: string; tenant_id: string }>(`
      SELECT id, tenant_id FROM payout_requests WHERE status = 'failed'
    `);
    for (const row of failedPayouts.rows) {
      const already = await hasUnresolvedAlert(row.tenant_id, 'PAYOUT_FAILED', row.id);
      if (!already) {
        await createFinancialAlert(row.tenant_id, {
          alertType: 'PAYOUT_FAILED',
          referenceId: row.id,
          severity: 'critical',
          message: `Payout falhou (payout_id=${row.id})`,
        });
      }
    }
  } catch (err) {
    console.error('[FinancialAlertWorker] Cycle error:', err);
  }
}

let intervalId: ReturnType<typeof setInterval> | null = null;

export function startFinancialAlertWorker(): void {
  // 🔴 F-RLS-OBSERVABILITY-WORKERS-RESOLVE (DECISION-0149): default-off. Varredura CROSS-TENANT crua —
  // sob unificard_app rodaria cega (0 linhas). Só liga com flag explícita; tenant-loop ao reativar.
  if (!isFinancialWorkerEnabled('ENABLE_FINANCIAL_ALERT_WORKER')) {
    console.log('[FinancialAlertWorker] DESLIGADO (default-off; ENABLE_FINANCIAL_ALERT_WORKER≠true).');
    return;
  }
  if (intervalId !== null) return;
  runAlertCycle().catch((err) => console.error('[FinancialAlertWorker] Initial run error:', err));
  intervalId = setInterval(runAlertCycle, INTERVAL_MS);
  console.log('[FinancialAlertWorker] Started (interval 60s, anomaly detection)');
}