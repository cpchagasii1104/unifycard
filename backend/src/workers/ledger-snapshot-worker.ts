// Ledger Snapshot Worker — gera snapshots periódicos do saldo por conta (bank_ledger).
// Não altera bank_transactions nem bank_ledger. Somente leitura do bank_ledger + escrita em ledger_snapshots.

import { pool } from '@core/database/pool';
import {
  getLatestSnapshot,
  recordSnapshot,
} from '@modules/ledger-snapshots/ledger-snapshot-repository';

const INTERVAL_MS = 10 * 60 * 1000; // 10 minutos
const MIN_SNAPSHOT_INTERVAL_MS = 10 * 60 * 1000; // só criar se último snapshot > 10 min

async function runLedgerSnapshotCycle(): Promise<void> {
  try {
    const latest = await getLatestSnapshot();
    if (latest) {
      const latestAt = new Date(latest.snapshotAt).getTime();
      if (Date.now() - latestAt < MIN_SNAPSHOT_INTERVAL_MS) {
        return; // otimização: último snapshot há menos de 10 min
      }
    }

    const snapshotAt = new Date();
    const result = await pool.query<{
      tenant_id: string;
      account_id: string;
      balance: string;
    }>(
      `SELECT tenant_id, account_id,
              COALESCE(SUM(CASE WHEN direction = 'credit' THEN amount_cents ELSE -amount_cents END), 0)::bigint as balance
       FROM bank_ledger
       GROUP BY tenant_id, account_id`
    );

    for (const row of result.rows) {
      const balanceCents = parseInt(String(row.balance), 10);
      await recordSnapshot(row.tenant_id, row.account_id, balanceCents, snapshotAt);
    }
  } catch (err) {
    console.error('[LedgerSnapshotWorker] Cycle error:', err);
  }
}

let intervalId: ReturnType<typeof setInterval> | null = null;

export function startLedgerSnapshotWorker(): void {
  if (intervalId !== null) return;
  runLedgerSnapshotCycle().catch((err) =>
    console.error('[LedgerSnapshotWorker] Initial run error:', err)
  );
  intervalId = setInterval(runLedgerSnapshotCycle, INTERVAL_MS);
  console.log('[LedgerSnapshotWorker] Started (interval 10min, ledger snapshots)');
}