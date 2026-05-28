/**
 * E2E C3.1 — drainRecoveryObligationsForCredit (DECISION-0055 D3, 2026-05-27)
 *
 * Income withholding síncrono: drena obligations ativas quando actor_wallet recebe D-money.
 *
 * Cenários:
 *   T1  D-money R$100 + obligation R$80 approved → drain R$80, residual R$20, recovered
 *   T2  D-money R$50 + obligation R$80 approved → drain R$50, residual R$0, partially_recovered
 *   T3  D-money R$30 + obligation parcial (faltando R$30) → drain R$30, recovered
 *   T4  Sem obligation ativa → drain R$0, residual = creditedAmount
 *   T5  Múltiplas obligations → FIFO por created_at
 *   T6  obligation pending_approval → não drena
 *   T7  obligation cancelled → não drena
 *   T8  Actor sem obligations (simula split regional/fee) → drain R$0
 *   T9  Saldo antigo R$100 + crédito R$50; obligation R$200 → drain só R$50 (não R$150)
 *   T10 Rollback: drain dentro de transação ROLLBACK → sem bank_transactions ou entries
 *   T11 Ledger double-entry preservado (Σdéb = Σcréd por transação)
 *   T12 Entries somam recovered_amount_cents
 *   T13 Source é actor_wallet (não escrow, risk_reserve, platform_fees, regional_fund)
 */

import dotenv from 'dotenv';
import { join } from 'path';
import { v4 as uuidv4 } from 'uuid';

import { pool, getClientWithTenant } from '../core/database/pool';
import { bankAccountService } from '../modules/bank/bank-account.service';
import { drainRecoveryObligationsForCredit } from '../modules/financial-recovery/actor-wallet-recovery-obligation.service';

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

async function getBalance(accountId: string): Promise<number> {
  const r = await q(
    `SELECT COALESCE(SUM(CASE WHEN direction='credit' THEN amount_cents ELSE -amount_cents END), 0) AS bal
       FROM bank_ledger WHERE tenant_id=$1 AND account_id=$2`,
    [TENANT_ID, accountId]
  );
  return Number(r.rows[0].bal);
}

async function bankTxCount(): Promise<number> {
  const r = await q(`SELECT COUNT(*) AS c FROM bank_transactions WHERE tenant_id=$1`, [TENANT_ID]);
  return Number(r.rows[0].c);
}

async function resetRiskProfiles() {
  await q(
    `UPDATE actor_risk_profile SET risk_level='low', risk_score=0, flags='[]'::jsonb, updated_at=NOW()
       WHERE actor_id IN (SELECT id FROM actors WHERE tenant_id=$1::uuid)`,
    [TENANT_ID]
  );
}

// ── fixture helpers ───────────────────────────────────────────────────────────

interface Fixture {
  debtorActorId: string;
  debtorAccountId: string; // actor_wallet
  creditorActorId: string;
  creditorAccountId: string; // user_wallet
  requestedByUserId: string;
}

async function buildFixture(): Promise<Fixture | null> {
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
     VALUES ($1::uuid, $2::uuid, $3::uuid, $4::uuid, $5, 'execution', 'E2E C3.1 fund',
             'e2e_c31_fund', $6, $7, NOW())`,
    [txId, TENANT_ID, actorId, accountId, amountCents, uuidv4(), cid]
  );
  await q(
    `INSERT INTO bank_ledger (id, tenant_id, account_id, transaction_id, direction, amount_cents, purpose, justification)
     VALUES (gen_random_uuid(), $1::uuid, $2::uuid, $3::uuid, 'credit', $4, 'execution', 'E2E C3.1 fund')`,
    [TENANT_ID, accountId, txId, amountCents]
  );
}

async function drainAccount(accountId: string, actorId: string): Promise<void> {
  const bal = await getBalance(accountId);
  if (bal <= 0) return;
  const cid = await getConceptId();
  const txId = uuidv4();
  await q(
    `INSERT INTO bank_transactions (id, tenant_id, actor_id, account_id, amount_cents, purpose, justification,
       reference_type, reference_id, concept_id, internal_completed_at)
     VALUES ($1::uuid, $2::uuid, $3::uuid, $4::uuid, $5, 'execution', 'E2E C3.1 drain reset',
             'e2e_c31_drain', $6, $7, NOW())`,
    [txId, TENANT_ID, actorId, accountId, bal, uuidv4(), cid]
  );
  await q(
    `INSERT INTO bank_ledger (id, tenant_id, account_id, transaction_id, direction, amount_cents, purpose, justification)
     VALUES (gen_random_uuid(), $1::uuid, $2::uuid, $3::uuid, 'debit', $4, 'execution', 'E2E C3.1 drain reset')`,
    [TENANT_ID, accountId, txId, bal]
  );
}

async function createApprovalRequest(f: Fixture, status: 'approved' | 'pending' | 'rejected'): Promise<string> {
  const id = uuidv4();
  await q(
    `INSERT INTO approval_requests
       (id, tenant_id, requested_by_user_id, acting_for_actor_id, acting_for_account_id,
        operation_type, operation_data, required_approvals, approval_type, status, expires_at)
     VALUES ($1, $2, $3, $4, $5, 'actor_wallet_recovery', '{"reason":"e2e_c31"}'::jsonb, 1, 'sequential', $6, NOW()+INTERVAL '1 hour')`,
    [id, TENANT_ID, f.requestedByUserId, f.debtorActorId, f.debtorAccountId, status]
  );
  return id;
}

async function createObligationRow(
  f: Fixture,
  amountCents: number,
  approvalRequestId: string | null,
  status: string = 'approved',
  recoveredAmountCents: number = 0
): Promise<string> {
  const cid = await getConceptId();
  const origTxId = uuidv4();
  await q(
    `INSERT INTO bank_transactions (id, tenant_id, actor_id, account_id, amount_cents, purpose, justification,
       reference_type, reference_id, concept_id, internal_completed_at)
     VALUES ($1::uuid, $2::uuid, $3::uuid, $4::uuid, $5, 'execution', 'E2E C3.1 origin tx',
             'e2e_c31_origin', $6, $7, NOW())`,
    [origTxId, TENANT_ID, f.debtorActorId, f.debtorAccountId, amountCents, uuidv4(), cid]
  );
  const intentId = uuidv4();
  await q(
    `INSERT INTO payment_intents (id, tenant_id, actor_id, amount_cents, intent_type, reference_id, gateway, currency)
     VALUES ($1, $2, $3, $4, 'recovery_test', $5, 'test', 'BRL')`,
    [intentId, TENANT_ID, f.debtorActorId, amountCents, uuidv4()]
  );
  const obligationId = uuidv4();
  await q(
    `INSERT INTO actor_wallet_recovery_obligations
       (id, tenant_id, debtor_actor_id, debtor_account_id, creditor_actor_id, creditor_account_id,
        original_transaction_id, payment_intent_id, amount_cents, reason, status,
        recovered_amount_cents, approval_request_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'E2E C3.1', $10, $11, $12)`,
    [
      obligationId, TENANT_ID,
      f.debtorActorId, f.debtorAccountId,
      f.creditorActorId, f.creditorAccountId,
      origTxId, intentId, amountCents,
      status, recoveredAmountCents, approvalRequestId,
    ]
  );
  return obligationId;
}

async function cleanupObligation(obligationId: string) {
  await q(`DELETE FROM actor_wallet_recovery_obligation_entries WHERE obligation_id=$1`, [obligationId]);
  await q(`DELETE FROM actor_wallet_recovery_obligations WHERE id=$1`, [obligationId]);
}

async function systemAccountsSnapshot() {
  const r = await q(
    `SELECT
       COALESCE(SUM(CASE WHEN direction='credit' THEN l.amount_cents ELSE 0 END), 0) AS credit_sum,
       COALESCE(SUM(CASE WHEN direction='debit'  THEN l.amount_cents ELSE 0 END), 0) AS debit_sum
     FROM bank_ledger l
     JOIN bank_accounts ba ON ba.id = l.account_id
     WHERE l.tenant_id=$1
       AND ba.account_type IN ('escrow_payments','risk_reserve','platform_fees','regional_fund')`,
    [TENANT_ID]
  );
  return r.rows[0] as { credit_sum: string; debit_sum: string };
}

// ── test runner ───────────────────────────────────────────────────────────────

async function runTests() {
  console.log('\n🔍 E2E C3.1 — drainRecoveryObligationsForCredit\n');

  const fixture = await buildFixture();
  if (!fixture) {
    console.error('SKIP: fixtures insuficientes');
    await pool.end();
    process.exit(0);
  }

  await resetRiskProfiles();
  const sysBefore = await systemAccountsSnapshot();

  try {
    // ── T1: D-money R$100 + obligation R$80 → drain R$80, residual R$20, recovered ──
    {
      await drainAccount(fixture.debtorAccountId, fixture.debtorActorId);
      await fundAccount(fixture.debtorAccountId, fixture.debtorActorId, 100_00);
      const approvalId = await createApprovalRequest(fixture, 'approved');
      const obligationId = await createObligationRow(fixture, 80_00, approvalId);

      try {
        const client = await getClientWithTenant(TENANT_ID);
        let result;
        try {
          await client.query('BEGIN');
          result = await drainRecoveryObligationsForCredit(TENANT_ID, fixture.debtorActorId, 100_00, client);
          await client.query('COMMIT');
        } catch (e) {
          await client.query('ROLLBACK').catch(() => {});
          throw e;
        } finally {
          client.release();
        }

        const obRow = await q(`SELECT status, recovered_amount_cents FROM actor_wallet_recovery_obligations WHERE id=$1`, [obligationId]);
        if (
          result.totalDrainedCents === 80_00 &&
          result.residualCreditCents === 20_00 &&
          result.obligationsTouched === 1 &&
          result.entriesCreated === 1 &&
          obRow.rows[0]?.status === 'recovered'
        ) {
          ok('T1 D-money 100 + obligation 80 → drain 80, residual 20, recovered',
            `drained=${result.totalDrainedCents} residual=${result.residualCreditCents}`);
        } else {
          fail('T1', `result=${JSON.stringify(result)} status=${obRow.rows[0]?.status}`);
        }
      } catch (e) {
        fail('T1', String(e));
      } finally {
        await cleanupObligation(obligationId);
        await q(`DELETE FROM approval_requests WHERE id=$1`, [approvalId]);
      }
    }

    // ── T2: D-money R$50 + obligation R$80 → drain R$50, partially_recovered ─────
    {
      await drainAccount(fixture.debtorAccountId, fixture.debtorActorId);
      await fundAccount(fixture.debtorAccountId, fixture.debtorActorId, 50_00);
      const approvalId = await createApprovalRequest(fixture, 'approved');
      const obligationId = await createObligationRow(fixture, 80_00, approvalId);

      try {
        const client = await getClientWithTenant(TENANT_ID);
        let result;
        try {
          await client.query('BEGIN');
          result = await drainRecoveryObligationsForCredit(TENANT_ID, fixture.debtorActorId, 50_00, client);
          await client.query('COMMIT');
        } catch (e) {
          await client.query('ROLLBACK').catch(() => {});
          throw e;
        } finally {
          client.release();
        }

        const obRow = await q(`SELECT status, recovered_amount_cents FROM actor_wallet_recovery_obligations WHERE id=$1`, [obligationId]);
        if (
          result.totalDrainedCents === 50_00 &&
          result.residualCreditCents === 0 &&
          obRow.rows[0]?.status === 'partially_recovered' &&
          Number(obRow.rows[0]?.recovered_amount_cents) === 50_00
        ) {
          ok('T2 D-money 50 + obligation 80 → drain 50, partially_recovered',
            `drained=${result.totalDrainedCents}`);
        } else {
          fail('T2', `result=${JSON.stringify(result)} row=${JSON.stringify(obRow.rows[0])}`);
        }
      } catch (e) {
        fail('T2', String(e));
      } finally {
        await cleanupObligation(obligationId);
        await q(`DELETE FROM approval_requests WHERE id=$1`, [approvalId]);
      }
    }

    // ── T3: obligation parcial (faltando R$30) + D-money R$30 → recovered ─────────
    {
      await drainAccount(fixture.debtorAccountId, fixture.debtorActorId);
      await fundAccount(fixture.debtorAccountId, fixture.debtorActorId, 40_00);
      const approvalId = await createApprovalRequest(fixture, 'approved');
      // obligation: amount=100, already_recovered=70, remaining=30
      const obligationId = await createObligationRow(fixture, 100_00, approvalId, 'partially_recovered', 70_00);

      try {
        const client = await getClientWithTenant(TENANT_ID);
        let result;
        try {
          await client.query('BEGIN');
          result = await drainRecoveryObligationsForCredit(TENANT_ID, fixture.debtorActorId, 30_00, client);
          await client.query('COMMIT');
        } catch (e) {
          await client.query('ROLLBACK').catch(() => {});
          throw e;
        } finally {
          client.release();
        }

        const obRow = await q(`SELECT status, recovered_amount_cents FROM actor_wallet_recovery_obligations WHERE id=$1`, [obligationId]);
        if (
          result.totalDrainedCents === 30_00 &&
          result.residualCreditCents === 0 &&
          obRow.rows[0]?.status === 'recovered' &&
          Number(obRow.rows[0]?.recovered_amount_cents) === 100_00
        ) {
          ok('T3 obligation parcial + D-money 30 → recovered',
            `drained=${result.totalDrainedCents} status=${obRow.rows[0]?.status}`);
        } else {
          fail('T3', `result=${JSON.stringify(result)} row=${JSON.stringify(obRow.rows[0])}`);
        }
      } catch (e) {
        fail('T3', String(e));
      } finally {
        await cleanupObligation(obligationId);
        await q(`DELETE FROM approval_requests WHERE id=$1`, [approvalId]);
      }
    }

    // ── T4: sem obligation ativa → drain 0, residual = creditedAmount ─────────────
    {
      await drainAccount(fixture.debtorAccountId, fixture.debtorActorId);
      await fundAccount(fixture.debtorAccountId, fixture.debtorActorId, 60_00);

      try {
        const client = await getClientWithTenant(TENANT_ID);
        let result;
        try {
          await client.query('BEGIN');
          result = await drainRecoveryObligationsForCredit(TENANT_ID, fixture.debtorActorId, 60_00, client);
          await client.query('COMMIT');
        } catch (e) {
          await client.query('ROLLBACK').catch(() => {});
          throw e;
        } finally {
          client.release();
        }

        if (result.totalDrainedCents === 0 && result.residualCreditCents === 60_00 && result.obligationsTouched === 0) {
          ok('T4 sem obligation → drain 0, residual = creditedAmount',
            `residual=${result.residualCreditCents}`);
        } else {
          fail('T4', JSON.stringify(result));
        }
      } catch (e) {
        fail('T4', String(e));
      }
    }

    // ── T5: múltiplas obligations → FIFO por created_at ──────────────────────────
    {
      await drainAccount(fixture.debtorAccountId, fixture.debtorActorId);
      await fundAccount(fixture.debtorAccountId, fixture.debtorActorId, 80_00);
      const approvalId1 = await createApprovalRequest(fixture, 'approved');
      const obId1 = await createObligationRow(fixture, 50_00, approvalId1); // older — drained first
      // Insert tiny delay to ensure created_at ordering
      await q(`SELECT pg_sleep(0.01)`);
      const approvalId2 = await createApprovalRequest(fixture, 'approved');
      const obId2 = await createObligationRow(fixture, 50_00, approvalId2); // newer

      try {
        const client = await getClientWithTenant(TENANT_ID);
        let result;
        try {
          await client.query('BEGIN');
          result = await drainRecoveryObligationsForCredit(TENANT_ID, fixture.debtorActorId, 80_00, client);
          await client.query('COMMIT');
        } catch (e) {
          await client.query('ROLLBACK').catch(() => {});
          throw e;
        } finally {
          client.release();
        }

        const ob1Row = await q(`SELECT status, recovered_amount_cents FROM actor_wallet_recovery_obligations WHERE id=$1`, [obId1]);
        const ob2Row = await q(`SELECT status, recovered_amount_cents FROM actor_wallet_recovery_obligations WHERE id=$1`, [obId2]);

        // ob1 (older) should be fully recovered (50), ob2 partially (30)
        if (
          result.totalDrainedCents === 80_00 &&
          ob1Row.rows[0]?.status === 'recovered' &&
          Number(ob1Row.rows[0]?.recovered_amount_cents) === 50_00 &&
          ob2Row.rows[0]?.status === 'partially_recovered' &&
          Number(ob2Row.rows[0]?.recovered_amount_cents) === 30_00
        ) {
          ok('T5 múltiplas obligations → FIFO',
            `ob1=recovered(50) ob2=partially(30)`);
        } else {
          fail('T5', `ob1=${JSON.stringify(ob1Row.rows[0])} ob2=${JSON.stringify(ob2Row.rows[0])} result=${JSON.stringify(result)}`);
        }
      } catch (e) {
        fail('T5', String(e));
      } finally {
        await cleanupObligation(obId1);
        await cleanupObligation(obId2);
        await q(`DELETE FROM approval_requests WHERE id IN ($1, $2)`, [approvalId1, approvalId2]);
      }
    }

    // ── T6: pending_approval não drena ────────────────────────────────────────────
    {
      await drainAccount(fixture.debtorAccountId, fixture.debtorActorId);
      await fundAccount(fixture.debtorAccountId, fixture.debtorActorId, 50_00);
      const obligationId = await createObligationRow(fixture, 50_00, null, 'pending_approval');

      try {
        const client = await getClientWithTenant(TENANT_ID);
        let result;
        try {
          await client.query('BEGIN');
          result = await drainRecoveryObligationsForCredit(TENANT_ID, fixture.debtorActorId, 50_00, client);
          await client.query('COMMIT');
        } catch (e) {
          await client.query('ROLLBACK').catch(() => {});
          throw e;
        } finally {
          client.release();
        }

        const obRow = await q(`SELECT status FROM actor_wallet_recovery_obligations WHERE id=$1`, [obligationId]);
        if (result.totalDrainedCents === 0 && obRow.rows[0]?.status === 'pending_approval') {
          ok('T6 pending_approval não drena', `drained=${result.totalDrainedCents}`);
        } else {
          fail('T6', `drained=${result.totalDrainedCents} status=${obRow.rows[0]?.status}`);
        }
      } catch (e) {
        fail('T6', String(e));
      } finally {
        await cleanupObligation(obligationId);
      }
    }

    // ── T7: cancelled não drena ───────────────────────────────────────────────────
    {
      await drainAccount(fixture.debtorAccountId, fixture.debtorActorId);
      await fundAccount(fixture.debtorAccountId, fixture.debtorActorId, 50_00);
      const approvalId = await createApprovalRequest(fixture, 'approved');
      const obligationId = await createObligationRow(fixture, 50_00, approvalId, 'cancelled');

      try {
        const client = await getClientWithTenant(TENANT_ID);
        let result;
        try {
          await client.query('BEGIN');
          result = await drainRecoveryObligationsForCredit(TENANT_ID, fixture.debtorActorId, 50_00, client);
          await client.query('COMMIT');
        } catch (e) {
          await client.query('ROLLBACK').catch(() => {});
          throw e;
        } finally {
          client.release();
        }

        if (result.totalDrainedCents === 0) {
          ok('T7 cancelled não drena', `drained=${result.totalDrainedCents}`);
        } else {
          fail('T7', `drained=${result.totalDrainedCents}`);
        }
      } catch (e) {
        fail('T7', String(e));
      } finally {
        await cleanupObligation(obligationId);
        await q(`DELETE FROM approval_requests WHERE id=$1`, [approvalId]);
      }
    }

    // ── T8: actor sem obligations (simula split regional/fee) → drain 0 ──────────
    {
      // Find an actor that has NO active recovery obligations (any actor ≠ debtor)
      const otherActorRow = await q(
        `SELECT id FROM actors WHERE tenant_id=$1 AND id <> $2 LIMIT 1`,
        [TENANT_ID, fixture.debtorActorId]
      );
      const otherActorId = otherActorRow.rows[0]?.id as string | undefined;

      if (!otherActorId) {
        fail('T8 actor sem obligations', 'nenhum outro actor encontrado para teste');
      } else {
        try {
          const client = await getClientWithTenant(TENANT_ID);
          let result;
          try {
            await client.query('BEGIN');
            result = await drainRecoveryObligationsForCredit(TENANT_ID, otherActorId, 50_00, client);
            await client.query('COMMIT');
          } catch (e) {
            await client.query('ROLLBACK').catch(() => {});
            throw e;
          } finally {
            client.release();
          }

          if (result.totalDrainedCents === 0 && result.residualCreditCents === 50_00) {
            ok('T8 actor sem obligations (simula split regional/fee) → drain 0',
              `residual=${result.residualCreditCents}`);
          } else {
            fail('T8', JSON.stringify(result));
          }
        } catch (e) {
          fail('T8', String(e));
        }
      }
    }

    // ── T9: saldo antigo R$100 + crédito R$50; obligation R$200 → drain só R$50 ───
    {
      await drainAccount(fixture.debtorAccountId, fixture.debtorActorId);
      // Saldo antigo: 100 (committed antes do hook)
      await fundAccount(fixture.debtorAccountId, fixture.debtorActorId, 100_00);
      // Novo crédito simulado: 50 (committed como se fosse D-money)
      await fundAccount(fixture.debtorAccountId, fixture.debtorActorId, 50_00);
      // Total balance = 150; obligation = 200; creditedAmountCents = 50 (teto do hook)
      const approvalId = await createApprovalRequest(fixture, 'approved');
      const obligationId = await createObligationRow(fixture, 200_00, approvalId);

      try {
        const client = await getClientWithTenant(TENANT_ID);
        let result;
        try {
          await client.query('BEGIN');
          // Passa apenas o valor do crédito recém-entrado (50), não o saldo total (150)
          result = await drainRecoveryObligationsForCredit(TENANT_ID, fixture.debtorActorId, 50_00, client);
          await client.query('COMMIT');
        } catch (e) {
          await client.query('ROLLBACK').catch(() => {});
          throw e;
        } finally {
          client.release();
        }

        if (result.totalDrainedCents === 50_00 && result.residualCreditCents === 0) {
          ok('T9 não drena saldo antigo além do crédito recém-entrado',
            `drained=${result.totalDrainedCents} (not 100_00 or 150_00)`);
        } else {
          fail('T9', `drained=${result.totalDrainedCents} expected 5000`);
        }
      } catch (e) {
        fail('T9', String(e));
      } finally {
        await cleanupObligation(obligationId);
        await q(`DELETE FROM approval_requests WHERE id=$1`, [approvalId]);
      }
    }

    // ── T10: rollback — drain dentro de transação ROLLBACK → sem entries ou tx ───
    {
      await drainAccount(fixture.debtorAccountId, fixture.debtorActorId);
      await fundAccount(fixture.debtorAccountId, fixture.debtorActorId, 60_00);
      const approvalId = await createApprovalRequest(fixture, 'approved');
      const obligationId = await createObligationRow(fixture, 60_00, approvalId);
      const txCountBefore = await bankTxCount();

      try {
        const client = await getClientWithTenant(TENANT_ID);
        try {
          await client.query('BEGIN');
          await drainRecoveryObligationsForCredit(TENANT_ID, fixture.debtorActorId, 60_00, client);
          await client.query('ROLLBACK'); // simula falha do D-money após o drain
        } finally {
          client.release();
        }

        const txCountAfter = await bankTxCount();
        const obRow = await q(`SELECT status, recovered_amount_cents FROM actor_wallet_recovery_obligations WHERE id=$1`, [obligationId]);
        const entriesRow = await q(`SELECT COUNT(*) AS c FROM actor_wallet_recovery_obligation_entries WHERE obligation_id=$1`, [obligationId]);

        if (
          txCountBefore === txCountAfter &&
          obRow.rows[0]?.status === 'approved' &&
          Number(obRow.rows[0]?.recovered_amount_cents) === 0 &&
          Number(entriesRow.rows[0]?.c) === 0
        ) {
          ok('T10 rollback → drain não persiste', `tx: ${txCountBefore}, status=approved, entries=0`);
        } else {
          fail('T10', `tx: ${txCountBefore}→${txCountAfter} status=${obRow.rows[0]?.status} entries=${entriesRow.rows[0]?.c}`);
        }
      } catch (e) {
        fail('T10', String(e));
      } finally {
        await cleanupObligation(obligationId);
        await q(`DELETE FROM approval_requests WHERE id=$1`, [approvalId]);
      }
    }

    // ── T11: ledger double-entry preservado ───────────────────────────────────────
    {
      await drainAccount(fixture.debtorAccountId, fixture.debtorActorId);
      await fundAccount(fixture.debtorAccountId, fixture.debtorActorId, 70_00);
      const approvalId = await createApprovalRequest(fixture, 'approved');
      const obligationId = await createObligationRow(fixture, 70_00, approvalId);

      try {
        const client = await getClientWithTenant(TENANT_ID);
        let result;
        try {
          await client.query('BEGIN');
          result = await drainRecoveryObligationsForCredit(TENANT_ID, fixture.debtorActorId, 70_00, client);
          await client.query('COMMIT');
        } catch (e) {
          await client.query('ROLLBACK').catch(() => {});
          throw e;
        } finally {
          client.release();
        }

        // Find the recovery transaction created
        const entryRow = await q(
          `SELECT recovery_transaction_id FROM actor_wallet_recovery_obligation_entries WHERE obligation_id=$1 LIMIT 1`,
          [obligationId]
        );
        const txId = entryRow.rows[0]?.recovery_transaction_id as string;
        if (!txId) {
          fail('T11 double-entry', 'no recovery_transaction_id found');
        } else {
          const ledger = await q(
            `SELECT direction, SUM(amount_cents) AS total FROM bank_ledger WHERE transaction_id=$1 GROUP BY direction`,
            [txId]
          );
          const debit = Number(ledger.rows.find(r => r.direction === 'debit')?.total ?? 0);
          const credit = Number(ledger.rows.find(r => r.direction === 'credit')?.total ?? 0);
          if (debit === 70_00 && credit === 70_00) {
            ok('T11 ledger double-entry', `debit=${debit} = credit=${credit} = 7000`);
          } else {
            fail('T11', `debit=${debit} credit=${credit}`);
          }
        }
      } catch (e) {
        fail('T11', String(e));
      } finally {
        await cleanupObligation(obligationId);
        await q(`DELETE FROM approval_requests WHERE id=$1`, [approvalId]);
      }
    }

    // ── T12: Σ entries = recovered_amount_cents ───────────────────────────────────
    {
      await drainAccount(fixture.debtorAccountId, fixture.debtorActorId);
      await fundAccount(fixture.debtorAccountId, fixture.debtorActorId, 45_00);
      const approvalId = await createApprovalRequest(fixture, 'approved');
      const obligationId = await createObligationRow(fixture, 45_00, approvalId);

      try {
        const client = await getClientWithTenant(TENANT_ID);
        try {
          await client.query('BEGIN');
          await drainRecoveryObligationsForCredit(TENANT_ID, fixture.debtorActorId, 45_00, client);
          await client.query('COMMIT');
        } catch (e) {
          await client.query('ROLLBACK').catch(() => {});
          throw e;
        } finally {
          client.release();
        }

        const entrySum = await q(
          `SELECT COALESCE(SUM(amount_cents),0) AS total FROM actor_wallet_recovery_obligation_entries WHERE obligation_id=$1`,
          [obligationId]
        );
        const obRow = await q(
          `SELECT recovered_amount_cents FROM actor_wallet_recovery_obligations WHERE id=$1`,
          [obligationId]
        );
        const sum = Number(entrySum.rows[0].total);
        const recovered = Number(obRow.rows[0]?.recovered_amount_cents);
        if (sum === recovered && recovered === 45_00) {
          ok('T12 Σ entries = recovered_amount_cents', `sum=${sum}`);
        } else {
          fail('T12', `sum=${sum} recovered=${recovered}`);
        }
      } catch (e) {
        fail('T12', String(e));
      } finally {
        await cleanupObligation(obligationId);
        await q(`DELETE FROM approval_requests WHERE id=$1`, [approvalId]);
      }
    }

    // ── T13: sistema não usa escrow/risk/fees/regional como source ────────────────
    {
      const sysAfter = await systemAccountsSnapshot();
      if (
        sysBefore.credit_sum === sysAfter.credit_sum &&
        sysBefore.debit_sum === sysAfter.debit_sum
      ) {
        ok('T13 recovery não usa system accounts como source', 'escrow/risk/fees/regional inalterados');
      } else {
        fail('T13', `credit: ${sysBefore.credit_sum}→${sysAfter.credit_sum} debit: ${sysBefore.debit_sum}→${sysAfter.debit_sum}`);
      }
    }

  } finally {
    // ── Resultado ────────────────────────────────────────────────────────────────
    console.log('\n────────────────────────────────────────────────────────');
    console.log(`  Resultado: ${passed}/${passed + failed} passaram`);
    if (failed > 0) {
      console.log('  ✗ Falhas:');
      for (const r of results.filter(r => !r.ok)) {
        console.log(`    - ${r.name}: ${r.detail}`);
      }
    }
    console.log('────────────────────────────────────────────────────────\n');
    await pool.end();
    process.exit(failed > 0 ? 1 : 0);
  }
}

runTests().catch(err => {
  console.error('FATAL durante E2E:', err);
  pool.end().catch(() => {});
  process.exit(1);
});
