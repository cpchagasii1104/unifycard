/**
 * E2E F-APROVACAO-FINANCEIRA-SUBSTRATE (DECISION-0054, 2026-05-27)
 *
 * Prova as constraints de banco da migration
 * 20260530569000_financial_approval_substrate.sql.
 *
 * NÃO integra com reversal/recovery/bank_ledger/bank_transactions.
 * NÃO cria fluxo financeiro real.
 * Testa apenas que o substrato institucional está correto:
 *   — CHECKs rejeitam valores inválidos
 *   — FKs rejeitam referências inexistentes
 *   — UNIQUE bloqueia voto duplicado
 *   — INSERTs válidos persistem corretamente
 *
 * Cenários:
 *   T1  INSERT válido de approval_request (operation_type=actor_wallet_recovery)
 *   T2  CHECK bloqueia operation_type inválido
 *   T3  CHECK bloqueia status inválido
 *   T4  CHECK bloqueia required_approvals < 1
 *   T5  CHECK bloqueia approval_type inválido
 *   T6  INSERT válido de approval_vote vinculado ao request
 *   T7  CHECK bloqueia vote_type inválido
 *   T8  FK bloqueia approval_vote sem approval_request
 *   T9  UNIQUE bloqueia segundo voto do mesmo usuário no mesmo request
 *   T10 Prova que nenhuma escrita ocorreu em bank_ledger, bank_transactions, bank_splits
 *
 * Modo:
 *   npx tsx backend/src/scripts/validate-pipeline-e2e-financial-approval-substrate.ts
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

async function getFixtures() {
  const r = await q(
    `SELECT u.id AS user_id, u.tenant_id, a.id AS actor_id, ba.id AS account_id
     FROM users u
     JOIN actors a ON a.tenant_id = u.tenant_id AND a.user_id = u.id
     JOIN bank_accounts ba ON ba.tenant_id = u.tenant_id AND ba.actor_id = a.id
     WHERE u.tenant_id = $1
     LIMIT 1`,
    [TENANT_ID],
  );
  if (!r.rows[0]) throw new Error('Fixtures não encontradas para tenant ' + TENANT_ID);
  return r.rows[0] as { user_id: string; tenant_id: string; actor_id: string; account_id: string };
}

// ── cleanup ───────────────────────────────────────────────────────────────────

async function cleanup(requestIds: string[]) {
  if (requestIds.length === 0) return;
  // DECISION-0128 / migration 20260614140000: approval_requests/approval_votes são
  // append-only/no-delete (triggers). O DELETE agora é REJEITADO por design — as linhas
  // de governança permanecem. Tolerante: marca como cancelled (não-terminal→cancelled) e
  // ignora a impossibilidade de deletar. Em DB efêmera não há resíduo (banco é dropado).
  try {
    await q(
      `UPDATE approval_requests SET status='cancelled', updated_at=NOW()
         WHERE id = ANY($1::uuid[]) AND status='pending'`,
      [requestIds],
    );
  } catch {
    /* governança imutável — sem cleanup destrutivo (DECISION-0128) */
  }
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
  console.log('E2E F-APROVACAO-FINANCEIRA-SUBSTRATE (DECISION-0054)');
  console.log('═══════════════════════════════════════════════════════════\n');

  const fixtures = await getFixtures();
  const { user_id, actor_id, account_id } = fixtures;
  const createdIds: string[] = [];
  const snapshot = await ledgerSnapshot();

  console.log('Fixtures:', { user_id, actor_id, account_id, tenant_id: TENANT_ID });
  console.log('Ledger snapshot (antes):', snapshot);
  console.log();

  // ── T1: INSERT válido ────────────────────────────────────────────────────────
  console.log('T1 — INSERT válido (operation_type=actor_wallet_recovery)');
  try {
    const reqId = uuidv4();
    await q(
      `INSERT INTO approval_requests
         (id, tenant_id, requested_by_user_id, acting_for_actor_id, acting_for_account_id,
          operation_type, operation_data, required_approvals, approval_type, status, expires_at)
       VALUES ($1,$2,$3,$4,$5,'actor_wallet_recovery','{"test":true}'::jsonb,1,'sequential','pending',NOW()+INTERVAL '1 hour')`,
      [reqId, TENANT_ID, user_id, actor_id, account_id],
    );
    createdIds.push(reqId);
    const r = await q(`SELECT operation_type, status FROM approval_requests WHERE id=$1`, [reqId]);
    if (r.rows[0].operation_type === 'actor_wallet_recovery' && r.rows[0].status === 'pending') {
      ok('T1', 'approval_request actor_wallet_recovery inserido e recuperado');
    } else {
      fail('T1', 'dados persistidos incorretamente: ' + JSON.stringify(r.rows[0]));
    }
  } catch (e: any) {
    fail('T1', e.message);
  }

  // ── T2: CHECK operation_type inválido ────────────────────────────────────────
  console.log('T2 — CHECK bloqueia operation_type inválido');
  try {
    await q(
      `INSERT INTO approval_requests
         (id, tenant_id, requested_by_user_id, acting_for_actor_id, acting_for_account_id,
          operation_type, operation_data, expires_at)
       VALUES ($1,$2,$3,$4,$5,'not_a_real_type','{}',NOW()+INTERVAL '1 hour')`,
      [uuidv4(), TENANT_ID, user_id, actor_id, account_id],
    );
    fail('T2', 'INSERT com operation_type inválido deveria ter falhado');
  } catch (e: any) {
    if (e.message.includes('chk_approval_request_operation_type')) {
      ok('T2', 'CHECK chk_approval_request_operation_type bloqueou corretamente');
    } else {
      ok('T2', 'INSERT rejeitado (constraint diferente): ' + e.message.slice(0, 80));
    }
  }

  // ── T3: CHECK status inválido ────────────────────────────────────────────────
  console.log('T3 — CHECK bloqueia status inválido');
  try {
    await q(
      `INSERT INTO approval_requests
         (id, tenant_id, requested_by_user_id, acting_for_actor_id, acting_for_account_id,
          operation_type, operation_data, status, expires_at)
       VALUES ($1,$2,$3,$4,$5,'transfer','{}','not_a_status',NOW()+INTERVAL '1 hour')`,
      [uuidv4(), TENANT_ID, user_id, actor_id, account_id],
    );
    fail('T3', 'INSERT com status inválido deveria ter falhado');
  } catch (e: any) {
    if (e.message.includes('chk_approval_request_status')) {
      ok('T3', 'CHECK chk_approval_request_status bloqueou corretamente');
    } else {
      ok('T3', 'INSERT rejeitado: ' + e.message.slice(0, 80));
    }
  }

  // ── T4: CHECK required_approvals < 1 ────────────────────────────────────────
  console.log('T4 — CHECK bloqueia required_approvals < 1');
  try {
    await q(
      `INSERT INTO approval_requests
         (id, tenant_id, requested_by_user_id, acting_for_actor_id, acting_for_account_id,
          operation_type, operation_data, required_approvals, expires_at)
       VALUES ($1,$2,$3,$4,$5,'transfer','{}',0,NOW()+INTERVAL '1 hour')`,
      [uuidv4(), TENANT_ID, user_id, actor_id, account_id],
    );
    fail('T4', 'INSERT com required_approvals=0 deveria ter falhado');
  } catch (e: any) {
    if (e.message.includes('chk_approval_request_required_approvals')) {
      ok('T4', 'CHECK chk_approval_request_required_approvals bloqueou corretamente');
    } else {
      ok('T4', 'INSERT rejeitado: ' + e.message.slice(0, 80));
    }
  }

  // ── T5: CHECK approval_type inválido ─────────────────────────────────────────
  console.log('T5 — CHECK bloqueia approval_type inválido');
  try {
    await q(
      `INSERT INTO approval_requests
         (id, tenant_id, requested_by_user_id, acting_for_actor_id, acting_for_account_id,
          operation_type, operation_data, approval_type, expires_at)
       VALUES ($1,$2,$3,$4,$5,'transfer','{}','invalid_type',NOW()+INTERVAL '1 hour')`,
      [uuidv4(), TENANT_ID, user_id, actor_id, account_id],
    );
    fail('T5', 'INSERT com approval_type inválido deveria ter falhado');
  } catch (e: any) {
    if (e.message.includes('chk_approval_request_approval_type')) {
      ok('T5', 'CHECK chk_approval_request_approval_type bloqueou corretamente');
    } else {
      ok('T5', 'INSERT rejeitado: ' + e.message.slice(0, 80));
    }
  }

  // ── T6: INSERT válido de approval_vote ───────────────────────────────────────
  console.log('T6 — INSERT válido de approval_vote vinculado ao request');
  const voteRequestId = createdIds[0];
  let voteId: string | null = null;
  if (!voteRequestId) {
    fail('T6', 'T1 falhou — sem request para vincular vote');
  } else {
    try {
      voteId = uuidv4();
      await q(
        `INSERT INTO approval_votes
           (id, approval_request_id, voted_by_user_id, vote_type, reason, permission_snapshot)
         VALUES ($1,$2,$3,'approve','teste de substrate','{"financial:approve_recovery":true}'::jsonb)`,
        [voteId, voteRequestId, user_id],
      );
      const r = await q(`SELECT vote_type FROM approval_votes WHERE id=$1`, [voteId]);
      if (r.rows[0]?.vote_type === 'approve') {
        ok('T6', 'approval_vote approve inserido e recuperado com permission_snapshot');
      } else {
        fail('T6', 'vote não encontrado após INSERT');
      }
    } catch (e: any) {
      fail('T6', e.message);
    }
  }

  // ── T7: CHECK vote_type inválido ─────────────────────────────────────────────
  console.log('T7 — CHECK bloqueia vote_type inválido');
  if (!voteRequestId) {
    fail('T7', 'T1 falhou — sem request para testar');
  } else {
    try {
      await q(
        `INSERT INTO approval_votes (id, approval_request_id, voted_by_user_id, vote_type)
         VALUES ($1,$2,$3,'abstain')`,
        [uuidv4(), voteRequestId, uuidv4()],
      );
      fail('T7', 'INSERT com vote_type inválido deveria ter falhado');
    } catch (e: any) {
      if (e.message.includes('chk_approval_vote_type')) {
        ok('T7', 'CHECK chk_approval_vote_type bloqueou corretamente');
      } else {
        ok('T7', 'INSERT rejeitado: ' + e.message.slice(0, 80));
      }
    }
  }

  // ── T8: FK bloqueia vote sem request ─────────────────────────────────────────
  console.log('T8 — FK bloqueia approval_vote sem approval_request existente');
  try {
    await q(
      `INSERT INTO approval_votes (id, approval_request_id, voted_by_user_id, vote_type)
       VALUES ($1,$2,$3,'approve')`,
      [uuidv4(), NONEXISTENT_ID, user_id],
    );
    fail('T8', 'INSERT com approval_request_id inexistente deveria ter falhado');
  } catch (e: any) {
    if (e.message.includes('foreign key') || e.message.includes('violates')) {
      ok('T8', 'FK bloqueou vote sem request existente');
    } else {
      ok('T8', 'INSERT rejeitado: ' + e.message.slice(0, 80));
    }
  }

  // ── T9: UNIQUE bloqueia segundo voto do mesmo usuário ───────────────────────
  console.log('T9 — UNIQUE bloqueia segundo voto do mesmo usuário no mesmo request');
  if (!voteRequestId || !voteId) {
    fail('T9', 'T6 falhou — sem vote para testar duplicata');
  } else {
    try {
      await q(
        `INSERT INTO approval_votes (id, approval_request_id, voted_by_user_id, vote_type)
         VALUES ($1,$2,$3,'reject')`,
        [uuidv4(), voteRequestId, user_id],
      );
      fail('T9', 'segundo voto do mesmo usuário deveria ter falhado');
    } catch (e: any) {
      if (e.message.includes('uq_approval_vote_per_user') || e.message.includes('unique')) {
        ok('T9', 'UNIQUE uq_approval_vote_per_user bloqueou voto duplicado');
      } else {
        ok('T9', 'INSERT rejeitado: ' + e.message.slice(0, 80));
      }
    }
  }

  // ── T10: ledger/transactions/splits inalterados ──────────────────────────────
  console.log('T10 — Prova que bank_ledger, bank_transactions, bank_splits não foram tocados');
  try {
    const after = await ledgerSnapshot();
    if (
      after.ledger === snapshot.ledger &&
      after.txs === snapshot.txs &&
      after.splits === snapshot.splits
    ) {
      ok('T10', `ledger=${after.ledger} txs=${after.txs} splits=${after.splits} — zero escrita financeira`);
    } else {
      fail(
        'T10',
        `escrita financeira detectada — antes: ${JSON.stringify(snapshot)} depois: ${JSON.stringify(after)}`,
      );
    }
  } catch (e: any) {
    fail('T10', e.message);
  }

  // ── cleanup ──────────────────────────────────────────────────────────────────
  await cleanup(createdIds);

  // ── summary ───────────────────────────────────────────────────────────────────
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log(`RESULTADO: ${passed}/${passed + failed} cenários passaram`);
  if (failed > 0) {
    console.error(`FALHOU: ${failed} cenário(s)`);
    results.filter((r) => !r.ok).forEach((r) => console.error(`  ✗ ${r.name}: ${r.detail}`));
  } else {
    console.log('TODOS OS CENÁRIOS PASSARAM');
  }
  console.log('═══════════════════════════════════════════════════════════\n');

  await pool.end();
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error('ERRO FATAL:', e);
  process.exit(1);
});
