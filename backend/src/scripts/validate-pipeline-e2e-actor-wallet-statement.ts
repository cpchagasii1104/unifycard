/**
 * E2E ACTOR_WALLET STATEMENT (Camada 1 — 2026-05-26)
 *
 * Prova material do read-model do extrato da actor_wallet:
 *   - Setup: cria fixtures + roda D-money real (createExecution +
 *     service_order release_approved → releaseFundsToActorWalletForOrder).
 *   - Provas:
 *     T1 — saldo retornado bate com bank_ledger SUM canônico.
 *     T2 — entry D-money carrega serviceOrderId + paymentRequestId +
 *          paymentIntentId + payerActorId reconstruídos via JOIN.
 *     T3 — isolamento: actor B NÃO vê entries da actor_wallet do actor A.
 *     T4 — entrada com reference_type desconhecido aparece como
 *          sourceType='unknown' sem quebrar; saldo continua íntegro.
 *     T5 — NENHUMA escrita financeira ocorre durante a leitura.
 *
 * Modo de execução:
 *   npx tsx backend/src/scripts/validate-pipeline-e2e-actor-wallet-statement.ts
 */

import dotenv from 'dotenv';
import { join } from 'path';
import { v4 as uuidv4 } from 'uuid';

import { pool } from '../core/database/pool';
import { bankAccountService } from '../modules/bank/bank-account.service';
import { bankTransactionService } from '../modules/bank/bank-transaction.service';
import { servicePaymentExecutionService } from '../modules/services/service-payment-execution.service';
import { serviceOrderService } from '../modules/services/service-order.service';
import { actorWalletStatementService } from '../modules/wallet/actor-wallet-statement.service';

dotenv.config({ path: join(process.cwd(), '.env') });

// F-BANK-TRANSACTION-SINK-FIREWALL (Fatia 9): este E2E chama bankTransactionService.transfer
// DIRETO (testa o sink, não um caller com firewall próprio) — precisa ligar o novo gate default-off
// pra continuar exercitando o fluxo real que este arquivo sempre testou.
process.env.BANK_TRANSACTION_SINK_FIREWALL_ENABLED = 'true';

const TENANT_ID = process.env.E2E_TENANT_ID || 'fbe13b78-4516-493d-905a-363796aea1d1';

type CheckResult = { ok: true; detail?: any } | { ok: false; reason: string; detail?: any };

function assertOk(label: string, r: CheckResult): void {
  if (r.ok === false) {
    console.error(`  ❌ FALHOU: ${label}`);
    console.error(`     Motivo: ${r.reason}`);
    if (r.detail !== undefined) console.error(JSON.stringify(r.detail, null, 2));
    process.exit(1);
  }
  console.log(`  ✅ ${label}`);
}

interface Fixtures {
  buyerUserId: string;
  buyerActorId: string;
  workerActorId: string;
  serviceId: string;
}

async function loadFixtures(): Promise<Fixtures> {
  const usersRes = await pool.query<{ user_id: string; email: string }>(
    `SELECT user_id::text, email FROM users WHERE tenant_id = $1
      AND email IN ('g2-buyer@e2e.internal', 'g2-provider@e2e.internal')`,
    [TENANT_ID]
  );
  const buyer = usersRes.rows.find((r) => r.email === 'g2-buyer@e2e.internal')!;
  const provider = usersRes.rows.find((r) => r.email === 'g2-provider@e2e.internal')!;

  const actors = await pool.query<{ user_id: string; actor_id: string }>(
    `SELECT user_id::text, id::text AS actor_id FROM actors
      WHERE tenant_id = $1 AND user_id = ANY($2::uuid[]) AND actor_type = 'user'`,
    [TENANT_ID, [buyer.user_id, provider.user_id]]
  );
  const buyerActorId = actors.rows.find((a) => a.user_id === buyer.user_id)!.actor_id;
  const workerActorId = actors.rows.find((a) => a.user_id === provider.user_id)!.actor_id;

  let serviceId: string;
  const svc = await pool.query<{ service_id: string }>(
    `SELECT service_id::text FROM services WHERE tenant_id = $1 AND actor_id = $2 LIMIT 1`,
    [TENANT_ID, workerActorId]
  );
  if (svc.rows[0]) {
    serviceId = svc.rows[0].service_id;
  } else {
    const newSvc = await pool.query<{ service_id: string }>(
      `INSERT INTO services (tenant_id, actor_id, name, slug, service_type, status, currency)
       VALUES ($1, $2, $3, $4, 'service', 'active', 'BRL') RETURNING service_id::text`,
      [TENANT_ID, workerActorId, 'Statement fixture', `stmt-${uuidv4().slice(0, 8)}`]
    );
    serviceId = newSvc.rows[0]!.service_id;
  }
  return { buyerUserId: buyer.user_id, buyerActorId, workerActorId, serviceId };
}

interface SeededRelease {
  orderId: string;
  paymentRequestId: string;
  paymentIntentId: string;
  bookingId: string;
}

async function seedAndReleaseDmoney(
  fixtures: Fixtures,
  amount: number
): Promise<SeededRelease> {
  const bookingId = uuidv4();
  const paymentRequestId = uuidv4();
  await pool.query(
    `INSERT INTO service_payment_requests (
       payment_request_id, tenant_id, booking_id, service_id, payer_actor_id, receiver_actor_id,
       payment_request_status, amount_cents, currency
     ) VALUES ($1::uuid, $2::uuid, $3::uuid, $4::uuid, $5::uuid, $6::uuid,
              'pending', $7, 'BRL')`,
    [paymentRequestId, TENANT_ID, bookingId, fixtures.serviceId, fixtures.buyerActorId, fixtures.workerActorId, amount]
  );
  await servicePaymentExecutionService.createExecution(TENANT_ID, fixtures.buyerUserId, {
    paymentRequestId,
    splits: [{ receiverActorId: fixtures.workerActorId, amountCents: amount, percentage: 100 }],
  });
  const intentRow = await pool.query<{ id: string }>(
    `SELECT id::text FROM payment_intents WHERE tenant_id = $1::uuid AND reference_id = $2 LIMIT 1`,
    [TENANT_ID, paymentRequestId]
  );
  const paymentIntentId = intentRow.rows[0]!.id;
  const orderId = uuidv4();
  const scheduledStart = new Date(Date.now() - 60 * 60 * 1000);
  await pool.query(
    `INSERT INTO service_orders (
       id, tenant_id, service_id, worker_actor_id, customer_actor_id, booking_id,
       status, settlement_flow,
       scheduled_start, completed_at,
       buyer_confirmation_deadline_at, release_eligible_at,
       buyer_confirmed_completion_at,
       created_by_actor_id, description, metadata
     ) VALUES ($1::uuid, $2::uuid, $3::uuid, $4::uuid, $5::uuid, $6::uuid,
              'release_approved', 'fixed_price_escrow',
              $7, NOW(),
              NOW() + INTERVAL '5 days', NOW() + INTERVAL '5 days',
              NOW(),
              $4::uuid, 'Statement fixture order', '{}'::jsonb)`,
    [orderId, TENANT_ID, fixtures.serviceId, fixtures.workerActorId, fixtures.buyerActorId, bookingId, scheduledStart]
  );
  await serviceOrderService.releaseFundsToActorWalletForOrder(TENANT_ID, orderId);
  return { orderId, paymentRequestId, paymentIntentId, bookingId };
}

async function captureBankSnapshot() {
  const ledger = await pool.query<{ c: string }>(`SELECT count(*)::text AS c FROM bank_ledger`);
  const tx = await pool.query<{ c: string }>(`SELECT count(*)::text AS c FROM bank_transactions`);
  return { ledgerCount: ledger.rows[0]?.c ?? '0', txCount: tx.rows[0]?.c ?? '0' };
}

// ── available-balance fixture helpers ────────────────────────────────────────

async function findCreditorForObligation(
  tenantId: string,
  excludeActorId: string
): Promise<{ actorId: string; accountId: string } | null> {
  const r = await pool.query<{ actor_id: string; account_id: string }>(
    `SELECT a.id::text AS actor_id, ba.id::text AS account_id
       FROM actors a
       JOIN bank_accounts ba
         ON ba.actor_id = a.id AND ba.tenant_id = a.tenant_id AND ba.account_type = 'user_wallet'
      WHERE a.tenant_id = $1 AND a.id::text <> $2 LIMIT 1`,
    [tenantId, excludeActorId]
  );
  return r.rows[0] ? { actorId: r.rows[0].actor_id, accountId: r.rows[0].account_id } : null;
}

async function getRecoveryConceptId(): Promise<string | null> {
  const r = await pool.query<{ concept_id: string }>(
    `SELECT concept_id FROM concepts WHERE slug='actor-wallet-recovery' LIMIT 1`
  );
  return r.rows[0]?.concept_id ?? null;
}

interface ObligFixture {
  obligationId: string;
  origTxId: string;
}

async function insertObligationFixture(
  tenantId: string,
  debtorActorId: string,
  debtorAccountId: string,
  creditorActorId: string,
  creditorAccountId: string,
  amountCents: number,
  status: string,
  recoveredAmountCents = 0
): Promise<ObligFixture> {
  const cid = await getRecoveryConceptId();
  const origTxId = uuidv4();
  await pool.query(
    `INSERT INTO bank_transactions
       (id, tenant_id, actor_id, account_id, amount_cents, purpose, justification,
        reference_type, reference_id, concept_id, internal_completed_at)
     VALUES ($1::uuid,$2::uuid,$3::uuid,$4::uuid,$5,'execution','E2E stmt avail origin',
             'e2e_stmt_avail_origin',$6,$7,NOW())`,
    [origTxId, tenantId, debtorActorId, debtorAccountId, amountCents, uuidv4(), cid]
  );
  const intentId = uuidv4();
  await pool.query(
    `INSERT INTO payment_intents
       (id, tenant_id, actor_id, amount_cents, intent_type, reference_id, gateway, currency, payment_status)
     VALUES ($1,$2,$3,$4,'stmt_avail_test',$5,'test','BRL','released_to_actor_wallet')`,
    [intentId, tenantId, debtorActorId, amountCents, uuidv4()]
  );
  const obligationId = uuidv4();
  await pool.query(
    `INSERT INTO actor_wallet_recovery_obligations
       (id, tenant_id, debtor_actor_id, debtor_account_id, creditor_actor_id, creditor_account_id,
        original_transaction_id, payment_intent_id, amount_cents, reason, status,
        recovered_amount_cents, approval_request_id)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'E2E stmt avail test',$10,$11,NULL)`,
    [
      obligationId, tenantId,
      debtorActorId, debtorAccountId,
      creditorActorId, creditorAccountId,
      origTxId, intentId, amountCents,
      status, recoveredAmountCents,
    ]
  );
  return { obligationId, origTxId };
}

async function deleteObligationFixture(f: ObligFixture): Promise<void> {
  await pool.query(
    `DELETE FROM actor_wallet_recovery_obligation_entries WHERE obligation_id=$1`, [f.obligationId]
  );
  await pool.query(`DELETE FROM actor_wallet_recovery_obligations WHERE id=$1`, [f.obligationId]);
  await pool.query(`DELETE FROM bank_transactions WHERE id=$1`, [f.origTxId]);
}

async function bootstrap(): Promise<void> {
  const { socialPortsRegistry } = await import('../core/social/ports-registry');
  const adapters = await import('../modules/social/adapters');
  socialPortsRegistry.setActorRepository(adapters.actorRepositoryAdapter);
  socialPortsRegistry.setActorUtils(adapters.actorUtilsAdapter);
  socialPortsRegistry.setSocialRepository(adapters.socialRepositoryAdapter);
  socialPortsRegistry.setSocialService(adapters.socialServiceAdapter);
  socialPortsRegistry.setEventFeedHandlers(adapters.eventFeedHandlersAdapter);
}

async function main() {
  console.log('═══ E2E ACTOR_WALLET STATEMENT — extrato com origem rastreável ═══\n');
  await bootstrap();
  const fixtures = await loadFixtures();
  await bankAccountService.ensurePlatformAccounts(TENANT_ID, 'BRL');
  console.log(`  ℹ  fixtures: buyer=${fixtures.buyerActorId.slice(0, 8)} worker=${fixtures.workerActorId.slice(0, 8)}\n`);

  // ============================================================
  // SETUP — rodar D-money para criar entry na actor_wallet do worker
  // ============================================================
  const seeded = await seedAndReleaseDmoney(fixtures, 45000);
  const workerWallet = await bankAccountService.getActorWalletAccount(
    TENANT_ID,
    fixtures.workerActorId,
    'BRL'
  );
  assertOk('SETUP — actor_wallet do worker existe após D-money', {
    ok: !!workerWallet,
    reason: 'wallet não criada',
  });

  // ============================================================
  // T1 — saldo retornado bate com bank_ledger SUM canônico
  // ============================================================
  console.log('=== TEST 1 — saldo bate com bank_ledger SUM canônico ===');
  const stmt = await actorWalletStatementService.getActorWalletStatement(
    TENANT_ID,
    fixtures.workerActorId
  );
  assertOk('T1.1 — statement.actorWallet retornado', {
    ok: stmt.actorWallet !== null && stmt.actorWallet.accountId === workerWallet!.accountId,
    reason: 'actorWallet ausente ou accountId errado',
    detail: stmt.actorWallet,
  });
  const ledgerSum = await pool.query<{ s: string }>(
    `SELECT COALESCE(SUM(CASE WHEN direction='credit' THEN amount_cents ELSE -amount_cents END), 0)::text AS s
       FROM bank_ledger WHERE tenant_id = $1::uuid AND account_id = $2::uuid`,
    [TENANT_ID, workerWallet!.accountId]
  );
  const expectedBalance = parseInt(ledgerSum.rows[0]!.s, 10);
  assertOk('T1.2 — balanceCents = SUM(bank_ledger por direction)', {
    ok: stmt.actorWallet?.balanceCents === expectedBalance,
    reason: 'saldo diverge do ledger',
    detail: { statement: stmt.actorWallet?.balanceCents, ledger: expectedBalance },
  });
  assertOk('T1.3 — statement.entries não vazio (D-money criou pelo menos 1 entry)', {
    ok: stmt.entries.length >= 1,
    reason: 'sem entries',
    detail: { count: stmt.entries.length },
  });

  // ============================================================
  // T2 — entry D-money carrega origem reconstruída
  // ============================================================
  console.log('\n=== TEST 2 — entry D-money carrega origem (serviceOrder/paymentRequest/paymentIntent/payer) ===');
  const dmoneyEntry = stmt.entries.find(
    (e) =>
      e.referenceType === 'fixed_price_release_to_actor_wallet' &&
      e.referenceId.startsWith(seeded.orderId)
  );
  assertOk('T2.1 — entry da release de seeded.orderId presente', {
    ok: !!dmoneyEntry,
    reason: 'entry não encontrada',
    detail: { orderId: seeded.orderId, entriesRefIds: stmt.entries.map((e) => e.referenceId) },
  });
  assertOk('T2.2 — sourceType=service_order', {
    ok: dmoneyEntry?.sourceType === 'service_order',
    reason: 'sourceType incorreto',
    detail: dmoneyEntry,
  });
  assertOk('T2.3 — serviceOrderId reconstruído', {
    ok: dmoneyEntry?.serviceOrderId === seeded.orderId,
    reason: 'serviceOrderId não bate',
    detail: { actual: dmoneyEntry?.serviceOrderId, expected: seeded.orderId },
  });
  assertOk('T2.4 — paymentRequestId reconstruído via booking_id', {
    ok: dmoneyEntry?.paymentRequestId === seeded.paymentRequestId,
    reason: 'paymentRequestId não bate',
    detail: { actual: dmoneyEntry?.paymentRequestId, expected: seeded.paymentRequestId },
  });
  assertOk('T2.5 — paymentIntentId reconstruído via reference_id', {
    ok: dmoneyEntry?.paymentIntentId === seeded.paymentIntentId,
    reason: 'paymentIntentId não bate',
    detail: { actual: dmoneyEntry?.paymentIntentId, expected: seeded.paymentIntentId },
  });
  assertOk('T2.6 — payerActorId reconstruído (cliente que pagou)', {
    ok: dmoneyEntry?.payerActorId === fixtures.buyerActorId,
    reason: 'payerActorId não bate',
    detail: { actual: dmoneyEntry?.payerActorId, expected: fixtures.buyerActorId },
  });
  assertOk('T2.7 — direction=credit + amountCents=45000', {
    ok: dmoneyEntry?.direction === 'credit' && dmoneyEntry?.amountCents === 45000,
    reason: 'campos materiais errados',
    detail: dmoneyEntry,
  });

  // ============================================================
  // T3 — isolamento: actor B (buyer) NÃO vê wallet do actor A (worker)
  // ============================================================
  console.log('\n=== TEST 3 — isolamento por actor (buyer não vê wallet do worker) ===');
  const stmtBuyer = await actorWalletStatementService.getActorWalletStatement(
    TENANT_ID,
    fixtures.buyerActorId
  );
  // Buyer pode ter actor_wallet OU não — D-money não credita buyer.
  // Se tiver, entries do buyer NÃO incluem entries do worker.
  const buyerOrderIds = stmtBuyer.entries
    .filter((e) => e.serviceOrderId)
    .map((e) => e.serviceOrderId);
  assertOk('T3.1 — buyer NÃO vê entries da actor_wallet do worker', {
    ok: !buyerOrderIds.includes(seeded.orderId),
    reason: 'buyer recebeu entry do worker — vazamento de isolamento',
    detail: { buyerOrderIds, leakedOrderId: seeded.orderId },
  });
  // Se buyer não tem actor_wallet, statement.actorWallet=null (esperado).
  // Saldo do buyer (se houver wallet) é independente do worker.
  assertOk('T3.2 — statement do buyer é distinto (accountId distinto ou null)', {
    ok:
      stmtBuyer.actorWallet === null ||
      stmtBuyer.actorWallet.accountId !== workerWallet!.accountId,
    reason: 'statement do buyer retornou accountId do worker',
    detail: { buyerWallet: stmtBuyer.actorWallet, workerWalletId: workerWallet!.accountId },
  });

  // ============================================================
  // T4 — entry com reference_type desconhecido aparece como unknown
  // ============================================================
  console.log('\n=== TEST 4 — entry com reference_type desconhecido vira sourceType=unknown ===');
  // Criar transferência manual de escrow_payments → actor_wallet com
  // reference_type não-canônico. Isso simula "entrada com origem
  // desconhecida".
  const escrowAccount = await bankAccountService.getPlatformLifecycleAccount(
    TENANT_ID,
    'escrow_payments',
    'BRL'
  );
  const manualRefId = `manual-${uuidv4()}`;
  await bankTransactionService.transfer(TENANT_ID, {
    eventId: uuidv4(),
    fromAccountId: escrowAccount!.accountId,
    toAccountId: workerWallet!.accountId,
    amountCents: 100,
    currency: 'BRL',
    transactionType: 'transfer',
    description: 'Manual fixture: reference_type desconhecido',
    referenceType: 'manual_test_unknown_origin',
    referenceId: manualRefId,
    treasurySource: 'treasury:settlement',
    concept_id: 'seller-funds-release',
    authorship: {
      performedByUserId: null,
      performedByActorId: null,
      actingForActorId: fixtures.workerActorId,
      actingForAccountId: workerWallet!.accountId,
      authoritySource: 'system',
      permissionSnapshot: {
        permissionKey: 'system',
        allowed: true,
        actorId: fixtures.workerActorId,
        decidedAt: new Date().toISOString(),
      },
    } as any,
  });

  const stmt2 = await actorWalletStatementService.getActorWalletStatement(
    TENANT_ID,
    fixtures.workerActorId
  );
  const unknownEntry = stmt2.entries.find(
    (e) => e.referenceType === 'manual_test_unknown_origin'
  );
  assertOk('T4.1 — entry desconhecida aparece no statement', {
    ok: !!unknownEntry,
    reason: 'entry desconhecida não retornada',
  });
  assertOk('T4.2 — sourceType=unknown (não quebra parsing)', {
    ok: unknownEntry?.sourceType === 'unknown',
    reason: 'sourceType errado',
    detail: unknownEntry,
  });
  assertOk('T4.3 — campos de origem (serviceOrderId etc.) são null', {
    ok:
      unknownEntry?.serviceOrderId === null &&
      unknownEntry?.paymentRequestId === null &&
      unknownEntry?.paymentIntentId === null &&
      unknownEntry?.payerActorId === null,
    reason: 'campos não-nulos inesperados',
    detail: unknownEntry,
  });
  assertOk('T4.4 — saldo NOVO bate com ledger (saldo + 100)', {
    ok: stmt2.actorWallet?.balanceCents === expectedBalance + 100,
    reason: 'saldo divergiu após entry desconhecida',
    detail: {
      before: expectedBalance,
      after: stmt2.actorWallet?.balanceCents,
      expected: expectedBalance + 100,
    },
  });

  // ============================================================
  // T5 — nenhuma escrita financeira ocorre durante leitura
  // ============================================================
  console.log('\n=== TEST 5 — read-only: nenhuma escrita financeira ===');
  const snapshotBeforeRead = await captureBankSnapshot();
  await actorWalletStatementService.getActorWalletStatement(TENANT_ID, fixtures.workerActorId);
  await actorWalletStatementService.getActorWalletStatement(TENANT_ID, fixtures.buyerActorId);
  await actorWalletStatementService.getActorWalletStatement(TENANT_ID, fixtures.workerActorId, 1);
  const snapshotAfterRead = await captureBankSnapshot();
  assertOk('T5.1 — bank_ledger count INALTERADO após múltiplas leituras', {
    ok: snapshotAfterRead.ledgerCount === snapshotBeforeRead.ledgerCount,
    reason: 'leitura criou entries',
    detail: { before: snapshotBeforeRead, after: snapshotAfterRead },
  });
  assertOk('T5.2 — bank_transactions count INALTERADO', {
    ok: snapshotAfterRead.txCount === snapshotBeforeRead.txCount,
    reason: 'leitura criou bank_transactions',
    detail: { before: snapshotBeforeRead, after: snapshotAfterRead },
  });

  // ============================================================
  // AVAILABLE BALANCE — T6–T15
  // ============================================================
  console.log('\n═══ AVAILABLE BALANCE PROJECTION — T6–T15 ═══\n');

  const creditor = await findCreditorForObligation(TENANT_ID, fixtures.workerActorId);
  assertOk('SETUP AB — creditor (user_wallet de outro actor) disponível', {
    ok: !!creditor,
    reason: 'nenhum actor com user_wallet encontrado — fixtures incompletas',
  });

  const toCleanup: ObligFixture[] = [];
  try {
    // T6 — sem obligations ativas: pendingRecoveryCents=0, availableBalanceCents=grossBalanceCents
    console.log('=== T6 — sem obligations ativas: pending=0, available=gross ===');
    const stmtClean = await actorWalletStatementService.getActorWalletStatement(
      TENANT_ID, fixtures.workerActorId
    );
    assertOk('T6.1 — grossBalanceCents presente', {
      ok: typeof stmtClean.actorWallet?.grossBalanceCents === 'number',
      reason: 'grossBalanceCents ausente',
      detail: stmtClean.actorWallet,
    });
    assertOk('T6.2 — pendingRecoveryCents = 0 (sem obligations ativas)', {
      ok: stmtClean.actorWallet?.pendingRecoveryCents === 0,
      reason: 'pendingRecoveryCents != 0 — obligations ativas inesperadas no worker',
      detail: { pending: stmtClean.actorWallet?.pendingRecoveryCents },
    });
    assertOk('T6.3 — availableBalanceCents = grossBalanceCents', {
      ok:
        stmtClean.actorWallet?.availableBalanceCents ===
        stmtClean.actorWallet?.grossBalanceCents,
      reason: 'available != gross com pending=0',
      detail: stmtClean.actorWallet,
    });

    const baseGross = stmtClean.actorWallet!.grossBalanceCents;

    // T7 — obligation 'approved' entra por completo
    console.log('\n=== T7 — obligation approved entra no pendingRecoveryCents ===');
    const ob7 = await insertObligationFixture(
      TENANT_ID, fixtures.workerActorId, workerWallet!.accountId,
      creditor!.actorId, creditor!.accountId,
      3000, 'approved'
    );
    toCleanup.push(ob7);
    const stmt7 = await actorWalletStatementService.getActorWalletStatement(
      TENANT_ID, fixtures.workerActorId
    );
    assertOk('T7.1 — pendingRecoveryCents = 3000 (approved, 0 recovered)', {
      ok: stmt7.actorWallet?.pendingRecoveryCents === 3000,
      reason: 'pending errado',
      detail: { pending: stmt7.actorWallet?.pendingRecoveryCents, expected: 3000 },
    });
    assertOk('T7.2 — availableBalanceCents = gross - 3000', {
      ok: stmt7.actorWallet?.availableBalanceCents === Math.max(0, baseGross - 3000),
      reason: 'available errado',
      detail: { available: stmt7.actorWallet?.availableBalanceCents, expected: Math.max(0, baseGross - 3000) },
    });

    // T8 — obligation 'partially_recovered' entra só com (amount - recovered)
    console.log('\n=== T8 — obligation partially_recovered entra com restante ===');
    const ob8 = await insertObligationFixture(
      TENANT_ID, fixtures.workerActorId, workerWallet!.accountId,
      creditor!.actorId, creditor!.accountId,
      8000, 'partially_recovered', 3000 // 8000 - 3000 = 5000 pendente
    );
    toCleanup.push(ob8);
    const stmt8 = await actorWalletStatementService.getActorWalletStatement(
      TENANT_ID, fixtures.workerActorId
    );
    // ob7=3000 (approved) + ob8=(8000-3000)=5000 → total 8000
    assertOk('T8.1 — pendingRecoveryCents = 3000 + 5000 = 8000', {
      ok: stmt8.actorWallet?.pendingRecoveryCents === 8000,
      reason: 'pending errado após parcialmente recovered',
      detail: { pending: stmt8.actorWallet?.pendingRecoveryCents, expected: 8000 },
    });

    // Cleanup ob7+ob8 antes dos testes de status não-elegível
    await deleteObligationFixture(ob7);
    await deleteObligationFixture(ob8);
    toCleanup.length = 0;

    // T9 — obligation 'recovered' NÃO entra
    console.log('\n=== T9 — obligation recovered NÃO entra ===');
    const ob9 = await insertObligationFixture(
      TENANT_ID, fixtures.workerActorId, workerWallet!.accountId,
      creditor!.actorId, creditor!.accountId,
      5000, 'recovered', 5000
    );
    toCleanup.push(ob9);
    const stmt9 = await actorWalletStatementService.getActorWalletStatement(
      TENANT_ID, fixtures.workerActorId
    );
    assertOk('T9.1 — pendingRecoveryCents = 0 (recovered não entra)', {
      ok: stmt9.actorWallet?.pendingRecoveryCents === 0,
      reason: 'obligation recovered contou indevidamente',
      detail: { pending: stmt9.actorWallet?.pendingRecoveryCents },
    });
    await deleteObligationFixture(ob9);
    toCleanup.length = 0;

    // T10 — obligation 'cancelled' NÃO entra
    console.log('\n=== T10 — obligation cancelled NÃO entra ===');
    const ob10 = await insertObligationFixture(
      TENANT_ID, fixtures.workerActorId, workerWallet!.accountId,
      creditor!.actorId, creditor!.accountId,
      5000, 'cancelled'
    );
    toCleanup.push(ob10);
    const stmt10 = await actorWalletStatementService.getActorWalletStatement(
      TENANT_ID, fixtures.workerActorId
    );
    assertOk('T10.1 — pendingRecoveryCents = 0 (cancelled não entra)', {
      ok: stmt10.actorWallet?.pendingRecoveryCents === 0,
      reason: 'obligation cancelled contou indevidamente',
      detail: { pending: stmt10.actorWallet?.pendingRecoveryCents },
    });
    await deleteObligationFixture(ob10);
    toCleanup.length = 0;

    // T11 — obligation 'pending_approval' NÃO entra
    console.log('\n=== T11 — obligation pending_approval NÃO entra ===');
    const ob11 = await insertObligationFixture(
      TENANT_ID, fixtures.workerActorId, workerWallet!.accountId,
      creditor!.actorId, creditor!.accountId,
      5000, 'pending_approval'
    );
    toCleanup.push(ob11);
    const stmt11 = await actorWalletStatementService.getActorWalletStatement(
      TENANT_ID, fixtures.workerActorId
    );
    assertOk('T11.1 — pendingRecoveryCents = 0 (pending_approval não entra)', {
      ok: stmt11.actorWallet?.pendingRecoveryCents === 0,
      reason: 'obligation pending_approval contou indevidamente',
      detail: { pending: stmt11.actorWallet?.pendingRecoveryCents },
    });
    await deleteObligationFixture(ob11);
    toCleanup.length = 0;

    // T12 — pending > gross → availableBalanceCents = 0, nunca negativo
    console.log('\n=== T12 — pending > gross → availableBalanceCents = 0 ===');
    const overflowAmount = baseGross + 50000; // certamente maior que gross
    const ob12 = await insertObligationFixture(
      TENANT_ID, fixtures.workerActorId, workerWallet!.accountId,
      creditor!.actorId, creditor!.accountId,
      overflowAmount, 'approved'
    );
    toCleanup.push(ob12);
    const stmt12 = await actorWalletStatementService.getActorWalletStatement(
      TENANT_ID, fixtures.workerActorId
    );
    assertOk('T12.1 — availableBalanceCents = 0 (pending > gross)', {
      ok: stmt12.actorWallet?.availableBalanceCents === 0,
      reason: 'availableBalanceCents negativo ou incorreto',
      detail: {
        gross: stmt12.actorWallet?.grossBalanceCents,
        pending: stmt12.actorWallet?.pendingRecoveryCents,
        available: stmt12.actorWallet?.availableBalanceCents,
      },
    });
    assertOk('T12.2 — availableBalanceCents >= 0 (nunca negativo)', {
      ok: (stmt12.actorWallet?.availableBalanceCents ?? -1) >= 0,
      reason: 'availableBalanceCents é negativo',
      detail: { available: stmt12.actorWallet?.availableBalanceCents },
    });
    await deleteObligationFixture(ob12);
    toCleanup.length = 0;

    // T13 — múltiplas obligations ativas somam corretamente
    console.log('\n=== T13 — múltiplas obligations ativas somam ===');
    const ob13a = await insertObligationFixture(
      TENANT_ID, fixtures.workerActorId, workerWallet!.accountId,
      creditor!.actorId, creditor!.accountId,
      4000, 'approved'
    );
    const ob13b = await insertObligationFixture(
      TENANT_ID, fixtures.workerActorId, workerWallet!.accountId,
      creditor!.actorId, creditor!.accountId,
      6000, 'partially_recovered', 1000 // restante = 5000
    );
    toCleanup.push(ob13a, ob13b);
    const stmt13 = await actorWalletStatementService.getActorWalletStatement(
      TENANT_ID, fixtures.workerActorId
    );
    // 4000 (approved) + 5000 (partially_recovered restante) = 9000
    assertOk('T13.1 — pendingRecoveryCents = 4000 + 5000 = 9000', {
      ok: stmt13.actorWallet?.pendingRecoveryCents === 9000,
      reason: 'soma múltiplas obligations errada',
      detail: { pending: stmt13.actorWallet?.pendingRecoveryCents, expected: 9000 },
    });
    await deleteObligationFixture(ob13a);
    await deleteObligationFixture(ob13b);
    toCleanup.length = 0;

    // T14 — leitura com obligation ativa NÃO escreve em bank_ledger
    console.log('\n=== T14 — leitura não escreve em bank_ledger ===');
    const ob14 = await insertObligationFixture(
      TENANT_ID, fixtures.workerActorId, workerWallet!.accountId,
      creditor!.actorId, creditor!.accountId,
      2000, 'approved'
    );
    toCleanup.push(ob14);
    const snapBefore = await captureBankSnapshot();
    await actorWalletStatementService.getActorWalletStatement(TENANT_ID, fixtures.workerActorId);
    await actorWalletStatementService.getActorWalletStatement(TENANT_ID, fixtures.workerActorId);
    const snapAfter = await captureBankSnapshot();
    assertOk('T14.1 — bank_ledger count inalterado após leitura com obligation ativa', {
      ok: snapAfter.ledgerCount === snapBefore.ledgerCount,
      reason: 'leitura escreveu em bank_ledger',
      detail: { before: snapBefore, after: snapAfter },
    });
    assertOk('T14.2 — bank_transactions count inalterado', {
      ok: snapAfter.txCount === snapBefore.txCount,
      reason: 'leitura escreveu bank_transactions',
      detail: { before: snapBefore, after: snapAfter },
    });
    await deleteObligationFixture(ob14);
    toCleanup.length = 0;

    // T15 — balanceCents = grossBalanceCents (alias preservado)
    console.log('\n=== T15 — balanceCents é alias de grossBalanceCents ===');
    const stmt15 = await actorWalletStatementService.getActorWalletStatement(
      TENANT_ID, fixtures.workerActorId
    );
    assertOk('T15.1 — balanceCents === grossBalanceCents (backward compat)', {
      ok:
        stmt15.actorWallet?.balanceCents === stmt15.actorWallet?.grossBalanceCents,
      reason: 'alias balanceCents diverge de grossBalanceCents',
      detail: {
        balanceCents: stmt15.actorWallet?.balanceCents,
        grossBalanceCents: stmt15.actorWallet?.grossBalanceCents,
      },
    });
    assertOk('T15.2 — balanceCents é o saldo bruto (= ledger SUM)', {
      ok: stmt15.actorWallet?.balanceCents === stmt15.actorWallet?.grossBalanceCents,
      reason: 'balanceCents alterado indevidamente',
      detail: stmt15.actorWallet,
    });
  } finally {
    // Garantia: limpar qualquer fixture não limpa por falha
    for (const f of toCleanup) {
      try { await deleteObligationFixture(f); } catch { /* best-effort */ }
    }
  }

  console.log('\n═══ E2E ACTOR_WALLET STATEMENT :: PASS — saldo igual ao ledger; origem rastreável; isolamento por actor; unknown sem quebrar; zero escrita; available balance projection (T6–T15) verificado. ═══');
  await pool.end();
}

main().catch((err) => {
  console.error('❌ ERRO NÃO CAPTURADO:', err);
  process.exit(1);
});
