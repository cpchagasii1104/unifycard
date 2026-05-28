/**
 * Backfill C4b-2 — user_wallet para payers históricos (DECISION-0057, 2026-05-27)
 *
 * Garante user_wallet canônica para todos os actors humanos com user_id
 * que aparecem como payer em payment_intents, independente do status.
 *
 * Idempotente: reexecução segura, skips contas já existentes.
 * Não cria saldo. Não toca bank_ledger, bank_transactions, bank_splits.
 *
 * Uso:
 *   DRY_RUN=true  npx tsx backend/src/scripts/backfill-user-wallets-for-payers.ts   (default)
 *   DRY_RUN=false npx tsx backend/src/scripts/backfill-user-wallets-for-payers.ts
 */

import dotenv from 'dotenv';
import { join } from 'path';

import { pool } from '../core/database/pool';
import { bankAccountService } from '../modules/bank/bank-account.service';

dotenv.config({ path: join(process.cwd(), 'backend', '.env') });

const DRY_RUN = process.env.DRY_RUN !== 'false';
const TENANT_ID = process.env.E2E_TENANT_ID || 'fbe13b78-4516-493d-905a-363796aea1d1';

async function run() {
  console.log(`\nBackfill C4b-2 — user_wallet para payers`);
  console.log(`DRY_RUN=${DRY_RUN}  TENANT=${TENANT_ID}\n`);

  // Fase 1: levanta todos os payers distintos com user_id
  const { rows: withUser } = await pool.query<{ tenant_id: string; actor_id: string; user_id: string }>(
    `SELECT DISTINCT pi.tenant_id, pi.actor_id, a.user_id
       FROM payment_intents pi
       JOIN actors a ON a.id = pi.actor_id AND a.tenant_id = pi.tenant_id
      WHERE pi.actor_id IS NOT NULL
        AND a.user_id IS NOT NULL
        AND pi.tenant_id = $1`,
    [TENANT_ID]
  );

  // Fase 2: actors sem user_id (skip + relato)
  const { rows: withoutUser } = await pool.query<{ actor_id: string }>(
    `SELECT DISTINCT pi.actor_id
       FROM payment_intents pi
       LEFT JOIN actors a ON a.id = pi.actor_id AND a.tenant_id = pi.tenant_id
      WHERE pi.actor_id IS NOT NULL
        AND (a.user_id IS NULL OR a.id IS NULL)
        AND pi.tenant_id = $1`,
    [TENANT_ID]
  );

  console.log(`Payers com user_id:    ${withUser.length}`);
  console.log(`Payers sem user_id:    ${withoutUser.length} (skipped — USER_WALLET_REQUIRES_USER_ID)`);
  if (withoutUser.length > 0) {
    withoutUser.forEach(r => console.log(`  SKIP  actor=${r.actor_id}`));
  }
  console.log('');

  let created = 0;
  let alreadyExisted = 0;
  let errors = 0;

  for (const row of withUser) {
    const snap = await pool.query<{ id: string }>(
      `SELECT id FROM bank_accounts WHERE tenant_id=$1 AND actor_id=$2 AND account_type='user_wallet'`,
      [row.tenant_id, row.actor_id]
    );
    const existedBefore = snap.rows.length > 0;

    if (DRY_RUN) {
      console.log(`  DRY  actor=${row.actor_id.slice(0, 8)} user=${row.user_id.slice(0, 8)} exists=${existedBefore}`);
      if (!existedBefore) created++;
      else alreadyExisted++;
      continue;
    }

    try {
      const wallet = await bankAccountService.ensureUserWalletForActor(row.tenant_id, row.actor_id);
      if (existedBefore) {
        console.log(`  OK   actor=${row.actor_id.slice(0, 8)} wallet=${wallet.accountId.slice(0, 8)} (already existed)`);
        alreadyExisted++;
      } else {
        console.log(`  NEW  actor=${row.actor_id.slice(0, 8)} wallet=${wallet.accountId.slice(0, 8)} owner_id=${(wallet as any).ownerId ?? '?'}`);
        created++;
      }
    } catch (e) {
      console.error(`  ERR  actor=${row.actor_id.slice(0, 8)} — ${String(e)}`);
      errors++;
    }
  }

  console.log(`\n${'─'.repeat(56)}`);
  if (DRY_RUN) {
    console.log(`  DRY_RUN — nenhuma escrita realizada`);
    console.log(`  Seria criado:        ${created}`);
    console.log(`  Já existia:          ${alreadyExisted}`);
  } else {
    console.log(`  Criado:              ${created}`);
    console.log(`  Já existia:          ${alreadyExisted}`);
    console.log(`  Erros:               ${errors}`);
  }
  console.log(`  Skipped (sem user_id): ${withoutUser.length}`);
  console.log('');

  await pool.end();
  process.exit(errors > 0 ? 1 : 0);
}

run().catch(err => {
  console.error('FATAL:', err);
  pool.end().finally(() => process.exit(1));
});
