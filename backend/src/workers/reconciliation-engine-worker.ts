/**
 * Prompt 52 — Reconciliation Engine worker: runReconciliation por tenant.
 * Não altera ledger/transactions; apenas reconciliation_runs + reconciliation_ledger_discrepancies.
 */

import { listTenantsForReconciliation } from '@modules/reconciliation/reconciliation.repository';
import { runReconciliation } from '@modules/reconciliation/reconciliation-engine.service';

const INTERVAL_MS = Number(process.env.RECONCILIATION_ENGINE_INTERVAL_MS || 300_000);

async function runCycle(): Promise<void> {
  let tenants: string[];
  try {
    tenants = await listTenantsForReconciliation(500);
  } catch (e) {
    console.error('[ReconciliationEngineWorker] listTenants failed:', e);
    return;
  }
  for (const tenantId of tenants) {
    try {
      await runReconciliation(tenantId);
    } catch (err) {
      console.error('[ReconciliationEngineWorker] run failed', { tenantId, err });
    }
  }
}

let intervalId: ReturnType<typeof setInterval> | null = null;

export function startReconciliationEngineWorker(): void {
  if (intervalId !== null) return;
  runCycle().catch((e) => console.error('[ReconciliationEngineWorker] initial:', e));
  intervalId = setInterval(() => {
    runCycle().catch((e) => console.error('[ReconciliationEngineWorker] cycle:', e));
  }, INTERVAL_MS);
  console.log(
    `[ReconciliationEngineWorker] Started (interval ${INTERVAL_MS}ms, Prompt 52 read-only engine)`
  );
}