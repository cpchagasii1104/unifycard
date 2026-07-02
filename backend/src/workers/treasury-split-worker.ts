// Treasury Split Worker — processa bank_settlements (status = sent) sem split executado.
// Chama Treasury Split Engine; não escreve em bank_transactions nem bank_ledger diretamente.
// F-GROUP-B-FINANCIAL-WORKERS-TENANT-LOOP-RLS (DECISION-0149 tenant-loop): descobre tenants por
// fonte NÃO-RLS (`tenants`) e claima POR TENANT com client de tenant-context — necessário porque
// lê bank_settlements, sob RLS+FORCE desde 20260702160000 (antes desta conversão o claim cru
// ficaria CEGO sob o role restrito).

import type { PoolClient } from 'pg';
import { getClientWithTenant } from '@core/database/pool';
import { claimNextSettlementsPendingSplit } from '@modules/treasury-split/treasury-split-config.repository';
import { executeSplit } from '@modules/treasury-split/treasury-split.service';
import { listTenantIdsForWorkerLoop } from '@core/database/tenant-loop';

const INTERVAL_MS = 15_000;
const BATCH_LIMIT = 50;

let intervalId: ReturnType<typeof setInterval> | null = null;

async function runTenantSplitBatch(tenantId: string): Promise<void> {
  let client: PoolClient | undefined;
  try {
    client = await getClientWithTenant(tenantId);
    await client.query('BEGIN');
    const claimed = await claimNextSettlementsPendingSplit(client, tenantId, BATCH_LIMIT);
    for (const s of claimed) {
      try {
        await executeSplit({
          settlementId: s.settlementId,
          tenantId: s.tenantId,
          amountCents: s.amountCents,
          currency: s.currency,
        });
      } catch (err) {
        console.error('[TreasurySplitWorker] Split failed', s.settlementId, err);
      }
    }
    await client.query('COMMIT');
  } catch (err) {
    console.error('[TreasurySplitWorker] Tenant batch error:', tenantId, err);
    await client?.query('ROLLBACK').catch(() => {});
  } finally {
    client?.release();
  }
}

async function runTreasurySplitCycle(): Promise<void> {
  try {
    const tenantIds = await listTenantIdsForWorkerLoop();
    for (const tenantId of tenantIds) {
      await runTenantSplitBatch(tenantId);
    }
  } catch (err) {
    console.error('[TreasurySplitWorker] Cycle error:', err);
  }
}

export function startTreasurySplitWorker(): void {
  if (intervalId !== null) return;
  runTreasurySplitCycle().catch((err) =>
    console.error('[TreasurySplitWorker] Initial run error:', err)
  );
  intervalId = setInterval(runTreasurySplitCycle, INTERVAL_MS);
  console.log('[BOOT] Treasury Split Engine iniciado (interval 15s, settlements sent → split)');
}