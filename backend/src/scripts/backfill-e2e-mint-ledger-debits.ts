/**
 * Orquestra backfill de partidas dobradas em mints E2E via domínio Bank.
 *
 * Uso: pnpm exec tsx src/scripts/backfill-e2e-mint-ledger-debits.ts
 */
import dotenv from 'dotenv';
import { join } from 'path';
import { pool } from '../core/database/pool';
import { runBackfillE2eMintLedgerDebits } from '../modules/bank/bank-maintenance.service';

dotenv.config({ path: join(process.cwd(), '.env') });

async function main(): Promise<void> {
  await runBackfillE2eMintLedgerDebits();
  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});