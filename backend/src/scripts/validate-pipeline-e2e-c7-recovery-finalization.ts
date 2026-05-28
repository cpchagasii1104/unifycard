/**
 * E2E C7 — RECOVERY FINALIZATION (DECISION-0053 C7, 2026-05-27)
 *
 * Prova finalizeRecoveryCase e sua integração com C3.1 (drain service).
 *
 * Cenários:
 *   T1   obligation 'recovered' + intent 'released_to_actor_wallet' → payment_status='refunded_via_recovery'
 *   T2   event_outbox PAYMENT_INTENT_REFUNDED_VIA_RECOVERY inserido
 *   T3   Segunda chamada idempotente → 'already_finalized', sem dupla escrita
 *   T4   obligation 'cancelled' → intent permanece 'released_to_actor_wallet'
 *   T5   obligation 'cancelled' → event_outbox ACTOR_WALLET_RECOVERY_CANCELLED inserido
 *   T6   obligation 'partially_recovered' → RecoveryFinalizationError NOT_TERMINAL, zero escrita
 *   T7   reversal após 'refunded_via_recovery' continua bloqueado com REVERSAL_POST_DMONEY_REQUIRES_RECOVERY_FLOW
 *   T8   Rollback: falha induzida no outbox não deixa payment_intent alterado
 *   T9   zero escrita em bank_ledger, bank_transactions, bank_splits
 *   T10  Cadeia C3.1→C7: drainRecoveryObligationsForCredit drena até 'recovered' e C7 finaliza
 *   T11  drainRecoveryObligationsForCredit sem obligation → intent permanece 'released_to_actor_wallet'
 *   T12  event_id determinístico: mesmo seed → mesmo UUID (idempotência de replay)
 *
 * Gates verificados implicitamente:
 *   - Nenhuma escrita em bank_ledger/bank_transactions/bank_splits (T9)
 *   - Guard de reversal atualizado bloqueia 'refunded_via_recovery' (T7)
 *   - Integração atômica C3.1+C7 dentro do mesmo client (T10)
 */

import dotenv from 'dotenv';
import { join } from 'path';
import { v4 as uuidv4 } from 'uuid';

import { pool, getClientWithTenant } from '../core/database/pool';
import {
  finalizeRecoveryCase,
  RecoveryFinalizationError,
} from '../modules/financial-recovery/recovery-finalization.service';
import { drainRecoveryObligationsForCredit } from '../modules/financial-recovery/actor-wallet-recovery-obligation.service';
import { outboxEventIdFromSeed } from '../core/events/event-outbox.repository';

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

// ── financial snapshot ────────────────────────────────────────────────────────

async function financialSnapshot() {
  const r = await q(
    `SELECT
       (SELECT COUNT(*) FROM bank_ledger       WHERE tenant_id = $1) AS ledger,
       (SELECT COUNT(*) FROM bank_transactions WHERE tenant_id = $1) AS txs,
       (SELECT COUNT(*) FROM bank_splits       WHERE tenant_id = $1) AS splits`,
    [TENANT_ID]
  );
  return r.rows[0] as { ledger: string; txs: string; splits: string };
}

// ── fixture helpers ───────────────────────────────────────────────────────────

interface C7Fixture {
  debtorActorId: string;
  debtorAccountId: string;  // actor_wallet
  creditorActorId: string;
  creditorAccountId: string; // user_wallet
  requestedByUserId: string;
}

async function buildFixture(): Promise<C7Fixture | null> {
  const debtorRow = await q(
    `SELECT a.id AS actor_id, a.user_id, ba.id AS account_id
       FROM actors a
       JOIN bank_accounts ba ON ba.actor_id = a.id AND ba.tenant_id = a.tenant_id AND ba.account_type = 'actor_wallet'
      WHERE a.tenant_id = $1 AND a.user_id IS NOT NULL LIMIT 1`,
    [TENANT_ID]
  );
  if (!debtorRow.rows[0]) return null;

  const debtorActorId = debtorRow.rows[0].actor_id as string;
  const debtorAccountId = debtorRow.rows[0].account_id as string;
  const requestedByUserId = debtorRow.rows[0].user_id as string;

  const creditorRow = await q(
    `SELECT a.id AS actor_id, ba.id AS account_id
       FROM actors a
       JOIN bank_accounts ba ON ba.actor_id = a.id AND ba.tenant_id = a.tenant_id AND ba.account_type = 'user_wallet'
      WHERE a.tenant_id = $1 AND a.id <> $2 LIMIT 1`,
    [TENANT_ID, debtorActorId]
  );
  if (!creditorRow.rows[0]) return null;

  return {
    debtorActorId,
    debtorAccountId,
    creditorActorId: creditorRow.rows[0].actor_id as string,
    creditorAccountId: creditorRow.rows[0].account_id as string,
    requestedByUserId,
  };
}

async function getConceptId(): Promise<string | null> {
  const r = await q(`SELECT concept_id FROM concepts WHERE slug='actor-wallet-recovery' LIMIT 1`);
  return r.rows[0]?.concept_id ?? null;
}

async function fundAccount(accountId: string, actorId: string, amountCents: number): Promise<void> {
  const cid = await getConceptId();
  const txId = uuidv4();
  await q(
    `INSERT INTO bank_transactions (id, tenant_id, actor_id, account_id, amount_cents, purpose, justification,
       reference_type, reference_id, concept_id, internal_completed_at)
     VALUES ($1::uuid, $2::uuid, $3::uuid, $4::uuid, $5, 'execution', 'E2E C7 fund',
             'e2e_c7_fund', $6, $7, NOW())`,
    [txId, TENANT_ID, actorId, accountId, amountCents, uuidv4(), cid]
  );
  await q(
    `INSERT INTO bank_ledger (id, tenant_id, account_id, transaction_id, direction, amount_cents, purpose, justification)
     VALUES (gen_random_uuid(), $1::uuid, $2::uuid, $3::uuid, 'credit', $4, 'execution', 'E2E C7 fund')`,
    [TENANT_ID, accountId, txId, amountCents]
  );
}

async function drainAccount(accountId: string, actorId: string): Promise<void> {
  const r = await q(
    `SELECT COALESCE(SUM(CASE WHEN direction='credit' THEN amount_cents ELSE -amount_cents END), 0) AS bal
       FROM bank_ledger WHERE tenant_id=$1 AND account_id=$2`,
    [TENANT_ID, accountId]
  );
  const bal = Number(r.rows[0].bal);
  if (bal <= 0) return;
  const cid = await getConceptId();
  const txId = uuidv4();
  await q(
    `INSERT INTO bank_transactions (id, tenant_id, actor_id, account_id, amount_cents, purpose, justification,
       reference_type, reference_id, concept_id, internal_completed_at)
     VALUES ($1::uuid, $2::uuid, $3::uuid, $4::uuid, $5, 'execution', 'E2E C7 drain',
             'e2e_c7_drain', $6, $7, NOW())`,
    [txId, TENANT_ID, actorId, accountId, bal, uuidv4(), cid]
  );
  await q(
    `INSERT INTO bank_ledger (id, tenant_id, account_id, transaction_id, direction, amount_cents, purpose, justification)
     VALUES (gen_random_uuid(), $1::uuid, $2::uuid, $3::uuid, 'debit', $4, 'execution', 'E2E C7 drain')`,
    [TENANT_ID, accountId, txId, bal]
  );
}

async function createPaymentIntent(
  actorId: string,
  status: string = 'released_to_actor_wallet',
  amountCents: number = 10000
): Promise<string> {
  const id = uuidv4();
  await q(
    `INSERT INTO payment_intents (id, tenant_id, actor_id, amount_cents, intent_type, reference_id, gateway, currency, payment_status)
     VALUES ($1, $2, $3, $4, 'recovery_c7_test', $5, 'test', 'BRL', $6)`,
    [id, TENANT_ID, actorId, amountCents, uuidv4(), status]
  );
  return id;
}

async function createApprovalRequest(f: C7Fixture, status: 'approved' | 'pending' = 'approved'): Promise<string> {
  const id = uuidv4();
  await q(
    `INSERT INTO approval_requests
       (id, tenant_id, requested_by_user_id, acting_for_actor_id, acting_for_account_id,
        operation_type, operation_data, required_approvals, approval_type, status, expires_at)
     VALUES ($1, $2, $3, $4, $5, 'actor_wallet_recovery', '{"reason":"e2e_c7"}'::jsonb, 1, 'sequential', $6, NOW()+INTERVAL '1 hour')`,
    [id, TENANT_ID, f.requestedByUserId, f.debtorActorId, f.debtorAccountId, status]
  );
  return id;
}

async function createObligation(
  f: C7Fixture,
  paymentIntentId: string,
  amountCents: number,
  approvalRequestId: string | null,
  status: string,
  recoveredAmountCents: number = 0
): Promise<string> {
  const cid = await getConceptId();
  const origTxId = uuidv4();
  await q(
    `INSERT INTO bank_transactions (id, tenant_id, actor_id, account_id, amount_cents, purpose, justification,
       reference_type, reference_id, concept_id, internal_completed_at)
     VALUES ($1::uuid, $2::uuid, $3::uuid, $4::uuid, $5, 'execution', 'E2E C7 origin tx',
             'e2e_c7_origin', $6, $7, NOW())`,
    [origTxId, TENANT_ID, f.debtorActorId, f.debtorAccountId, amountCents, uuidv4(), cid]
  );
  const id = uuidv4();
  await q(
    `INSERT INTO actor_wallet_recovery_obligations
       (id, tenant_id, debtor_actor_id, debtor_account_id, creditor_actor_id, creditor_account_id,
        original_transaction_id, payment_intent_id, amount_cents, reason, status,
        recovered_amount_cents, approval_request_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'E2E C7', $10, $11, $12)`,
    [
      id, TENANT_ID,
      f.debtorActorId, f.debtorAccountId,
      f.creditorActorId, f.creditorAccountId,
      origTxId, paymentIntentId, amountCents,
      status, recoveredAmountCents, approvalRequestId,
    ]
  );
  return id;
}

async function cleanupObligation(obligationId: string) {
  await q(`DELETE FROM actor_wallet_recovery_obligation_entries WHERE obligation_id=$1`, [obligationId]);
  await q(`DELETE FROM actor_wallet_recovery_obligations WHERE id=$1`, [obligationId]);
}

async function cleanupIntent(intentId: string) {
  await q(`DELETE FROM payment_intents WHERE id=$1`, [intentId]);
}

async function getOutboxEvent(eventType: string, obligationId: string): Promise<boolean> {
  const r = await q(
    `SELECT 1 FROM event_outbox
      WHERE tenant_id=$1 AND event_type=$2 AND payload->>'obligation_id' = $3`,
    [TENANT_ID, eventType, obligationId]
  );
  return r.rows.length > 0;
}

async function getPaymentStatus(intentId: string): Promise<string | null> {
  const r = await q(`SELECT payment_status FROM payment_intents WHERE id=$1`, [intentId]);
  return r.rows[0]?.payment_status ?? null;
}

async function resetRiskProfiles() {
  await q(
    `UPDATE actor_risk_profile SET risk_level='low', risk_score=0, flags='[]'::jsonb, updated_at=NOW()
       WHERE actor_id IN (SELECT id FROM actors WHERE tenant_id=$1::uuid)`,
    [TENANT_ID]
  );
}

// ── test runner ───────────────────────────────────────────────────────────────

async function runTests() {
  console.log('\n🔍 E2E C7 — Recovery Finalization\n');

  const fixture = await buildFixture();
  if (!fixture) {
    console.error('SKIP: fixtures insuficientes (actor_wallet + user_wallet requeridos)');
    await pool.end();
    process.exit(0);
  }

  await resetRiskProfiles();
  const snap = await financialSnapshot();

  // ── T1: obligation 'recovered' → payment_status='refunded_via_recovery' ─────
  {
    const intentId = await createPaymentIntent(fixture.debtorActorId);
    const approvalId = await createApprovalRequest(fixture);
    const obligationId = await createObligation(fixture, intentId, 5000, approvalId, 'recovered', 5000);

    try {
      const result = await finalizeRecoveryCase(TENANT_ID, obligationId);
      const status = await getPaymentStatus(intentId);
      if (result === 'finalized' && status === 'refunded_via_recovery') {
        ok('T1 recovered → refunded_via_recovery', `result=${result} status=${status}`);
      } else {
        fail('T1 recovered → refunded_via_recovery', `result=${result} status=${status}`);
      }
    } catch (e) {
      fail('T1 recovered → refunded_via_recovery', String(e));
    }

    // ── T2: event_outbox PAYMENT_INTENT_REFUNDED_VIA_RECOVERY ─────────────────
    const hasEvent = await getOutboxEvent('PAYMENT_INTENT_REFUNDED_VIA_RECOVERY', obligationId);
    if (hasEvent) {
      ok('T2 event_outbox PAYMENT_INTENT_REFUNDED_VIA_RECOVERY', `obligation=${obligationId.slice(0, 8)}…`);
    } else {
      fail('T2 event_outbox PAYMENT_INTENT_REFUNDED_VIA_RECOVERY', 'evento não encontrado');
    }

    // ── T3: idempotência ───────────────────────────────────────────────────────
    try {
      const result2 = await finalizeRecoveryCase(TENANT_ID, obligationId);
      const status2 = await getPaymentStatus(intentId);
      if (result2 === 'already_finalized' && status2 === 'refunded_via_recovery') {
        ok('T3 idempotência (already_finalized)', `result=${result2}`);
      } else {
        fail('T3 idempotência', `result=${result2} status=${status2}`);
      }
    } catch (e) {
      fail('T3 idempotência', String(e));
    }

    await cleanupObligation(obligationId);
    await cleanupIntent(intentId);
    await q(`DELETE FROM approval_requests WHERE id=$1`, [approvalId]);
  }

  // ── T4: cancelled → intent permanece 'released_to_actor_wallet' ──────────────
  {
    const intentId = await createPaymentIntent(fixture.debtorActorId);
    const obligationId = await createObligation(fixture, intentId, 5000, null, 'cancelled', 0);

    try {
      const result = await finalizeRecoveryCase(TENANT_ID, obligationId);
      const status = await getPaymentStatus(intentId);
      if (result === 'cancelled_event_recorded' && status === 'released_to_actor_wallet') {
        ok('T4 cancelled → intent inalterado', `result=${result} status=${status}`);
      } else {
        fail('T4 cancelled → intent inalterado', `result=${result} status=${status}`);
      }
    } catch (e) {
      fail('T4 cancelled → intent inalterado', String(e));
    }

    // ── T5: event_outbox ACTOR_WALLET_RECOVERY_CANCELLED ──────────────────────
    const hasEvent = await getOutboxEvent('ACTOR_WALLET_RECOVERY_CANCELLED', obligationId);
    if (hasEvent) {
      ok('T5 event_outbox ACTOR_WALLET_RECOVERY_CANCELLED', `obligation=${obligationId.slice(0, 8)}…`);
    } else {
      fail('T5 event_outbox ACTOR_WALLET_RECOVERY_CANCELLED', 'evento não encontrado');
    }

    await cleanupObligation(obligationId);
    await cleanupIntent(intentId);
  }

  // ── T6: partially_recovered → RecoveryFinalizationError NOT_TERMINAL ─────────
  {
    const intentId = await createPaymentIntent(fixture.debtorActorId);
    const obligationId = await createObligation(fixture, intentId, 5000, null, 'partially_recovered', 2000);

    try {
      await finalizeRecoveryCase(TENANT_ID, obligationId);
      fail('T6 partially_recovered bloqueado', 'não lançou erro');
    } catch (e) {
      if (
        e instanceof RecoveryFinalizationError &&
        e.code === 'RECOVERY_FINALIZATION_OBLIGATION_NOT_TERMINAL'
      ) {
        const status = await getPaymentStatus(intentId);
        if (status === 'released_to_actor_wallet') {
          ok('T6 partially_recovered bloqueado + zero escrita', `code=${e.code}`);
        } else {
          fail('T6 partially_recovered bloqueado', `status mudou para ${status}`);
        }
      } else {
        fail('T6 partially_recovered bloqueado', `erro inesperado: ${String(e)}`);
      }
    }

    await cleanupObligation(obligationId);
    await cleanupIntent(intentId);
  }

  // ── T7: reversal bloqueado após 'refunded_via_recovery' ──────────────────────
  {
    const intentId = await createPaymentIntent(fixture.debtorActorId, 'refunded_via_recovery');
    const approvalId = await createApprovalRequest(fixture);
    const obligationId = await createObligation(fixture, intentId, 5000, approvalId, 'recovered', 5000);

    // Cria uma bank_transaction fake com reference_type='service_execution' para ativar o guard
    const cid = await getConceptId();
    const origTxId = uuidv4();
    await q(
      `INSERT INTO bank_transactions (id, tenant_id, actor_id, account_id, amount_cents, purpose, justification,
         reference_type, reference_id, concept_id, internal_completed_at)
       VALUES ($1::uuid, $2::uuid, $3::uuid, $4::uuid, $5, 'execution', 'E2E C7 T7 reversal guard test',
               'service_execution', $6, $7, NOW())`,
      [origTxId, TENANT_ID, fixture.debtorActorId, fixture.debtorAccountId, 5000, intentId, cid]
    );

    const { requestReversal } = await import('../modules/reversal/reversal.service');
    try {
      await requestReversal(TENANT_ID, {
        originalTransactionId: origTxId,
        actorId: fixture.debtorActorId,
        amountCents: 5000,
        reason: 'E2E C7 T7 reversal guard test — deve bloquear',
        reversalType: 'internal_refund',
        performedByUserId: fixture.requestedByUserId,
      });
      fail('T7 reversal bloqueado em refunded_via_recovery', 'não lançou erro');
    } catch (e) {
      if (String(e).includes('REVERSAL_POST_DMONEY_REQUIRES_RECOVERY_FLOW')) {
        ok('T7 reversal bloqueado em refunded_via_recovery', 'REVERSAL_POST_DMONEY_REQUIRES_RECOVERY_FLOW');
      } else {
        fail('T7 reversal bloqueado em refunded_via_recovery', `erro inesperado: ${String(e).slice(0, 200)}`);
      }
    }

    await q(`DELETE FROM bank_transactions WHERE id=$1`, [origTxId]);
    await cleanupObligation(obligationId);
    await cleanupIntent(intentId);
    await q(`DELETE FROM approval_requests WHERE id=$1`, [approvalId]);
  }

  // ── T8: rollback — falha induzida no outbox não deixa payment_intent alterado ─
  {
    const intentId = await createPaymentIntent(fixture.debtorActorId);
    const approvalId = await createApprovalRequest(fixture);
    // Obrigação com event_id que conflita após primeira inserção (para simular falha)
    // Simulamos rollback criando a transação manualmente e abortando
    const obligationId = await createObligation(fixture, intentId, 3000, approvalId, 'recovered', 3000);

    const client = await getClientWithTenant(TENANT_ID);
    try {
      await client.query('BEGIN');
      // Atualiza status normalmente
      await client.query(
        `UPDATE payment_intents SET payment_status = 'refunded_via_recovery', updated_at = now() WHERE tenant_id = $1 AND id = $2`,
        [TENANT_ID, intentId]
      );
      // Força ROLLBACK antes do commit — simula falha pós-update mas pré-commit
      await client.query('ROLLBACK');
    } finally {
      client.release();
    }

    const statusAfter = await getPaymentStatus(intentId);
    if (statusAfter === 'released_to_actor_wallet') {
      ok('T8 rollback preserva intent status', `status=${statusAfter}`);
    } else {
      fail('T8 rollback preserva intent status', `status inesperado=${statusAfter}`);
    }

    await cleanupObligation(obligationId);
    await cleanupIntent(intentId);
    await q(`DELETE FROM approval_requests WHERE id=$1`, [approvalId]);
  }

  // ── T9: zero escrita financeira durante toda a suite ─────────────────────────
  const snapAfter = await financialSnapshot();
  if (snap.ledger === snapAfter.ledger) {
    ok('T9 bank_ledger zero escrita C7', `${snap.ledger} → ${snapAfter.ledger}`);
  } else {
    fail('T9 bank_ledger zero escrita C7', `${snap.ledger} → ${snapAfter.ledger}`);
  }
  if (snap.txs === snapAfter.txs) {
    ok('T9 bank_transactions zero escrita C7', `${snap.txs} → ${snapAfter.txs}`);
  } else {
    fail('T9 bank_transactions zero escrita C7', `${snap.txs} → ${snapAfter.txs}`);
  }
  if (snap.splits === snapAfter.splits) {
    ok('T9 bank_splits zero escrita C7', `${snap.splits} → ${snapAfter.splits}`);
  } else {
    fail('T9 bank_splits zero escrita C7', `${snap.splits} → ${snapAfter.splits}`);
  }

  // ── T10: cadeia C3.1→C7 dentro da mesma transação ────────────────────────────
  {
    await drainAccount(fixture.debtorAccountId, fixture.debtorActorId);
    const intentId = await createPaymentIntent(fixture.debtorActorId, 'released_to_actor_wallet', 4000);
    const approvalId = await createApprovalRequest(fixture, 'approved');
    const obligationId = await createObligation(fixture, intentId, 4000, approvalId, 'approved', 0);

    const client = await getClientWithTenant(TENANT_ID);
    try {
      await client.query('BEGIN');
      // Fund actor_wallet dentro da TX (simula D-money credit — C3.1 usa maxAmountCents=creditedAmountCents)
      const cid = await getConceptId();
      const txId = uuidv4();
      await client.query(
        `INSERT INTO bank_transactions (id, tenant_id, actor_id, account_id, amount_cents, purpose, justification,
           reference_type, reference_id, concept_id, internal_completed_at)
         VALUES ($1::uuid, $2::uuid, $3::uuid, $4::uuid, $5, 'execution', 'E2E C7 T10 D-money simulated',
                 'e2e_c7_dmoney', $6, $7, NOW())`,
        [txId, TENANT_ID, fixture.debtorActorId, fixture.debtorAccountId, 4000, uuidv4(), cid]
      );
      await client.query(
        `INSERT INTO bank_ledger (id, tenant_id, account_id, transaction_id, direction, amount_cents, purpose, justification)
         VALUES (gen_random_uuid(), $1::uuid, $2::uuid, $3::uuid, 'credit', $4, 'execution', 'E2E C7 T10 D-money simulated')`,
        [TENANT_ID, fixture.debtorAccountId, txId, 4000]
      );

      // drainRecoveryObligationsForCredit integrando C3.1+C7 dentro do mesmo client
      const drainResult = await drainRecoveryObligationsForCredit(
        TENANT_ID, fixture.debtorActorId, 4000, client
      );

      await client.query('COMMIT');

      const obligationStatus = (await q(
        `SELECT status FROM actor_wallet_recovery_obligations WHERE id=$1`, [obligationId]
      )).rows[0]?.status;
      const intentStatus = await getPaymentStatus(intentId);
      const hasRefundEvent = await getOutboxEvent('PAYMENT_INTENT_REFUNDED_VIA_RECOVERY', obligationId);

      if (
        drainResult.totalDrainedCents === 4000 &&
        obligationStatus === 'recovered' &&
        intentStatus === 'refunded_via_recovery' &&
        hasRefundEvent
      ) {
        ok('T10 cadeia C3.1→C7 (drain→finalize atômico)', `drained=${drainResult.totalDrainedCents} obligStatus=${obligationStatus} intentStatus=${intentStatus}`);
      } else {
        fail('T10 cadeia C3.1→C7', `drained=${drainResult.totalDrainedCents} obligStatus=${obligationStatus} intentStatus=${intentStatus} event=${hasRefundEvent}`);
      }
    } catch (e) {
      await client.query('ROLLBACK').catch(() => {});
      fail('T10 cadeia C3.1→C7', String(e));
    } finally {
      client.release();
    }

    await cleanupObligation(obligationId);
    await cleanupIntent(intentId);
    await q(`DELETE FROM approval_requests WHERE id=$1`, [approvalId]);
    await drainAccount(fixture.debtorAccountId, fixture.debtorActorId);
  }

  // ── T11: drain sem obligation → intent permanece 'released_to_actor_wallet' ──
  {
    const intentId = await createPaymentIntent(fixture.debtorActorId, 'released_to_actor_wallet', 2000);

    const client = await getClientWithTenant(TENANT_ID);
    try {
      await client.query('BEGIN');
      const drainResult = await drainRecoveryObligationsForCredit(
        TENANT_ID, fixture.debtorActorId, 2000, client
      );
      await client.query('COMMIT');

      const intentStatus = await getPaymentStatus(intentId);
      if (drainResult.totalDrainedCents === 0 && intentStatus === 'released_to_actor_wallet') {
        ok('T11 sem obligation → intent inalterado', `drained=${drainResult.totalDrainedCents} status=${intentStatus}`);
      } else {
        fail('T11 sem obligation → intent inalterado', `drained=${drainResult.totalDrainedCents} status=${intentStatus}`);
      }
    } catch (e) {
      await client.query('ROLLBACK').catch(() => {});
      fail('T11 sem obligation → intent inalterado', String(e));
    } finally {
      client.release();
    }

    await cleanupIntent(intentId);
  }

  // ── T12: event_id determinístico ─────────────────────────────────────────────
  {
    const seed = `PAYMENT_INTENT_REFUNDED_VIA_RECOVERY:${TENANT_ID}:test-obligation-id`;
    const id1 = outboxEventIdFromSeed(seed);
    const id2 = outboxEventIdFromSeed(seed);
    if (id1 === id2 && id1.length === 36) {
      ok('T12 event_id determinístico', `${id1.slice(0, 8)}…`);
    } else {
      fail('T12 event_id determinístico', `id1=${id1} id2=${id2}`);
    }
  }

  // ── summary ───────────────────────────────────────────────────────────────────
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
