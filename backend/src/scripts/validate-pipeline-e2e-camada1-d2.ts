/**
 * E2E D2 (Camada 1 saída — 2026-05-26)
 *
 * Prova material da APROVAÇÃO de release seller_pending → release_approved:
 *
 *   - buyer confirma → release_approved + buyer_confirmed_completion_at
 *     preenchido + INSERT atômico no event_outbox
 *     SERVICE_ORDER_RELEASE_APPROVED.
 *   - timeout (release_eligible_at <= NOW()) → release_approved +
 *     buyer_confirmed_completion_at PERMANECE NULL + outbox.
 *   - disputed_at IS NOT NULL bloqueia AMBOS os caminhos.
 *   - antes do prazo (release_eligible_at > NOW()) bloqueia timeout.
 *   - buyer errado (≠ customerActorId) → THROW autoridade.
 *   - idempotência: 2ª chamada falha previsível, evento NÃO duplica.
 *   - atomicidade: ROLLBACK externo desfaz UPDATE + outbox JUNTOS.
 *   - ZERO movimento financeiro: bank_ledger, bank_transactions,
 *     escrow_payments inalterados.
 *
 * Significado de release_approved (NÃO confundir com bank_accounts.
 * account_type='seller_available'): "serviço APROVADO para futura
 * liberação financeira"; NÃO "fundos liberados". Dinheiro permanece
 * em escrow_payments. Ver DT-D2-WIRING-MONEY-PENDING.
 *
 * Modo de execução:
 *   npx tsx backend/src/scripts/validate-pipeline-e2e-camada1-d2.ts
 */

import dotenv from 'dotenv';
import { join } from 'path';
import { v4 as uuidv4 } from 'uuid';
import { createHash } from 'crypto';

import { pool, getClientWithTenant } from '../core/database/pool';
import { bankAccountService } from '../modules/bank/bank-account.service';
import { serviceOrderService } from '../modules/services/service-order.service';

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

/**
 * Espelho LITERAL de deterministicServiceOrderReleaseApprovedOutboxEventId
 * (service-order.service.ts).
 */
function deterministicServiceOrderReleaseApprovedOutboxEventId(
  tenantId: string,
  orderId: string
): string {
  const hash = createHash('sha256')
    .update(`SERVICE_ORDER_RELEASE_APPROVED:${tenantId}:${orderId}`)
    .digest();
  const b = Buffer.alloc(16);
  hash.copy(b, 0, 0, 16);
  b[6] = (b[6]! & 0x0f) | 0x40;
  b[8] = (b[8]! & 0x3f) | 0x80;
  const h = b.toString('hex');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20, 32)}`;
}

interface SeededFixtures {
  workerActorId: string;
  customerActorId: string;
  otherActorId: string; // actor não-customer (para T2 buyer errado)
  serviceId: string;
}

async function loadOrSeedFixtures(): Promise<SeededFixtures> {
  const buyerEmail = 'g2-buyer@e2e.internal';
  const providerEmail = 'g2-provider@e2e.internal';

  const usersRes = await pool.query<{ user_id: string; email: string }>(
    `SELECT user_id::text, email FROM users WHERE tenant_id = $1 AND email = ANY($2::text[])`,
    [TENANT_ID, [buyerEmail, providerEmail]]
  );
  if (usersRes.rows.length < 2) {
    throw new Error('Fixtures de users não encontradas; rode o E2E transversal antes.');
  }
  const buyerUser = usersRes.rows.find((u) => u.email === buyerEmail)!;
  const providerUser = usersRes.rows.find((u) => u.email === providerEmail)!;

  const actorsRes = await pool.query<{ user_id: string; actor_id: string }>(
    `SELECT user_id::text, id::text AS actor_id FROM actors
      WHERE tenant_id = $1 AND user_id = ANY($2::uuid[]) AND actor_type = 'user'`,
    [TENANT_ID, [buyerUser.user_id, providerUser.user_id]]
  );
  const customerActorId = actorsRes.rows.find((a) => a.user_id === buyerUser.user_id)!.actor_id;
  const workerActorId = actorsRes.rows.find((a) => a.user_id === providerUser.user_id)!.actor_id;

  let serviceId: string;
  const svcRes = await pool.query<{ service_id: string }>(
    `SELECT service_id::text FROM services WHERE tenant_id = $1 AND actor_id = $2 LIMIT 1`,
    [TENANT_ID, workerActorId]
  );
  if (svcRes.rows[0]) {
    serviceId = svcRes.rows[0].service_id;
  } else {
    const newSvc = await pool.query<{ service_id: string }>(
      `INSERT INTO services (
         tenant_id, actor_id, name, slug, service_type, status, currency
       ) VALUES ($1, $2, $3, $4, 'service', 'active', 'BRL')
       RETURNING service_id::text`,
      [TENANT_ID, workerActorId, 'D2 fixture service', `d2-fixture-${uuidv4().slice(0, 8)}`]
    );
    serviceId = newSvc.rows[0]!.service_id;
  }

  // workerActorId reusado como "outro actor" para T2 (buyer errado) — não
  // é o customer da order. Suficiente para provar gate.
  return { workerActorId, customerActorId, otherActorId: workerActorId, serviceId };
}

/**
 * Seed direto via INSERT — bypass createOrder (foco D2).
 * Cria service_order já em status='seller_pending', settlement_flow=
 * 'fixed_price_escrow', release_eligible_at e buyer_confirmation_deadline_at
 * controlados.
 */
async function seedSellerPendingOrder(
  fixtures: SeededFixtures,
  opts: {
    releaseEligibleAt: Date;
    disputedAt?: Date;
  }
): Promise<string> {
  const orderId = uuidv4();
  const scheduledStart = new Date(Date.now() - 60 * 60 * 1000); // -1h (já iniciou)
  await pool.query(
    `INSERT INTO service_orders (
       id, tenant_id, service_id, worker_actor_id, customer_actor_id,
       status, settlement_flow,
       scheduled_start,
       completed_at,
       buyer_confirmation_deadline_at,
       release_eligible_at,
       disputed_at,
       created_by_actor_id,
       description, metadata
     ) VALUES ($1::uuid, $2::uuid, $3::uuid, $4::uuid, $5::uuid,
               'seller_pending', 'fixed_price_escrow',
               $6, NOW(),
               $7, $7,
               $8,
               $4::uuid,
               'D2 fixture order', '{}'::jsonb)`,
    [
      orderId,
      TENANT_ID,
      fixtures.serviceId,
      fixtures.workerActorId,
      fixtures.customerActorId,
      scheduledStart,
      opts.releaseEligibleAt,
      opts.disputedAt ?? null,
    ]
  );
  return orderId;
}

async function captureMoneySnapshot(): Promise<{
  ledgerCount: string;
  txCount: string;
  escrowBalance: number;
}> {
  const ledger = await pool.query<{ c: string }>(`SELECT count(*)::text AS c FROM bank_ledger`);
  const tx = await pool.query<{ c: string }>(`SELECT count(*)::text AS c FROM bank_transactions`);
  await bankAccountService.ensurePlatformAccounts(TENANT_ID, 'BRL');
  const escrow = await bankAccountService.getPlatformLifecycleAccount(
    TENANT_ID,
    'escrow_payments',
    'BRL'
  );
  const balance = escrow
    ? (await bankAccountService.getBalance(TENANT_ID, escrow.accountId)).balanceCents
    : 0;
  return {
    ledgerCount: ledger.rows[0]?.c ?? '0',
    txCount: tx.rows[0]?.c ?? '0',
    escrowBalance: balance,
  };
}

async function bootstrapPortsForScript(): Promise<void> {
  const { socialPortsRegistry } = await import('../core/social/ports-registry');
  const {
    actorRepositoryAdapter, actorUtilsAdapter,
    socialRepositoryAdapter, socialServiceAdapter, eventFeedHandlersAdapter,
  } = await import('../modules/social/adapters');
  socialPortsRegistry.setActorRepository(actorRepositoryAdapter);
  socialPortsRegistry.setActorUtils(actorUtilsAdapter);
  socialPortsRegistry.setSocialRepository(socialRepositoryAdapter);
  socialPortsRegistry.setSocialService(socialServiceAdapter);
  socialPortsRegistry.setEventFeedHandlers(eventFeedHandlersAdapter);
}

async function main() {
  console.log('═══ E2E D2 — Camada 1 saída: seller_pending → release_approved ═══\n');
  await bootstrapPortsForScript();
  const fixtures = await loadOrSeedFixtures();
  console.log(`  ℹ  fixtures: customer=${fixtures.customerActorId.slice(0, 8)} worker=${fixtures.workerActorId.slice(0, 8)} service=${fixtures.serviceId.slice(0, 8)}\n`);

  const moneyInit = await captureMoneySnapshot();

  // ============================================================
  // TEST 1 — Buyer confirma: seller_pending → release_approved
  // ============================================================
  console.log('=== TEST 1 — Buyer confirma → release_approved + outbox atômico ===');
  // release_eligible_at no FUTURO — buyer confirma ANTES do prazo.
  const orderA = await seedSellerPendingOrder(fixtures, {
    releaseEligibleAt: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
  });

  const approvedA = await serviceOrderService.confirmBuyerCompletion(TENANT_ID, orderA, {
    buyerActorId: fixtures.customerActorId,
    // E2E D2 não testa gate genérico — esse é exercido em rotas reais
    // que sempre passam buyerUserId. Aqui foco é bifurcação D2.
    buyerUserId: undefined,
  });

  assertOk('T1.1 — status = release_approved', {
    ok: approvedA.status === 'release_approved',
    reason: 'status não foi para release_approved',
    detail: { status: approvedA.status },
  });
  assertOk('T1.2 — buyer_confirmed_completion_at preenchido (~now)', {
    ok:
      !!approvedA.buyerConfirmedCompletionAt &&
      Math.abs(new Date(approvedA.buyerConfirmedCompletionAt).getTime() - Date.now()) < 60 * 1000,
    reason: 'buyer_confirmed_completion_at ausente ou fora de janela',
    detail: { ts: approvedA.buyerConfirmedCompletionAt },
  });
  assertOk('T1.3 — disputed_at permanece NULL', {
    ok: approvedA.disputedAt === null,
    reason: 'disputed_at preenchido indevidamente',
    detail: { disputedAt: approvedA.disputedAt },
  });

  const eventIdA = deterministicServiceOrderReleaseApprovedOutboxEventId(TENANT_ID, orderA);
  const outboxA = await pool.query<{ c: string }>(
    `SELECT count(*)::text AS c FROM event_outbox
      WHERE tenant_id = $1::uuid AND event_id = $2::uuid
        AND event_type = 'SERVICE_ORDER_RELEASE_APPROVED'`,
    [TENANT_ID, eventIdA]
  );
  assertOk('T1.4 — event_outbox tem 1 row SERVICE_ORDER_RELEASE_APPROVED', {
    ok: outboxA.rows[0]?.c === '1',
    reason: 'outbox não tem evento esperado',
    detail: outboxA.rows[0],
  });

  // ============================================================
  // TEST 2 — Buyer ERRADO → THROW (autoridade fina)
  // ============================================================
  console.log('\n=== TEST 2 — Buyer ≠ customerActorId → THROW (gate fino) ===');
  const orderB = await seedSellerPendingOrder(fixtures, {
    releaseEligibleAt: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
  });
  let buyerWrongThrew: Error | null = null;
  try {
    await serviceOrderService.confirmBuyerCompletion(TENANT_ID, orderB, {
      buyerActorId: fixtures.otherActorId, // worker, NÃO customer
      buyerUserId: undefined,
    });
  } catch (e) {
    buyerWrongThrew = e as Error;
  }
  assertOk('T2.1 — buyer errado lança ForbiddenError', {
    ok: buyerWrongThrew !== null && /comprador/i.test(buyerWrongThrew.message),
    reason: 'buyer errado deveria ter sido rejeitado',
    detail: { threw: buyerWrongThrew?.message },
  });
  const orderBStatus = await pool.query<{ status: string }>(
    `SELECT status FROM service_orders WHERE id = $1::uuid`,
    [orderB]
  );
  assertOk('T2.2 — estado da order B inalterado (seller_pending)', {
    ok: orderBStatus.rows[0]?.status === 'seller_pending',
    reason: 'order B mudou de estado apesar do gate',
    detail: orderBStatus.rows[0],
  });

  // ============================================================
  // TEST 3 — Timeout: release_eligible_at <= NOW() → release_approved
  // ============================================================
  console.log('\n=== TEST 3 — Timeout → release_approved (buyer_confirmed_completion_at NULL) ===');
  const orderC = await seedSellerPendingOrder(fixtures, {
    releaseEligibleAt: new Date(Date.now() - 60 * 1000), // -1min (vencido)
  });

  const timeoutResult = await serviceOrderService.approveExpiredServiceOrderReleases(
    TENANT_ID,
    100
  );
  assertOk('T3.1 — approveExpiredServiceOrderReleases incluiu orderC', {
    ok: timeoutResult.approved.includes(orderC),
    reason: 'orderC não foi processada',
    detail: { approved: timeoutResult.approved, failed: timeoutResult.failed },
  });

  const orderCRow = await pool.query<{ status: string; bcca: Date | null }>(
    `SELECT status, buyer_confirmed_completion_at AS bcca
       FROM service_orders WHERE id = $1::uuid`,
    [orderC]
  );
  assertOk('T3.2 — order C status=release_approved + buyer_confirmed_completion_at NULL', {
    ok:
      orderCRow.rows[0]?.status === 'release_approved' &&
      orderCRow.rows[0]?.bcca === null,
    reason: 'order C não foi para release_approved OU buyer_confirmed_completion_at preenchido indevidamente',
    detail: orderCRow.rows[0],
  });

  const eventIdC = deterministicServiceOrderReleaseApprovedOutboxEventId(TENANT_ID, orderC);
  const outboxC = await pool.query<{ c: string }>(
    `SELECT count(*)::text AS c FROM event_outbox
      WHERE tenant_id = $1::uuid AND event_id = $2::uuid`,
    [TENANT_ID, eventIdC]
  );
  assertOk('T3.3 — outbox tem 1 row SERVICE_ORDER_RELEASE_APPROVED (timeout)', {
    ok: outboxC.rows[0]?.c === '1',
    reason: 'outbox não emitido para timeout',
    detail: outboxC.rows[0],
  });

  // ============================================================
  // TEST 4 — Disputa bloqueia AMBOS os caminhos
  // ============================================================
  console.log('\n=== TEST 4 — disputed_at preenchido bloqueia buyer-confirm E timeout ===');
  const orderD = await seedSellerPendingOrder(fixtures, {
    releaseEligibleAt: new Date(Date.now() - 60 * 1000), // vencido (tornaria elegível)
    disputedAt: new Date(),
  });

  // Buyer-confirm com disputa: deve THROW.
  let buyerOnDisputeThrew: Error | null = null;
  try {
    await serviceOrderService.confirmBuyerCompletion(TENANT_ID, orderD, {
      buyerActorId: fixtures.customerActorId,
      buyerUserId: undefined,
    });
  } catch (e) {
    buyerOnDisputeThrew = e as Error;
  }
  assertOk('T4.1 — buyer-confirm com disputa lança', {
    ok: buyerOnDisputeThrew !== null && /disputa/i.test(buyerOnDisputeThrew.message),
    reason: 'buyer-confirm deveria ter rejeitado disputa',
    detail: { threw: buyerOnDisputeThrew?.message },
  });

  // Timeout com disputa: orderD NÃO deve aparecer no batch.
  const timeoutOnDispute = await serviceOrderService.approveExpiredServiceOrderReleases(
    TENANT_ID,
    100
  );
  assertOk('T4.2 — timeout não inclui orderD com disputa', {
    ok: !timeoutOnDispute.approved.includes(orderD) && !timeoutOnDispute.failed.find((f) => f.orderId === orderD),
    reason: 'orderD com disputa entrou no batch',
    detail: { approved: timeoutOnDispute.approved, failed: timeoutOnDispute.failed },
  });

  const orderDRow = await pool.query<{ status: string }>(
    `SELECT status FROM service_orders WHERE id = $1::uuid`,
    [orderD]
  );
  assertOk('T4.3 — order D permanece seller_pending', {
    ok: orderDRow.rows[0]?.status === 'seller_pending',
    reason: 'order D mudou de estado apesar da disputa',
    detail: orderDRow.rows[0],
  });

  // ============================================================
  // TEST 5 — Antes do prazo: timeout NÃO inclui
  // ============================================================
  console.log('\n=== TEST 5 — release_eligible_at > NOW(): timeout NÃO inclui ===');
  const orderE = await seedSellerPendingOrder(fixtures, {
    releaseEligibleAt: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000), // futuro
  });
  const timeoutBeforePrazo = await serviceOrderService.approveExpiredServiceOrderReleases(
    TENANT_ID,
    100
  );
  assertOk('T5.1 — orderE NÃO incluída no batch (release_eligible_at no futuro)', {
    ok: !timeoutBeforePrazo.approved.includes(orderE),
    reason: 'orderE incluída indevidamente',
    detail: { approved: timeoutBeforePrazo.approved },
  });

  // ============================================================
  // TEST 6 — Atomicidade: ROLLBACK desfaz UPDATE + outbox juntos
  // ============================================================
  console.log('\n=== TEST 6 — Atomicidade: ROLLBACK externo desfaz UPDATE + outbox ===');
  const orderF = await seedSellerPendingOrder(fixtures, {
    releaseEligibleAt: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
  });
  const eventIdF = deterministicServiceOrderReleaseApprovedOutboxEventId(TENANT_ID, orderF);
  const externalClient = await getClientWithTenant(TENANT_ID);
  let t6Threw: Error | null = null;
  try {
    await externalClient.query('BEGIN');

    const approvedF = await serviceOrderService.confirmBuyerCompletion(
      TENANT_ID,
      orderF,
      { buyerActorId: fixtures.customerActorId, buyerUserId: undefined },
      externalClient
    );

    assertOk('T6.1 — PRESENÇA: status=release_approved DENTRO da tx', {
      ok: approvedF.status === 'release_approved',
      reason: 'modo convidado não aprovou',
      detail: { status: approvedF.status },
    });

    const presenceOrder = await externalClient.query<{ status: string; bcca: Date | null }>(
      `SELECT status, buyer_confirmed_completion_at AS bcca
         FROM service_orders WHERE id = $1::uuid`,
      [orderF]
    );
    assertOk('T6.2 — PRESENÇA: service_orders mostra release_approved + bcca DENTRO da tx', {
      ok:
        presenceOrder.rows[0]?.status === 'release_approved' &&
        presenceOrder.rows[0]?.bcca !== null,
      reason: 'estado não visível dentro da tx',
      detail: presenceOrder.rows[0],
    });

    const presenceOutbox = await externalClient.query<{ c: string }>(
      `SELECT count(*)::text AS c FROM event_outbox
        WHERE tenant_id = $1::uuid AND event_id = $2::uuid`,
      [TENANT_ID, eventIdF]
    );
    assertOk('T6.3 — PRESENÇA: event_outbox tem 1 row DENTRO da tx', {
      ok: presenceOutbox.rows[0]?.c === '1',
      reason: 'outbox não inserido dentro da tx',
      detail: presenceOutbox.rows[0],
    });

    await externalClient.query('ROLLBACK');
  } catch (e) {
    t6Threw = e as Error;
    try { await externalClient.query('ROLLBACK'); } catch (_rb) {}
  } finally {
    externalClient.release();
  }

  assertOk('T6.4 — modo convidado não lançou erro inesperado', {
    ok: t6Threw === null,
    reason: 'erro inesperado em modo convidado',
    detail: { threw: t6Threw?.message ?? null },
  });

  const absenceOrder = await pool.query<{ status: string; bcca: Date | null }>(
    `SELECT status, buyer_confirmed_completion_at AS bcca
       FROM service_orders WHERE id = $1::uuid`,
    [orderF]
  );
  assertOk('T6.5 — AUSÊNCIA pós-rollback: order F volta a seller_pending, bcca NULL', {
    ok: absenceOrder.rows[0]?.status === 'seller_pending' && absenceOrder.rows[0]?.bcca === null,
    reason: 'rollback não reverteu UPDATE',
    detail: absenceOrder.rows[0],
  });
  const absenceOutbox = await pool.query<{ c: string }>(
    `SELECT count(*)::text AS c FROM event_outbox
      WHERE tenant_id = $1::uuid AND event_id = $2::uuid`,
    [TENANT_ID, eventIdF]
  );
  assertOk('T6.6 — AUSÊNCIA pós-rollback: 0 outbox rows', {
    ok: absenceOutbox.rows[0]?.c === '0',
    reason: 'rollback não reverteu INSERT outbox',
    detail: absenceOutbox.rows[0],
  });

  // ============================================================
  // TEST 7 — Idempotência: 2ª chamada lança + outbox tem 1 row
  // ============================================================
  console.log('\n=== TEST 7 — Idempotência: 2ª chamada não duplica evento ===');
  const orderG = await seedSellerPendingOrder(fixtures, {
    releaseEligibleAt: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
  });
  const eventIdG = deterministicServiceOrderReleaseApprovedOutboxEventId(TENANT_ID, orderG);

  const firstApprove = await serviceOrderService.confirmBuyerCompletion(TENANT_ID, orderG, {
    buyerActorId: fixtures.customerActorId,
    buyerUserId: undefined,
  });
  assertOk('T7.1 — 1ª chamada: release_approved', {
    ok: firstApprove.status === 'release_approved',
    reason: '1ª chamada não aprovou',
    detail: { status: firstApprove.status },
  });

  let secondThrew: Error | null = null;
  try {
    await serviceOrderService.confirmBuyerCompletion(TENANT_ID, orderG, {
      buyerActorId: fixtures.customerActorId,
      buyerUserId: undefined,
    });
  } catch (e) {
    secondThrew = e as Error;
  }
  assertOk('T7.2 — 2ª chamada lança (status não é mais seller_pending)', {
    ok: secondThrew !== null && /seller_pending/i.test(secondThrew.message),
    reason: '2ª chamada deveria ter falhado',
    detail: { threw: secondThrew?.message },
  });

  const outboxG = await pool.query<{ c: string }>(
    `SELECT count(*)::text AS c FROM event_outbox
      WHERE tenant_id = $1::uuid AND event_id = $2::uuid`,
    [TENANT_ID, eventIdG]
  );
  assertOk('T7.3 — outbox contém APENAS 1 row para orderG', {
    ok: outboxG.rows[0]?.c === '1',
    reason: 'outbox duplicou apesar da 2ª chamada falhar',
    detail: outboxG.rows[0],
  });

  // ============================================================
  // BALANÇO FINANCEIRO FINAL — D2 NÃO move 1 centavo
  // ============================================================
  const moneyFinal = await captureMoneySnapshot();
  assertOk('FINAL — bank_ledger, bank_transactions e escrow_payments INALTERADOS', {
    ok:
      moneyFinal.ledgerCount === moneyInit.ledgerCount &&
      moneyFinal.txCount === moneyInit.txCount &&
      moneyFinal.escrowBalance === moneyInit.escrowBalance,
    reason: 'D2 moveu dinheiro indevidamente',
    detail: { init: moneyInit, final: moneyFinal },
  });

  console.log('\n═══ E2E D2 :: PASS — buyer confirma/timeout aprovam; disputa+autoridade+prazo bloqueiam; atomicidade+idempotência; ZERO movimento financeiro. ═══');
  await pool.end();
}

main().catch((err) => {
  console.error('❌ ERRO NÃO CAPTURADO:', err);
  process.exit(1);
});
