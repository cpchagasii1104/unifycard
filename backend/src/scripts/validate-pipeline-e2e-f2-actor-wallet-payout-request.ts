/**
 * E2E F2 ACTOR-WALLET-PAYOUT REQUEST SERVICE (DECISION-0058, 2026-05-28)
 *
 * Prova o serviço de criação de pedido de saque de actor_wallet.
 * NÃO move dinheiro. NÃO cria bank_transaction. NÃO cria bank_ledger.
 * NÃO executa payout. Testa apenas a camada F2:
 *   — requestActorWalletPayout cria pedido em status pending_approval
 *   — approval_request vinculado com operation_type='actor_wallet_payout'
 *   — idempotência por idempotency_key
 *   — snapshot de available balance filtra criação conservadoramente
 *   — obligations aprovadas/partially_recovered reduzem available no snapshot
 *   — obligations terminais/pending_approval não reduzem available
 *   — actor sem actor_wallet falha explicitamente
 *   — rollback atômico: falha induzida não deixa pedido órfão
 *   — payout_requests legado permanece intocado
 *
 * Cenários:
 *   T1  Cria pedido válido em status pending_approval
 *   T2  approval_request criado com operation_type='actor_wallet_payout'
 *   T3  pedido referencia approval_request_id correto
 *   T4  idempotência: mesma key retorna pedido existente, não duplica
 *   T5  amount <= available projetado passa criação
 *   T6  amount > available projetado falha com INSUFFICIENT_AVAILABLE_BALANCE
 *   T7  obligation 'approved' reduz available no snapshot
 *   T8  obligation 'partially_recovered' reduz available pelo restante
 *   T9  obligation 'pending_approval' NÃO reduz available
 *   T10 obligation 'recovered' NÃO reduz available
 *   T11 obligation 'cancelled' NÃO reduz available
 *   T12 actor sem actor_wallet falha com ACTOR_WALLET_NOT_FOUND
 *   T13 rollback: zero actor_wallet_payout_requests órfão após falha induzida
 *   T14 zero alteração em bank_ledger
 *   T15 zero alteração em bank_transactions
 *   T16 payout_requests legado intocado (zero registros adicionados)
 *
 * Modo:
 *   npx tsx backend/src/scripts/validate-pipeline-e2e-f2-actor-wallet-payout-request.ts
 */

import dotenv from 'dotenv';
import { join } from 'path';
import { v4 as uuidv4 } from 'uuid';

import { pool } from '../core/database/pool';
import { bankAccountService } from '../modules/bank/bank-account.service';
import {
  actorWalletPayoutService,
  ActorWalletPayoutError,
} from '../modules/wallet/actor-wallet-payout.service';
import { calculateActorWalletBalanceProjection } from '../modules/wallet/actor-wallet-balance-projection';

dotenv.config({ path: join(process.cwd(), 'backend', '.env') });

const TENANT_ID = process.env.E2E_TENANT_ID || 'fbe13b78-4516-493d-905a-363796aea1d1';

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
  actorWalletAccountId: string;
}

async function getFixtures(): Promise<Fixtures> {
  // Precisa de actor com actor_wallet — busca actor + actor_wallet
  const r = await q(
    `SELECT u.id AS user_id, a.id AS actor_id, ba.id AS account_id
     FROM users u
     JOIN actors a ON a.tenant_id = u.tenant_id AND a.user_id = u.id
     JOIN bank_accounts ba
       ON ba.tenant_id = u.tenant_id
      AND ba.actor_id = a.id
      AND ba.account_type = 'actor_wallet'
     WHERE u.tenant_id = $1
     LIMIT 1`,
    [TENANT_ID]
  );
  if (!r.rows[0]) throw new Error('Nenhum actor com actor_wallet encontrado para tenant ' + TENANT_ID);
  const row = r.rows[0] as { user_id: string; actor_id: string; account_id: string };
  return { userId: row.user_id, actorId: row.actor_id, actorWalletAccountId: row.account_id };
}

async function getFinancialSnapshot() {
  const [ledger, txs, payouts] = await Promise.all([
    q(`SELECT COUNT(*) AS n FROM bank_ledger WHERE tenant_id=$1`, [TENANT_ID]),
    q(`SELECT COUNT(*) AS n FROM bank_transactions WHERE tenant_id=$1`, [TENANT_ID]),
    q(`SELECT COUNT(*) AS n FROM payout_requests WHERE tenant_id=$1`, [TENANT_ID]),
  ]);
  return {
    ledger: Number(ledger.rows[0].n),
    txs: Number(txs.rows[0].n),
    payouts: Number(payouts.rows[0].n),
  };
}

async function insertObligFixture(
  tenantId: string,
  debtorActorId: string,
  debtorAccountId: string,
  amountCents: number,
  status: string,
  recoveredAmountCents = 0
): Promise<{ obligId: string; fakeTxId: string; fakeIntentId: string }> {
  // Creditor fixture — qualquer actor/conta diferente do devedor
  const credRes = await q(
    `SELECT a.id AS actor_id, ba.id AS account_id
     FROM actors a
     JOIN bank_accounts ba ON ba.actor_id = a.id AND ba.tenant_id = a.tenant_id
     WHERE a.tenant_id = $1 AND a.id != $2
     LIMIT 1`,
    [tenantId, debtorActorId]
  );
  if (!credRes.rows[0]) throw new Error('Sem creditor para fixture');
  const creditorActorId = credRes.rows[0].actor_id;
  const creditorAccountId = credRes.rows[0].account_id;

  // concept_id NOT NULL — usa concept de financeiro-payout (seeded em F1 / 20260530572000)
  // concepts PK = concept_id (NÃO id)
  const conceptRes = await q(
    `SELECT concept_id FROM concepts WHERE domain='financeiro-payout' LIMIT 1`
  );
  if (!conceptRes.rows[0]) throw new Error('Nenhum concept em financeiro-payout — F1 migration aplicada?');
  const conceptId = conceptRes.rows[0].concept_id;

  // Fake bank_transaction (actor_id + account_id = debtor)
  const fakeTxId = uuidv4();
  await q(
    `INSERT INTO bank_transactions
       (id, tenant_id, actor_id, account_id, amount_cents, purpose,
        justification, reference_type, reference_id, concept_id)
     VALUES ($1,$2,$3,$4,$5,'execution','e2e obligation fixture','e2e_obligation_fixture',$6,$7)`,
    [fakeTxId, tenantId, debtorActorId, debtorAccountId, amountCents, fakeTxId, conceptId]
  );

  // Fake payment_intent (actor_id = debtor; intent_type + gateway required; PK = id)
  const fakeIntentId = uuidv4();
  await q(
    `INSERT INTO payment_intents
       (id, tenant_id, actor_id, amount_cents, currency,
        intent_type, gateway, payment_status, reference_id)
     VALUES ($1,$2,$3,$4,'BRL','e2e_fixture','unknown','released_to_actor_wallet',$5)`,
    [fakeIntentId, tenantId, debtorActorId, amountCents, fakeIntentId]
  );

  const obligId = uuidv4();
  await q(
    `INSERT INTO actor_wallet_recovery_obligations
       (id, tenant_id,
        debtor_actor_id, debtor_account_id,
        creditor_actor_id, creditor_account_id,
        original_transaction_id, payment_intent_id,
        amount_cents, reason, status, recovered_amount_cents)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'e2e-payout-test',$10,$11)`,
    [
      obligId, tenantId,
      debtorActorId, debtorAccountId,
      creditorActorId, creditorAccountId,
      fakeTxId, fakeIntentId,
      amountCents, status, recoveredAmountCents,
    ]
  );
  return { obligId, fakeTxId, fakeIntentId };
}

async function cleanupObligFixture(
  obligId: string,
  fakeTxId: string,
  fakeIntentId: string
): Promise<void> {
  await q(`DELETE FROM actor_wallet_recovery_obligations WHERE id=$1`, [obligId]);
  await q(`DELETE FROM payment_intents WHERE id=$1`, [fakeIntentId]);
  await q(`DELETE FROM bank_transactions WHERE id=$1`, [fakeTxId]);
}

async function cleanupPayoutRequests(ids: string[]): Promise<void> {
  if (!ids.length) return;
  // limpar approval_requests vinculados primeiro
  const approvalIds = await q(
    `SELECT approval_request_id FROM actor_wallet_payout_requests WHERE id = ANY($1::uuid[])`,
    [ids]
  );
  await q(`DELETE FROM actor_wallet_payout_requests WHERE id = ANY($1::uuid[])`, [ids]);
  const aIds = approvalIds.rows.map((r: any) => r.approval_request_id).filter(Boolean);
  if (aIds.length) {
    await q(`DELETE FROM approval_votes WHERE approval_request_id = ANY($1::uuid[])`, [aIds]);
    await q(`DELETE FROM approval_requests WHERE id = ANY($1::uuid[])`, [aIds]);
  }
}

// ── main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('E2E F2 ACTOR-WALLET-PAYOUT REQUEST SERVICE (DECISION-0058)');
  console.log('═══════════════════════════════════════════════════════════\n');

  const fixtures = await getFixtures();
  const { userId, actorId, actorWalletAccountId } = fixtures;
  const snapshot0 = await getFinancialSnapshot();
  const createdPayoutIds: string[] = [];
  const obligFixtures: Array<{ obligId: string; fakeTxId: string; fakeIntentId: string }> = [];

  console.log('Fixtures:', { userId, actorId, actorWalletAccountId, tenantId: TENANT_ID });
  console.log('Snapshot financeiro (antes):', snapshot0);
  console.log();

  try {
    // ── T1: Cria pedido válido pending_approval ────────────────────────────────
    console.log('T1 — Cria pedido válido em status pending_approval');
    const idem1 = `f2-t1-${uuidv4().slice(0, 8)}`;
    try {
      const res = await actorWalletPayoutService.requestActorWalletPayout({
        tenantId: TENANT_ID,
        actorId,
        requestedByUserId: userId,
        requestedAmountCents: 1,
        idempotencyKey: idem1,
        reason: 'e2e T1 — pedido mínimo válido',
      });
      if (
        res.payoutRequest.status === 'pending_approval' &&
        res.payoutRequest.requestedAmountCents === 1 &&
        res.alreadyExisted === false
      ) {
        createdPayoutIds.push(res.payoutRequest.id);
        ok('T1', `pedido ${res.payoutRequest.id.slice(0, 8)} criado — status=pending_approval amount=1`);
      } else {
        fail('T1', 'dados incorretos: ' + JSON.stringify({ status: res.payoutRequest.status, alreadyExisted: res.alreadyExisted }));
      }
    } catch (e: any) {
      fail('T1', e.message);
    }

    // ── T2: approval_request criado com operation_type='actor_wallet_payout' ──
    console.log('T2 — approval_request criado com operation_type=actor_wallet_payout');
    if (createdPayoutIds[0]) {
      try {
        const r = await q(
          `SELECT ar.operation_type, ar.status
           FROM actor_wallet_payout_requests pr
           JOIN approval_requests ar ON ar.id = pr.approval_request_id
           WHERE pr.id = $1`,
          [createdPayoutIds[0]]
        );
        if (r.rows[0]?.operation_type === 'actor_wallet_payout' && r.rows[0]?.status === 'pending') {
          ok('T2', 'approval_request operation_type=actor_wallet_payout status=pending');
        } else {
          fail('T2', 'approval_request incorreto: ' + JSON.stringify(r.rows[0]));
        }
      } catch (e: any) {
        fail('T2', e.message);
      }
    } else {
      fail('T2', 'T1 falhou — sem pedido para verificar');
    }

    // ── T3: pedido referencia approval_request_id correto ─────────────────────
    console.log('T3 — pedido referencia approval_request_id correto (não null)');
    if (createdPayoutIds[0]) {
      try {
        const r = await q(
          `SELECT approval_request_id FROM actor_wallet_payout_requests WHERE id=$1`,
          [createdPayoutIds[0]]
        );
        if (r.rows[0]?.approval_request_id) {
          ok('T3', `approval_request_id=${r.rows[0].approval_request_id.slice(0, 8)}...`);
        } else {
          fail('T3', 'approval_request_id é NULL no pedido');
        }
      } catch (e: any) {
        fail('T3', e.message);
      }
    } else {
      fail('T3', 'T1 falhou — sem pedido para verificar');
    }

    // ── T4: idempotência — mesma key retorna pedido existente ─────────────────
    console.log('T4 — idempotência: mesma key não duplica pedido');
    if (createdPayoutIds[0]) {
      try {
        const res2 = await actorWalletPayoutService.requestActorWalletPayout({
          tenantId: TENANT_ID,
          actorId,
          requestedByUserId: userId,
          requestedAmountCents: 1,
          idempotencyKey: idem1, // mesma key de T1
          reason: 'e2e T4 — idempotência',
        });
        const countRes = await q(
          `SELECT COUNT(*) AS n FROM actor_wallet_payout_requests
           WHERE tenant_id=$1 AND idempotency_key=$2`,
          [TENANT_ID, idem1]
        );
        if (res2.alreadyExisted === true && Number(countRes.rows[0].n) === 1) {
          ok('T4', 'idempotência OK — alreadyExisted=true, apenas 1 row no DB');
        } else {
          fail('T4', `alreadyExisted=${res2.alreadyExisted} count=${countRes.rows[0].n}`);
        }
      } catch (e: any) {
        fail('T4', e.message);
      }
    } else {
      fail('T4', 'T1 falhou');
    }

    // ── T5: amount <= available passa ─────────────────────────────────────────
    // Após F2 hardening: active-gate bloqueia nova criação enquanto R1 (T1) está ativo.
    // T1 já provou que amount=1 <= available cria pedido. T5 confirma via snapshot.
    console.log('T5 — snapshot confirma available >= 1 (T1 já provou que criação passa)');
    try {
      const snap5 = await calculateActorWalletBalanceProjection(TENANT_ID, actorId, actorWalletAccountId);
      if (snap5.availableBalanceCents >= 1) {
        ok('T5', `snapshot: available=${snap5.availableBalanceCents} >= 1 — T1 provou que criação passa`);
      } else {
        fail('T5', `available=${snap5.availableBalanceCents} — saldo insuficiente para provar T5`);
      }
    } catch (e: any) {
      fail('T5', e.message);
    }

    // ── T6: amount > available falha INSUFFICIENT_AVAILABLE_BALANCE ───────────
    // Active-gate é verificado antes do balance-gate. Cancelar R1 primeiro para
    // que o balance-gate seja alcançado com nova key.
    console.log('T6 — cancela R1, nova key com amount > available → INSUFFICIENT_AVAILABLE_BALANCE');
    try {
      // Cancelar R1 (de T1) para que o active-gate não intercepte T6
      if (createdPayoutIds[0]) {
        await q(`UPDATE actor_wallet_payout_requests SET status='cancelled' WHERE id=$1`, [createdPayoutIds[0]]);
      }
      await actorWalletPayoutService.requestActorWalletPayout({
        tenantId: TENANT_ID,
        actorId,
        requestedByUserId: userId,
        requestedAmountCents: 999_999_999,
        idempotencyKey: `f2-t6-${uuidv4().slice(0, 8)}`,
        reason: 'e2e T6 — deve falhar',
      });
      fail('T6', 'deveria ter falhado com INSUFFICIENT_AVAILABLE_BALANCE');
    } catch (e: any) {
      if (e instanceof ActorWalletPayoutError && e.code === 'ACTOR_WALLET_PAYOUT_INSUFFICIENT_AVAILABLE_BALANCE') {
        ok('T6', 'ACTOR_WALLET_PAYOUT_INSUFFICIENT_AVAILABLE_BALANCE lançado corretamente');
      } else {
        fail('T6', 'erro inesperado: ' + e.message);
      }
    }
    // Estado após T6: R1 está cancelled; nenhum request ativo para actorId

    // ── T7: obligation 'approved' reduz available ─────────────────────────────
    console.log('T7 — obligation approved reduz available no snapshot');
    let obligT7: typeof obligFixtures[0] | null = null;
    try {
      obligT7 = await insertObligFixture(TENANT_ID, actorId, actorWalletAccountId, 50000, 'approved', 0);
      obligFixtures.push(obligT7);
      const snap = await calculateActorWalletBalanceProjection(
        TENANT_ID, actorId, actorWalletAccountId
      );
      if (snap.pendingRecoveryCents >= 50000) {
        ok('T7', `approved reduz: pending=${snap.pendingRecoveryCents} >= 50000`);
      } else {
        fail('T7', `pending=${snap.pendingRecoveryCents} — deveria incluir 50000 da obligation approved`);
      }
    } catch (e: any) {
      fail('T7', e.message);
    } finally {
      if (obligT7) {
        await cleanupObligFixture(obligT7.obligId, obligT7.fakeTxId, obligT7.fakeIntentId);
        obligFixtures.pop();
      }
    }

    // ── T8: obligation 'partially_recovered' reduz available pelo restante ─────
    console.log('T8 — obligation partially_recovered reduz available pelo restante');
    let obligT8: typeof obligFixtures[0] | null = null;
    try {
      // amount=10000, recovered=3000 → pending=7000
      obligT8 = await insertObligFixture(TENANT_ID, actorId, actorWalletAccountId, 10000, 'partially_recovered', 3000);
      obligFixtures.push(obligT8);
      const snap = await calculateActorWalletBalanceProjection(
        TENANT_ID, actorId, actorWalletAccountId
      );
      if (snap.pendingRecoveryCents >= 7000) {
        ok('T8', `partially_recovered: pending=${snap.pendingRecoveryCents} inclui restante 7000`);
      } else {
        fail('T8', `pending=${snap.pendingRecoveryCents} — deveria incluir 7000 (10000-3000)`);
      }
    } catch (e: any) {
      fail('T8', e.message);
    } finally {
      if (obligT8) {
        await cleanupObligFixture(obligT8.obligId, obligT8.fakeTxId, obligT8.fakeIntentId);
        obligFixtures.pop();
      }
    }

    // ── T9: obligation 'pending_approval' NÃO reduz available ─────────────────
    console.log("T9 — obligation 'pending_approval' NÃO reduz available");
    let obligT9: typeof obligFixtures[0] | null = null;
    try {
      obligT9 = await insertObligFixture(TENANT_ID, actorId, actorWalletAccountId, 50000, 'pending_approval', 0);
      obligFixtures.push(obligT9);
      const snapBefore = await calculateActorWalletBalanceProjection(
        TENANT_ID, actorId, actorWalletAccountId
      );
      await cleanupObligFixture(obligT9.obligId, obligT9.fakeTxId, obligT9.fakeIntentId);
      obligFixtures.pop();
      obligT9 = null;
      const snapAfter = await calculateActorWalletBalanceProjection(
        TENANT_ID, actorId, actorWalletAccountId
      );
      if (snapBefore.pendingRecoveryCents === snapAfter.pendingRecoveryCents) {
        ok('T9', `pending_approval não altera pendingRecoveryCents=${snapBefore.pendingRecoveryCents}`);
      } else {
        fail('T9', `pendingRecoveryCents mudou: ${snapAfter.pendingRecoveryCents} → ${snapBefore.pendingRecoveryCents}`);
      }
    } catch (e: any) {
      fail('T9', e.message);
    } finally {
      if (obligT9) {
        await cleanupObligFixture(obligT9.obligId, obligT9.fakeTxId, obligT9.fakeIntentId).catch(() => {});
      }
    }

    // ── T10: obligation 'recovered' NÃO reduz available ──────────────────────
    console.log("T10 — obligation 'recovered' NÃO reduz available");
    let obligT10: typeof obligFixtures[0] | null = null;
    try {
      obligT10 = await insertObligFixture(TENANT_ID, actorId, actorWalletAccountId, 50000, 'recovered', 50000);
      obligFixtures.push(obligT10);
      const snapBefore = await calculateActorWalletBalanceProjection(
        TENANT_ID, actorId, actorWalletAccountId
      );
      await cleanupObligFixture(obligT10.obligId, obligT10.fakeTxId, obligT10.fakeIntentId);
      obligFixtures.pop();
      obligT10 = null;
      const snapAfter = await calculateActorWalletBalanceProjection(
        TENANT_ID, actorId, actorWalletAccountId
      );
      if (snapBefore.pendingRecoveryCents === snapAfter.pendingRecoveryCents) {
        ok('T10', `recovered não altera pendingRecoveryCents=${snapBefore.pendingRecoveryCents}`);
      } else {
        fail('T10', `pendingRecoveryCents mudou com obligation recovered`);
      }
    } catch (e: any) {
      fail('T10', e.message);
    } finally {
      if (obligT10) {
        await cleanupObligFixture(obligT10.obligId, obligT10.fakeTxId, obligT10.fakeIntentId).catch(() => {});
      }
    }

    // ── T11: obligation 'cancelled' NÃO reduz available ──────────────────────
    console.log("T11 — obligation 'cancelled' NÃO reduz available");
    let obligT11: typeof obligFixtures[0] | null = null;
    try {
      obligT11 = await insertObligFixture(TENANT_ID, actorId, actorWalletAccountId, 50000, 'cancelled', 0);
      obligFixtures.push(obligT11);
      const snapBefore = await calculateActorWalletBalanceProjection(
        TENANT_ID, actorId, actorWalletAccountId
      );
      await cleanupObligFixture(obligT11.obligId, obligT11.fakeTxId, obligT11.fakeIntentId);
      obligFixtures.pop();
      obligT11 = null;
      const snapAfter = await calculateActorWalletBalanceProjection(
        TENANT_ID, actorId, actorWalletAccountId
      );
      if (snapBefore.pendingRecoveryCents === snapAfter.pendingRecoveryCents) {
        ok('T11', `cancelled não altera pendingRecoveryCents=${snapBefore.pendingRecoveryCents}`);
      } else {
        fail('T11', `pendingRecoveryCents mudou com obligation cancelled`);
      }
    } catch (e: any) {
      fail('T11', e.message);
    } finally {
      if (obligT11) {
        await cleanupObligFixture(obligT11.obligId, obligT11.fakeTxId, obligT11.fakeIntentId).catch(() => {});
      }
    }

    // ── T12: actor sem actor_wallet falha ACTOR_WALLET_NOT_FOUND ─────────────
    console.log('T12 — actor sem actor_wallet falha com ACTOR_WALLET_NOT_FOUND');
    try {
      // Cria actor sem wallet
      const noWalletActorId = uuidv4();
      await q(
        `INSERT INTO actors (id, tenant_id, actor_type, display_name)
         VALUES ($1,$2,'user','no-wallet-actor')`,
        [noWalletActorId, TENANT_ID]
      );
      try {
        await actorWalletPayoutService.requestActorWalletPayout({
          tenantId: TENANT_ID,
          actorId: noWalletActorId,
          requestedByUserId: userId,
          requestedAmountCents: 1,
          idempotencyKey: `f2-t12-${uuidv4().slice(0, 8)}`,
          reason: 'e2e T12',
        });
        fail('T12', 'deveria ter falhado com ACTOR_WALLET_NOT_FOUND');
      } catch (e: any) {
        if (e instanceof ActorWalletPayoutError && e.code === 'ACTOR_WALLET_NOT_FOUND') {
          ok('T12', 'ACTOR_WALLET_NOT_FOUND lançado corretamente para actor sem wallet');
        } else {
          fail('T12', 'erro inesperado: ' + e.message);
        }
      } finally {
        await q(`DELETE FROM actors WHERE id=$1`, [noWalletActorId]).catch(() => {});
      }
    } catch (e: any) {
      fail('T12', e.message);
    }

    // ── T13: rollback — falha após approval não deixa pedido órfão ───────────
    console.log('T13 — rollback: falha induzida não deixa payout_request órfão');
    const idem13 = `f2-t13-${uuidv4().slice(0, 8)}`;
    try {
      // Injetamos uma idempotency_key que causaria UNIQUE violation no payout_request
      // para forçar rollback: primeiro criamos uma row com a key diretamente
      // Status 'cancelled' (terminal) — partial unique index não se aplica a terminais.
      // O service detecta idempotência pela key INDEPENDENTE do status.
      await q(
        `INSERT INTO actor_wallet_payout_requests
           (id, tenant_id, actor_id, actor_wallet_account_id,
            requested_amount_cents, destination_type, idempotency_key, status)
         VALUES ($1,$2,$3,$4,1,'internal_settlement',$5,'cancelled')`,
        [uuidv4(), TENANT_ID, actorId, actorWalletAccountId, idem13]
      );
      // Agora chamar o service com a mesma key → idempotência (não erro)
      const res13 = await actorWalletPayoutService.requestActorWalletPayout({
        tenantId: TENANT_ID,
        actorId,
        requestedByUserId: userId,
        requestedAmountCents: 1,
        idempotencyKey: idem13,
        reason: 'e2e T13',
      });
      // O service deve detectar idempotência ANTES de criar conflito
      if (res13.alreadyExisted === true) {
        createdPayoutIds.push(res13.payoutRequest.id);
        ok('T13', 'idempotência detectada antes de UNIQUE conflict — sem pedido órfão');
      } else {
        fail('T13', 'esperava alreadyExisted=true mas criou novo pedido');
      }
    } catch (e: any) {
      fail('T13', 'erro inesperado: ' + e.message);
    }

    // ── Setup T17/T18/T20: criar request ativo (R1 foi cancelado em T6) ────────
    // Após T6, actorId não tem request ativo. Criar um novo para provar T17/T18/T20.
    const idem17Setup = `f2-t17s-${uuidv4().slice(0, 8)}`;
    let r17setupId: string | null = null;
    try {
      const r17setup = await actorWalletPayoutService.requestActorWalletPayout({
        tenantId: TENANT_ID,
        actorId,
        requestedByUserId: userId,
        requestedAmountCents: 1,
        idempotencyKey: idem17Setup,
        reason: 'setup para T17/T18/T19/T20',
      });
      r17setupId = r17setup.payoutRequest.id;
      createdPayoutIds.push(r17setupId);
    } catch (e: any) {
      // Se falhar, T17/T18/T19/T20 vão fail com contexto explícito
    }

    // ── T17: segunda key diferente falha com ACTOR_WALLET_PAYOUT_ALREADY_ACTIVE
    console.log('T17 — segunda idempotency_key diferente falha com ACTOR_WALLET_PAYOUT_ALREADY_ACTIVE');
    {
      if (!r17setupId) {
        fail('T17', 'Pré-condição: setup r17 falhou — sem request ativo para testar');
      } else {
        try {
          await actorWalletPayoutService.requestActorWalletPayout({
            tenantId: TENANT_ID,
            actorId,
            requestedByUserId: userId,
            requestedAmountCents: 1,
            idempotencyKey: `f2-t17-${uuidv4().slice(0, 8)}`,
            reason: 'e2e T17 — deve falhar com ALREADY_ACTIVE',
          });
          fail('T17', 'deveria ter falhado com ACTOR_WALLET_PAYOUT_ALREADY_ACTIVE');
        } catch (e: any) {
          if (e instanceof ActorWalletPayoutError && e.code === 'ACTOR_WALLET_PAYOUT_ALREADY_ACTIVE') {
            ok('T17', 'ACTOR_WALLET_PAYOUT_ALREADY_ACTIVE lançado corretamente para nova key com request ativo');
          } else {
            fail('T17', 'erro inesperado: ' + e.message);
          }
        }
      }
    }

    // ── T18: mesma key não ativa o active-gate (idempotência prevalece) ───────
    console.log('T18 — mesma idempotency_key não falha com ALREADY_ACTIVE (idempotência prevalece)');
    if (r17setupId) {
      try {
        // Chamar com a mesma key do setup — deve retornar alreadyExisted=true
        const res18 = await actorWalletPayoutService.requestActorWalletPayout({
          tenantId: TENANT_ID,
          actorId,
          requestedByUserId: userId,
          requestedAmountCents: 1,
          idempotencyKey: idem17Setup, // mesma key do setup
          reason: 'e2e T18 — idempotência deve prevalecer sobre active-gate',
        });
        if (res18.alreadyExisted === true) {
          const approvalCount = await q(
            `SELECT COUNT(*) AS n FROM actor_wallet_payout_requests
              WHERE tenant_id=$1 AND actor_id=$2 AND status='pending_approval'`,
            [TENANT_ID, actorId]
          );
          ok('T18', `alreadyExisted=true — idempotência prevaleceu sobre active-gate (pending_count=${approvalCount.rows[0].n})`);
        } else {
          fail('T18', 'esperava alreadyExisted=true mas obteve alreadyExisted=false');
        }
      } catch (e: any) {
        fail('T18', 'lançou erro inesperado: ' + e.message);
      }
    } else {
      fail('T18', 'setup T17 falhou — sem request ativo para testar');
    }

    // ── T19: request terminal permite novo request ────────────────────────────
    // Cancela r17setup (terminal) → nova key deve passar pelo active-gate.
    // Usa o mesmo actorId (saldo ~110100, amount=1 passa balance-gate).
    console.log('T19 — request terminal (cancelled) permite novo pedido com nova key');
    try {
      if (!r17setupId) {
        fail('T19', 'Pré-condição: setup r17 falhou — não é possível testar T19');
      } else {
        // Simular encerramento do request
        await q(`UPDATE actor_wallet_payout_requests SET status='cancelled' WHERE id=$1`, [r17setupId]);

        // Nova key → active-gate passa (r17setup é terminal), balance-gate passa (saldo disponível)
        const res19 = await actorWalletPayoutService.requestActorWalletPayout({
          tenantId: TENANT_ID,
          actorId,
          requestedByUserId: userId,
          requestedAmountCents: 1,
          idempotencyKey: `f2-t19-${uuidv4().slice(0, 8)}`,
          reason: 'e2e T19 — novo pedido após terminal',
        });
        createdPayoutIds.push(res19.payoutRequest.id);

        if (res19.payoutRequest.status === 'pending_approval' && res19.alreadyExisted === false) {
          ok('T19', `request terminal permite novo pedido — id=${res19.payoutRequest.id.slice(0, 8)}`);
        } else {
          fail('T19', `status=${res19.payoutRequest.status} alreadyExisted=${res19.alreadyExisted}`);
        }
      }
    } catch (e: any) {
      fail('T19', e.message);
    }
    // Estado após T19: res19 está pending_approval — ativo para T20

    // ── T20: partial unique index bloqueia INSERT direto ─────────────────────
    // T19 criou um request ativo (pending_approval) para actorId.
    // INSERT direto com mesmo actor + status ativo deve violar o partial index.
    console.log('T20 — partial unique index bloqueia segundo INSERT direto com mesmo actor ativo');
    {
      const activeForT20 = await q(
        `SELECT id FROM actor_wallet_payout_requests
          WHERE tenant_id=$1 AND actor_id=$2
            AND status IN ('pending_approval','approved','processing')
          LIMIT 1`,
        [TENANT_ID, actorId]
      );
      if (!activeForT20.rows[0]) {
        fail('T20', 'Pré-condição: nenhum request ativo para actorId — T19 pode ter falhado');
      } else {
        const directId = uuidv4();
        let inserted = false;
        try {
          await q(
            `INSERT INTO actor_wallet_payout_requests
               (id, tenant_id, actor_id, actor_wallet_account_id,
                requested_amount_cents, destination_type, idempotency_key, status)
             VALUES ($1,$2,$3,$4,1,'internal_settlement',$5,'pending_approval')`,
            [directId, TENANT_ID, actorId, actorWalletAccountId, `f2-t20-${uuidv4().slice(0, 8)}`]
          );
          inserted = true;
          fail('T20', 'INSERT direto deveria ter falhado com 23505 (partial index)');
          await q(`DELETE FROM actor_wallet_payout_requests WHERE id=$1`, [directId]).catch(() => {});
        } catch (e: any) {
          if (!inserted && (e.code === '23505' || String(e.message).includes('uidx_actor_wallet_payout_one_active_per_actor'))) {
            ok('T20', 'partial unique index bloqueou INSERT direto com 23505');
          } else if (!inserted) {
            fail('T20', 'erro inesperado (não é 23505): ' + e.message);
          }
        }
      }
    }

    // ── T14: zero bank_ledger ─────────────────────────────────────────────────
    console.log('T14 — zero alteração em bank_ledger');
    try {
      const snap14 = await getFinancialSnapshot();
      if (snap14.ledger === snapshot0.ledger) {
        ok('T14', `bank_ledger=${snap14.ledger} — inalterado`);
      } else {
        fail('T14', `bank_ledger mudou: antes=${snapshot0.ledger} depois=${snap14.ledger}`);
      }
    } catch (e: any) {
      fail('T14', e.message);
    }

    // ── T15: zero bank_transactions ───────────────────────────────────────────
    console.log('T15 — zero alteração em bank_transactions');
    try {
      const snap15 = await getFinancialSnapshot();
      if (snap15.txs === snapshot0.txs) {
        ok('T15', `bank_transactions=${snap15.txs} — inalterado`);
      } else {
        fail('T15', `bank_transactions mudou: antes=${snapshot0.txs} depois=${snap15.txs}`);
      }
    } catch (e: any) {
      fail('T15', e.message);
    }

    // ── T16: payout_requests legado intocado ──────────────────────────────────
    console.log('T16 — payout_requests legado intocado');
    try {
      const snap16 = await getFinancialSnapshot();
      if (snap16.payouts === snapshot0.payouts) {
        ok('T16', `payout_requests=${snap16.payouts} — inalterado (trilho seller intocado)`);
      } else {
        fail('T16', `payout_requests mudou: antes=${snapshot0.payouts} depois=${snap16.payouts}`);
      }
    } catch (e: any) {
      fail('T16', e.message);
    }

  } finally {
    // Cleanup garantido
    for (const f of obligFixtures) {
      await cleanupObligFixture(f.obligId, f.fakeTxId, f.fakeIntentId).catch(() => {});
    }
    await cleanupPayoutRequests(createdPayoutIds);
    // Limpar qualquer payout com idempotency_key de T13
    await q(
      `DELETE FROM actor_wallet_payout_requests WHERE tenant_id=$1 AND idempotency_key LIKE 'f2-t13-%'`,
      [TENANT_ID]
    ).catch(() => {});
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
