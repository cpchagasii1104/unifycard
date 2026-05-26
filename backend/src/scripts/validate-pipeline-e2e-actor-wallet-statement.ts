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
       status, amount, currency
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

  console.log('\n═══ E2E ACTOR_WALLET STATEMENT :: PASS — saldo igual ao ledger; origem rastreável; isolamento por actor; unknown sem quebrar; zero escrita. ═══');
  await pool.end();
}

main().catch((err) => {
  console.error('❌ ERRO NÃO CAPTURADO:', err);
  process.exit(1);
});
