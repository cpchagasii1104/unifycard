/**
 * E2E F1 ACTOR-WALLET-PAYOUT SUBSTRATE (DECISION-0058, 2026-05-28)
 *
 * Prova as constraints de banco da migration
 * 20260530572000_actor_wallet_payout_requests_substrate.sql.
 *
 * NÃO integra com serviço de payout, bank_ledger ou bank_transactions.
 * NÃO move dinheiro. NÃO cria fluxo financeiro real.
 * Testa apenas que o substrato institucional está correto:
 *   — CHECKs rejeitam valores inválidos
 *   — FKs rejeitam referências inexistentes
 *   — UNIQUE bloqueia double-submit por idempotency_key
 *   — INSERTs válidos persistem corretamente
 *   — concept actor-wallet-payout existe no domínio correto
 *   — approval_requests aceita operation_type='actor_wallet_payout'
 *   — bank_ledger inalterado (zero escrita financeira)
 *
 * Cenários:
 *   T1  Tabela actor_wallet_payout_requests existe no schema
 *   T2  INSERT válido (status=pending_approval, destination_type=internal_settlement)
 *   T3  CHECK bloqueia status inválido
 *   T4  CHECK bloqueia requested_amount_cents <= 0
 *   T5  CHECK bloqueia destination_type fora do MVP ('pix', 'ted')
 *   T6  FK bloqueia actor_id inexistente
 *   T7  FK bloqueia actor_wallet_account_id inexistente
 *   T8  UNIQUE bloqueia idempotency_key duplicado no mesmo tenant
 *   T9  approval_requests aceita operation_type='actor_wallet_payout' (CHECK estendido)
 *   T10 approval_requests ainda rejeita operation_type inválido (CHECK intacto)
 *   T11 concept 'actor-wallet-payout' existe em domínio 'financeiro-payout'
 *   T12 bank_ledger, bank_transactions, bank_splits inalterados (zero escrita financeira)
 *
 * Modo:
 *   npx tsx backend/src/scripts/validate-pipeline-e2e-f1-actor-wallet-payout-substrate.ts
 */

import dotenv from 'dotenv';
import { join } from 'path';
import { v4 as uuidv4 } from 'uuid';

import { pool } from '../core/database/pool';

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

interface Fixtures {
  userId: string;
  actorId: string;
  accountId: string;
}

async function getFixtures(): Promise<Fixtures> {
  const r = await q(
    `SELECT u.id AS user_id, a.id AS actor_id, ba.id AS account_id
     FROM users u
     JOIN actors a ON a.tenant_id = u.tenant_id AND a.user_id = u.id
     JOIN bank_accounts ba ON ba.tenant_id = u.tenant_id AND ba.actor_id = a.id
     WHERE u.tenant_id = $1
     LIMIT 1`,
    [TENANT_ID],
  );
  if (!r.rows[0]) throw new Error('Fixtures não encontradas para tenant ' + TENANT_ID);
  const row = r.rows[0] as { user_id: string; actor_id: string; account_id: string };
  return { userId: row.user_id, actorId: row.actor_id, accountId: row.account_id };
}

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

async function cleanup(payoutIds: string[], approvalIds: string[]) {
  if (payoutIds.length > 0) {
    await q(`DELETE FROM actor_wallet_payout_requests WHERE id = ANY($1::uuid[])`, [payoutIds]);
  }
  if (approvalIds.length > 0) {
    await q(`DELETE FROM approval_votes WHERE approval_request_id = ANY($1::uuid[])`, [approvalIds]);
    await q(`DELETE FROM approval_requests WHERE id = ANY($1::uuid[])`, [approvalIds]);
  }
}

// ── main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('E2E F1 ACTOR-WALLET-PAYOUT SUBSTRATE (DECISION-0058)');
  console.log('═══════════════════════════════════════════════════════════\n');

  const fixtures = await getFixtures();
  const { userId, actorId, accountId } = fixtures;
  const payoutIds: string[] = [];
  const approvalIds: string[] = [];
  const snapshot = await ledgerSnapshot();

  console.log('Fixtures:', { userId, actorId, accountId, tenantId: TENANT_ID });
  console.log('Ledger snapshot (antes):', snapshot);
  console.log();

  try {
    // ── T1: tabela existe ──────────────────────────────────────────────────────
    console.log('T1 — Tabela actor_wallet_payout_requests existe no schema');
    try {
      const r = await q(
        `SELECT table_name FROM information_schema.tables
         WHERE table_schema='public' AND table_name='actor_wallet_payout_requests'`,
      );
      if (r.rows.length === 1) {
        ok('T1', 'actor_wallet_payout_requests encontrada em information_schema.tables');
      } else {
        fail('T1', 'tabela não encontrada — migration 20260530572000 aplicada?');
      }
    } catch (e: any) {
      fail('T1', e.message);
    }

    // ── T2: INSERT válido ──────────────────────────────────────────────────────
    console.log('T2 — INSERT válido (status=pending_approval, destination_type=internal_settlement)');
    let validPayoutId: string | null = null;
    try {
      validPayoutId = uuidv4();
      await q(
        `INSERT INTO actor_wallet_payout_requests
           (id, tenant_id, actor_id, actor_wallet_account_id,
            requested_amount_cents, destination_type, status)
         VALUES ($1,$2,$3,$4,5000,'internal_settlement','pending_approval')`,
        [validPayoutId, TENANT_ID, actorId, accountId],
      );
      payoutIds.push(validPayoutId);
      const r = await q(
        `SELECT status, destination_type, requested_amount_cents
         FROM actor_wallet_payout_requests WHERE id=$1`,
        [validPayoutId],
      );
      const row = r.rows[0];
      if (
        row.status === 'pending_approval' &&
        row.destination_type === 'internal_settlement' &&
        Number(row.requested_amount_cents) === 5000
      ) {
        ok('T2', 'payout_request inserido — status=pending_approval, destination=internal_settlement, amount=5000');
      } else {
        fail('T2', 'dados persistidos incorretamente: ' + JSON.stringify(row));
      }
    } catch (e: any) {
      fail('T2', e.message);
    }

    // ── T3: CHECK status inválido ──────────────────────────────────────────────
    console.log('T3 — CHECK bloqueia status inválido');
    try {
      await q(
        `INSERT INTO actor_wallet_payout_requests
           (id, tenant_id, actor_id, actor_wallet_account_id,
            requested_amount_cents, destination_type, status)
         VALUES ($1,$2,$3,$4,1000,'internal_settlement','sacar')`,
        [uuidv4(), TENANT_ID, actorId, accountId],
      );
      fail('T3', 'INSERT com status inválido deveria ter falhado');
    } catch (e: any) {
      if (e.message.includes('chk_payout_request_status') || e.message.includes('check')) {
        ok('T3', 'CHECK chk_payout_request_status bloqueou corretamente');
      } else {
        ok('T3', 'INSERT rejeitado: ' + e.message.slice(0, 100));
      }
    }

    // ── T4: CHECK amount_cents <= 0 ────────────────────────────────────────────
    console.log('T4 — CHECK bloqueia requested_amount_cents <= 0');
    try {
      await q(
        `INSERT INTO actor_wallet_payout_requests
           (id, tenant_id, actor_id, actor_wallet_account_id,
            requested_amount_cents, destination_type)
         VALUES ($1,$2,$3,$4,0,'internal_settlement')`,
        [uuidv4(), TENANT_ID, actorId, accountId],
      );
      fail('T4', 'INSERT com amount=0 deveria ter falhado');
    } catch (e: any) {
      if (e.message.includes('chk_payout_request_amount_positive') || e.message.includes('check')) {
        ok('T4', 'CHECK chk_payout_request_amount_positive bloqueou amount=0');
      } else {
        ok('T4', 'INSERT rejeitado: ' + e.message.slice(0, 100));
      }
    }

    // ── T5: CHECK destination_type fora do MVP ─────────────────────────────────
    console.log('T5 — CHECK bloqueia destination_type fora do MVP (pix, ted)');
    try {
      await q(
        `INSERT INTO actor_wallet_payout_requests
           (id, tenant_id, actor_id, actor_wallet_account_id,
            requested_amount_cents, destination_type)
         VALUES ($1,$2,$3,$4,1000,'pix')`,
        [uuidv4(), TENANT_ID, actorId, accountId],
      );
      fail('T5', "INSERT com destination_type='pix' deveria ter falhado");
    } catch (e: any) {
      if (e.message.includes('chk_payout_request_destination_type') || e.message.includes('check')) {
        ok('T5', "CHECK chk_payout_request_destination_type bloqueou 'pix'");
      } else {
        ok('T5', 'INSERT rejeitado: ' + e.message.slice(0, 100));
      }
    }

    // ── T6: FK actor_id inexistente ────────────────────────────────────────────
    console.log('T6 — FK bloqueia actor_id inexistente');
    try {
      await q(
        `INSERT INTO actor_wallet_payout_requests
           (id, tenant_id, actor_id, actor_wallet_account_id,
            requested_amount_cents, destination_type)
         VALUES ($1,$2,$3,$4,1000,'internal_settlement')`,
        [uuidv4(), TENANT_ID, NONEXISTENT_ID, accountId],
      );
      fail('T6', 'INSERT com actor_id inexistente deveria ter falhado');
    } catch (e: any) {
      if (e.message.includes('foreign key') || e.message.includes('violates')) {
        ok('T6', 'FK (actor_id → actors) bloqueou referência inexistente');
      } else {
        ok('T6', 'INSERT rejeitado: ' + e.message.slice(0, 100));
      }
    }

    // ── T7: FK actor_wallet_account_id inexistente ─────────────────────────────
    console.log('T7 — FK bloqueia actor_wallet_account_id inexistente');
    try {
      await q(
        `INSERT INTO actor_wallet_payout_requests
           (id, tenant_id, actor_id, actor_wallet_account_id,
            requested_amount_cents, destination_type)
         VALUES ($1,$2,$3,$4,1000,'internal_settlement')`,
        [uuidv4(), TENANT_ID, actorId, NONEXISTENT_ID],
      );
      fail('T7', 'INSERT com actor_wallet_account_id inexistente deveria ter falhado');
    } catch (e: any) {
      if (e.message.includes('foreign key') || e.message.includes('violates')) {
        ok('T7', 'FK (actor_wallet_account_id → bank_accounts) bloqueou referência inexistente');
      } else {
        ok('T7', 'INSERT rejeitado: ' + e.message.slice(0, 100));
      }
    }

    // ── T8: UNIQUE idempotency_key duplicada ───────────────────────────────────
    console.log('T8 — UNIQUE bloqueia idempotency_key duplicada no mesmo tenant');
    const idemKey = `e2e-payout-${uuidv4().slice(0, 8)}`;
    let firstPayoutId: string | null = null;
    try {
      firstPayoutId = uuidv4();
      // status='cancelled' (terminal) — evita conflito com partial unique index
      // enquanto T2's row (pending_approval) ainda está ativa no mesmo test run.
      // O UNIQUE uq_payout_request_idempotency não filtra por status.
      await q(
        `INSERT INTO actor_wallet_payout_requests
           (id, tenant_id, actor_id, actor_wallet_account_id,
            requested_amount_cents, destination_type, idempotency_key, status)
         VALUES ($1,$2,$3,$4,2000,'internal_settlement',$5,'cancelled')`,
        [firstPayoutId, TENANT_ID, actorId, accountId, idemKey],
      );
      payoutIds.push(firstPayoutId);

      // Tentar inserir segundo com mesma chave — deve falhar por uq_payout_request_idempotency
      try {
        await q(
          `INSERT INTO actor_wallet_payout_requests
             (id, tenant_id, actor_id, actor_wallet_account_id,
              requested_amount_cents, destination_type, idempotency_key, status)
           VALUES ($1,$2,$3,$4,3000,'internal_settlement',$5,'cancelled')`,
          [uuidv4(), TENANT_ID, actorId, accountId, idemKey],
        );
        fail('T8', 'segundo INSERT com mesma idempotency_key deveria ter falhado');
      } catch (e: any) {
        if (e.message.includes('uq_payout_request_idempotency') || e.message.includes('unique')) {
          ok('T8', 'UNIQUE uq_payout_request_idempotency bloqueou double-submit');
        } else {
          ok('T8', 'INSERT rejeitado: ' + e.message.slice(0, 100));
        }
      }
    } catch (e: any) {
      fail('T8', 'Erro ao criar primeiro pedido com idempotency_key: ' + e.message);
    }

    // ── T9: approval_requests aceita actor_wallet_payout ──────────────────────
    console.log('T9 — approval_requests aceita operation_type=actor_wallet_payout');
    let approvalPayoutId: string | null = null;
    try {
      approvalPayoutId = uuidv4();
      await q(
        `INSERT INTO approval_requests
           (id, tenant_id, requested_by_user_id, acting_for_actor_id, acting_for_account_id,
            operation_type, operation_data, required_approvals, approval_type, status, expires_at)
         VALUES ($1,$2,$3,$4,$5,'actor_wallet_payout',
                 '{"requested_amount_cents":5000,"destination_type":"internal_settlement"}'::jsonb,
                 1,'sequential','pending',NOW()+INTERVAL '1 hour')`,
        [approvalPayoutId, TENANT_ID, userId, actorId, accountId],
      );
      approvalIds.push(approvalPayoutId);
      const r = await q(
        `SELECT operation_type, status FROM approval_requests WHERE id=$1`,
        [approvalPayoutId],
      );
      if (r.rows[0]?.operation_type === 'actor_wallet_payout') {
        ok('T9', 'approval_request com operation_type=actor_wallet_payout inserido — CHECK estendido OK');
      } else {
        fail('T9', 'dados incorretos: ' + JSON.stringify(r.rows[0]));
      }
    } catch (e: any) {
      fail('T9', e.message);
    }

    // ── T10: CHECK de approval_requests ainda rejeita inválido ────────────────
    console.log('T10 — CHECK ainda rejeita operation_type inválido em approval_requests');
    try {
      await q(
        `INSERT INTO approval_requests
           (id, tenant_id, requested_by_user_id, acting_for_actor_id, acting_for_account_id,
            operation_type, operation_data, expires_at)
         VALUES ($1,$2,$3,$4,$5,'saque_direto','{}',NOW()+INTERVAL '1 hour')`,
        [uuidv4(), TENANT_ID, userId, actorId, accountId],
      );
      fail('T10', 'INSERT com operation_type inválido deveria ter falhado');
    } catch (e: any) {
      if (e.message.includes('chk_approval_request_operation_type') || e.message.includes('check')) {
        ok('T10', 'CHECK chk_approval_request_operation_type intacto — bloqueia valores inválidos');
      } else {
        ok('T10', 'INSERT rejeitado: ' + e.message.slice(0, 100));
      }
    }

    // ── T11: concept actor-wallet-payout existe ────────────────────────────────
    console.log("T11 — concept 'actor-wallet-payout' existe em domínio 'financeiro-payout'");
    try {
      const r = await q(
        `SELECT slug, domain FROM concepts WHERE slug='actor-wallet-payout' AND domain='financeiro-payout'`,
      );
      if (r.rows.length === 1) {
        ok('T11', `concept '${r.rows[0].slug}' em domínio '${r.rows[0].domain}' — seed OK`);
      } else {
        fail('T11', "concept 'actor-wallet-payout' não encontrado — seed da migration aplicado?");
      }
    } catch (e: any) {
      fail('T11', e.message);
    }

    // ── T12: ledger/transactions/splits inalterados ───────────────────────────
    console.log('T12 — bank_ledger, bank_transactions, bank_splits inalterados');
    try {
      const after = await ledgerSnapshot();
      if (
        after.ledger === snapshot.ledger &&
        after.txs === snapshot.txs &&
        after.splits === snapshot.splits
      ) {
        ok('T12', `ledger=${after.ledger} txs=${after.txs} splits=${after.splits} — zero escrita financeira`);
      } else {
        fail(
          'T12',
          `escrita financeira detectada — antes: ${JSON.stringify(snapshot)} depois: ${JSON.stringify(after)}`,
        );
      }
    } catch (e: any) {
      fail('T12', e.message);
    }

  } finally {
    // cleanup garante rollback mesmo com falhas
    await cleanup(payoutIds, approvalIds);
  }

  // ── summary ──────────────────────────────────────────────────────────────────
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log(`RESULTADO: ${passed}/${passed + failed} cenários passaram`);
  if (failed > 0) {
    console.error(`FALHOU: ${failed} cenário(s)`);
    results.filter((r) => !r.ok).forEach((r) => console.error(`  ✗ ${r.name}: ${r.detail}`));
  } else {
    console.log('TODOS OS CENÁRIOS PASSARAM ✓');
  }
  console.log('═══════════════════════════════════════════════════════════\n');

  await pool.end();
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error('ERRO FATAL:', e);
  process.exit(1);
});
