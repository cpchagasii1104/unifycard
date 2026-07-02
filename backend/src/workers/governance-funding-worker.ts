// Governance Funding Worker — processa governance_funding (pending → PaymentIntent).
// Não escreve em bank_transactions nem bank_ledger; usa payment-intent-repository.
// F-GROUP-B-FINANCIAL-WORKERS-TENANT-LOOP-RLS (DECISION-0149 tenant-loop): descobre tenants por
// fonte NÃO-RLS (`tenants`) e claima POR TENANT com tenant-context — sem leitura cross-tenant.

import {
  claimNextPendingFundingRequests,
  markFundingFailed,
} from '@modules/governance-funding/governance-funding.repository';
import { executeFunding } from '@modules/governance-funding/governance-funding.service';
import { listTenantIdsForWorkerLoop } from '@core/database/tenant-loop';

const INTERVAL_MS = 30_000;
const BATCH_LIMIT = 50;

async function runGovernanceFundingCycle(): Promise<void> {
  try {
    const tenantIds = await listTenantIdsForWorkerLoop();
    for (const tenantId of tenantIds) {
      const claimed = await claimNextPendingFundingRequests(tenantId, BATCH_LIMIT);
      for (const f of claimed) {
        try {
          await executeFunding({
            tenantId: f.tenantId,
            proposalId: f.proposalId,
            treasuryAccountId: f.treasuryAccountId,
            projectReference: f.projectReference,
            amountCents: f.amountCents,
            currency: f.currency,
          });
        } catch (err) {
          console.error('[GovernanceFundingWorker] Funding failed', f.id, err);
          try {
            await markFundingFailed(f.tenantId, f.id);
          } catch (e) {
            console.error('[GovernanceFundingWorker] markFundingFailed error', f.id, e);
          }
        }
      }
    }
  } catch (err) {
    console.error('[GovernanceFundingWorker] Cycle error:', err);
  }
}

let intervalId: ReturnType<typeof setInterval> | null = null;

export function startGovernanceFundingWorker(): void {
  if (intervalId !== null) return;
  runGovernanceFundingCycle().catch((err) =>
    console.error('[GovernanceFundingWorker] Initial run error:', err)
  );
  intervalId = setInterval(runGovernanceFundingCycle, INTERVAL_MS);
  console.log('[BOOT] Governance Funding Worker iniciado (interval 30s)');
}