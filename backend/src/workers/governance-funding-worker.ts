// Governance Funding Worker — processa governance_funding (pending → PaymentIntent).
// Não escreve em bank_transactions nem bank_ledger; usa payment-intent-repository.

import {
  claimNextPendingFundingRequests,
  markFundingFailed,
} from '@modules/governance-funding/governance-funding.repository';
import { executeFunding } from '@modules/governance-funding/governance-funding.service';

const INTERVAL_MS = 30_000;
const BATCH_LIMIT = 50;

async function runGovernanceFundingCycle(): Promise<void> {
  try {
    const claimed = await claimNextPendingFundingRequests(BATCH_LIMIT);
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