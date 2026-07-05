/**
 * E2E F3 ACTOR-WALLET-PAYOUT EXECUTION (DECISION-0058 D2 + D-3/D-4)
 *
 * Prova a execução financeira do payout de actor_wallet.
 *
 * MOVE DINHEIRO via bankTransactionService.transfer. Mas zero rota pública,
 * zero worker, zero PIX/TED — só service interno + bank_settlement.
 *
 * Cenários:
 *   T1  happy path: approved request, zero obligations, transfer actor_wallet→bank_settlement, status=completed
 *   T2  pending_approval bloqueia execução (PAYOUT_NOT_APPROVED); zero ledger
 *   T3  completed é idempotente (segunda chamada retorna existente, zero novo transfer)
 *   T4  status terminal (cancelled/rejected/failed) bloqueia execução
 *   T5  obligation 'approved' é drenada antes do payout; payout executa só excedente
 *   T6  obligation 'partially_recovered' é drenada pelo restante antes do payout
 *   T7  saldo pós-drain < requested → completed parcial (D-3)
 *   T8  saldo pós-drain = 0 → failed com 'zero_available_after_recovery_drain' (D-4); zero transfer
 *   T9  rollback técnico: settlement account ausente → SETTLEMENT_MISSING; status volta a 'approved'; ledger intacto
 *   T10 execução concorrente do mesmo request: uma sucede, outra falha com ALREADY_PROCESSING
 *   T11 C3.1 concurrent: drain externo + F3 serializam via FOR UPDATE; sem deadlock
 *   T12 idempotência por reference: segunda execução do mesmo payoutRequestId retorna 'completed_idempotent', sem novo transfer
 *   T13 payout_requests legado (seller) intocado
 *   T14 bank_settlements table não existe — settlement é account_type, não tabela
 *   T15 ledger double-entry: cada transfer cria exatamente 1 debit + 1 credit
 *   T16 F2 regression: requestActorWalletPayout ainda cria pending_approval
 *   T17 C3.1 regression: drainRecoveryObligationsForCredit independente continua drenando
 *   T18 C7 regression: finalizeRecoveryCase continua funcionando após F3
 *
 * Modo:
 *   npx tsx backend/src/scripts/validate-pipeline-e2e-f3-actor-wallet-payout-execution.ts
 */

import dotenv from 'dotenv';
import { join } from 'path';
import { v4 as uuidv4 } from 'uuid';

import { pool, getClientWithTenant } from '../core/database/pool';
import { bankAccountService } from '../modules/bank/bank-account.service';
import { bankTransactionService } from '../modules/bank/bank-transaction.service';
import { bankLedgerRepository } from '../modules/bank/bank-ledger.repository';
import { buildSystemAuthorship } from '../modules/bank/financial-authorship.helper';
import { drainRecoveryObligationsForCredit } from '../modules/financial-recovery/actor-wallet-recovery-obligation.service';
import {
  actorWalletPayoutService,
  ActorWalletPayoutError,
} from '../modules/wallet/actor-wallet-payout.service';

dotenv.config({ path: join(process.cwd(), 'backend', '.env') });

// F-BANK-TRANSACTION-SINK-FIREWALL (Fatia 9): executeActorWalletPayout chama
// bankTransactionService.transfer no fim da cadeia — precisa ligar o novo gate default-off pra
// continuar exercitando a execução real de payout que este arquivo sempre testou.
process.env.BANK_TRANSACTION_SINK_FIREWALL_ENABLED = 'true';

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

// ── counters ──────────────────────────────────────────────────────────────────

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

// ── fixtures ──────────────────────────────────────────────────────────────────

interface Fixtures {
  userId: string;
  actorId: string;
  actorWalletAccountId: string;
  settlementAccountId: string;
}

async function getFixtures(): Promise<Fixtures> {
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
  if (!r.rows[0]) throw new Error('Sem actor com actor_wallet para tenant ' + TENANT_ID);
  const row = r.rows[0] as { user_id: string; actor_id: string; account_id: string };
  const settlement = await bankAccountService.getPlatformLifecycleAccount(TENANT_ID, 'bank_settlement', 'BRL');
  if (!settlement) throw new Error('bank_settlement account não existe para tenant ' + TENANT_ID);
  return {
    userId: row.user_id,
    actorId: row.actor_id,
    actorWalletAccountId: row.account_id,
    settlementAccountId: settlement.accountId,
  };
}

async function getFinancialSnapshot() {
  const [ledger, txs, payouts, settlements, settlementBal, walletBal] = await Promise.all([
    q(`SELECT COUNT(*) AS n FROM bank_ledger WHERE tenant_id=$1`, [TENANT_ID]),
    q(`SELECT COUNT(*) AS n FROM bank_transactions WHERE tenant_id=$1`, [TENANT_ID]),
    q(`SELECT COUNT(*) AS n FROM payout_requests WHERE tenant_id=$1`, [TENANT_ID]),
    q(`SELECT COUNT(*) AS n FROM bank_settlements WHERE tenant_id=$1`, [TENANT_ID]),
    q(
      `SELECT COALESCE(SUM(CASE WHEN direction='credit' THEN amount_cents ELSE -amount_cents END),0)::bigint AS bal
         FROM bank_ledger
        WHERE tenant_id=$1 AND account_id=(
          SELECT id FROM bank_accounts WHERE tenant_id=$1 AND account_type='bank_settlement' LIMIT 1
        )`,
      [TENANT_ID]
    ),
    q(
      `SELECT COALESCE(SUM(CASE WHEN direction='credit' THEN amount_cents ELSE -amount_cents END),0)::bigint AS bal
         FROM bank_ledger
        WHERE tenant_id=$1 AND account_id=(
          SELECT ba.id FROM bank_accounts ba
            JOIN actors a ON a.id=ba.actor_id
            JOIN users u ON u.id=a.user_id
           WHERE ba.tenant_id=$1 AND ba.account_type='actor_wallet'
           LIMIT 1
        )`,
      [TENANT_ID]
    ),
  ]);
  return {
    ledger: Number(ledger.rows[0].n),
    txs: Number(txs.rows[0].n),
    payouts: Number(payouts.rows[0].n),
    bankSettlementsCount: Number(settlements.rows[0].n),
    settlementBalance: Number(settlementBal.rows[0].bal),
    walletBalance: Number(walletBal.rows[0].bal),
  };
}

/**
 * Cria payout_request via service F2 e força para 'approved' (gate aprovado).
 * Retorna ids para uso/cleanup.
 */
async function setupApprovedPayoutRequest(
  fix: Fixtures,
  amountCents: number,
  labelSuffix: string
): Promise<{ payoutRequestId: string; approvalRequestId: string }> {
  const idem = `f3-${labelSuffix}-${uuidv4().slice(0, 8)}`;
  const res = await actorWalletPayoutService.requestActorWalletPayout({
    tenantId: TENANT_ID,
    actorId: fix.actorId,
    requestedByUserId: fix.userId,
    requestedAmountCents: amountCents,
    idempotencyKey: idem,
    reason: `e2e F3 ${labelSuffix}`,
  });
  const payoutId = res.payoutRequest.id;
  const approvalId = res.payoutRequest.approvalRequestId!;
  // Force approval to 'approved' + payout to 'approved' (simulando gate aprovado)
  await q(`UPDATE approval_requests SET status='approved' WHERE id=$1`, [approvalId]);
  await q(
    `UPDATE actor_wallet_payout_requests
        SET status='approved',
            approved_amount_cents=$1
      WHERE id=$2`,
    [amountCents, payoutId]
  );
  return { payoutRequestId: payoutId, approvalRequestId: approvalId };
}

/**
 * Cria payout_request via INSERT direto (bypassa F2's gates) com status='approved'.
 * Usado em T7/T8 onde precisamos amounts maiores que o saldo (F2 rejeitaria).
 */
async function setupApprovedPayoutRequestDirect(
  fix: Fixtures,
  requestedAmountCents: number,
  approvedAmountCents: number,
  labelSuffix: string
): Promise<{ payoutRequestId: string; approvalRequestId: string }> {
  const idem = `f3-${labelSuffix}-${uuidv4().slice(0, 8)}`;
  const approvalId = uuidv4();
  const payoutId = uuidv4();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  await q(
    `INSERT INTO approval_requests
       (id, tenant_id, requested_by_user_id, acting_for_actor_id, acting_for_account_id,
        operation_type, operation_data, required_approvals, approval_type, status, expires_at)
     VALUES ($1,$2,$3,$4,$5,'actor_wallet_payout','{"e2e":true}'::jsonb,1,'sequential','approved',$6)`,
    [approvalId, TENANT_ID, fix.userId, fix.actorId, fix.actorWalletAccountId, expiresAt]
  );
  await q(
    `INSERT INTO actor_wallet_payout_requests
       (id, tenant_id, actor_id, actor_wallet_account_id, approval_request_id,
        requested_amount_cents, approved_amount_cents, destination_type, idempotency_key, status)
     VALUES ($1,$2,$3,$4,$5,$6,$7,'internal_settlement',$8,'approved')`,
    [payoutId, TENANT_ID, fix.actorId, fix.actorWalletAccountId, approvalId,
     requestedAmountCents, approvedAmountCents, idem]
  );
  return { payoutRequestId: payoutId, approvalRequestId: approvalId };
}

/**
 * Cancela request (terminal → libera active-gate).
 */
async function cancelPayoutRequest(payoutRequestId: string): Promise<void> {
  await q(
    `UPDATE actor_wallet_payout_requests SET status='cancelled' WHERE id=$1`,
    [payoutRequestId]
  );
}

/**
 * Defesa entre testes: cancela qualquer request ativo para o actor.
 * Garante que o próximo teste possa criar um novo setup sem cascade.
 */
async function ensureNoActiveRequest(actorId: string): Promise<void> {
  await q(
    `UPDATE actor_wallet_payout_requests
        SET status='cancelled'
      WHERE tenant_id=$1 AND actor_id=$2
        AND status IN ('pending_approval','approved','processing')`,
    [TENANT_ID, actorId]
  );
}

/**
 * Seeds direct credit no bank_ledger para a actor_wallet.
 * Padrão E2E (igual ao C3): INSERT bank_transactions + INSERT bank_ledger credit.
 * referenceType='e2e_f3_seed' permite cleanup ao final.
 * NÃO usar fora de E2E — bypassa controles de transfer.
 */
async function seedWalletCredit(fix: Fixtures, amountCents: number): Promise<string> {
  if (amountCents <= 0) return '';
  const txId = uuidv4();
  const conceptRes = await q(`SELECT concept_id FROM concepts WHERE domain='financeiro-payout' LIMIT 1`);
  const conceptId = conceptRes.rows[0].concept_id;
  await q(
    `INSERT INTO bank_transactions
       (id, tenant_id, actor_id, account_id, amount_cents, purpose,
        justification, reference_type, reference_id, concept_id)
     VALUES ($1::uuid,$2,$3,$4,$5,'initial_credit','e2e F3 seed credit','e2e_f3_seed',$6,$7)`,
    [txId, TENANT_ID, fix.actorId, fix.actorWalletAccountId, amountCents, txId, conceptId]
  );
  await q(
    `INSERT INTO bank_ledger
       (id, tenant_id, account_id, transaction_id, direction, amount_cents, purpose, justification)
     VALUES (gen_random_uuid(), $1, $2, $3, 'credit', $4, 'initial_credit', 'e2e F3 seed credit')`,
    [TENANT_ID, fix.actorWalletAccountId, txId, amountCents]
  );
  return txId;
}

/**
 * Ensures wallet has at least `targetCents` via seed credit.
 */
async function ensureWalletBalance(fix: Fixtures, targetCents: number): Promise<void> {
  const cur = (await bankLedgerRepository.calculateBalance(TENANT_ID, fix.actorWalletAccountId)).balanceCents;
  if (cur >= targetCents) return;
  await seedWalletCredit(fix, targetCents - cur);
}

/**
 * Insere obligation fixture (FK bank_transactions + payment_intents).
 * Reusa o padrão validado em F2 E2E.
 */
async function insertObligFixture(
  tenantId: string,
  debtorActorId: string,
  debtorAccountId: string,
  amountCents: number,
  status: string,
  recoveredAmountCents = 0,
  requestedByUserIdForApproval?: string
): Promise<{ obligId: string; fakeTxId: string; fakeIntentId: string; approvalId: string | null }> {
  const credRes = await q(
    `SELECT a.id AS actor_id, ba.id AS account_id
       FROM actors a
       JOIN bank_accounts ba ON ba.actor_id = a.id AND ba.tenant_id = a.tenant_id
      WHERE a.tenant_id=$1 AND a.id != $2
      LIMIT 1`,
    [tenantId, debtorActorId]
  );
  if (!credRes.rows[0]) throw new Error('Sem creditor para obligation fixture');
  const creditorActorId = credRes.rows[0].actor_id;
  const creditorAccountId = credRes.rows[0].account_id;

  const conceptRes = await q(
    `SELECT concept_id FROM concepts WHERE domain='financeiro-payout' LIMIT 1`
  );
  if (!conceptRes.rows[0]) throw new Error('concept financeiro-payout ausente');
  const conceptId = conceptRes.rows[0].concept_id;

  const fakeTxId = uuidv4();
  await q(
    `INSERT INTO bank_transactions
       (id, tenant_id, actor_id, account_id, amount_cents, purpose,
        justification, reference_type, reference_id, concept_id)
     VALUES ($1,$2,$3,$4,$5,'execution','e2e F3 obligation fixture','e2e_obligation_fixture',$6,$7)`,
    [fakeTxId, tenantId, debtorActorId, debtorAccountId, amountCents, fakeTxId, conceptId]
  );

  const fakeIntentId = uuidv4();
  await q(
    `INSERT INTO payment_intents
       (id, tenant_id, actor_id, amount_cents, currency,
        intent_type, gateway, payment_status, reference_id)
     VALUES ($1,$2,$3,$4,'BRL','e2e_fixture','unknown','released_to_actor_wallet',$5)`,
    [fakeIntentId, tenantId, debtorActorId, amountCents, fakeIntentId]
  );

  // Para obligations com status 'approved' ou 'partially_recovered' precisamos
  // de approval_request aprovado vinculado (debitActorWalletForRecovery valida).
  let approvalId: string | null = null;
  if (status === 'approved' || status === 'partially_recovered') {
    if (!requestedByUserIdForApproval) {
      throw new Error('insertObligFixture: requestedByUserIdForApproval requerido para status approved/partially_recovered');
    }
    approvalId = uuidv4();
    await q(
      `INSERT INTO approval_requests
         (id, tenant_id, requested_by_user_id,
          acting_for_actor_id, acting_for_account_id,
          operation_type, operation_data,
          required_approvals, approval_type, status, expires_at)
       VALUES ($1,$2,$3,$4,$5,'actor_wallet_recovery','{}'::jsonb,1,'sequential','approved',NOW()+INTERVAL '7 days')`,
      [approvalId, tenantId, requestedByUserIdForApproval, creditorActorId, creditorAccountId]
    );
  }

  const obligId = uuidv4();
  await q(
    `INSERT INTO actor_wallet_recovery_obligations
       (id, tenant_id,
        debtor_actor_id, debtor_account_id,
        creditor_actor_id, creditor_account_id,
        original_transaction_id, payment_intent_id,
        amount_cents, reason, status, recovered_amount_cents,
        approval_request_id)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'e2e-f3-fixture',$10,$11,$12)`,
    [
      obligId, tenantId, debtorActorId, debtorAccountId,
      creditorActorId, creditorAccountId,
      fakeTxId, fakeIntentId,
      amountCents, status, recoveredAmountCents, approvalId,
    ]
  );
  return { obligId, fakeTxId, fakeIntentId, approvalId };
}

async function cleanupObligFixture(
  f: { obligId: string; fakeTxId: string; fakeIntentId: string; approvalId: string | null }
): Promise<void> {
  // Antes de deletar entries: encontrar bank_transactions criadas pelo drain
  // (referenceType='actor_wallet_recovery'; referenceId aponta para entry.id).
  // Sem essa limpeza, o drain permanentemente reduz o saldo da wallet.
  const entries = await q(
    `SELECT recovery_transaction_id FROM actor_wallet_recovery_obligation_entries WHERE obligation_id=$1`,
    [f.obligId]
  );
  const drainTxIds = entries.rows.map((r: any) => r.recovery_transaction_id).filter((v: any): v is string => Boolean(v));
  if (drainTxIds.length > 0) {
    await q(`DELETE FROM bank_ledger WHERE transaction_id = ANY($1::uuid[])`, [drainTxIds]).catch(() => {});
    await q(`DELETE FROM bank_transactions WHERE id = ANY($1::uuid[])`, [drainTxIds]).catch(() => {});
  }

  await q(`DELETE FROM actor_wallet_recovery_obligation_entries WHERE obligation_id=$1`, [f.obligId]).catch(() => {});
  await q(`DELETE FROM actor_wallet_recovery_obligations WHERE id=$1`, [f.obligId]).catch(() => {});
  await q(`DELETE FROM payment_intents WHERE id=$1`, [f.fakeIntentId]).catch(() => {});
  await q(`DELETE FROM bank_transactions WHERE id=$1`, [f.fakeTxId]).catch(() => {});
  if (f.approvalId) {
    await q(`DELETE FROM approval_votes WHERE approval_request_id=$1`, [f.approvalId]).catch(() => {});
    await q(`DELETE FROM approval_requests WHERE id=$1`, [f.approvalId]).catch(() => {});
  }
}

/**
 * Cleanup das seed credits inseridas pela ensureWalletBalance/seedWalletCredit.
 */
async function cleanupSeedCredits(): Promise<void> {
  await q(
    `DELETE FROM bank_ledger WHERE transaction_id IN (
       SELECT id FROM bank_transactions WHERE tenant_id=$1 AND reference_type='e2e_f3_seed'
     )`,
    [TENANT_ID]
  ).catch(() => {});
  await q(`DELETE FROM bank_transactions WHERE tenant_id=$1 AND reference_type='e2e_f3_seed'`, [TENANT_ID]).catch(() => {});
}

async function cleanupPayoutRequests(ids: string[]): Promise<void> {
  if (!ids.length) return;
  const approvalIds = await q(
    `SELECT approval_request_id FROM actor_wallet_payout_requests WHERE id = ANY($1::uuid[])`,
    [ids]
  );
  // Reverter ledger created by F3 transfers (delete bank_ledger + bank_transactions for ref_type=actor_wallet_payout matching these ids)
  await q(
    `DELETE FROM bank_ledger WHERE transaction_id IN (
       SELECT id FROM bank_transactions WHERE tenant_id=$1 AND reference_type='actor_wallet_payout' AND reference_id = ANY($2::text[])
     )`,
    [TENANT_ID, ids]
  ).catch(() => {});
  await q(
    `DELETE FROM bank_transactions WHERE tenant_id=$1 AND reference_type='actor_wallet_payout' AND reference_id = ANY($2::text[])`,
    [TENANT_ID, ids]
  ).catch(() => {});
  // best-effort: payout_requests é deletável (reseta o gate de request ativo); approval_requests/votes
  // são imutáveis (governança DECISION-0128 / prevent_approval_request_delete) → .catch para não abortar
  // o runner (em efêmero o DB é dropado).
  await q(`DELETE FROM actor_wallet_payout_requests WHERE id = ANY($1::uuid[])`, [ids]).catch(() => {});
  const aIds = approvalIds.rows.map((r: any) => r.approval_request_id).filter(Boolean);
  if (aIds.length) {
    await q(`DELETE FROM approval_votes WHERE approval_request_id = ANY($1::uuid[])`, [aIds]).catch(() => {});
    await q(`DELETE FROM approval_requests WHERE id = ANY($1::uuid[])`, [aIds]).catch(() => {});
  }
}

// ── main ──────────────────────────────────────────────────────────────────────

async function main() {
  await assertEphemeral();
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('E2E F3 ACTOR-WALLET-PAYOUT EXECUTION (DECISION-0058 D2/D3/D4)');
  console.log('═══════════════════════════════════════════════════════════\n');

  const fix = await getFixtures();

  // Pre-flight: garantir saldo mínimo para os testes (runs anteriores podem ter depletado).
  const preBal = (await bankLedgerRepository.calculateBalance(TENANT_ID, fix.actorWalletAccountId)).balanceCents;
  if (preBal < 10000) {
    await seedWalletCredit(fix, 10000 - preBal);
    console.log(`[pre-flight] wallet seed credit ${10000 - preBal} cents (saldo ${preBal} → 10000)`);
  }

  const snapshot0 = await getFinancialSnapshot();
  const createdPayoutIds: string[] = [];
  const obligFixtures: Array<{ obligId: string; fakeTxId: string; fakeIntentId: string; approvalId: string | null }> = [];

  console.log('Fixtures:', {
    userId: fix.userId,
    actorId: fix.actorId,
    actorWalletAccountId: fix.actorWalletAccountId,
    settlementAccountId: fix.settlementAccountId,
    tenantId: TENANT_ID,
  });
  console.log('Snapshot inicial:', snapshot0);
  console.log();

  try {
    // ── T1: happy path ────────────────────────────────────────────────────────
    console.log('T1 — happy path: approved, zero obligations, transfer wallet→settlement, completed');
    try {
      const setup = await setupApprovedPayoutRequest(fix, 1, 't1');
      createdPayoutIds.push(setup.payoutRequestId);
      const settlementBefore = (await getFinancialSnapshot()).settlementBalance;

      const res = await actorWalletPayoutService.executeActorWalletPayout(
        TENANT_ID, setup.payoutRequestId, fix.userId
      );
      const settlementAfter = (await getFinancialSnapshot()).settlementBalance;

      const finalRow = await q(
        `SELECT status, executed_amount_cents, settlement_transaction_id FROM actor_wallet_payout_requests WHERE id=$1`,
        [setup.payoutRequestId]
      );
      const fr = finalRow.rows[0];
      if (
        res.result === 'completed' &&
        res.executedAmountCents === 1 &&
        res.settlementTransactionId &&
        fr.status === 'completed' &&
        Number(fr.executed_amount_cents) === 1 &&
        fr.settlement_transaction_id === res.settlementTransactionId &&
        settlementAfter - settlementBefore === 1
      ) {
        ok('T1', `transfer 1 cent → settlement (Δ=${settlementAfter - settlementBefore})`);
      } else {
        fail('T1', `result=${res.result} exec=${res.executedAmountCents} sttx=${res.settlementTransactionId} fr=${JSON.stringify(fr)} ΔsettBal=${settlementAfter - settlementBefore}`);
      }
    } catch (e: any) {
      fail('T1', e.message);
    }

    // ── T2: pending_approval bloqueia execução ────────────────────────────────
    console.log('T2 — pending_approval bloqueia (PAYOUT_NOT_APPROVED); zero ledger');
    try {
      const idem = `f3-t2-${uuidv4().slice(0, 8)}`;
      const res2 = await actorWalletPayoutService.requestActorWalletPayout({
        tenantId: TENANT_ID, actorId: fix.actorId, requestedByUserId: fix.userId,
        requestedAmountCents: 1, idempotencyKey: idem, reason: 'e2e T2',
      });
      createdPayoutIds.push(res2.payoutRequest.id);
      const ledgerBefore = (await getFinancialSnapshot()).ledger;
      try {
        await actorWalletPayoutService.executeActorWalletPayout(
          TENANT_ID, res2.payoutRequest.id, fix.userId
        );
        fail('T2', 'deveria ter falhado com PAYOUT_NOT_APPROVED');
      } catch (e: any) {
        const ledgerAfter = (await getFinancialSnapshot()).ledger;
        if (e instanceof ActorWalletPayoutError && e.code === 'PAYOUT_NOT_APPROVED' && ledgerAfter === ledgerBefore) {
          ok('T2', 'PAYOUT_NOT_APPROVED + ledger inalterado');
        } else {
          fail('T2', `code=${e.code} Δledger=${ledgerAfter - ledgerBefore}`);
        }
      }
      await cancelPayoutRequest(res2.payoutRequest.id);
    } catch (e: any) {
      fail('T2', e.message);
    }

    // ── T3: completed é idempotente ───────────────────────────────────────────
    console.log('T3 — completed é idempotente: segunda execução retorna existente, zero novo transfer');
    try {
      const setup = await setupApprovedPayoutRequest(fix, 1, 't3');
      createdPayoutIds.push(setup.payoutRequestId);
      const r1 = await actorWalletPayoutService.executeActorWalletPayout(
        TENANT_ID, setup.payoutRequestId, fix.userId
      );
      const ledgerAfter1 = (await getFinancialSnapshot()).ledger;
      const r2 = await actorWalletPayoutService.executeActorWalletPayout(
        TENANT_ID, setup.payoutRequestId, fix.userId
      );
      const ledgerAfter2 = (await getFinancialSnapshot()).ledger;
      if (
        r1.result === 'completed' &&
        r2.result === 'completed_idempotent' &&
        r2.settlementTransactionId === r1.settlementTransactionId &&
        ledgerAfter2 === ledgerAfter1
      ) {
        ok('T3', `r1=completed r2=completed_idempotent mesmo settlementTxId, ledger inalterado`);
      } else {
        fail('T3', `r1=${r1.result} r2=${r2.result} sameTx=${r1.settlementTransactionId === r2.settlementTransactionId} Δledger=${ledgerAfter2 - ledgerAfter1}`);
      }
    } catch (e: any) {
      fail('T3', e.message);
    }

    // ── T4: cancelled/rejected/failed bloqueiam ───────────────────────────────
    console.log('T4 — status terminal bloqueia execução');
    try {
      const setup = await setupApprovedPayoutRequest(fix, 1, 't4');
      createdPayoutIds.push(setup.payoutRequestId);
      await q(`UPDATE actor_wallet_payout_requests SET status='cancelled' WHERE id=$1`, [setup.payoutRequestId]);
      try {
        await actorWalletPayoutService.executeActorWalletPayout(TENANT_ID, setup.payoutRequestId, fix.userId);
        fail('T4', 'cancelled deveria bloquear');
      } catch (e: any) {
        if (e instanceof ActorWalletPayoutError && e.code === 'PAYOUT_TERMINAL_BLOCKED') {
          ok('T4', 'cancelled → PAYOUT_TERMINAL_BLOCKED');
        } else {
          fail('T4', 'erro inesperado: ' + e.message);
        }
      }
    } catch (e: any) {
      fail('T4', e.message);
    }

    // ── T5: obligation approved é drenada antes do payout ─────────────────────
    console.log('T5 — obligation approved drenada antes; payout executa excedente');
    await ensureNoActiveRequest(fix.actorId);
    try {
      // setup approved request com valor moderado
      const setup = await setupApprovedPayoutRequest(fix, 100, 't5');
      createdPayoutIds.push(setup.payoutRequestId);
      // obligation de 50 (approved) — drain pegará 50 antes do payout
      const oblig = await insertObligFixture(TENANT_ID, fix.actorId, fix.actorWalletAccountId, 50, 'approved', 0, fix.userId);
      obligFixtures.push(oblig);

      const walletBalBefore = (await getFinancialSnapshot()).walletBalance;
      const res = await actorWalletPayoutService.executeActorWalletPayout(
        TENANT_ID, setup.payoutRequestId, fix.userId
      );
      const walletBalAfter = (await getFinancialSnapshot()).walletBalance;

      // Δwallet = -(drainAmount + payoutAmount) = -(50 + 100) = -150
      if (
        res.result === 'completed' &&
        res.executedAmountCents === 100 &&
        res.drainResult.totalDrainedCents === 50 &&
        walletBalBefore - walletBalAfter === 150
      ) {
        ok('T5', `drain=50, payout=100, Δwallet=-${walletBalBefore - walletBalAfter}`);
      } else {
        fail('T5', `result=${res.result} exec=${res.executedAmountCents} drain=${res.drainResult.totalDrainedCents} Δwallet=${walletBalBefore - walletBalAfter}`);
      }
    } catch (e: any) {
      fail('T5', e.message);
    }

    // ── T6: obligation partially_recovered drenada pelo restante ─────────────
    console.log('T6 — obligation partially_recovered drenada pelo restante (amount-recovered)');
    await ensureNoActiveRequest(fix.actorId);
    try {
      const setup = await setupApprovedPayoutRequest(fix, 100, 't6');
      createdPayoutIds.push(setup.payoutRequestId);
      // amount=80, recovered=30 → restante=50
      const oblig = await insertObligFixture(TENANT_ID, fix.actorId, fix.actorWalletAccountId, 80, 'partially_recovered', 30, fix.userId);
      obligFixtures.push(oblig);

      const walletBalBefore = (await getFinancialSnapshot()).walletBalance;
      const res = await actorWalletPayoutService.executeActorWalletPayout(
        TENANT_ID, setup.payoutRequestId, fix.userId
      );
      const walletBalAfter = (await getFinancialSnapshot()).walletBalance;

      // drain = 50 (restante), payout = 100, Δwallet = -150
      if (
        res.result === 'completed' &&
        res.executedAmountCents === 100 &&
        res.drainResult.totalDrainedCents === 50 &&
        walletBalBefore - walletBalAfter === 150
      ) {
        ok('T6', `partially_recovered: drain=50 (restante), payout=100`);
      } else {
        fail('T6', `result=${res.result} exec=${res.executedAmountCents} drain=${res.drainResult.totalDrainedCents}`);
      }
    } catch (e: any) {
      fail('T6', e.message);
    }

    // ── T7: D-3 — saldo pós-drain < requested → completed parcial ────────────
    console.log('T7 — D-3: saldo pós-drain < requested → completed parcial');
    await ensureNoActiveRequest(fix.actorId);
    try {
      // setup request com valor moderado
      const setup = await setupApprovedPayoutRequest(fix, 200, 't7');
      createdPayoutIds.push(setup.payoutRequestId);
      // Vamos descobrir saldo atual da wallet via service (não usamos service de payout)
      const balanceNow = await bankLedgerRepository.calculateBalance(TENANT_ID, fix.actorWalletAccountId);
      // obligation que vai drenar quase todo o saldo, deixando apenas 50 cents disponível para payout
      const drainAmount = Math.max(1, balanceNow.balanceCents - 50);
      const oblig = await insertObligFixture(TENANT_ID, fix.actorId, fix.actorWalletAccountId, drainAmount, 'approved', 0, fix.userId);
      obligFixtures.push(oblig);

      const res = await actorWalletPayoutService.executeActorWalletPayout(
        TENANT_ID, setup.payoutRequestId, fix.userId
      );

      // Esperado: drain=drainAmount, payout = min(200, 50) = 50 (parcial)
      if (
        res.result === 'completed' &&
        res.executedAmountCents === 50 &&
        res.executedAmountCents < 200 &&
        res.drainResult.totalDrainedCents === drainAmount
      ) {
        ok('T7', `parcial: requested=200 executed=50 drain=${drainAmount}`);
      } else {
        fail('T7', `result=${res.result} exec=${res.executedAmountCents} drain=${res.drainResult.totalDrainedCents}`);
      }
    } catch (e: any) {
      fail('T7', e.message);
    }

    // ── T8: D-4 — saldo pós-drain = 0 → failed (zero transfer) ───────────────
    // Após T7 wallet ≈ 0. Cria request via direct INSERT (F2 rejeitaria por
    // INSUFFICIENT), executa F3, espera failed/zero_available_after_recovery_drain.
    console.log('T8 — D-4: saldo pós-drain zero → failed; zero transfer');
    await ensureNoActiveRequest(fix.actorId);
    try {
      // Direct INSERT (bypassa F2's INSUFFICIENT gate)
      const setup = await setupApprovedPayoutRequestDirect(fix, 100, 100, 't8');
      createdPayoutIds.push(setup.payoutRequestId);

      const balBefore = await bankLedgerRepository.calculateBalance(TENANT_ID, fix.actorWalletAccountId);
      const res = await actorWalletPayoutService.executeActorWalletPayout(
        TENANT_ID, setup.payoutRequestId, fix.userId
      );
      const reqRow = await q(`SELECT status, failed_reason, executed_amount_cents, settlement_transaction_id FROM actor_wallet_payout_requests WHERE id=$1`, [setup.payoutRequestId]);
      const rr = reqRow.rows[0];

      if (
        res.result === 'failed_zero_after_drain' &&
        res.executedAmountCents === 0 &&
        res.settlementTransactionId === null &&
        rr.status === 'failed' &&
        rr.failed_reason === 'zero_available_after_recovery_drain' &&
        rr.settlement_transaction_id === null &&
        balBefore.balanceCents === 0
      ) {
        ok('T8', `wallet=0, F3 → failed/zero_available_after_recovery_drain, settlement_tx=null`);
      } else {
        fail('T8', `result=${res.result} status=${rr.status} reason=${rr.failed_reason} sttx=${rr.settlement_transaction_id} balBefore=${balBefore.balanceCents}`);
      }
    } catch (e: any) {
      fail('T8', e.message);
    }

    // ── Pós-T8: restaurar wallet para os testes seguintes ────────────────────
    // T7 depletou wallet. Seed credit para T9-T18 (que precisam de saldo > 0).
    await ensureWalletBalance(fix, 2000);

    // ── T9: rollback técnico — settlement account ausente ────────────────────
    console.log('T9 — rollback: settlement account ausente → request volta a approved, ledger intacto');
    await ensureNoActiveRequest(fix.actorId);
    try {
      const setup = await setupApprovedPayoutRequest(fix, 1, 't9');
      createdPayoutIds.push(setup.payoutRequestId);
      const ledgerBefore = (await getFinancialSnapshot()).ledger;
      // Temporariamente trocar account_type para esconder a settlement account
      await q(`UPDATE bank_accounts SET account_type='credit' WHERE id=$1`, [fix.settlementAccountId]);
      let restored = false;
      try {
        await actorWalletPayoutService.executeActorWalletPayout(TENANT_ID, setup.payoutRequestId, fix.userId);
        fail('T9', 'deveria ter falhado com SETTLEMENT_ACCOUNT_MISSING');
      } catch (e: any) {
        // Restaurar settlement antes de qualquer assert (defensivo)
        await q(`UPDATE bank_accounts SET account_type='bank_settlement' WHERE id=$1`, [fix.settlementAccountId]);
        restored = true;
        if (e instanceof ActorWalletPayoutError && e.code === 'PAYOUT_SETTLEMENT_ACCOUNT_MISSING') {
          // Verify request status rolled back to 'approved'
          const reqRow = await q(`SELECT status FROM actor_wallet_payout_requests WHERE id=$1`, [setup.payoutRequestId]);
          const ledgerAfter = (await getFinancialSnapshot()).ledger;
          if (reqRow.rows[0].status === 'approved' && ledgerAfter === ledgerBefore) {
            ok('T9', `SETTLEMENT_ACCOUNT_MISSING + status=approved (rollback) + ledger intacto`);
          } else {
            fail('T9', `status=${reqRow.rows[0].status} Δledger=${ledgerAfter - ledgerBefore}`);
          }
        } else {
          fail('T9', 'erro inesperado: ' + e.message);
        }
      } finally {
        if (!restored) {
          await q(`UPDATE bank_accounts SET account_type='bank_settlement' WHERE id=$1`, [fix.settlementAccountId]);
        }
      }
      // Cancel the still-approved request to free active-gate
      await cancelPayoutRequest(setup.payoutRequestId);
    } catch (e: any) {
      fail('T9', e.message);
      // best effort restore
      await q(`UPDATE bank_accounts SET account_type='bank_settlement' WHERE id=$1`, [fix.settlementAccountId]).catch(() => {});
    }

    // ── T10: execução concorrente do mesmo request ────────────────────────────
    console.log('T10 — execução concorrente: uma sucede, outra falha com ALREADY_PROCESSING ou completed_idempotent');
    await ensureNoActiveRequest(fix.actorId);
    try {
      const setup = await setupApprovedPayoutRequest(fix, 1, 't10');
      createdPayoutIds.push(setup.payoutRequestId);
      const [r1, r2] = await Promise.allSettled([
        actorWalletPayoutService.executeActorWalletPayout(TENANT_ID, setup.payoutRequestId, fix.userId),
        actorWalletPayoutService.executeActorWalletPayout(TENANT_ID, setup.payoutRequestId, fix.userId),
      ]);
      // Por causa do SELECT FOR UPDATE, a segunda chamada espera. Quando libera,
      // status já é 'completed' → retorna completed_idempotent.
      const fulfilled = [r1, r2].filter(r => r.status === 'fulfilled') as PromiseFulfilledResult<any>[];
      const rejected = [r1, r2].filter(r => r.status === 'rejected') as PromiseRejectedResult[];
      const completed = fulfilled.find(r => r.value.result === 'completed');
      const idempotent = fulfilled.find(r => r.value.result === 'completed_idempotent');
      const alreadyProcessing = rejected.find(r => (r.reason as ActorWalletPayoutError).code === 'PAYOUT_ALREADY_PROCESSING');
      // Aceita ambas variações: (completed + idempotent) ou (completed + ALREADY_PROCESSING)
      if (completed && (idempotent || alreadyProcessing)) {
        ok('T10', `r1.completed + ${idempotent ? 'r2.idempotent' : 'r2.ALREADY_PROCESSING'} — zero double-payout`);
      } else {
        fail('T10', `r1=${r1.status === 'fulfilled' ? r1.value.result : r1.reason?.code} r2=${r2.status === 'fulfilled' ? r2.value.result : r2.reason?.code}`);
      }
    } catch (e: any) {
      fail('T10', e.message);
    }

    // ── T11: C3.1 concurrent — drain externo e F3 serializam sem deadlock ────
    console.log('T11 — C3.1 concurrent: drain externo + F3 serializam via FOR UPDATE; sem deadlock');
    await ensureNoActiveRequest(fix.actorId);
    try {
      const setup = await setupApprovedPayoutRequest(fix, 50, 't11');
      createdPayoutIds.push(setup.payoutRequestId);
      const oblig = await insertObligFixture(TENANT_ID, fix.actorId, fix.actorWalletAccountId, 30, 'approved', 0, fix.userId);
      obligFixtures.push(oblig);

      // Disparar drain externo (C3.1) e F3 em paralelo
      const drainClient = await getClientWithTenant(TENANT_ID);
      const drainPromise = (async () => {
        try {
          await drainClient.query('BEGIN');
          const r = await drainRecoveryObligationsForCredit(TENANT_ID, fix.actorId, 30, drainClient);
          await drainClient.query('COMMIT');
          return r;
        } catch (e) {
          await drainClient.query('ROLLBACK').catch(() => {});
          throw e;
        } finally {
          drainClient.release();
        }
      })();

      const [drainResult, payoutResult] = await Promise.allSettled([
        drainPromise,
        actorWalletPayoutService.executeActorWalletPayout(TENANT_ID, setup.payoutRequestId, fix.userId),
      ]);

      // Sem deadlock — ambos devem completar (não importa quem foi primeiro)
      if (
        drainResult.status === 'fulfilled' &&
        payoutResult.status === 'fulfilled' &&
        (payoutResult.value.result === 'completed' || payoutResult.value.result === 'failed_zero_after_drain')
      ) {
        ok('T11', `drain ok + payout ${payoutResult.value.result} sem deadlock`);
      } else {
        const dErr = drainResult.status === 'rejected' ? (drainResult.reason as Error).message : 'ok';
        const pErr = payoutResult.status === 'rejected' ? (payoutResult.reason as Error).message : payoutResult.value.result;
        fail('T11', `drain=${dErr} payout=${pErr}`);
      }
    } catch (e: any) {
      fail('T11', e.message);
    }

    // ── T12: idempotência por reference (mesma chamada repetida) ─────────────
    console.log('T12 — idempotência: segunda execução do mesmo request → completed_idempotent, zero novo transfer');
    await ensureNoActiveRequest(fix.actorId);
    try {
      const setup = await setupApprovedPayoutRequest(fix, 1, 't12');
      createdPayoutIds.push(setup.payoutRequestId);
      await actorWalletPayoutService.executeActorWalletPayout(TENANT_ID, setup.payoutRequestId, fix.userId);
      const txCountBefore = (await getFinancialSnapshot()).txs;
      const r2 = await actorWalletPayoutService.executeActorWalletPayout(TENANT_ID, setup.payoutRequestId, fix.userId);
      const txCountAfter = (await getFinancialSnapshot()).txs;
      if (r2.result === 'completed_idempotent' && txCountAfter === txCountBefore) {
        ok('T12', 'completed_idempotent + zero novo bank_transaction');
      } else {
        fail('T12', `r2=${r2.result} Δtxs=${txCountAfter - txCountBefore}`);
      }
    } catch (e: any) {
      fail('T12', e.message);
    }

    // ── T13: payout_requests legado intocado ─────────────────────────────────
    console.log('T13 — payout_requests legado intocado');
    try {
      const snapNow = await getFinancialSnapshot();
      if (snapNow.payouts === snapshot0.payouts) {
        ok('T13', `payout_requests=${snapNow.payouts} (inalterado)`);
      } else {
        fail('T13', `payout_requests mudou: antes=${snapshot0.payouts} agora=${snapNow.payouts}`);
      }
    } catch (e: any) {
      fail('T13', e.message);
    }

    // ── T14: bank_settlements table intocada (F3 não cria settlement rows) ────
    console.log('T14 — bank_settlements row count inalterada (F3 não toca tabela legada de settlements)');
    try {
      const snapNow = await getFinancialSnapshot();
      if (snapNow.bankSettlementsCount === snapshot0.bankSettlementsCount) {
        ok('T14', `bank_settlements=${snapNow.bankSettlementsCount} (inalterado — F3 usa apenas account_type)`);
      } else {
        fail('T14', `bank_settlements mudou: antes=${snapshot0.bankSettlementsCount} agora=${snapNow.bankSettlementsCount}`);
      }
    } catch (e: any) {
      fail('T14', e.message);
    }

    // ── T15: ledger double-entry ──────────────────────────────────────────────
    console.log('T15 — ledger double-entry: cada payout transfer cria 1 debit + 1 credit');
    try {
      // Buscar TODAS as transactions de payout deste run + verificar 1 debit/1 credit por tx
      const txs = await q(
        `SELECT id FROM bank_transactions
          WHERE tenant_id=$1 AND reference_type='actor_wallet_payout' AND reference_id = ANY($2::text[])`,
        [TENANT_ID, createdPayoutIds]
      );
      let mismatched = 0;
      for (const tx of txs.rows) {
        const entries = await q(
          `SELECT direction, COUNT(*)::int AS n FROM bank_ledger WHERE tenant_id=$1 AND transaction_id=$2 GROUP BY direction`,
          [TENANT_ID, tx.id]
        );
        const byDir: Record<string, number> = {};
        for (const row of entries.rows) byDir[row.direction] = row.n;
        if (byDir.credit !== 1 || byDir.debit !== 1) mismatched++;
      }
      if (mismatched === 0 && txs.rows.length > 0) {
        ok('T15', `${txs.rows.length} payout tx(s) com 1 debit + 1 credit cada`);
      } else if (txs.rows.length === 0) {
        fail('T15', 'nenhum bank_transaction de payout encontrado para verificar');
      } else {
        fail('T15', `${mismatched}/${txs.rows.length} payout tx(s) sem double-entry correto`);
      }
    } catch (e: any) {
      fail('T15', e.message);
    }

    // ── T16: F2 regression — requestActorWalletPayout cria pending_approval ──
    console.log('T16 — F2 regression: requestActorWalletPayout ainda cria pending_approval');
    await ensureNoActiveRequest(fix.actorId);
    try {
      const idem = `f3-t16-${uuidv4().slice(0, 8)}`;
      const res = await actorWalletPayoutService.requestActorWalletPayout({
        tenantId: TENANT_ID, actorId: fix.actorId, requestedByUserId: fix.userId,
        requestedAmountCents: 1, idempotencyKey: idem, reason: 'e2e T16 F2 regression',
      });
      createdPayoutIds.push(res.payoutRequest.id);
      if (res.payoutRequest.status === 'pending_approval') {
        ok('T16', 'F2 regression: pending_approval criado normalmente');
      } else {
        fail('T16', `status inesperado: ${res.payoutRequest.status}`);
      }
      await cancelPayoutRequest(res.payoutRequest.id);
    } catch (e: any) {
      fail('T16', e.message);
    }

    // ── T17: C3.1 regression — drainRecoveryObligationsForCredit independente ─
    console.log('T17 — C3.1 regression: drainRecoveryObligationsForCredit drena obligation isolada');
    try {
      const oblig = await insertObligFixture(TENANT_ID, fix.actorId, fix.actorWalletAccountId, 10, 'approved', 0, fix.userId);
      obligFixtures.push(oblig);
      const c = await getClientWithTenant(TENANT_ID);
      try {
        await c.query('BEGIN');
        const r = await drainRecoveryObligationsForCredit(TENANT_ID, fix.actorId, 10, c);
        await c.query('COMMIT');
        if (r.totalDrainedCents === 10 && r.obligationsTouched === 1) {
          ok('T17', `drain=10 obligationsTouched=1 — C3.1 íntegro`);
        } else {
          fail('T17', `drain=${r.totalDrainedCents} touched=${r.obligationsTouched}`);
        }
      } finally {
        c.release();
      }
    } catch (e: any) {
      fail('T17', e.message);
    }

    // ── T18: C7 regression — obligation 'recovered' não reentra no drain ─────
    console.log('T18 — C7 regression: obligation recovered/finalizada não é drenada');
    try {
      const oblig = await insertObligFixture(TENANT_ID, fix.actorId, fix.actorWalletAccountId, 20, 'recovered', 20);
      obligFixtures.push(oblig);
      const c = await getClientWithTenant(TENANT_ID);
      try {
        await c.query('BEGIN');
        const r = await drainRecoveryObligationsForCredit(TENANT_ID, fix.actorId, 100, c);
        await c.query('COMMIT');
        // obligation 'recovered' NÃO entra no drain (status filter)
        if (r.obligationsTouched === 0 && r.totalDrainedCents === 0) {
          ok('T18', 'recovered não drenado (C7 boundary respeitado)');
        } else {
          fail('T18', `touched=${r.obligationsTouched} drained=${r.totalDrainedCents}`);
        }
      } finally {
        c.release();
      }
    } catch (e: any) {
      fail('T18', e.message);
    }

  } finally {
    // Cleanup
    for (const f of obligFixtures) {
      await cleanupObligFixture(f).catch(() => {});
    }
    await cleanupPayoutRequests(createdPayoutIds);
    await cleanupSeedCredits();
    // Garantia: restaurar settlement account_type (caso T9 tenha falhado de forma anômala)
    await q(`UPDATE bank_accounts SET account_type='bank_settlement' WHERE id=$1`, [fix.settlementAccountId]).catch(() => {});
  }

  // ── summary ─────────────────────────────────────────────────────────────────
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
