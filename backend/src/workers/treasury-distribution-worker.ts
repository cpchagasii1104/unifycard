// Treasury Distribution Worker — cria governance_financial_actions a partir de treasury_distributions.
// Não escreve em bank_transactions nem bank_ledger. Ações são processadas pelo Governance Financial Action Worker.
// F-GROUP-B-FINANCIAL-WORKERS-TENANT-LOOP-RLS (DECISION-0149 tenant-loop): descobre tenants por
// fonte NÃO-RLS (`tenants`) e claima POR TENANT com client de tenant-context.

import type { PoolClient } from 'pg';
import { getClientWithTenant } from '@core/database/pool';
import { claimNextPendingDistributions } from '@modules/treasury/treasury-distribution-repository';
import { createFinancialAction } from '@modules/governance/governance-financial-action-repository';
import { listTenantIdsForWorkerLoop } from '@core/database/tenant-loop';

const INTERVAL_MS = 60_000;
const BATCH_LIMIT = 50;

async function runTenantDistributionBatch(tenantId: string): Promise<void> {
  let client: PoolClient | undefined;
  try {
    client = await getClientWithTenant(tenantId);
    await client.query('BEGIN');
    const claimed = await claimNextPendingDistributions(client, tenantId, BATCH_LIMIT);
    for (const d of claimed) {
      try {
        if (!d.proposalId) {
          await client.query(
            `UPDATE treasury_distributions SET status = 'failed', processed_at = now() WHERE id = $1 AND tenant_id = $2`,
            [d.id, d.tenantId]
          );
          continue;
        }
        await createFinancialAction(d.tenantId, {
          proposalId: d.proposalId,
          actionType: 'treasury_distribution',
          referenceId: d.referenceId,
          payload: {
            treasury_account_id: d.treasuryAccountId,
            amount_cents: d.amountCents,
            reference_id: d.referenceId ?? undefined,
          },
        });
        await client.query(
          `UPDATE treasury_distributions SET status = 'processed', processed_at = now() WHERE id = $1 AND tenant_id = $2`,
          [d.id, d.tenantId]
        );
      } catch (err) {
        console.error('[TreasuryDistributionWorker] Distribution failed', d.id, err);
        await client.query(
          `UPDATE treasury_distributions SET status = 'failed', processed_at = now() WHERE id = $1 AND tenant_id = $2`,
          [d.id, d.tenantId]
        ).catch(() => {});
      }
    }
    await client.query('COMMIT');
  } catch (err) {
    console.error('[TreasuryDistributionWorker] Tenant batch error:', tenantId, err);
    await client?.query('ROLLBACK').catch(() => {});
  } finally {
    client?.release();
  }
}

async function runTreasuryDistributionCycle(): Promise<void> {
  try {
    const tenantIds = await listTenantIdsForWorkerLoop();
    for (const tenantId of tenantIds) {
      await runTenantDistributionBatch(tenantId);
    }
  } catch (err) {
    console.error('[TreasuryDistributionWorker] Cycle error:', err);
  }
}

let intervalId: ReturnType<typeof setInterval> | null = null;

export function startTreasuryDistributionWorker(): void {
  if (intervalId !== null) return;
  runTreasuryDistributionCycle().catch((err) =>
    console.error('[TreasuryDistributionWorker] Initial run error:', err)
  );
  intervalId = setInterval(runTreasuryDistributionCycle, INTERVAL_MS);
  console.log('[TreasuryDistributionWorker] Started (interval 60s, treasury distributions)');
}