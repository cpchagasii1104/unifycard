// Treasury Distribution Worker — cria governance_financial_actions a partir de treasury_distributions.
// Não escreve em bank_transactions nem bank_ledger. Ações são processadas pelo Governance Financial Action Worker.

import type { PoolClient } from 'pg';
import { pool } from '@core/database/pool';
import { claimNextPendingDistributions } from '@modules/treasury/treasury-distribution-repository';
import { createFinancialAction } from '@modules/governance/governance-financial-action-repository';

const INTERVAL_MS = 60_000;
const BATCH_LIMIT = 50;

async function runTreasuryDistributionCycle(): Promise<void> {
  let client: PoolClient | undefined;
  try {
    client = await pool.connect();
    await client.query('BEGIN');
    const claimed = await claimNextPendingDistributions(client, BATCH_LIMIT);
    for (const d of claimed) {
      try {
        if (!d.proposalId) {
          await client.query(
            `UPDATE treasury_distributions SET status = 'failed', processed_at = now() WHERE id = $1`,
            [d.id]
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
    console.error('[TreasuryDistributionWorker] Cycle error:', err);
    await client?.query('ROLLBACK').catch(() => {});
  } finally {
    client?.release();
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