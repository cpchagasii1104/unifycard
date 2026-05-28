/**
 * E2E C4 — RECOVERY CREDITOR RESOLVER (DECISION-0056, 2026-05-27)
 *
 * Prova o resolveRecoveryCreditor com todos os caminhos fail-closed.
 *
 * NÃO move dinheiro.
 * NÃO escreve em bank_ledger, bank_transactions, bank_splits.
 * Testa somente leitura determinística de creditor_account_id.
 *
 * Cenários:
 *   T1  Resolve com payer que tem user_wallet no formato lifecycle
 *   T2  Falha PAYMENT_INTENT_NOT_FOUND quando intent não existe
 *   T3  Falha CREDITOR_ACCOUNT_NOT_FOUND quando payer não tem user_wallet
 *   T4  Falha CREDITOR_ACCOUNT_NOT_FOUND quando actor não tem user_id
 *   T5  Falha CREDITOR_ACCOUNT_NOT_FOUND quando payer só tem actor_wallet (vetada por DECISION-0056)
 *   T6  bank_ledger: zero escrita durante todos os cenários
 *   T7  bank_transactions: zero escrita durante todos os cenários
 *   T8  bank_splits: zero escrita durante todos os cenários
 *
 * Modo:
 *   npx tsx backend/src/scripts/validate-pipeline-e2e-recovery-creditor-resolver.ts
 */

import dotenv from 'dotenv';
import { join } from 'path';
import { v4 as uuidv4 } from 'uuid';

import { pool } from '../core/database/pool';
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

async function getActor(): Promise<{ id: string; userId: string }> {
  // Precisa de actor COM user_id mas sem user_wallet lifecycle existente.
  // T3 exige NOT_FOUND após T1 remover a wallet do mesmo actor.
  const r = await q(
    `SELECT a.id, a.user_id FROM actors a
      WHERE a.tenant_id = $1
        AND a.user_id IS NOT NULL
        AND NOT EXISTS (
          SELECT 1 FROM bank_accounts ba
           WHERE ba.tenant_id = a.tenant_id
             AND ba.owner_type = 'actor'
             AND ba.account_type = 'user_wallet'
             AND (ba.owner_id = a.user_id::text OR ba.owner_id = a.user_id::text || ':user_wallet')
        )
      LIMIT 1`,
    [TENANT_ID]
  );
  if (!r.rows[0]) throw new Error('Nenhum actor com user_id sem user_wallet lifecycle para tenant ' + TENANT_ID);
  return { id: r.rows[0].id as string, userId: r.rows[0].user_id as string };
}

async function getActorWithoutUserId(): Promise<string> {
  const r = await q(
    `SELECT a.id FROM actors a
      WHERE a.tenant_id = $1
        AND a.user_id IS NULL
      LIMIT 1`,
    [TENANT_ID]
  );
  if (!r.rows[0]) throw new Error('Nenhum actor sem user_id para tenant ' + TENANT_ID);
  return r.rows[0].id as string;
}

async function createPaymentIntent(actorId: string): Promise<string> {
  const r = await q(
    `INSERT INTO payment_intents (tenant_id, actor_id, amount_cents, intent_type, reference_id, gateway, currency)
     VALUES ($1, $2, 100, 'test_recovery_creditor', $3, 'test', 'BRL')
     RETURNING id`,
    [TENANT_ID, actorId, uuidv4()]
  );
  return r.rows[0].id as string;
}

async function createUserWallet(actorId: string, userId: string): Promise<string> {
  // owner_id no formato lifecycle que getLifecycleAccount espera: '{userId}:user_wallet'
  // owner_type = 'actor' (DB canonical — BankAccountOwnerType 'user' mapeia para 'actor' no DB)
  const r = await q(
    `INSERT INTO bank_accounts (tenant_id, owner_id, owner_type, account_type, actor_id)
     VALUES ($1, $2, 'actor', 'user_wallet', $3)
     RETURNING id`,
    [TENANT_ID, `${userId}:user_wallet`, actorId]
  );
  return r.rows[0].id as string;
}

async function createActorWallet(actorId: string): Promise<string> {
  const compositeOwnerId = `${actorId}:actor_wallet:test_${uuidv4()}`;
  const r = await q(
    `INSERT INTO bank_accounts (tenant_id, owner_id, owner_type, account_type, actor_id)
     VALUES ($1, $2, 'actor', 'actor_wallet', $3)
     RETURNING id`,
    [TENANT_ID, compositeOwnerId, actorId]
  );
  return r.rows[0].id as string;
}

// ── cleanup ───────────────────────────────────────────────────────────────────

async function cleanup(accountIds: string[], intentIds: string[]) {
  if (accountIds.length > 0) {
    await q(
      `DELETE FROM bank_accounts WHERE id = ANY($1::uuid[])`,
      [accountIds]
    );
  }
  if (intentIds.length > 0) {
    await q(
      `DELETE FROM payment_intents WHERE id = ANY($1::uuid[])`,
      [intentIds]
    );
  }
}

// ── scenarios ─────────────────────────────────────────────────────────────────

async function runTests() {
  console.log('\n🔍 E2E C4 — recovery-creditor-resolver\n');

  const snapshot = await ledgerSnapshot();
  const createdAccounts: string[] = [];
  const createdIntents: string[] = [];

  try {
    const { id: actorId, userId } = await getActor();

    // T1 — happy path: payer com user_wallet no formato lifecycle
    {
      const walletId = await createUserWallet(actorId, userId);
      createdAccounts.push(walletId);
      const intentId = await createPaymentIntent(actorId);
      createdIntents.push(intentId);

      try {
        const result = await resolveRecoveryCreditor(TENANT_ID, intentId);
        if (
          result.creditorActorId === actorId &&
          result.creditorAccountId === walletId &&
          result.paymentIntentId === intentId
        ) {
          ok('T1 resolve com user_wallet lifecycle', `account=${walletId.slice(0, 8)}…`);
        } else {
          fail('T1 resolve com user_wallet única', `resultado inesperado: ${JSON.stringify(result)}`);
        }
      } catch (e) {
        fail('T1 resolve com user_wallet lifecycle', String(e));
      }

      // Remove a wallet para não interferir em T3
      await q(`DELETE FROM bank_accounts WHERE id = $1`, [walletId]);
      createdAccounts.splice(createdAccounts.indexOf(walletId), 1);
    }

    // T2 — PAYMENT_INTENT_NOT_FOUND
    {
      try {
        await resolveRecoveryCreditor(TENANT_ID, NONEXISTENT_ID);
        fail('T2 PAYMENT_INTENT_NOT_FOUND', 'deveria ter lançado erro');
      } catch (e) {
        if (e instanceof RecoveryCreditorResolverError && e.code === 'PAYMENT_INTENT_NOT_FOUND') {
          ok('T2 PAYMENT_INTENT_NOT_FOUND', `code=${e.code}`);
        } else {
          fail('T2 PAYMENT_INTENT_NOT_FOUND', `erro errado: ${String(e)}`);
        }
      }
    }

    // T3 — CREDITOR_ACCOUNT_NOT_FOUND (payer sem user_wallet)
    {
      const intentId = await createPaymentIntent(actorId);
      createdIntents.push(intentId);

      try {
        await resolveRecoveryCreditor(TENANT_ID, intentId);
        fail('T3 CREDITOR_ACCOUNT_NOT_FOUND', 'deveria ter lançado erro');
      } catch (e) {
        if (e instanceof RecoveryCreditorResolverError && e.code === 'CREDITOR_ACCOUNT_NOT_FOUND') {
          ok('T3 CREDITOR_ACCOUNT_NOT_FOUND', `code=${e.code}`);
        } else {
          fail('T3 CREDITOR_ACCOUNT_NOT_FOUND', `erro errado: ${String(e)}`);
        }
      }
    }

    // T4 — CREDITOR_ACCOUNT_NOT_FOUND quando actor não tem user_id
    {
      const noUserIdActorId = await getActorWithoutUserId();
      const intentId = await createPaymentIntent(noUserIdActorId);
      createdIntents.push(intentId);

      try {
        await resolveRecoveryCreditor(TENANT_ID, intentId);
        fail('T4 CREDITOR_ACCOUNT_NOT_FOUND (sem user_id)', 'deveria ter lançado erro');
      } catch (e) {
        if (e instanceof RecoveryCreditorResolverError && e.code === 'CREDITOR_ACCOUNT_NOT_FOUND') {
          ok('T4 CREDITOR_ACCOUNT_NOT_FOUND (sem user_id)', `code=${e.code}`);
        } else {
          fail('T4 CREDITOR_ACCOUNT_NOT_FOUND (sem user_id)', `erro errado: ${String(e)}`);
        }
      }
    }

    // T5 — actor_wallet não é aceita (CREDITOR_ACCOUNT_NOT_FOUND, não fallback)
    {
      const actorWalletId = await createActorWallet(actorId);
      createdAccounts.push(actorWalletId);
      const intentId = await createPaymentIntent(actorId);
      createdIntents.push(intentId);

      try {
        await resolveRecoveryCreditor(TENANT_ID, intentId);
        fail('T5 actor_wallet não aceita como destino', 'deveria ter lançado CREDITOR_ACCOUNT_NOT_FOUND');
      } catch (e) {
        if (e instanceof RecoveryCreditorResolverError && e.code === 'CREDITOR_ACCOUNT_NOT_FOUND') {
          ok('T5 actor_wallet não aceita como destino', `code=${e.code} — sem fallback para actor_wallet`);
        } else {
          fail('T5 actor_wallet não aceita como destino', `erro errado: ${String(e)}`);
        }
      }

      await q(`DELETE FROM bank_accounts WHERE id = $1`, [actorWalletId]);
      createdAccounts.splice(0);
    }

    // T6-T8 — READ-ONLY: zero escrita financeira
    const snapshotAfter = await ledgerSnapshot();
    if (snapshot.ledger === snapshotAfter.ledger) {
      ok('T6 bank_ledger zero escrita', `${snapshot.ledger} → ${snapshotAfter.ledger}`);
    } else {
      fail('T6 bank_ledger zero escrita', `${snapshot.ledger} → ${snapshotAfter.ledger}`);
    }
    if (snapshot.txs === snapshotAfter.txs) {
      ok('T7 bank_transactions zero escrita', `${snapshot.txs} → ${snapshotAfter.txs}`);
    } else {
      fail('T7 bank_transactions zero escrita', `${snapshot.txs} → ${snapshotAfter.txs}`);
    }
    if (snapshot.splits === snapshotAfter.splits) {
      ok('T8 bank_splits zero escrita', `${snapshot.splits} → ${snapshotAfter.splits}`);
    } else {
      fail('T8 bank_splits zero escrita', `${snapshot.splits} → ${snapshotAfter.splits}`);
    }

  } finally {
    await cleanup(createdAccounts, createdIntents);
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
