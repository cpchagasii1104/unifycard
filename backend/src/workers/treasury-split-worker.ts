// Treasury Split Worker — processa bank_settlements (status = sent) sem split executado.
// Chama Treasury Split Engine; não escreve em bank_transactions nem bank_ledger diretamente.

import type { PoolClient } from 'pg';
import { pool } from '@core/database/pool';
import { claimNextSettlementsPendingSplit } from '@modules/treasury-split/treasury-split-config.repository';
import { executeSplit } from '@modules/treasury-split/treasury-split.service';

const INTERVAL_MS = 15_000;
const BATCH_LIMIT = 50;

let intervalId: ReturnType<typeof setInterval> | null = null;

async function runTreasurySplitCycle(): Promise<void> {
  let client: PoolClient | undefined;
  try {
    client = await pool.connect();
    await client.query('BEGIN');
    const claimed = await claimNextSettlementsPendingSplit(client, BATCH_LIMIT);
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
    console.error('[TreasurySplitWorker] Cycle error:', err);
    await client?.query('ROLLBACK').catch(() => {});
  } finally {
    client?.release();
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