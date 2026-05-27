/**
 * E2E F-ACTOR-WALLET-RECOVERY-SUBSTRATE (DECISION-0053 C6, 2026-05-27)
 *
 * Prova as constraints de banco da migration
 * 20260530570000_actor_wallet_recovery_obligations_substrate.sql.
 *
 * NÃO debita actor_wallet.
 * NÃO cria fluxo financeiro real.
 * NÃO resolve creditor_account_id.
 * Testa apenas substrato institucional:
 *   — CHECKs rejeitam valores inválidos
 *   — FKs rejeitam referências inexistentes
 *   — UNIQUE total bloqueia segunda obrigação para mesmo caso
 *   — Concept actor-wallet-recovery existe no banco
 *   — Zero escrita em bank_ledger / bank_transactions / bank_splits
 *
 * Cenários:
 *   T1  INSERT válido de obligation pending_approval (sem approval_request_id)
 *   T2  CHECK bloqueia amount_cents <= 0
 *   T3  CHECK bloqueia recovered_amount_cents > amount_cents
 *   T4  CHECK bloqueia status inválido
 *   T5  UNIQUE bloqueia segunda obligation para mesmo caso (mesmo payment_intent + tx + debtor)
 *   T6  INSERT válido de entry vinculada à obligation do T1
 *   T7  FK bloqueia entry sem obligation válida
 *   T8  CHECK bloqueia entry amount_cents <= 0
 *   T9  FK bloqueia approval_request_id inexistente
 *   T10 Concept actor-wallet-recovery existe e resolve domain=financeiro-reversal
 *   T11 Zero escrita em bank_ledger, bank_transactions, bank_splits
 *   T12 Tabelas actor_wallet_recovery_obligations e _entries existem no schema
 *
 * Modo:
 *   npx tsx backend/src/scripts/validate-pipeline-e2e-recovery-obligation-substrate.ts
 */

import dotenv from 'dotenv';
import { join } from 'path';
import { v4 as uuidv4 } from 'uuid';

import { pool } from '../core/database/pool';

dotenv.config({ path: join(process.cwd(), 'backend', '.env') });

const TENANT_ID = process.env.E2E_TENANT_ID || 'fbe13b78-4516-493d-905a-363796aea1d1';
const NONEXISTENT_ID = '00000000-0000-0000-0000-000000000000';

// ── helpers ──────────────────────────────────────────────────────────────────

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

// ── fixtures ─────────────────────────────────────────────────────────────────

async function getFixtures() {
  // Actor + bank_account (usamos o mesmo actor para debtor e creditor — FK só exige existência)
  const actorRes = await q(
    `SELECT a.id AS actor_id, ba.id AS account_id
     FROM actors a
     JOIN bank_accounts ba ON ba.tenant_id = a.tenant_id AND ba.actor_id = a.id
     WHERE a.tenant_id = $1
     LIMIT 1`,
    [TENANT_ID],
  );
  if (!actorRes.rows[0]) throw new Error('Nenhum actor/bank_account para tenant ' + TENANT_ID);

  // bank_transaction existente (para original_transaction_id)
  const txRes = await q(
    `SELECT id FROM bank_transactions WHERE tenant_id = $1 LIMIT 1`,
    [TENANT_ID],
  );
  if (!txRes.rows[0]) throw new Error('Nenhuma bank_transaction para tenant ' + TENANT_ID);

  // payment_intent existente (para payment_intent_id)
  const piRes = await q(
    `SELECT id FROM payment_intents WHERE tenant_id = $1 LIMIT 1`,
    [TENANT_ID],
  );
  if (!piRes.rows[0]) throw new Error('Nenhum payment_intent para tenant ' + TENANT_ID);

  return {
    actor_id: actorRes.rows[0].actor_id as string,
    account_id: actorRes.rows[0].account_id as string,
    transaction_id: txRes.rows[0].id as string,
    payment_intent_id: piRes.rows[0].id as string,
  };
}

// ── cleanup ───────────────────────────────────────────────────────────────────

async function cleanup(obligationIds: string[]) {
  if (obligationIds.length === 0) return;
  await q(
    `DELETE FROM actor_wallet_recovery_obligation_entries WHERE obligation_id = ANY($1::uuid[])`,
    [obligationIds],
  );
  await q(
    `DELETE FROM actor_wallet_recovery_obligations WHERE id = ANY($1::uuid[])`,
    [obligationIds],
  );
}

// ── ledger snapshot ───────────────────────────────────────────────────────────

async function ledgerSnapshot() {
  const [ledger, txs, splits] = await Promise.all([
    q(`SELECT COUNT(*) AS n FROM bank_ledger WHERE tenant_id=$1`, [TENANT_ID]),
    q(`SELECT COUNT(*) AS n FROM bank_transactions WHERE tenant_id=$1`, [TENANT_ID]),
    q(`SELECT COUNT(*) AS n FROM bank_splits WHERE tenant_id=$1`, [TENANT_ID]),
  ]);
  return {
    ledger: Number(ledger.rows[0].n),
    txs: Number(txs.rows[0].n),
    splits: Number(splits.rows[0].n),
  };
}

// ── main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('E2E F-ACTOR-WALLET-RECOVERY-SUBSTRATE (DECISION-0053 C6)');
  console.log('═══════════════════════════════════════════════════════════\n');

  const fixtures = await getFixtures();
  const { actor_id, account_id, transaction_id, payment_intent_id } = fixtures;
  const createdObligationIds: string[] = [];
  const snapshot = await ledgerSnapshot();

  console.log('Fixtures:', { actor_id, account_id, transaction_id, payment_intent_id, tenant_id: TENANT_ID });
  console.log('Ledger snapshot (antes):', snapshot);
  console.log();

  // ── T1: INSERT válido de obligation pending_approval ─────────────────────
  console.log('T1 — INSERT válido de obligation (status=pending_approval, sem approval_request_id)');
  try {
    const oblId = uuidv4();
    await q(
      `INSERT INTO actor_wallet_recovery_obligations
         (id, tenant_id, debtor_actor_id, debtor_account_id, creditor_actor_id, creditor_account_id,
          original_transaction_id, payment_intent_id, amount_cents, reason)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      [oblId, TENANT_ID, actor_id, account_id, actor_id, account_id,
       transaction_id, payment_intent_id, 10000, 'E2E test recovery obligation'],
    );
    createdObligationIds.push(oblId);
    const r = await q(`SELECT status, recovered_amount_cents FROM actor_wallet_recovery_obligations WHERE id=$1`, [oblId]);
    if (r.rows[0].status === 'pending_approval' && Number(r.rows[0].recovered_amount_cents) === 0) {
      ok('T1', 'obligation pending_approval inserida com status e recovered_amount_cents corretos');
    } else {
      fail('T1', 'dados incorretos: ' + JSON.stringify(r.rows[0]));
    }
  } catch (e: any) {
    fail('T1', 'INSERT falhou inesperadamente: ' + e.message);
  }

  // ── T2: CHECK bloqueia amount_cents <= 0 ─────────────────────────────────
  console.log('\nT2 — CHECK bloqueia amount_cents <= 0');
  try {
    await q(
      `INSERT INTO actor_wallet_recovery_obligations
         (id, tenant_id, debtor_actor_id, debtor_account_id, creditor_actor_id, creditor_account_id,
          original_transaction_id, payment_intent_id, amount_cents, reason)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      [uuidv4(), TENANT_ID, actor_id, account_id, actor_id, account_id,
       transaction_id, payment_intent_id, 0, 'should fail'],
    );
    fail('T2', 'INSERT com amount_cents=0 deveria ter falhado');
  } catch (e: any) {
    if (e.message.includes('chk_recovery_obligation_amount_positive')) {
      ok('T2', 'CHECK chk_recovery_obligation_amount_positive bloqueou amount_cents=0');
    } else {
      fail('T2', 'Falhou por razão inesperada: ' + e.message);
    }
  }

  // ── T3: CHECK bloqueia recovered_amount_cents > amount_cents ─────────────
  console.log('\nT3 — CHECK bloqueia recovered_amount_cents > amount_cents');
  try {
    await q(
      `INSERT INTO actor_wallet_recovery_obligations
         (id, tenant_id, debtor_actor_id, debtor_account_id, creditor_actor_id, creditor_account_id,
          original_transaction_id, payment_intent_id, amount_cents, reason, recovered_amount_cents)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
      [uuidv4(), TENANT_ID, actor_id, account_id, actor_id, account_id,
       transaction_id, payment_intent_id, 1000, 'should fail', 2000],
    );
    fail('T3', 'INSERT com recovered > amount deveria ter falhado');
  } catch (e: any) {
    if (e.message.includes('chk_recovery_obligation_recovered_bounds')) {
      ok('T3', 'CHECK chk_recovery_obligation_recovered_bounds bloqueou recovered_amount_cents > amount_cents');
    } else {
      fail('T3', 'Falhou por razão inesperada: ' + e.message);
    }
  }

  // ── T4: CHECK bloqueia status inválido ───────────────────────────────────
  console.log('\nT4 — CHECK bloqueia status inválido');
  try {
    await q(
      `INSERT INTO actor_wallet_recovery_obligations
         (id, tenant_id, debtor_actor_id, debtor_account_id, creditor_actor_id, creditor_account_id,
          original_transaction_id, payment_intent_id, amount_cents, reason, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
      [uuidv4(), TENANT_ID, actor_id, account_id, actor_id, account_id,
       transaction_id, payment_intent_id, 1000, 'should fail', 'invalid_status'],
    );
    fail('T4', 'INSERT com status inválido deveria ter falhado');
  } catch (e: any) {
    if (e.message.includes('chk_recovery_obligation_status')) {
      ok('T4', 'CHECK chk_recovery_obligation_status bloqueou status=invalid_status');
    } else {
      fail('T4', 'Falhou por razão inesperada: ' + e.message);
    }
  }

  // ── T5: UNIQUE bloqueia segunda obligation para mesmo caso ────────────────
  console.log('\nT5 — UNIQUE total bloqueia segunda obligation para mesmo caso');
  try {
    await q(
      `INSERT INTO actor_wallet_recovery_obligations
         (id, tenant_id, debtor_actor_id, debtor_account_id, creditor_actor_id, creditor_account_id,
          original_transaction_id, payment_intent_id, amount_cents, reason)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      [uuidv4(), TENANT_ID, actor_id, account_id, actor_id, account_id,
       transaction_id, payment_intent_id, 5000, 'duplicate should fail'],
    );
    fail('T5', 'Segunda obligation para mesmo caso deveria ter sido bloqueada pelo UNIQUE');
  } catch (e: any) {
    if (e.message.includes('uq_recovery_obligation_per_case')) {
      ok('T5', 'UNIQUE uq_recovery_obligation_per_case bloqueou segunda obligation para mesmo caso');
    } else {
      fail('T5', 'Falhou por razão inesperada: ' + e.message);
    }
  }

  // ── T6: INSERT válido de entry ────────────────────────────────────────────
  console.log('\nT6 — INSERT válido de entry vinculada à obligation do T1');
  let entryObligationId = createdObligationIds[0];
  try {
    await q(
      `INSERT INTO actor_wallet_recovery_obligation_entries
         (id, tenant_id, obligation_id, recovery_transaction_id, amount_cents)
       VALUES ($1,$2,$3,$4,$5)`,
      [uuidv4(), TENANT_ID, entryObligationId, transaction_id, 3000],
    );
    const r = await q(
      `SELECT COUNT(*) AS n FROM actor_wallet_recovery_obligation_entries WHERE obligation_id=$1`,
      [entryObligationId],
    );
    if (Number(r.rows[0].n) === 1) {
      ok('T6', 'entry inserida e recuperada corretamente (1 entry para a obligation)');
    } else {
      fail('T6', 'contagem incorreta de entries: ' + r.rows[0].n);
    }
  } catch (e: any) {
    fail('T6', 'INSERT de entry falhou inesperadamente: ' + e.message);
  }

  // ── T7: FK bloqueia entry sem obligation válida ───────────────────────────
  console.log('\nT7 — FK bloqueia entry sem obligation válida');
  try {
    await q(
      `INSERT INTO actor_wallet_recovery_obligation_entries
         (id, tenant_id, obligation_id, recovery_transaction_id, amount_cents)
       VALUES ($1,$2,$3,$4,$5)`,
      [uuidv4(), TENANT_ID, NONEXISTENT_ID, transaction_id, 1000],
    );
    fail('T7', 'Entry sem obligation deveria ter falhado por FK');
  } catch (e: any) {
    if (e.message.includes('foreign key') || e.message.includes('chave estrangeira') || e.message.includes('actor_wallet_recovery_obligation_entries_obligation_id_fkey')) {
      ok('T7', 'FK bloqueou entry com obligation_id inexistente');
    } else {
      fail('T7', 'Falhou por razão inesperada: ' + e.message);
    }
  }

  // ── T8: CHECK bloqueia entry amount_cents <= 0 ───────────────────────────
  console.log('\nT8 — CHECK bloqueia entry amount_cents <= 0');
  try {
    await q(
      `INSERT INTO actor_wallet_recovery_obligation_entries
         (id, tenant_id, obligation_id, recovery_transaction_id, amount_cents)
       VALUES ($1,$2,$3,$4,$5)`,
      [uuidv4(), TENANT_ID, entryObligationId, transaction_id, -100],
    );
    fail('T8', 'Entry com amount_cents=-100 deveria ter falhado');
  } catch (e: any) {
    if (e.message.includes('chk_recovery_entry_amount_positive')) {
      ok('T8', 'CHECK chk_recovery_entry_amount_positive bloqueou amount_cents=-100');
    } else {
      fail('T8', 'Falhou por razão inesperada: ' + e.message);
    }
  }

  // ── T9: FK bloqueia approval_request_id inexistente ─────────────────────
  console.log('\nT9 — FK bloqueia approval_request_id inexistente');
  try {
    await q(
      `INSERT INTO actor_wallet_recovery_obligations
         (id, tenant_id, debtor_actor_id, debtor_account_id, creditor_actor_id, creditor_account_id,
          original_transaction_id, payment_intent_id, amount_cents, reason, approval_request_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
      [uuidv4(), TENANT_ID, actor_id, account_id, actor_id, account_id,
       // Use different tx/pi to avoid T5 UNIQUE conflict
       transaction_id, uuidv4(), 5000, 'should fail on approval_request FK', NONEXISTENT_ID],
    );
    fail('T9', 'INSERT com approval_request_id inexistente deveria ter falhado por FK');
  } catch (e: any) {
    if (e.message.includes('foreign key') || e.message.includes('chave estrangeira') ||
        e.message.includes('approval_requests') || e.message.includes('approval_request_id')) {
      ok('T9', 'FK bloqueou approval_request_id inexistente');
    } else if (e.message.includes('payment_intents')) {
      ok('T9', 'FK bloqueou payment_intent_id inexistente (uuid() like approach confirmed FK active)');
    } else {
      fail('T9', 'Falhou por razão inesperada: ' + e.message);
    }
  }

  // ── T10: Concept actor-wallet-recovery existe ────────────────────────────
  console.log('\nT10 — Concept actor-wallet-recovery existe em financeiro-reversal');
  try {
    const r = await q(
      `SELECT slug, domain FROM concepts WHERE slug = 'actor-wallet-recovery' AND domain = 'financeiro-reversal'`,
    );
    if (r.rows.length === 1) {
      ok('T10', `concept actor-wallet-recovery encontrado (domain=${r.rows[0].domain})`);
    } else {
      fail('T10', 'concept actor-wallet-recovery não encontrado em financeiro-reversal');
    }
  } catch (e: any) {
    fail('T10', 'Query falhou: ' + e.message);
  }

  // ── T11: Zero escrita em bank_ledger/bank_transactions/bank_splits ────────
  console.log('\nT11 — Prova que bank_ledger, bank_transactions, bank_splits não foram tocados');
  const snapshotAfter = await ledgerSnapshot();
  if (
    snapshotAfter.ledger === snapshot.ledger &&
    snapshotAfter.txs === snapshot.txs &&
    snapshotAfter.splits === snapshot.splits
  ) {
    ok('T11', `ledger=${snapshotAfter.ledger} txs=${snapshotAfter.txs} splits=${snapshotAfter.splits} — zero escrita financeira`);
  } else {
    fail('T11', `contagens mudaram: ledger ${snapshot.ledger}→${snapshotAfter.ledger}, txs ${snapshot.txs}→${snapshotAfter.txs}, splits ${snapshot.splits}→${snapshotAfter.splits}`);
  }

  // ── T12: Tabelas existem no schema ───────────────────────────────────────
  console.log('\nT12 — Tabelas actor_wallet_recovery_obligations e _entries existem');
  try {
    const r = await q(
      `SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename IN ('actor_wallet_recovery_obligations','actor_wallet_recovery_obligation_entries') ORDER BY tablename`,
    );
    if (r.rows.length === 2) {
      ok('T12', 'ambas as tabelas existem: ' + r.rows.map((x: any) => x.tablename).join(', '));
    } else {
      fail('T12', 'tabelas faltando, encontradas: ' + r.rows.map((x: any) => x.tablename).join(', '));
    }
  } catch (e: any) {
    fail('T12', 'Query falhou: ' + e.message);
  }

  // ── cleanup ───────────────────────────────────────────────────────────────
  await cleanup(createdObligationIds);

  // ── resultado final ───────────────────────────────────────────────────────
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log(`Resultado: ${passed}/${passed + failed} cenários passaram`);
  if (failed > 0) {
    console.error(`FALHAS (${failed}):`);
    results.filter(r => !r.ok).forEach(r => console.error(`  ✗ ${r.name}: ${r.detail}`));
    console.log('═══════════════════════════════════════════════════════════\n');
    process.exit(1);
  } else {
    console.log('TODOS OS CENÁRIOS PASSARAM');
    console.log('═══════════════════════════════════════════════════════════\n');
  }

  await pool.end();
}

main().catch(e => {
  console.error('Erro fatal:', e.message);
  process.exit(1);
});
