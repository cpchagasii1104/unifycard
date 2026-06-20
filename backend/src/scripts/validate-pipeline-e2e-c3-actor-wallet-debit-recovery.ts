/**
 * E2E C3 — debitActorWalletForRecovery (DECISION-0055, 2026-05-27)
 *
 * Prova o serviço de débito de actor_wallet para recovery pós-D-money.
 *
 * Cenários:
 *   T1   Saldo suficiente → transfere total, 1 entry, status=recovered
 *   T2   Saldo parcial → transfere disponível, 1 entry, status=partially_recovered
 *   T3   partially_recovered + novo saldo → segunda entry, status=recovered
 *   T4   Saldo zero → no_funds_available, sem transaction, sem entry
 *   T5   pending_approval → RECOVERY_APPROVAL_REQUIRED
 *   T6   approval_request status=pending → RECOVERY_APPROVAL_REQUIRED
 *   T7   approval_request operation_type errado → RECOVERY_APPROVAL_WRONG_TYPE
 *   T8   recovered/cancelled/failed → bloqueados
 *   T9   recovered_amount_cents nunca ultrapassa amount_cents
 *   T10  Σ entries.amount_cents = obligation.recovered_amount_cents
 *   T11  Ledger double-entry preservado (Σdéb = Σcréd por transação)
 *   T12  Zero escrita em escrow_payments, risk_reserve, platform_fees, regional_fund
 *   T13  actor_wallet do devedor é debitada
 *   T14  user_wallet do payer é creditada
 *   T15  Rollback: BEGIN + transfer manual sem entry → ROLLBACK → sem bank_transaction órfã
 *
 * Modo:
 *   npx tsx backend/src/scripts/validate-pipeline-e2e-c3-actor-wallet-debit-recovery.ts
 */

import dotenv from 'dotenv';
import { join } from 'path';
import { v4 as uuidv4 } from 'uuid';

import { pool } from '../core/database/pool';
import { bankAccountService } from '../modules/bank/bank-account.service';
import {
  ActorWalletDebitError,
  debitActorWalletForRecovery,
} from '../modules/wallet/actor-wallet-debit.service';

dotenv.config({ path: join(process.cwd(), 'backend', '.env') });

const TENANT_ID = process.env.E2E_TENANT_ID || 'fbe13b78-4516-493d-905a-363796aea1d1';

// F-ACTOR-WALLET-PAYOUT-PROOF-WIRING: recusa rodar contra DB não-efêmero (nunca unificard_dev).
const EXPECTED_DB = process.env.EXPECTED_DATABASE_NAME || '';
async function assertEphemeral(): Promise<void> {
  const db = (await pool.query<{ db: string }>('SELECT current_database() AS db')).rows[0]?.db;
  if (db === 'unificard_dev') throw new Error('Refusing to run payout/recovery E2E against non-ephemeral database.');
  if (!EXPECTED_DB || db !== EXPECTED_DB) throw new Error(`Refusing to run payout/recovery E2E against non-ephemeral database (db="${db}" != EXPECTED "${EXPECTED_DB}").`);
  if (!/payout|approve|decision|recovery|wallet|test|ephemeral/i.test(db)) throw new Error(`Refusing to run payout/recovery E2E against non-ephemeral database (db="${db}" not ephemeral).`);
  console.log(`🔒 DB efêmera confirmada: ${db}`);
}

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

// ── snapshots ─────────────────────────────────────────────────────────────────

async function systemAccountsSnapshot() {
  const r = await q(
    `SELECT
       (SELECT COALESCE(SUM(l.amount_cents), 0) FROM bank_ledger l
          JOIN bank_accounts ba ON ba.id = l.account_id
         WHERE l.tenant_id = $1 AND ba.account_type IN ('escrow_payments','risk_reserve','platform_fees','regional_fund')
           AND l.direction = 'credit') AS credit_sum,
       (SELECT COALESCE(SUM(l.amount_cents), 0) FROM bank_ledger l
          JOIN bank_accounts ba ON ba.id = l.account_id
         WHERE l.tenant_id = $1 AND ba.account_type IN ('escrow_payments','risk_reserve','platform_fees','regional_fund')
           AND l.direction = 'debit') AS debit_sum`,
    [TENANT_ID]
  );
  return r.rows[0] as { credit_sum: string; debit_sum: string };
}

async function bankTxCount(): Promise<string> {
  const r = await q(`SELECT COUNT(*) AS c FROM bank_transactions WHERE tenant_id=$1`, [TENANT_ID]);
  return r.rows[0].c as string;
}

// ── risk reset ────────────────────────────────────────────────────────────────

async function resetRiskProfiles() {
  await q(
    `UPDATE actor_risk_profile
        SET risk_level='low', risk_score=0, flags='[]'::jsonb, updated_at=NOW()
      WHERE actor_id IN (SELECT id FROM actors WHERE tenant_id=$1::uuid)`,
    [TENANT_ID]
  );
}

// ── fixtures ──────────────────────────────────────────────────────────────────

interface Fixture {
  debtorActorId: string;
  debtorAccountId: string; // actor_wallet
  creditorActorId: string;
  creditorAccountId: string; // user_wallet
  requestedByUserId: string; // debtor's user_id
}

async function buildFixture(): Promise<Fixture | null> {
  // Debtor: actor with actor_wallet and user_id
  const debtorRow = await q(
    `SELECT a.id AS actor_id, a.user_id, ba.id AS account_id
       FROM actors a
       JOIN bank_accounts ba ON ba.actor_id = a.id AND ba.tenant_id = a.tenant_id AND ba.account_type = 'actor_wallet'
      WHERE a.tenant_id = $1 AND a.user_id IS NOT NULL
      LIMIT 1`,
    [TENANT_ID]
  );
  if (!debtorRow.rows[0]) return null;

  const debtorActorId = debtorRow.rows[0].actor_id as string;
  const debtorAccountId = debtorRow.rows[0].account_id as string;
  const requestedByUserId = debtorRow.rows[0].user_id as string;

  // Creditor: different actor with user_wallet
  const creditorRow = await q(
    `SELECT a.id AS actor_id, ba.id AS account_id
       FROM actors a
       JOIN bank_accounts ba ON ba.actor_id = a.id AND ba.tenant_id = a.tenant_id AND ba.account_type = 'user_wallet'
      WHERE a.tenant_id = $1 AND a.id <> $2
      LIMIT 1`,
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

async function fundAccount(accountId: string, actorId: string, amountCents: number): Promise<void> {
  const conceptId = await q(
    `SELECT concept_id FROM concepts WHERE slug='actor-wallet-recovery' LIMIT 1`
  );
  const cid = conceptId.rows[0]?.concept_id ?? null;
  const txId = uuidv4();
  await q(
    `INSERT INTO bank_transactions (id, tenant_id, actor_id, account_id, amount_cents, purpose, justification,
       reference_type, reference_id, concept_id, internal_completed_at)
     VALUES ($1::uuid, $2::uuid, $3::uuid, $4::uuid, $5, 'execution', 'E2E C3 subsidy',
             'e2e_c3_subsidy', $6, $7, NOW())`,
    [txId, TENANT_ID, actorId, accountId, amountCents, uuidv4(), cid]
  );
  await q(
    `INSERT INTO bank_ledger (id, tenant_id, account_id, transaction_id, direction, amount_cents, purpose, justification)
     VALUES (gen_random_uuid(), $1::uuid, $2::uuid, $3::uuid, 'credit', $4, 'execution', 'E2E C3 subsidy')`,
    [TENANT_ID, accountId, txId, amountCents]
  );
}

async function createApprovalRequest(
  f: Fixture,
  status: 'approved' | 'pending' | 'rejected',
  operationType: string = 'actor_wallet_recovery'
): Promise<string> {
  const id = uuidv4();
  await q(
    `INSERT INTO approval_requests
       (id, tenant_id, requested_by_user_id, acting_for_actor_id, acting_for_account_id,
        operation_type, operation_data, required_approvals, approval_type, status, expires_at)
     VALUES ($1, $2, $3, $4, $5, $6, '{"reason":"e2e_c3"}'::jsonb, 1, 'sequential', $7, NOW()+INTERVAL '1 hour')`,
    [id, TENANT_ID, f.requestedByUserId, f.debtorActorId, f.debtorAccountId, operationType, status]
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
  // Need a real bank_transaction for original_transaction_id FK
  const conceptId = (await q(`SELECT concept_id FROM concepts WHERE slug='actor-wallet-recovery' LIMIT 1`)).rows[0]?.concept_id;
  const origTxId = uuidv4();
  await q(
    `INSERT INTO bank_transactions (id, tenant_id, actor_id, account_id, amount_cents, purpose, justification,
       reference_type, reference_id, concept_id, internal_completed_at)
     VALUES ($1::uuid, $2::uuid, $3::uuid, $4::uuid, $5, 'execution', 'E2E C3 origin tx',
             'e2e_c3_origin', $6, $7, NOW())`,
    [origTxId, TENANT_ID, f.debtorActorId, f.debtorAccountId, amountCents, uuidv4(), conceptId]
  );
  // Need a payment_intent for payment_intent_id FK
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
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'E2E C3 test', $10, $11, $12)`,
    [
      obligationId, TENANT_ID,
      f.debtorActorId, f.debtorAccountId,
      f.creditorActorId, f.creditorAccountId,
      origTxId, intentId,
      amountCents,
      status, recoveredAmountCents,
      approvalRequestId,
    ]
  );
  return obligationId;
}

async function getBalance(accountId: string): Promise<number> {
  const r = await q(
    `SELECT COALESCE(
       SUM(CASE WHEN direction='credit' THEN amount_cents ELSE -amount_cents END), 0
     ) AS balance
       FROM bank_ledger WHERE tenant_id=$1 AND account_id=$2`,
    [TENANT_ID, accountId]
  );
  return Number(r.rows[0].balance);
}

async function cleanupObligation(obligationId: string) {
  // best-effort: registros financeiros/governança imutáveis (DECISION-0128); em efêmero o DB é dropado.
  await q(`DELETE FROM actor_wallet_recovery_obligation_entries WHERE obligation_id = $1`, [obligationId]).catch(() => {});
  await q(`DELETE FROM actor_wallet_recovery_obligations WHERE id = $1`, [obligationId]).catch(() => {});
}

async function drainAccount(accountId: string, actorId: string): Promise<void> {
  const currentBal = await getBalance(accountId);
  if (currentBal <= 0) return;
  const conceptRow = await q(`SELECT concept_id FROM concepts WHERE slug='actor-wallet-recovery' LIMIT 1`);
  const cid = conceptRow.rows[0]?.concept_id ?? null;
  const txId = uuidv4();
  await q(
    `INSERT INTO bank_transactions (id, tenant_id, actor_id, account_id, amount_cents, purpose, justification,
       reference_type, reference_id, concept_id, internal_completed_at)
     VALUES ($1::uuid, $2::uuid, $3::uuid, $4::uuid, $5, 'execution', 'E2E C3 drain',
             'e2e_c3_drain', $6, $7, NOW())`,
    [txId, TENANT_ID, actorId, accountId, currentBal, uuidv4(), cid]
  );
  await q(
    `INSERT INTO bank_ledger (id, tenant_id, account_id, transaction_id, direction, amount_cents, purpose, justification)
     VALUES (gen_random_uuid(), $1::uuid, $2::uuid, $3::uuid, 'debit', $4, 'execution', 'E2E C3 drain')`,
    [TENANT_ID, accountId, txId, currentBal]
  );
}

// ── scenarios ─────────────────────────────────────────────────────────────────

async function runTests() {
  await assertEphemeral();
  console.log('\n🔍 E2E C3 — debitActorWalletForRecovery\n');

  const fixture = await buildFixture();
  if (!fixture) {
    console.error('SKIP: fixtures insuficientes (debtor actor_wallet ou creditor user_wallet ausentes)');
    await pool.end();
    process.exit(0);
  }

  await resetRiskProfiles();

  const systemSnapshotBefore = await systemAccountsSnapshot();

  try {
    // ── T1: saldo suficiente → recovered ──────────────────────────────────────
    {
      const amount = 10_000;
      const approvalId = await createApprovalRequest(fixture, 'approved');
      const obligationId = await createObligationRow(fixture, amount, approvalId);
      await fundAccount(fixture.debtorAccountId, fixture.debtorActorId, amount);

      try {
        const result = await debitActorWalletForRecovery(TENANT_ID, obligationId);
        if (result.result === 'recovered' && result.amountDebited === amount && result.recoveredTotal === amount) {
          ok('T1 saldo suficiente → recovered', `debited=${result.amountDebited} total=${result.recoveredTotal}`);
        } else {
          fail('T1 saldo suficiente → recovered', `resultado=${JSON.stringify(result)}`);
        }
      } catch (e) {
        fail('T1 saldo suficiente → recovered', String(e));
      } finally {
        await cleanupObligation(obligationId);
        await q(`DELETE FROM approval_requests WHERE id=$1`, [approvalId]);
      }
    }

    // ── T2: saldo parcial → partially_recovered ───────────────────────────────
    {
      // Lê saldo atual antes de fundar; cria obrigação acima do total disponível
      const balBefore = await getBalance(fixture.debtorAccountId);
      const fundedBalance = 8_000;
      const amount = balBefore + fundedBalance + 5_000; // sempre > saldo após fund
      const expectedDebited = balBefore + fundedBalance;
      const approvalId = await createApprovalRequest(fixture, 'approved');
      const obligationId = await createObligationRow(fixture, amount, approvalId);
      await fundAccount(fixture.debtorAccountId, fixture.debtorActorId, fundedBalance);

      try {
        const result = await debitActorWalletForRecovery(TENANT_ID, obligationId);
        if (
          result.result === 'partially_recovered' &&
          result.amountDebited === expectedDebited &&
          result.recoveredTotal === expectedDebited
        ) {
          ok('T2 saldo parcial → partially_recovered', `debited=${result.amountDebited} of ${amount}`);
        } else {
          fail('T2 saldo parcial → partially_recovered', JSON.stringify(result));
        }
      } catch (e) {
        fail('T2 saldo parcial → partially_recovered', String(e));
      } finally {
        await cleanupObligation(obligationId);
        await q(`DELETE FROM approval_requests WHERE id=$1`, [approvalId]);
      }
    }

    // ── T3: partially_recovered + novo saldo → segunda entry → recovered ───────
    {
      const amount = 15_000;
      const firstPayment = 6_000;
      const secondPayment = amount - firstPayment;
      const approvalId = await createApprovalRequest(fixture, 'approved');
      // Cria obrigação já com recovered_amount_cents = firstPayment (simula estado parcial)
      const obligationId = await createObligationRow(fixture, amount, approvalId, 'partially_recovered', firstPayment);
      await fundAccount(fixture.debtorAccountId, fixture.debtorActorId, secondPayment + 1_000); // extra

      try {
        const result = await debitActorWalletForRecovery(TENANT_ID, obligationId);
        if (result.result === 'recovered' && result.amountDebited === secondPayment && result.recoveredTotal === amount) {
          ok('T3 segunda entry → recovered', `debited=${result.amountDebited} total=${result.recoveredTotal}`);
        } else {
          fail('T3 segunda entry → recovered', JSON.stringify(result));
        }
      } catch (e) {
        fail('T3 segunda entry → recovered', String(e));
      } finally {
        await cleanupObligation(obligationId);
        await q(`DELETE FROM approval_requests WHERE id=$1`, [approvalId]);
      }
    }

    // ── T10: Σ entries = recovered_amount_cents (obligation limpa via serviço) ──
    {
      const amount = 6_000;
      const approvalId = await createApprovalRequest(fixture, 'approved');
      const obligationId = await createObligationRow(fixture, amount, approvalId);
      await fundAccount(fixture.debtorAccountId, fixture.debtorActorId, amount);

      try {
        await debitActorWalletForRecovery(TENANT_ID, obligationId);

        const entrySum = await q(
          `SELECT COALESCE(SUM(amount_cents), 0) AS total FROM actor_wallet_recovery_obligation_entries WHERE obligation_id=$1`,
          [obligationId]
        );
        const obRow = await q(
          `SELECT recovered_amount_cents FROM actor_wallet_recovery_obligations WHERE id=$1`,
          [obligationId]
        );
        const sumEntries = Number(entrySum.rows[0].total);
        const recovered = Number(obRow.rows[0]?.recovered_amount_cents ?? 0);
        if (sumEntries === recovered && recovered === amount) {
          ok('T10 Σ entries = recovered_amount_cents', `sum=${sumEntries} recovered=${recovered}`);
        } else {
          fail('T10 Σ entries = recovered_amount_cents', `sum=${sumEntries} != recovered=${recovered}`);
        }
      } catch (e) {
        fail('T10 Σ entries = recovered_amount_cents', String(e));
      } finally {
        await cleanupObligation(obligationId);
        await q(`DELETE FROM approval_requests WHERE id=$1`, [approvalId]);
      }
    }

    // ── T4: saldo zero → no_funds_available ───────────────────────────────────
    {
      // Drena conta para garantir saldo zero antes do teste
      await drainAccount(fixture.debtorAccountId, fixture.debtorActorId);

      const amount = 5_000;
      const approvalId = await createApprovalRequest(fixture, 'approved');
      const obligationId = await createObligationRow(fixture, amount, approvalId);
      // NÃO funda o account — saldo = 0

      const txCountBefore = await bankTxCount();
      try {
        const result = await debitActorWalletForRecovery(TENANT_ID, obligationId);
        if (result.result === 'no_funds_available' && result.amountDebited === 0) {
          ok('T4 saldo zero → no_funds_available', 'sem transaction criada');
        } else {
          fail('T4 saldo zero → no_funds_available', JSON.stringify(result));
        }
      } catch (e) {
        fail('T4 saldo zero → no_funds_available', String(e));
      }
      const txCountAfter = await bankTxCount();
      if (txCountBefore === txCountAfter) {
        ok('T4b zero bank_transactions no saldo=0', `count=${txCountBefore}`);
      } else {
        fail('T4b zero bank_transactions no saldo=0', `${txCountBefore} → ${txCountAfter}`);
      }

      await cleanupObligation(obligationId);
      await q(`DELETE FROM approval_requests WHERE id=$1`, [approvalId]);
    }

    // ── T5: pending_approval → RECOVERY_APPROVAL_REQUIRED ────────────────────
    {
      const obligationId = await createObligationRow(fixture, 1_000, null, 'pending_approval');
      try {
        await debitActorWalletForRecovery(TENANT_ID, obligationId);
        fail('T5 pending_approval bloqueia', 'deveria ter lançado erro');
      } catch (e) {
        if (e instanceof ActorWalletDebitError && e.code === 'RECOVERY_APPROVAL_REQUIRED') {
          ok('T5 pending_approval bloqueia', `code=${e.code}`);
        } else {
          fail('T5 pending_approval bloqueia', String(e));
        }
      } finally {
        await cleanupObligation(obligationId);
      }
    }

    // ── T6: approval_request status=pending → RECOVERY_APPROVAL_REQUIRED ─────
    {
      const approvalId = await createApprovalRequest(fixture, 'pending');
      const obligationId = await createObligationRow(fixture, 1_000, approvalId);
      try {
        await debitActorWalletForRecovery(TENANT_ID, obligationId);
        fail('T6 approval pending bloqueia', 'deveria ter lançado erro');
      } catch (e) {
        if (e instanceof ActorWalletDebitError && e.code === 'RECOVERY_APPROVAL_REQUIRED') {
          ok('T6 approval pending bloqueia', `code=${e.code}`);
        } else {
          fail('T6 approval pending bloqueia', String(e));
        }
      } finally {
        await cleanupObligation(obligationId);
        await q(`DELETE FROM approval_requests WHERE id=$1`, [approvalId]);
      }
    }

    // ── T7: operation_type errado → RECOVERY_APPROVAL_WRONG_TYPE ─────────────
    {
      const approvalId = await createApprovalRequest(fixture, 'approved', 'manual_refund');
      const obligationId = await createObligationRow(fixture, 1_000, approvalId);
      try {
        await debitActorWalletForRecovery(TENANT_ID, obligationId);
        fail('T7 operation_type errado bloqueia', 'deveria ter lançado erro');
      } catch (e) {
        if (e instanceof ActorWalletDebitError && e.code === 'RECOVERY_APPROVAL_WRONG_TYPE') {
          ok('T7 operation_type errado bloqueia', `code=${e.code}`);
        } else {
          fail('T7 operation_type errado bloqueia', String(e));
        }
      } finally {
        await cleanupObligation(obligationId);
        await q(`DELETE FROM approval_requests WHERE id=$1`, [approvalId]);
      }
    }

    // ── T8: recovered/cancelled/failed → bloqueados ───────────────────────────
    {
      for (const badStatus of ['recovered', 'cancelled', 'failed'] as const) {
        const approvalId = await createApprovalRequest(fixture, 'approved');
        const obligationId = await createObligationRow(fixture, 1_000, approvalId, badStatus);
        try {
          await debitActorWalletForRecovery(TENANT_ID, obligationId);
          fail(`T8 ${badStatus} bloqueia`, 'deveria ter lançado erro');
        } catch (e) {
          if (e instanceof ActorWalletDebitError) {
            ok(`T8 ${badStatus} bloqueia`, `code=${e.code}`);
          } else {
            fail(`T8 ${badStatus} bloqueia`, String(e));
          }
        } finally {
          await cleanupObligation(obligationId);
          await q(`DELETE FROM approval_requests WHERE id=$1`, [approvalId]);
        }
      }
    }

    // ── T9: recovered_amount_cents nunca ultrapassa amount_cents ──────────────
    // Verifica CHK constraint diretamente no DB com INSERT VALUES (não SELECT).
    {
      const conceptId = (await q(`SELECT concept_id FROM concepts WHERE slug='actor-wallet-recovery' LIMIT 1`)).rows[0]?.concept_id ?? null;
      const origTxId = uuidv4();
      let intentId: string | null = null;
      try {
        await q(
          `INSERT INTO bank_transactions (id, tenant_id, actor_id, account_id, amount_cents, purpose, justification,
             reference_type, reference_id, concept_id, internal_completed_at)
           VALUES ($1::uuid, $2::uuid, $3::uuid, $4::uuid, 100, 'execution', 'E2E C3 T9 origin tx',
                   'e2e_c3_t9', $5, $6, NOW())`,
          [origTxId, TENANT_ID, fixture.debtorActorId, fixture.debtorAccountId, uuidv4(), conceptId]
        );
        intentId = uuidv4();
        await q(
          `INSERT INTO payment_intents (id, tenant_id, actor_id, amount_cents, intent_type, reference_id, gateway, currency)
           VALUES ($1, $2, $3, 100, 't9_test', $4, 'test', 'BRL')`,
          [intentId, TENANT_ID, fixture.debtorActorId, uuidv4()]
        );
        await q(
          `INSERT INTO actor_wallet_recovery_obligations
             (id, tenant_id, debtor_actor_id, debtor_account_id, creditor_actor_id, creditor_account_id,
              original_transaction_id, payment_intent_id, amount_cents, reason, status,
              recovered_amount_cents, approval_request_id)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 100, 'T9 test', 'approved', 101, NULL)`,
          [uuidv4(), TENANT_ID, fixture.debtorActorId, fixture.debtorAccountId,
           fixture.creditorActorId, fixture.creditorAccountId, origTxId, intentId]
        );
        fail('T9 CHK recovered <= amount', 'INSERT com recovered > amount deveria ter falhado');
      } catch (e) {
        if (String(e).includes('chk_recovery_obligation_recovered_bounds')) {
          ok('T9 CHK recovered <= amount', 'constraint enforced no DB');
        } else {
          fail('T9 CHK recovered <= amount', String(e));
        }
      } finally {
        if (intentId) await q(`DELETE FROM payment_intents WHERE id=$1`, [intentId]).catch(() => {});
        await q(`DELETE FROM bank_transactions WHERE id=$1`, [origTxId]).catch(() => {});
      }
    }

    // ── T11: ledger double-entry preservado ────────────────────────────────────
    {
      const amount = 7_000;
      const approvalId = await createApprovalRequest(fixture, 'approved');
      const obligationId = await createObligationRow(fixture, amount, approvalId);
      await fundAccount(fixture.debtorAccountId, fixture.debtorActorId, amount);

      let transactionId: string | undefined;
      try {
        const result = await debitActorWalletForRecovery(TENANT_ID, obligationId);
        transactionId = result.transactionId;
        // Check ledger double-entry: sum(credit) = sum(debit) per transaction
        const ledger = await q(
          `SELECT direction, SUM(amount_cents) AS total FROM bank_ledger
            WHERE transaction_id = $1 GROUP BY direction`,
          [transactionId]
        );
        const debitTotal = ledger.rows.find(r => r.direction === 'debit')?.total ?? 0;
        const creditTotal = ledger.rows.find(r => r.direction === 'credit')?.total ?? 0;
        if (Number(debitTotal) === Number(creditTotal) && Number(debitTotal) === amount) {
          ok('T11 ledger double-entry', `debit=${debitTotal} = credit=${creditTotal} = ${amount}`);
        } else {
          fail('T11 ledger double-entry', `debit=${debitTotal} credit=${creditTotal}`);
        }
      } catch (e) {
        fail('T11 ledger double-entry', String(e));
      } finally {
        await cleanupObligation(obligationId);
        await q(`DELETE FROM approval_requests WHERE id=$1`, [approvalId]);
      }
    }

    // ── T13 + T14: actor_wallet debitada, user_wallet creditada ───────────────
    {
      const amount = 3_000;
      const approvalId = await createApprovalRequest(fixture, 'approved');
      const obligationId = await createObligationRow(fixture, amount, approvalId);
      await fundAccount(fixture.debtorAccountId, fixture.debtorActorId, amount);

      const debtorBalBefore = await getBalance(fixture.debtorAccountId);
      const creditorBalBefore = await getBalance(fixture.creditorAccountId);

      try {
        const result = await debitActorWalletForRecovery(TENANT_ID, obligationId);
        const debtorBalAfter = await getBalance(fixture.debtorAccountId);
        const creditorBalAfter = await getBalance(fixture.creditorAccountId);

        if (debtorBalBefore - debtorBalAfter === amount) {
          ok('T13 actor_wallet debitada', `bal: ${debtorBalBefore} → ${debtorBalAfter} (-${amount})`);
        } else {
          fail('T13 actor_wallet debitada', `diff=${debtorBalBefore - debtorBalAfter}, esperado=${amount}`);
        }
        if (creditorBalAfter - creditorBalBefore === amount) {
          ok('T14 user_wallet creditada', `bal: ${creditorBalBefore} → ${creditorBalAfter} (+${amount})`);
        } else {
          fail('T14 user_wallet creditada', `diff=${creditorBalAfter - creditorBalBefore}, esperado=${amount}`);
        }
      } catch (e) {
        fail('T13/T14 balance verification', String(e));
      } finally {
        await cleanupObligation(obligationId);
        await q(`DELETE FROM approval_requests WHERE id=$1`, [approvalId]);
      }
    }

    // ── T15: rollback — BEGIN + transfer manual + ROLLBACK = sem tx órfã ───────
    {
      const amount = 5_000;
      await fundAccount(fixture.debtorAccountId, fixture.debtorActorId, amount);
      const txCountBefore = await bankTxCount();

      // Simula execução parcial: abre transação, faz transfer, reverte sem entry
      const testClient = await pool.connect();
      await q(`SELECT set_config('app.current_tenant', $1, false)`, [TENANT_ID]);
      await testClient.query(`SELECT set_config('app.current_tenant', $1, false)`, [TENANT_ID]);
      const refId = uuidv4();
      const conceptRow = await q(`SELECT concept_id FROM concepts WHERE slug='actor-wallet-recovery' LIMIT 1`);
      const cid = conceptRow.rows[0]?.concept_id ?? null;
      try {
        await testClient.query('BEGIN');
        const eventId = uuidv4();
        await testClient.query(
          `INSERT INTO bank_transactions (id, tenant_id, actor_id, account_id, amount_cents, purpose, justification,
             reference_type, reference_id, concept_id, internal_completed_at)
           VALUES ($1::uuid, $2::uuid, $3::uuid, $4::uuid, $5, 'execution', 'T15 rollback test',
                   'actor_wallet_recovery', $6, $7, NOW())`,
          [eventId, TENANT_ID, fixture.debtorActorId, fixture.debtorAccountId, amount, refId, cid]
        );
        // Induz rollback sem inserir entry
        await testClient.query('ROLLBACK');
      } finally {
        testClient.release();
      }

      const txCountAfter = await bankTxCount();
      if (txCountBefore === txCountAfter) {
        ok('T15 rollback sem entry → sem tx órfã', `count=${txCountBefore}`);
      } else {
        fail('T15 rollback sem entry → sem tx órfã', `${txCountBefore} → ${txCountAfter}`);
      }
    }

    // ── T12: zero escrita em system accounts ──────────────────────────────────
    {
      const systemSnapshotAfter = await systemAccountsSnapshot();
      if (
        systemSnapshotBefore.credit_sum === systemSnapshotAfter.credit_sum &&
        systemSnapshotBefore.debit_sum === systemSnapshotAfter.debit_sum
      ) {
        ok('T12 zero escrita em escrow/risk/fees/regional', 'system accounts inalterados');
      } else {
        fail('T12 zero escrita em escrow/risk/fees/regional',
          `credit: ${systemSnapshotBefore.credit_sum}→${systemSnapshotAfter.credit_sum} ` +
          `debit: ${systemSnapshotBefore.debit_sum}→${systemSnapshotAfter.debit_sum}`);
      }
    }

  } catch (e) {
    console.error('FATAL durante E2E:', e);
    failed++;
  }

  // ── summary ──────────────────────────────────────────────────────────────────
  console.log(`\n${'─'.repeat(56)}`);
  console.log(`  Resultado: ${passed}/${passed + failed} passaram`);
  if (failed > 0) {
    console.log('  ✗ Falhas:');
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
