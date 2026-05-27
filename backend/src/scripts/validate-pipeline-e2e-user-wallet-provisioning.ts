/**
 * E2E C4b — USER WALLET PROVISIONING (DECISION-0057, 2026-05-27)
 *
 * Prova ensureUserWalletForActor e corrige bug DT-USER-WALLET-PAYMENT-EVENT-RESOLVER-BUG.
 *
 * NÃO move dinheiro.
 * NÃO escreve em bank_ledger, bank_transactions, bank_splits.
 *
 * Cenários:
 *   T1  Actor com user_id: provisiona user_wallet (idempotente)
 *   T2  Chamada repetida: retorna mesma conta (idempotência)
 *   T3  Actor sem user_id: lança USER_WALLET_REQUIRES_USER_ID
 *   T4  Actor inexistente: lança USER_WALLET_REQUIRES_USER_ID
 *   T5  owner_id gerado usa userId, não actorId (${userId}:user_wallet)
 *   T6  bank_accounts.actor_id da wallet = actorId correto
 *   T7  owner_type = 'actor' no DB (toDbOwnerType mapping)
 *   T8  bank_ledger: zero escrita
 *   T9  bank_transactions: zero escrita
 *
 * Modo:
 *   npx tsx backend/src/scripts/validate-pipeline-e2e-user-wallet-provisioning.ts
 */

import dotenv from 'dotenv';
import { join } from 'path';
import { v4 as uuidv4 } from 'uuid';

import { pool } from '../core/database/pool';
import { bankAccountService } from '../modules/bank/bank-account.service';

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
       (SELECT COUNT(*) FROM bank_transactions WHERE tenant_id = $1) AS txs`,
    [TENANT_ID]
  );
  return r.rows[0] as { ledger: string; txs: string };
}

// ── fixtures ──────────────────────────────────────────────────────────────────

async function getActorWithUserId(): Promise<{ actorId: string; userId: string } | null> {
  const r = await q(
    `SELECT a.id AS actor_id, a.user_id
       FROM actors a
      WHERE a.tenant_id = $1
        AND a.user_id IS NOT NULL
      LIMIT 1`,
    [TENANT_ID]
  );
  if (!r.rows[0]) return null;
  return { actorId: r.rows[0].actor_id as string, userId: r.rows[0].user_id as string };
}

async function createActorWithoutUserId(): Promise<string> {
  const r = await q(
    `INSERT INTO actors (tenant_id, actor_type, display_name)
     VALUES ($1, 'user', $2)
     RETURNING id`,
    [TENANT_ID, `e2e-no-user-${uuidv4().slice(0, 8)}`]
  );
  return r.rows[0].id as string;
}

async function cleanup(actorIds: string[], accountIds: string[]) {
  if (accountIds.length > 0) {
    await q(`DELETE FROM bank_accounts WHERE id = ANY($1::uuid[])`, [accountIds]);
  }
  if (actorIds.length > 0) {
    await q(`DELETE FROM actors WHERE id = ANY($1::uuid[])`, [actorIds]);
  }
}

// ── scenarios ─────────────────────────────────────────────────────────────────

async function runTests() {
  console.log('\n🔍 E2E C4b — user-wallet-provisioning\n');

  const fixture = await getActorWithUserId();
  if (!fixture) {
    console.error('SKIP: nenhum actor com user_id para tenant ' + TENANT_ID);
    await pool.end();
    process.exit(0);
  }

  const { actorId, userId } = fixture;
  const snapshot = await ledgerSnapshot();
  const createdActors: string[] = [];
  const createdAccounts: string[] = [];

  try {
    // T1 — provisiona user_wallet para actor com user_id
    {
      let walletId: string | undefined;
      try {
        const wallet = await bankAccountService.ensureUserWalletForActor(TENANT_ID, actorId);
        walletId = wallet.accountId;
        ok('T1 provisiona user_wallet', `account=${walletId.slice(0, 8)}…`);
      } catch (e) {
        fail('T1 provisiona user_wallet', String(e));
      }

      // T2 — idempotência: segunda chamada retorna mesma conta
      if (walletId) {
        try {
          const wallet2 = await bankAccountService.ensureUserWalletForActor(TENANT_ID, actorId);
          if (wallet2.accountId === walletId) {
            ok('T2 idempotência', `same account=${walletId.slice(0, 8)}…`);
          } else {
            createdAccounts.push(wallet2.accountId);
            fail('T2 idempotência', `segunda chamada criou nova conta: ${wallet2.accountId}`);
          }
        } catch (e) {
          fail('T2 idempotência', String(e));
        }

        // T5 — owner_id usa userId, NÃO actorId
        {
          const r = await q(
            `SELECT owner_id FROM bank_accounts WHERE id = $1`,
            [walletId]
          );
          const ownerIdInDb = r.rows[0]?.owner_id as string | undefined;
          const expectedOwnerIdPrefix = `${userId}:`;
          if (ownerIdInDb?.startsWith(expectedOwnerIdPrefix)) {
            ok('T5 owner_id usa userId', `owner_id=${ownerIdInDb}`);
          } else {
            fail('T5 owner_id usa userId', `owner_id=${ownerIdInDb}, esperava prefixo ${expectedOwnerIdPrefix}`);
          }
        }

        // T6 — bank_accounts.actor_id = actorId
        {
          const r = await q(
            `SELECT actor_id FROM bank_accounts WHERE id = $1`,
            [walletId]
          );
          const dbActorId = r.rows[0]?.actor_id as string | undefined;
          if (dbActorId === actorId) {
            ok('T6 actor_id correto', `actor_id=${actorId.slice(0, 8)}…`);
          } else {
            fail('T6 actor_id correto', `db actor_id=${dbActorId}, esperado=${actorId}`);
          }
        }

        // T7 — owner_type = 'actor' no DB
        {
          const r = await q(
            `SELECT owner_type FROM bank_accounts WHERE id = $1`,
            [walletId]
          );
          const dbOwnerType = r.rows[0]?.owner_type as string | undefined;
          if (dbOwnerType === 'actor') {
            ok('T7 owner_type=actor', `owner_type=${dbOwnerType}`);
          } else {
            fail('T7 owner_type=actor', `owner_type=${dbOwnerType}`);
          }
        }
      }
    }

    // T3 — actor sem user_id: USER_WALLET_REQUIRES_USER_ID
    {
      const orphanActorId = await createActorWithoutUserId();
      createdActors.push(orphanActorId);
      try {
        await bankAccountService.ensureUserWalletForActor(TENANT_ID, orphanActorId);
        fail('T3 USER_WALLET_REQUIRES_USER_ID', 'deveria ter lançado erro');
      } catch (e) {
        if (e instanceof Error && e.message === 'USER_WALLET_REQUIRES_USER_ID') {
          ok('T3 USER_WALLET_REQUIRES_USER_ID', 'actor sem user_id rejeitado');
        } else {
          fail('T3 USER_WALLET_REQUIRES_USER_ID', `erro errado: ${String(e)}`);
        }
      }
    }

    // T4 — actor inexistente: USER_WALLET_REQUIRES_USER_ID (row não encontrada)
    {
      try {
        await bankAccountService.ensureUserWalletForActor(TENANT_ID, NONEXISTENT_ID);
        fail('T4 actor inexistente', 'deveria ter lançado erro');
      } catch (e) {
        if (e instanceof Error && e.message === 'USER_WALLET_REQUIRES_USER_ID') {
          ok('T4 actor inexistente → USER_WALLET_REQUIRES_USER_ID', 'fail-closed correto');
        } else {
          fail('T4 actor inexistente', `erro errado: ${String(e)}`);
        }
      }
    }

    // T8-T9 — READ financeiro: zero escrita
    const snapshotAfter = await ledgerSnapshot();
    if (snapshot.ledger === snapshotAfter.ledger) {
      ok('T8 bank_ledger zero escrita', `${snapshot.ledger} → ${snapshotAfter.ledger}`);
    } else {
      fail('T8 bank_ledger zero escrita', `${snapshot.ledger} → ${snapshotAfter.ledger}`);
    }
    if (snapshot.txs === snapshotAfter.txs) {
      ok('T9 bank_transactions zero escrita', `${snapshot.txs} → ${snapshotAfter.txs}`);
    } else {
      fail('T9 bank_transactions zero escrita', `${snapshot.txs} → ${snapshotAfter.txs}`);
    }

  } finally {
    await cleanup(createdActors, createdAccounts);
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
