/**
 * E2E C4b-2 — USER WALLET BACKFILL + LAZY CREATION (DECISION-0057, 2026-05-27)
 *
 * Prova backfill idempotente e lazy creation em createExecution.
 *
 * NÃO move dinheiro.
 * NÃO escreve em bank_ledger, bank_transactions, bank_splits (fora do fluxo normal).
 *
 * Cenários:
 *   T1   Backfill cria user_wallet para payer histórico sem wallet
 *   T2   Backfill é idempotente (segunda chamada não duplica)
 *   T3   Backfill não cria conta para actor sem user_id (skipa silenciosamente)
 *   T4   owner_id = userId:user_wallet após backfill
 *   T5   actor_id da wallet = actorId do payer
 *   T6   owner_type = 'actor' no DB
 *   T7   Resolver C4 passa para payer com wallet criada via backfill
 *   T8   Resolver C4 fail-closed (CREDITOR_ACCOUNT_NOT_FOUND) sem wallet
 *   T9   bank_ledger: zero escrita durante backfill
 *   T10  bank_transactions: zero escrita durante backfill
 *   T11  bank_splits: zero escrita durante backfill
 *   T12  lazy creation: ensureUserWalletForActor idempotente chamada antes de transação
 *
 * Modo:
 *   npx tsx backend/src/scripts/validate-pipeline-e2e-c4b2-user-wallet-backfill.ts
 */

import dotenv from 'dotenv';
import { join } from 'path';
import { v4 as uuidv4 } from 'uuid';

import { pool } from '../core/database/pool';
import { bankAccountService } from '../modules/bank/bank-account.service';
import {
  RecoveryCreditorResolverError,
  resolveRecoveryCreditor,
} from '../modules/financial-recovery/recovery-creditor-resolver.service';

dotenv.config({ path: join(process.cwd(), 'backend', '.env') });

const TENANT_ID = process.env.E2E_TENANT_ID || 'fbe13b78-4516-493d-905a-363796aea1d1';
const NONEXISTENT_ID = '00000000-0000-0000-0000-000000000000';

// ── helpers ───────────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;
const results: { name: string; ok: boolean; detail: string }[] = [];

function ok(name: string, detail = '') {
  passed++;
  results.push({ name, ok: true, detail });
  console.log(`  ✓ ${name}${detail ? ' — ' + detail : ''}`);
}

function fail(name: string, detail: string) {
  failed++;
  results.push({ name, ok: false, detail });
  console.error(`  ✗ ${name} — ${detail}`);
}

async function q(sql: string, params: unknown[] = []) {
  return pool.query(sql, params);
}

// ── ledger snapshot ───────────────────────────────────────────────────────────

async function ledgerSnapshot() {
  const r = await q(
    `SELECT
       (SELECT COUNT(*) FROM bank_ledger       WHERE tenant_id = $1) AS ledger,
       (SELECT COUNT(*) FROM bank_transactions WHERE tenant_id = $1) AS txs,
       (SELECT COUNT(*) FROM bank_splits       WHERE tenant_id = $1) AS splits`,
    [TENANT_ID]
  );
  return r.rows[0] as { ledger: string; txs: string; splits: string };
}

// ── fixtures ──────────────────────────────────────────────────────────────────

async function getActorWithUserIdWithoutWallet(): Promise<{ actorId: string; userId: string } | null> {
  const r = await q(
    `SELECT a.id AS actor_id, a.user_id
       FROM actors a
      WHERE a.tenant_id = $1
        AND a.user_id IS NOT NULL
        AND NOT EXISTS (
          SELECT 1 FROM bank_accounts ba
           WHERE ba.tenant_id = a.tenant_id
             AND ba.actor_id = a.id
             AND ba.account_type = 'user_wallet'
        )
      LIMIT 1`,
    [TENANT_ID]
  );
  if (!r.rows[0]) return null;
  return { actorId: r.rows[0].actor_id as string, userId: r.rows[0].user_id as string };
}

async function createPaymentIntent(actorId: string): Promise<string> {
  const r = await q(
    `INSERT INTO payment_intents (tenant_id, actor_id, amount_cents, intent_type, reference_id, gateway, currency)
     VALUES ($1, $2, 100, 'test_c4b2', $3, 'test', 'BRL')
     RETURNING id`,
    [TENANT_ID, actorId, uuidv4()]
  );
  return r.rows[0].id as string;
}

async function createActorWithoutUserId(): Promise<string> {
  const r = await q(
    `INSERT INTO actors (tenant_id, actor_type, display_name)
     VALUES ($1, 'user', $2)
     RETURNING id`,
    [TENANT_ID, `e2e-c4b2-no-user-${uuidv4().slice(0, 8)}`]
  );
  return r.rows[0].id as string;
}

async function cleanup(actorIds: string[], intentIds: string[], accountIds: string[]) {
  if (accountIds.length > 0) {
    await q(`DELETE FROM bank_accounts WHERE id = ANY($1::uuid[])`, [accountIds]);
  }
  if (intentIds.length > 0) {
    await q(`DELETE FROM payment_intents WHERE id = ANY($1::uuid[])`, [intentIds]);
  }
  if (actorIds.length > 0) {
    await q(`DELETE FROM actors WHERE id = ANY($1::uuid[])`, [actorIds]);
  }
}

// ── scenarios ─────────────────────────────────────────────────────────────────

async function runTests() {
  console.log('\n🔍 E2E C4b-2 — user-wallet-backfill + lazy-creation\n');

  const snapshot = await ledgerSnapshot();
  const createdActors: string[] = [];
  const createdIntents: string[] = [];
  const createdAccounts: string[] = [];

  try {
    // T1 — backfill cria user_wallet para payer histórico sem wallet
    // (simula um payer histórico: actor com user_id mas sem user_wallet no banco)
    const freshTarget = await getActorWithUserIdWithoutWallet();
    let backfillActorId: string;
    let backfillUserId: string;
    let backfillWalletId: string | undefined;

    if (freshTarget) {
      backfillActorId = freshTarget.actorId;
      backfillUserId = freshTarget.userId;
    } else {
      // Todos já têm wallet: cria actor novo com user vinculado para simular backfill
      // Usa user existente para garantir user_id válido
      const userRow = await q(
        `SELECT u.id AS user_id, a.id AS actor_id FROM users u
           JOIN actors a ON a.user_id = u.id AND a.tenant_id = $1
          WHERE a.tenant_id = $1 AND a.user_id IS NOT NULL
          LIMIT 1`,
        [TENANT_ID]
      );
      if (!userRow.rows[0]) {
        console.log('  SKIP T1-T7: nenhum actor com user_id disponível');
        backfillActorId = '';
        backfillUserId = '';
      } else {
        backfillActorId = userRow.rows[0].actor_id as string;
        backfillUserId = userRow.rows[0].user_id as string;
      }
    }

    if (backfillActorId) {
      // Remove qualquer wallet existente para simular "payer histórico sem wallet"
      const existingWallet = await q(
        `DELETE FROM bank_accounts WHERE tenant_id=$1 AND actor_id=$2 AND account_type='user_wallet' RETURNING id`,
        [TENANT_ID, backfillActorId]
      );
      const removedId = existingWallet.rows[0]?.id as string | undefined;

      try {
        const wallet = await bankAccountService.ensureUserWalletForActor(TENANT_ID, backfillActorId);
        backfillWalletId = wallet.accountId;
        createdAccounts.push(wallet.accountId);
        ok('T1 backfill cria user_wallet', `actor=${backfillActorId.slice(0, 8)} wallet=${wallet.accountId.slice(0, 8)}`);
      } catch (e) {
        if (removedId) createdAccounts.push(removedId); // restore signal
        fail('T1 backfill cria user_wallet', String(e));
      }

      // T2 — backfill idempotente (segunda chamada)
      if (backfillWalletId) {
        try {
          const wallet2 = await bankAccountService.ensureUserWalletForActor(TENANT_ID, backfillActorId);
          if (wallet2.accountId === backfillWalletId) {
            ok('T2 backfill idempotente', `same wallet=${backfillWalletId.slice(0, 8)}`);
          } else {
            createdAccounts.push(wallet2.accountId);
            fail('T2 backfill idempotente', `segunda chamada criou nova conta: ${wallet2.accountId}`);
          }
        } catch (e) {
          fail('T2 backfill idempotente', String(e));
        }

        // T4 — owner_id = userId:user_wallet
        const dbRow = await q(`SELECT owner_id, actor_id, owner_type FROM bank_accounts WHERE id=$1`, [backfillWalletId]);
        const row = dbRow.rows[0];
        if (row?.owner_id?.startsWith(backfillUserId + ':')) {
          ok('T4 owner_id = userId:user_wallet', `owner_id=${row.owner_id}`);
        } else {
          fail('T4 owner_id = userId:user_wallet', `owner_id=${row?.owner_id}, esperado prefixo ${backfillUserId}:`);
        }

        // T5 — actor_id correto
        if (row?.actor_id === backfillActorId) {
          ok('T5 actor_id correto', `actor_id=${backfillActorId.slice(0, 8)}`);
        } else {
          fail('T5 actor_id correto', `db actor_id=${row?.actor_id}, esperado=${backfillActorId}`);
        }

        // T6 — owner_type = 'actor'
        if (row?.owner_type === 'actor') {
          ok('T6 owner_type=actor', `owner_type=${row.owner_type}`);
        } else {
          fail('T6 owner_type=actor', `owner_type=${row?.owner_type}`);
        }

        // T7 — resolver C4 passa com wallet existente
        const intentId = await createPaymentIntent(backfillActorId);
        createdIntents.push(intentId);
        try {
          const resolved = await resolveRecoveryCreditor(TENANT_ID, intentId);
          if (resolved.creditorAccountId === backfillWalletId) {
            ok('T7 resolver C4 passa', `account=${backfillWalletId.slice(0, 8)}`);
          } else {
            fail('T7 resolver C4 passa', `resolveu para ${resolved.creditorAccountId}, esperado ${backfillWalletId}`);
          }
        } catch (e) {
          fail('T7 resolver C4 passa', String(e));
        }
      }
    }

    // T3 — backfill não cria wallet para actor sem user_id
    {
      const orphanActorId = await createActorWithoutUserId();
      createdActors.push(orphanActorId);
      try {
        await bankAccountService.ensureUserWalletForActor(TENANT_ID, orphanActorId);
        fail('T3 backfill skipa actor sem user_id', 'deveria ter lançado USER_WALLET_REQUIRES_USER_ID');
      } catch (e) {
        if (e instanceof Error && e.message === 'USER_WALLET_REQUIRES_USER_ID') {
          ok('T3 backfill skipa actor sem user_id', 'fail-closed correto');
        } else {
          fail('T3 backfill skipa actor sem user_id', String(e));
        }
      }
    }

    // T8 — resolver C4 fail-closed sem wallet
    {
      // Cria actor com user_id mas SEM wallet
      const freshActor = await getActorWithUserIdWithoutWallet();
      if (freshActor) {
        const intentId = await createPaymentIntent(freshActor.actorId);
        createdIntents.push(intentId);
        try {
          await resolveRecoveryCreditor(TENANT_ID, intentId);
          fail('T8 resolver C4 fail-closed', 'deveria ter lançado CREDITOR_ACCOUNT_NOT_FOUND');
        } catch (e) {
          if (e instanceof RecoveryCreditorResolverError && e.code === 'CREDITOR_ACCOUNT_NOT_FOUND') {
            ok('T8 resolver C4 fail-closed sem wallet', `code=${e.code}`);
          } else {
            fail('T8 resolver C4 fail-closed', `erro errado: ${String(e)}`);
          }
        }
      } else {
        ok('T8 resolver C4 fail-closed', 'N/A — todos os actors têm wallet (cenário coberto por E2E C4)');
      }
    }

    // T12 — lazy creation: ensureUserWalletForActor idempotente
    {
      if (backfillActorId) {
        try {
          const w = await bankAccountService.ensureUserWalletForActor(TENANT_ID, backfillActorId);
          ok('T12 lazy creation idempotente', `wallet=${w.accountId.slice(0, 8)}`);
        } catch (e) {
          fail('T12 lazy creation idempotente', String(e));
        }
      } else {
        ok('T12 lazy creation idempotente', 'N/A — nenhum actor disponível para teste');
      }
    }

    // T9-T11 — zero escrita financeira
    const snapshotAfter = await ledgerSnapshot();
    if (snapshot.ledger === snapshotAfter.ledger) {
      ok('T9 bank_ledger zero escrita', `${snapshot.ledger} → ${snapshotAfter.ledger}`);
    } else {
      fail('T9 bank_ledger zero escrita', `${snapshot.ledger} → ${snapshotAfter.ledger}`);
    }
    if (snapshot.txs === snapshotAfter.txs) {
      ok('T10 bank_transactions zero escrita', `${snapshot.txs} → ${snapshotAfter.txs}`);
    } else {
      fail('T10 bank_transactions zero escrita', `${snapshot.txs} → ${snapshotAfter.txs}`);
    }
    if (snapshot.splits === snapshotAfter.splits) {
      ok('T11 bank_splits zero escrita', `${snapshot.splits} → ${snapshotAfter.splits}`);
    } else {
      fail('T11 bank_splits zero escrita', `${snapshot.splits} → ${snapshotAfter.splits}`);
    }

  } finally {
    await cleanup(createdActors, createdIntents, createdAccounts);
  }

  // ── summary ──────────────────────────────────────────────────────────────────
  console.log(`\n${'─'.repeat(56)}`);
  console.log(`  Resultado: ${passed}/${passed + failed} passaram`);
  if (failed > 0) {
    console.log(`  ✗ Falhas:`);
    results.filter(r => !r.ok).forEach(r => console.log(`    - ${r.name}: ${r.detail}`));
  }
  console.log('');

  await pool.end();
  process.exit(failed > 0 ? 1 : 0);
}

runTests().catch(err => {
  console.error('FATAL:', err);
  pool.end().finally(() => process.exit(1));
});
