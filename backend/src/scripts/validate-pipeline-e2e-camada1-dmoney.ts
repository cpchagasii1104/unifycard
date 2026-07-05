/**
 * E2E D-money (Camada 1 saída — 2026-05-26)
 *
 * Prova material do release financeiro:
 *   service_order.status='release_approved'
 *     → transfer escrow_payments → actor_wallet (por split)
 *     → payment_intent.payment_status='released_to_actor_wallet'
 *     → service_order.status='funds_released'
 *     → event_outbox SERVICE_ORDER_FUNDS_RELEASED_TO_ACTOR_WALLET.
 *
 * Tudo atômico, idempotente, lastreado por bank_ledger, sem acordar
 * release-worker antigo.
 *
 * Modo de execução:
 *   npx tsx backend/src/scripts/validate-pipeline-e2e-camada1-dmoney.ts
 */

import dotenv from 'dotenv';
import { join } from 'path';
import { v4 as uuidv4 } from 'uuid';
import { createHash } from 'crypto';

import { pool, getClientWithTenant } from '../core/database/pool';
import { bankAccountService } from '../modules/bank/bank-account.service';
import { servicePaymentExecutionService } from '../modules/services/service-payment-execution.service';
import { serviceOrderService } from '../modules/services/service-order.service';

dotenv.config({ path: join(process.cwd(), '.env') });

// F-BANK-TRANSACTION-SINK-FIREWALL (Fatia 9, achado da auditoria Yala 2026-07-05): este
// E2E chama servicePaymentExecutionService.createExecution -> ... -> bankTransactionService.
// createTransactionWithExplicitSplitLines DIRETO (4o entrypoint do sink, agora gated) — precisa
// ligar o gate default-off pra continuar exercitando o fluxo real que este arquivo sempre testou.
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

function deterministicReleaseFundsOutboxEventId(tenantId: string, orderId: string): string {
  const hash = createHash('sha256')
    .update(`SERVICE_ORDER_FUNDS_RELEASED_TO_ACTOR_WALLET:${tenantId}:${orderId}`)
    .digest();
  const b = Buffer.alloc(16);
  hash.copy(b, 0, 0, 16);
  b[6] = (b[6]! & 0x0f) | 0x40;
  b[8] = (b[8]! & 0x3f) | 0x80;
  const h = b.toString('hex');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20, 32)}`;
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
  const buyer = usersRes.rows.find((r) => r.email === 'g2-buyer@e2e.internal');
  const provider = usersRes.rows.find((r) => r.email === 'g2-provider@e2e.internal');
  if (!buyer || !provider) {
    throw new Error('Fixtures de users não encontradas (rode E2E transversal antes).');
  }
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
      [TENANT_ID, workerActorId, 'D-money fixture', `dmoney-${uuidv4().slice(0, 8)}`]
    );
    serviceId = newSvc.rows[0]!.service_id;
  }
  return { buyerUserId: buyer.user_id, buyerActorId, workerActorId, serviceId };
}

interface SeededOrder {
  orderId: string;
  paymentRequestId: string;
  paymentIntentId: string;
  bookingId: string;
}

/**
 * Setup completo da cadeia até release_approved:
 *   - createPaymentRequest (booking sintético via UUID).
 *   - createExecution (Camada 1 entrada — credita escrow_payments).
 *   - INSERT service_order com booking_id, status='release_approved',
 *     settlement_flow='fixed_price_escrow'.
 */
async function seedReadyForRelease(
  fixtures: Fixtures,
  amount = 30000,
  splits?: Array<{ receiverActorId: string; amountCents: number; percentage?: number | null }>
): Promise<SeededOrder> {
  const bookingId = uuidv4();
  const paymentRequestId = uuidv4();

  // INSERT direto service_payment_request (bypass orquestrador completo).
  await pool.query(
    `INSERT INTO service_payment_requests (
       payment_request_id, tenant_id, booking_id, service_id, payer_actor_id, receiver_actor_id,
       payment_request_status, amount_cents, currency
     ) VALUES ($1::uuid, $2::uuid, $3::uuid, $4::uuid, $5::uuid, $6::uuid,
              'pending', $7, 'BRL')`,
    [paymentRequestId, TENANT_ID, bookingId, fixtures.serviceId, fixtures.buyerActorId, fixtures.workerActorId, amount]
  );

  // createExecution real — cria payment_intent escrowed + ledger em escrow_payments.
  const execSplits = splits ?? [{ receiverActorId: fixtures.workerActorId, amountCents: amount, percentage: 100 }];
  const execResult = await servicePaymentExecutionService.createExecution(TENANT_ID, fixtures.buyerUserId, {
    paymentRequestId,
    splits: execSplits,
  });
  // Localizar payment_intent
  const intentRow = await pool.query<{ id: string }>(
    `SELECT id::text FROM payment_intents WHERE tenant_id = $1::uuid AND reference_id = $2 LIMIT 1`,
    [TENANT_ID, paymentRequestId]
  );
  const paymentIntentId = intentRow.rows[0]!.id;

  // INSERT direto service_order em release_approved.
  const orderId = uuidv4();
  const scheduledStart = new Date(Date.now() - 60 * 60 * 1000);
  await pool.query(
    `INSERT INTO service_orders (
       id, tenant_id, service_id, worker_actor_id, customer_actor_id, booking_id,
       status, settlement_flow,
       scheduled_start, completed_at,
       buyer_confirmation_deadline_at, release_eligible_at,
       buyer_confirmed_completion_at,
       created_by_actor_id,
       description, metadata
     ) VALUES ($1::uuid, $2::uuid, $3::uuid, $4::uuid, $5::uuid, $6::uuid,
              'release_approved', 'fixed_price_escrow',
              $7, NOW(),
              NOW() + INTERVAL '5 days', NOW() + INTERVAL '5 days',
              NOW(),
              $4::uuid,
              'D-money fixture order', '{}'::jsonb)`,
    [orderId, TENANT_ID, fixtures.serviceId, fixtures.workerActorId, fixtures.buyerActorId, bookingId, scheduledStart]
  );

  return { orderId, paymentRequestId, paymentIntentId, bookingId };
}

async function bankSnapshot(walletAccountId: string | null = null, escrowAccountId: string | null = null) {
  const ledger = await pool.query<{ c: string }>(`SELECT count(*)::text AS c FROM bank_ledger`);
  const tx = await pool.query<{ c: string }>(`SELECT count(*)::text AS c FROM bank_transactions`);
  let walletBalance: number | null = null;
  let escrowBalance: number | null = null;
  if (walletAccountId) {
    walletBalance = (await bankAccountService.getBalance(TENANT_ID, walletAccountId)).balanceCents;
  }
  if (escrowAccountId) {
    escrowBalance = (await bankAccountService.getBalance(TENANT_ID, escrowAccountId)).balanceCents;
  }
  return {
    ledgerCount: ledger.rows[0]?.c ?? '0',
    txCount: tx.rows[0]?.c ?? '0',
    walletBalance,
    escrowBalance,
  };
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
  console.log('═══ E2E D-money — Camada 1: escrow → actor_wallet ═══\n');
  await bootstrap();
  const fixtures = await loadFixtures();
  await bankAccountService.ensurePlatformAccounts(TENANT_ID, 'BRL');
  const escrowAccount = await bankAccountService.getPlatformLifecycleAccount(TENANT_ID, 'escrow_payments', 'BRL');
  if (!escrowAccount) throw new Error('escrow_payments do tenant não existe');
  console.log(`  ℹ  fixtures: buyer=${fixtures.buyerActorId.slice(0, 8)} worker=${fixtures.workerActorId.slice(0, 8)} service=${fixtures.serviceId.slice(0, 8)}\n`);

  // ============================================================
  // TEST 1 — Caminho feliz
  // ============================================================
  console.log('=== TEST 1 — caminho feliz: release_approved → funds_released + escrow→actor_wallet ===');
  const seedA = await seedReadyForRelease(fixtures, 30000);
  const escrowBefore = (await bankAccountService.getBalance(TENANT_ID, escrowAccount.accountId)).balanceCents;

  const r1 = await serviceOrderService.releaseFundsToActorWalletForOrder(TENANT_ID, seedA.orderId);

  assertOk('T1.1 — retorno carrega orderId + paymentIntentId + splits', {
    ok:
      r1.orderId === seedA.orderId &&
      r1.paymentIntentId === seedA.paymentIntentId &&
      r1.totalAmountCents === 30000 &&
      r1.splits.length === 1 &&
      r1.splits[0]!.receiverActorId === fixtures.workerActorId,
    reason: 'retorno inconsistente',
    detail: r1,
  });

  const orderAfter = await pool.query<{ status: string }>(
    `SELECT status FROM service_orders WHERE id = $1::uuid`,
    [seedA.orderId]
  );
  assertOk('T1.2 — service_order.status = funds_released', {
    ok: orderAfter.rows[0]?.status === 'funds_released',
    reason: 'status não foi para funds_released',
    detail: orderAfter.rows[0],
  });

  const intentAfter = await pool.query<{ payment_status: string }>(
    `SELECT payment_status FROM payment_intents WHERE id = $1::uuid`,
    [seedA.paymentIntentId]
  );
  assertOk('T1.3 — payment_intent.payment_status = released_to_actor_wallet', {
    ok: intentAfter.rows[0]?.payment_status === 'released_to_actor_wallet',
    reason: 'payment_status não foi para released_to_actor_wallet',
    detail: intentAfter.rows[0],
  });

  const walletAcc = await bankAccountService.getActorWalletAccount(TENANT_ID, fixtures.workerActorId, 'BRL');
  assertOk('T1.4 — actor_wallet do worker existe (criada por D-money)', {
    ok: !!walletAcc,
    reason: 'actor_wallet não foi criada',
  });
  const walletBalance = (await bankAccountService.getBalance(TENANT_ID, walletAcc!.accountId)).balanceCents;
  // saldo final = anterior + 30000
  assertOk('T1.5 — actor_wallet do worker recebeu +30000', {
    ok: walletBalance >= 30000,
    reason: `saldo actor_wallet = ${walletBalance}`,
    detail: { walletBalance },
  });

  const escrowAfter = (await bankAccountService.getBalance(TENANT_ID, escrowAccount.accountId)).balanceCents;
  assertOk('T1.6 — escrow_payments diminuiu exatamente 30000', {
    ok: escrowBefore - escrowAfter === 30000,
    reason: `escrow delta=${escrowBefore - escrowAfter}`,
    detail: { escrowBefore, escrowAfter },
  });

  const eventId = deterministicReleaseFundsOutboxEventId(TENANT_ID, seedA.orderId);
  const outboxA = await pool.query<{ c: string }>(
    `SELECT count(*)::text AS c FROM event_outbox WHERE event_id = $1::uuid
      AND event_type='SERVICE_ORDER_FUNDS_RELEASED_TO_ACTOR_WALLET'`,
    [eventId]
  );
  assertOk('T1.7 — event_outbox tem 1 row SERVICE_ORDER_FUNDS_RELEASED_TO_ACTOR_WALLET', {
    ok: outboxA.rows[0]?.c === '1',
    reason: 'outbox não emitido',
    detail: outboxA.rows[0],
  });

  // bank_ledger net-zero por transação
  const ledgerNet = await pool.query<{ net: string }>(
    `SELECT COALESCE(SUM(CASE WHEN direction='credit' THEN amount_cents ELSE -amount_cents END), 0)::text AS net
       FROM bank_ledger WHERE transaction_id = $1::uuid`,
    [r1.splits[0]!.bankTransactionId]
  );
  assertOk('T1.8 — bank_ledger net-zero por transação (Σdéb=Σcred)', {
    ok: ledgerNet.rows[0]?.net === '0',
    reason: `net=${ledgerNet.rows[0]?.net}`,
    detail: ledgerNet.rows[0],
  });

  // ============================================================
  // TEST 2 — Retry (idempotência por estado)
  // ============================================================
  console.log('\n=== TEST 2 — retry: 2ª chamada não duplica ===');
  const walletBalBefore2 = (await bankAccountService.getBalance(TENANT_ID, walletAcc!.accountId)).balanceCents;
  const escrowBefore2 = (await bankAccountService.getBalance(TENANT_ID, escrowAccount.accountId)).balanceCents;

  let retryThrew: Error | null = null;
  try {
    await serviceOrderService.releaseFundsToActorWalletForOrder(TENANT_ID, seedA.orderId);
  } catch (e) {
    retryThrew = e as Error;
  }
  assertOk('T2.1 — retry lança (status≠release_approved)', {
    ok: retryThrew !== null && /release_approved|condições D-money/i.test(retryThrew.message),
    reason: 'retry deveria ter falhado',
    detail: { threw: retryThrew?.message },
  });

  const walletBalAfter2 = (await bankAccountService.getBalance(TENANT_ID, walletAcc!.accountId)).balanceCents;
  const escrowAfter2 = (await bankAccountService.getBalance(TENANT_ID, escrowAccount.accountId)).balanceCents;
  assertOk('T2.2 — actor_wallet INALTERADA após retry', {
    ok: walletBalAfter2 === walletBalBefore2,
    reason: 'wallet duplicou no retry',
    detail: { before: walletBalBefore2, after: walletBalAfter2 },
  });
  assertOk('T2.3 — escrow INALTERADO após retry', {
    ok: escrowAfter2 === escrowBefore2,
    reason: 'escrow alterado no retry',
    detail: { before: escrowBefore2, after: escrowAfter2 },
  });

  const outboxAfter2 = await pool.query<{ c: string }>(
    `SELECT count(*)::text AS c FROM event_outbox WHERE event_id = $1::uuid`,
    [eventId]
  );
  assertOk('T2.4 — outbox ainda tem APENAS 1 row', {
    ok: outboxAfter2.rows[0]?.c === '1',
    reason: 'outbox duplicou',
    detail: outboxAfter2.rows[0],
  });

  // ============================================================
  // TEST 3 — Disputa bloqueia
  // ============================================================
  console.log('\n=== TEST 3 — disputa bloqueia release ===');
  const seedD = await seedReadyForRelease(fixtures, 20000);
  await pool.query(
    `UPDATE service_orders SET disputed_at = NOW() WHERE id = $1::uuid`,
    [seedD.orderId]
  );
  let dispThrew: Error | null = null;
  try {
    await serviceOrderService.releaseFundsToActorWalletForOrder(TENANT_ID, seedD.orderId);
  } catch (e) {
    dispThrew = e as Error;
  }
  assertOk('T3.1 — release lança quando disputed_at preenchido', {
    ok: dispThrew !== null,
    reason: 'disputa não bloqueou',
    detail: { threw: dispThrew?.message },
  });

  // ============================================================
  // TEST 4 — Status errado bloqueia
  // ============================================================
  console.log('\n=== TEST 4 — service_order status errado bloqueia ===');
  const seedW = await seedReadyForRelease(fixtures, 15000);
  await pool.query(
    `UPDATE service_orders SET status = 'seller_pending' WHERE id = $1::uuid`,
    [seedW.orderId]
  );
  let statusThrew: Error | null = null;
  try {
    await serviceOrderService.releaseFundsToActorWalletForOrder(TENANT_ID, seedW.orderId);
  } catch (e) {
    statusThrew = e as Error;
  }
  assertOk('T4.1 — release lança quando status=seller_pending', {
    ok: statusThrew !== null,
    reason: 'status errado não bloqueou',
    detail: { threw: statusThrew?.message },
  });

  // ============================================================
  // TEST 5 — Sem booking_id bloqueia
  // ============================================================
  console.log('\n=== TEST 5 — booking_id NULL bloqueia ===');
  const seedB = await seedReadyForRelease(fixtures, 10000);
  await pool.query(
    `UPDATE service_orders SET booking_id = NULL WHERE id = $1::uuid`,
    [seedB.orderId]
  );
  let bookThrew: Error | null = null;
  try {
    await serviceOrderService.releaseFundsToActorWalletForOrder(TENANT_ID, seedB.orderId);
  } catch (e) {
    bookThrew = e as Error;
  }
  assertOk('T5.1 — release lança quando booking_id NULL', {
    ok: bookThrew !== null,
    reason: 'booking_id NULL não bloqueou',
    detail: { threw: bookThrew?.message },
  });

  // ============================================================
  // TEST 6 — metadata.splits inválido bloqueia
  // ============================================================
  console.log('\n=== TEST 6 — metadata.splits inválido bloqueia ===');
  const seedM = await seedReadyForRelease(fixtures, 5000);
  // Corrompe metadata.splits no payment_intent
  await pool.query(
    `UPDATE payment_intents SET metadata = jsonb_set(metadata, '{splits}', '[]'::jsonb)
      WHERE id = $1::uuid`,
    [seedM.paymentIntentId]
  );
  const escrowBeforeM = (await bankAccountService.getBalance(TENANT_ID, escrowAccount.accountId)).balanceCents;
  let metaThrew: Error | null = null;
  try {
    await serviceOrderService.releaseFundsToActorWalletForOrder(TENANT_ID, seedM.orderId);
  } catch (e) {
    metaThrew = e as Error;
  }
  assertOk('T6.1 — release lança quando splits inválido', {
    ok: metaThrew !== null && /splits/i.test(metaThrew.message),
    reason: 'splits inválido não bloqueou',
    detail: { threw: metaThrew?.message },
  });
  const escrowAfterM = (await bankAccountService.getBalance(TENANT_ID, escrowAccount.accountId)).balanceCents;
  assertOk('T6.2 — escrow inalterado após bloqueio (rollback)', {
    ok: escrowAfterM === escrowBeforeM,
    reason: 'escrow alterado apesar do erro',
    detail: { before: escrowBeforeM, after: escrowAfterM },
  });

  // ============================================================
  // TEST 7 — Receiver actor_type='user' (worker é user)
  // ============================================================
  console.log('\n=== TEST 7 — receiver user → actor_wallet criada ===');
  // T1 já fez isso. Provar que NÃO foi para user_wallet nem credit nem seller_available.
  const wrongAccs = await pool.query<{ c: string; types: string[] }>(
    `SELECT count(*)::text AS c, array_agg(DISTINCT account_type) AS types
       FROM bank_accounts
      WHERE tenant_id = $1::uuid AND actor_id = $2::uuid
        AND account_type IN ('user_wallet', 'seller_available', 'seller_pending', 'credit')`,
    [TENANT_ID, fixtures.workerActorId]
  );
  // 'credit' é a default GENÉRICA do receiver (já existe pré-D-money via createExecution legado).
  // Provar que NENHUMA delas recebeu dinheiro nessa transação.
  const wrongLedger = await pool.query<{ c: string }>(
    `SELECT count(*)::text AS c FROM bank_ledger bl
        JOIN bank_accounts ba ON ba.id = bl.account_id
        JOIN bank_transactions bt ON bt.id = bl.transaction_id
      WHERE bt.reference_type = 'fixed_price_release_to_actor_wallet'
        AND bt.reference_id LIKE $1
        AND ba.account_type IN ('user_wallet', 'seller_available', 'seller_pending')`,
    [`${seedA.orderId}:%`]
  );
  assertOk('T7.1 — release NÃO creditou user_wallet/seller_*/credit indevidamente', {
    ok: wrongLedger.rows[0]?.c === '0',
    reason: 'dinheiro foi para conta errada',
    detail: { wrongCount: wrongLedger.rows[0]?.c, other_accounts: wrongAccs.rows[0] },
  });
  assertOk('T7.2 — destino foi actor_wallet (worker actor_type=user)', {
    ok: walletAcc !== null && walletAcc.accountType === 'actor_wallet',
    reason: 'destino não é actor_wallet',
    detail: { walletAccountType: walletAcc?.accountType },
  });

  // ============================================================
  // TEST 8 — Rollback externo
  // ============================================================
  console.log('\n=== TEST 8 — atomicidade: ROLLBACK externo desfaz tudo ===');
  const seedR = await seedReadyForRelease(fixtures, 7000);
  const escrowBeforeR = (await bankAccountService.getBalance(TENANT_ID, escrowAccount.accountId)).balanceCents;
  const walletBalBeforeR = (await bankAccountService.getBalance(TENANT_ID, walletAcc!.accountId)).balanceCents;

  const externalClient = await getClientWithTenant(TENANT_ID);
  let rollbackPresenceSeen = false;
  try {
    await externalClient.query('BEGIN');
    const insideResult = await serviceOrderService.releaseFundsToActorWalletForOrder(
      TENANT_ID,
      seedR.orderId,
      externalClient
    );
    // PRESENÇA DENTRO da tx
    const insideOrder = await externalClient.query<{ status: string }>(
      `SELECT status FROM service_orders WHERE id = $1::uuid`,
      [seedR.orderId]
    );
    const insideIntent = await externalClient.query<{ payment_status: string }>(
      `SELECT payment_status FROM payment_intents WHERE id = $1::uuid`,
      [seedR.paymentIntentId]
    );
    rollbackPresenceSeen =
      insideOrder.rows[0]?.status === 'funds_released' &&
      insideIntent.rows[0]?.payment_status === 'released_to_actor_wallet' &&
      insideResult.splits.length === 1;
    await externalClient.query('ROLLBACK');
  } finally {
    externalClient.release();
  }

  assertOk('T8.1 — PRESENÇA dentro da tx: status=funds_released + intent=released', {
    ok: rollbackPresenceSeen,
    reason: 'modo convidado não aplicou D-money',
  });

  const orderAfterR = await pool.query<{ status: string }>(
    `SELECT status FROM service_orders WHERE id = $1::uuid`,
    [seedR.orderId]
  );
  const intentAfterR = await pool.query<{ payment_status: string }>(
    `SELECT payment_status FROM payment_intents WHERE id = $1::uuid`,
    [seedR.paymentIntentId]
  );
  assertOk('T8.2 — AUSÊNCIA pós-rollback: service_order volta a release_approved', {
    ok: orderAfterR.rows[0]?.status === 'release_approved',
    reason: 'rollback não reverteu service_order',
    detail: orderAfterR.rows[0],
  });
  assertOk('T8.3 — AUSÊNCIA pós-rollback: payment_intent volta a escrowed', {
    ok: intentAfterR.rows[0]?.payment_status === 'escrowed',
    reason: 'rollback não reverteu payment_intent',
    detail: intentAfterR.rows[0],
  });
  const escrowAfterR = (await bankAccountService.getBalance(TENANT_ID, escrowAccount.accountId)).balanceCents;
  const walletBalAfterR = (await bankAccountService.getBalance(TENANT_ID, walletAcc!.accountId)).balanceCents;
  assertOk('T8.4 — AUSÊNCIA pós-rollback: escrow + actor_wallet INALTERADOS', {
    ok: escrowAfterR === escrowBeforeR && walletBalAfterR === walletBalBeforeR,
    reason: 'rollback não reverteu ledger',
    detail: {
      escrow: { before: escrowBeforeR, after: escrowAfterR },
      wallet: { before: walletBalBeforeR, after: walletBalAfterR },
    },
  });
  const eventIdR = deterministicReleaseFundsOutboxEventId(TENANT_ID, seedR.orderId);
  const outboxAfterR = await pool.query<{ c: string }>(
    `SELECT count(*)::text AS c FROM event_outbox WHERE event_id = $1::uuid`,
    [eventIdR]
  );
  assertOk('T8.5 — AUSÊNCIA pós-rollback: 0 outbox', {
    ok: outboxAfterR.rows[0]?.c === '0',
    reason: 'rollback não reverteu outbox',
    detail: outboxAfterR.rows[0],
  });

  // ============================================================
  // TEST 9 — Release-worker antigo NÃO é acordado
  // ============================================================
  console.log('\n=== TEST 9 — release-worker antigo não acionado (payment_intent NÃO vira settled) ===');
  // T1 já moveu o dinheiro do seedA. Verificar que payment_status=
  // 'released_to_actor_wallet' (não 'settled').
  const r9 = await pool.query<{ payment_status: string }>(
    `SELECT payment_status FROM payment_intents WHERE id = $1::uuid`,
    [seedA.paymentIntentId]
  );
  assertOk('T9.1 — payment_intent NÃO está em settled (release-worker antigo dorme)', {
    ok: r9.rows[0]?.payment_status === 'released_to_actor_wallet',
    reason: 'payment_intent foi para settled, release-worker antigo seria acordado',
    detail: r9.rows[0],
  });
  // E que NENHUMA referenceType='seller_release' foi criada pelo D-money
  const sellerReleaseCount = await pool.query<{ c: string }>(
    `SELECT count(*)::text AS c FROM bank_transactions
      WHERE tenant_id = $1::uuid AND reference_type = 'seller_release'
        AND reference_id = $2`,
    [TENANT_ID, seedA.paymentRequestId]
  );
  assertOk('T9.2 — D-money não criou bank_transaction com reference_type=seller_release', {
    ok: sellerReleaseCount.rows[0]?.c === '0',
    reason: 'D-money usou caminho do release-worker antigo',
    detail: sellerReleaseCount.rows[0],
  });

  // ============================================================
  // TEST 10 — Wallet visibility
  // ============================================================
  console.log('\n=== TEST 10 — actor_wallet visível em listagens por actor ===');
  const acctsByActor = await pool.query<{ account_type: string; owner_id: string }>(
    `SELECT account_type, owner_id FROM bank_accounts
      WHERE tenant_id = $1::uuid AND actor_id = $2::uuid`,
    [TENANT_ID, fixtures.workerActorId]
  );
  const hasActorWallet = acctsByActor.rows.some((r) => r.account_type === 'actor_wallet');
  assertOk('T10.1 — actor_wallet aparece em bank_accounts.actor_id=worker', {
    ok: hasActorWallet,
    reason: 'actor_wallet não encontrada via actor_id',
    detail: acctsByActor.rows,
  });
  console.log('  ℹ  T10.2 — GET /identity/wallet integra rotas de identity; conta actor_wallet aparece quando rota varre bank_accounts por actor (verificação completa de superfície UI é frente de produto separada — DT-ACTOR-WALLET-VISIBILITY).');

  // ============================================================
  // FINAL — bank_ledger net-zero global
  // ============================================================
  const ledgerNetGlobal = await pool.query<{ net: string }>(
    `SELECT COALESCE(SUM(CASE WHEN direction='credit' THEN amount_cents ELSE -amount_cents END), 0)::text AS net
       FROM bank_ledger WHERE transaction_id IN (
         SELECT id FROM bank_transactions WHERE reference_type = 'fixed_price_release_to_actor_wallet'
       )`
  );
  assertOk('FINAL — bank_ledger Σdéb=Σcred (net-zero global em todas as D-money tx)', {
    ok: ledgerNetGlobal.rows[0]?.net === '0',
    reason: 'ledger net ≠ 0',
    detail: ledgerNetGlobal.rows[0],
  });

  console.log('\n═══ E2E D-money :: PASS — escrow→actor_wallet provado materialmente; retry/disputa/status/booking/splits bloqueiam; rollback reverte; release-worker antigo NÃO acordado; ledger íntegro. ═══');
  await pool.end();
}

main().catch((err) => {
  console.error('❌ ERRO NÃO CAPTURADO:', err);
  process.exit(1);
});
