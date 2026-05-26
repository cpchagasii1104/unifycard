/**
 * E2E F1 (Camada 1 saída — 2026-05-26)
 *
 * Prova material da bifurcação de completeOrder por settlement_flow:
 *   - fixed_price_escrow → status='seller_pending' + buyer_confirmation_deadline_at
 *     + release_eligible_at + INSERT atômico no event_outbox
 *     SERVICE_ORDER_PENDING_BUYER_CONFIRMATION.
 *   - none (legado) → status='completed' sem campos F1 nem outbox F1.
 *   - Atomicidade: ROLLBACK externo desfaz UPDATE + outbox JUNTOS.
 *   - Idempotência: 2ª chamada não duplica evento.
 *   - ZERO movimento financeiro: bank_ledger / escrow_payments inalterados.
 *
 * Modo de execução:
 *   npx tsx backend/src/scripts/validate-pipeline-e2e-camada1-f1.ts
 *
 * Pré-requisitos:
 *   - postgres acessível via DATABASE_URL (.env do backend).
 *   - tenant E2E_TENANT_ID existente (default
 *     fbe13b78-4516-493d-905a-363796aea1d1).
 *   - migration 20260530555000 aplicada.
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
 * Espelho LITERAL de deterministicServiceOrderPendingOutboxEventId
 * em service-order.service.ts (cópia mecânica do hash — não importa do
 * service para evitar acoplamento de leitura ↔ implementação).
 */
function deterministicServiceOrderPendingOutboxEventId(tenantId: string, orderId: string): string {
  const hash = createHash('sha256')
    .update(`SERVICE_ORDER_PENDING_BUYER_CONFIRMATION:${tenantId}:${orderId}`)
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
  serviceId: string;
}

/**
 * Reusa o seed dos outros E2E (mesmo tenant). buyer = customer, provider = worker.
 */
async function loadOrSeedFixtures(): Promise<SeededFixtures> {
  const buyerEmail = 'g2-buyer@e2e.internal';
  const providerEmail = 'g2-provider@e2e.internal';

  const usersRes = await pool.query<{ user_id: string; email: string }>(
    `SELECT user_id::text, email FROM users WHERE tenant_id = $1 AND email = ANY($2::text[])`,
    [TENANT_ID, [buyerEmail, providerEmail]]
  );
  if (usersRes.rows.length < 2) {
    throw new Error(
      `Fixtures de users não encontradas para o tenant; rode o E2E transversal antes (cria buyer/provider).`
    );
  }
  const buyerUser = usersRes.rows.find((u) => u.email === buyerEmail)!;
  const providerUser = usersRes.rows.find((u) => u.email === providerEmail)!;

  const actorsRes = await pool.query<{ user_id: string; actor_id: string }>(
    `SELECT user_id::text, id::text AS actor_id FROM actors
      WHERE tenant_id = $1 AND user_id = ANY($2::uuid[]) AND actor_type = 'user'`,
    [TENANT_ID, [buyerUser.user_id, providerUser.user_id]]
  );
  if (actorsRes.rows.length < 2) {
    throw new Error(`Actors user-type não encontrados para os users buyer/provider.`);
  }
  const customerActorId = actorsRes.rows.find((a) => a.user_id === buyerUser.user_id)!.actor_id;
  const workerActorId = actorsRes.rows.find((a) => a.user_id === providerUser.user_id)!.actor_id;

  // Service: reusa o primeiro service do provider OU cria um novo.
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
      [TENANT_ID, workerActorId, 'F1 fixture service', `f1-fixture-${uuidv4().slice(0, 8)}`]
    );
    serviceId = newSvc.rows[0]!.service_id;
  }

  return { workerActorId, customerActorId, serviceId };
}

/**
 * Cria service_order direto via INSERT (bypass createOrder — não é o
 * escopo de F1). Status='in_progress' para que completeOrder possa atuar.
 */
async function seedServiceOrder(
  fixtures: SeededFixtures,
  settlementFlow: 'none' | 'fixed_price_escrow'
): Promise<string> {
  const orderId = uuidv4();
  const scheduledStart = new Date(Date.now() + 60 * 60 * 1000); // +1h
  await pool.query(
    `INSERT INTO service_orders (
       id, tenant_id, service_id, worker_actor_id, customer_actor_id,
       status, settlement_flow,
       scheduled_start,
       created_by_actor_id,
       description, metadata
     ) VALUES ($1::uuid, $2::uuid, $3::uuid, $4::uuid, $5::uuid,
               'in_progress', $6,
               $7,
               $4::uuid,
               'F1 fixture order', '{}'::jsonb)`,
    [
      orderId,
      TENANT_ID,
      fixtures.serviceId,
      fixtures.workerActorId,
      fixtures.customerActorId,
      settlementFlow,
      scheduledStart,
    ]
  );
  return orderId;
}

async function captureMoneySnapshot(): Promise<{
  ledgerCount: string;
  escrowBalance: number;
}> {
  const ledger = await pool.query<{ c: string }>(`SELECT count(*)::text AS c FROM bank_ledger`);
  await bankAccountService.ensurePlatformAccounts(TENANT_ID, 'BRL');
  const escrow = await bankAccountService.getPlatformLifecycleAccount(
    TENANT_ID,
    'escrow_payments',
    'BRL'
  );
  const balance = escrow
    ? (await bankAccountService.getBalance(TENANT_ID, escrow.accountId)).balanceCents
    : 0;
  return { ledgerCount: ledger.rows[0]?.c ?? '0', escrowBalance: balance };
}

async function bootstrapPortsForScript(): Promise<void> {
  // Bootstrap mínimo de DI — espelha app.builder.ts / validate-pipeline-e2e-
  // transversal.ts L261-274. Sem isso, completeOrder → authorityService →
  // socialPortsRegistry.getActorRepository() lança.
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
  console.log('═══ E2E F1 — Camada 1 saída (completeOrder bifurca por settlement_flow) ═══\n');

  await bootstrapPortsForScript();
  const fixtures = await loadOrSeedFixtures();
  console.log(`  ℹ  fixtures: worker=${fixtures.workerActorId.slice(0, 8)} customer=${fixtures.customerActorId.slice(0, 8)} service=${fixtures.serviceId.slice(0, 8)}\n`);

  // ============================================================
  // TEST 1 — Caminho F1 (fixed_price_escrow) modo DONO
  // ============================================================
  console.log('=== TEST 1 — fixed_price_escrow → seller_pending + deadline + outbox atômico ===');
  const orderA = await seedServiceOrder(fixtures, 'fixed_price_escrow');
  const moneyBefore = await captureMoneySnapshot();

  const completedA = await serviceOrderService.completeOrder(TENANT_ID, orderA, {
    completedByActorId: fixtures.workerActorId,
    // E2E F1 mede bifurcação + atomicidade — gate genérico service_order:complete
    // não é o objeto de prova aqui. completedByUserId=undefined pula o gate
    // (service-order.service.ts:307-319: `if (input.completedByUserId) { ... }`).
    // DT-SERVICE-ORDER-AUTHORITY (sessão 2026-05-26) registra que a permissão
    // genérica não cruza com order.workerActorId — gap material a tratar em frente
    // própria. Aqui o E2E exerce a F1 sem o gate.
    completedByUserId: undefined,
    workerNotes: 'F1 test 1 — completion notes',
  });

  assertOk('T1.1 — status = seller_pending', {
    ok: completedA.status === 'seller_pending',
    reason: 'status não foi para seller_pending',
    detail: { status: completedA.status },
  });

  assertOk('T1.2 — settlementFlow preservado em fixed_price_escrow', {
    ok: completedA.settlementFlow === 'fixed_price_escrow',
    reason: 'settlementFlow alterado indevidamente',
    detail: { settlementFlow: completedA.settlementFlow },
  });

  assertOk('T1.3 — buyer_confirmation_deadline_at preenchido (~now+7d)', {
    ok:
      !!completedA.buyerConfirmationDeadlineAt &&
      Math.abs(
        (new Date(completedA.buyerConfirmationDeadlineAt).getTime() - Date.now()) -
          7 * 24 * 60 * 60 * 1000
      ) < 60 * 1000, // tolerância 1 min
    reason: 'deadline ausente ou fora da janela esperada (7d ± 1min)',
    detail: { deadline: completedA.buyerConfirmationDeadlineAt },
  });

  assertOk('T1.4 — release_eligible_at preenchido = deadline', {
    ok:
      !!completedA.releaseEligibleAt &&
      !!completedA.buyerConfirmationDeadlineAt &&
      new Date(completedA.releaseEligibleAt).getTime() ===
        new Date(completedA.buyerConfirmationDeadlineAt).getTime(),
    reason: 'release_eligible_at ausente ou ≠ deadline',
    detail: {
      releaseEligibleAt: completedA.releaseEligibleAt,
      deadline: completedA.buyerConfirmationDeadlineAt,
    },
  });

  assertOk('T1.5 — disputed_at e buyer_confirmed_completion_at permanecem NULL', {
    ok: completedA.disputedAt === null && completedA.buyerConfirmedCompletionAt === null,
    reason: 'campos D2 futuros foram preenchidos indevidamente',
    detail: {
      disputedAt: completedA.disputedAt,
      buyerConfirmedCompletionAt: completedA.buyerConfirmedCompletionAt,
    },
  });

  // Outbox tem 1 evento para esta order
  const expectedEventIdA = deterministicServiceOrderPendingOutboxEventId(TENANT_ID, orderA);
  const outboxAResult = await pool.query<{ c: string }>(
    `SELECT count(*)::text AS c FROM event_outbox
      WHERE tenant_id = $1::uuid AND event_id = $2::uuid
        AND event_type = 'SERVICE_ORDER_PENDING_BUYER_CONFIRMATION'`,
    [TENANT_ID, expectedEventIdA]
  );
  assertOk('T1.6 — event_outbox tem 1 row SERVICE_ORDER_PENDING_BUYER_CONFIRMATION', {
    ok: outboxAResult.rows[0]?.c === '1',
    reason: 'outbox não tem exatamente 1 row para esta order',
    detail: outboxAResult.rows[0],
  });

  // ZERO movimento financeiro
  const moneyAfter = await captureMoneySnapshot();
  assertOk('T1.7 — ZERO movimento financeiro: bank_ledger e escrow_payments inalterados', {
    ok:
      moneyAfter.ledgerCount === moneyBefore.ledgerCount &&
      moneyAfter.escrowBalance === moneyBefore.escrowBalance,
    reason: 'F1 moveu dinheiro indevidamente',
    detail: { before: moneyBefore, after: moneyAfter },
  });

  // ============================================================
  // TEST 2 — Caminho legado (none) NÃO entra no fluxo F1
  // ============================================================
  console.log('\n=== TEST 2 — settlement_flow=none → completed (sem F1) ===');
  const orderB = await seedServiceOrder(fixtures, 'none');

  const completedB = await serviceOrderService.completeOrder(TENANT_ID, orderB, {
    completedByActorId: fixtures.workerActorId,
    // E2E F1 mede bifurcação + atomicidade — gate genérico service_order:complete
    // não é o objeto de prova aqui. completedByUserId=undefined pula o gate
    // (service-order.service.ts:307-319: `if (input.completedByUserId) { ... }`).
    // DT-SERVICE-ORDER-AUTHORITY (sessão 2026-05-26) registra que a permissão
    // genérica não cruza com order.workerActorId — gap material a tratar em frente
    // própria. Aqui o E2E exerce a F1 sem o gate.
    completedByUserId: undefined,
    workerNotes: 'F1 test 2 — legacy completion',
  });

  assertOk('T2.1 — status = completed (legado), não seller_pending', {
    ok: completedB.status === 'completed',
    reason: 'caminho legado entrou no fluxo F1 indevidamente',
    detail: { status: completedB.status },
  });

  assertOk('T2.2 — buyer_confirmation_deadline_at permanece NULL', {
    ok: completedB.buyerConfirmationDeadlineAt === null,
    reason: 'deadline indevido em order none',
    detail: { deadline: completedB.buyerConfirmationDeadlineAt },
  });

  assertOk('T2.3 — release_eligible_at permanece NULL', {
    ok: completedB.releaseEligibleAt === null,
    reason: 'release_eligible_at indevido em order none',
    detail: { releaseEligibleAt: completedB.releaseEligibleAt },
  });

  const expectedEventIdB = deterministicServiceOrderPendingOutboxEventId(TENANT_ID, orderB);
  const outboxBResult = await pool.query<{ c: string }>(
    `SELECT count(*)::text AS c FROM event_outbox
      WHERE tenant_id = $1::uuid AND event_id = $2::uuid`,
    [TENANT_ID, expectedEventIdB]
  );
  assertOk('T2.4 — event_outbox SEM evento F1 para esta order', {
    ok: outboxBResult.rows[0]?.c === '0',
    reason: 'caminho legado emitiu evento F1 indevidamente',
    detail: outboxBResult.rows[0],
  });

  // ============================================================
  // TEST 3 — Atomicidade (presença DENTRO da tx + ausência APÓS rollback)
  // ============================================================
  console.log('\n=== TEST 3 — Atomicidade: ROLLBACK desfaz UPDATE + outbox juntos ===');
  const orderC = await seedServiceOrder(fixtures, 'fixed_price_escrow');
  const expectedEventIdC = deterministicServiceOrderPendingOutboxEventId(TENANT_ID, orderC);

  const externalClient = await getClientWithTenant(TENANT_ID);
  let t3CallThrew: Error | null = null;
  try {
    await externalClient.query('BEGIN');

    const completedC = await serviceOrderService.completeOrder(
      TENANT_ID,
      orderC,
      {
        completedByActorId: fixtures.workerActorId,
        // E2E F1 mede bifurcação + atomicidade — gate genérico service_order:complete
    // não é o objeto de prova aqui. completedByUserId=undefined pula o gate
    // (service-order.service.ts:307-319: `if (input.completedByUserId) { ... }`).
    // DT-SERVICE-ORDER-AUTHORITY (sessão 2026-05-26) registra que a permissão
    // genérica não cruza com order.workerActorId — gap material a tratar em frente
    // própria. Aqui o E2E exerce a F1 sem o gate.
    completedByUserId: undefined,
        workerNotes: 'F1 test 3 — atomicity (rollback)',
      },
      externalClient
    );

    // PRESENÇA dentro da tx
    assertOk('T3.1 — PRESENÇA: status=seller_pending DENTRO da tx', {
      ok: completedC.status === 'seller_pending',
      reason: 'modo convidado não aplicou seller_pending',
      detail: { status: completedC.status },
    });

    const orderRowInTx = await externalClient.query<{ status: string; deadline: Date | null }>(
      `SELECT status, buyer_confirmation_deadline_at AS deadline
         FROM service_orders WHERE tenant_id = $1::uuid AND id = $2::uuid`,
      [TENANT_ID, orderC]
    );
    assertOk('T3.2 — PRESENÇA: service_orders tem deadline DENTRO da tx', {
      ok:
        orderRowInTx.rows[0]?.status === 'seller_pending' &&
        orderRowInTx.rows[0]?.deadline !== null,
      reason: 'estado não visível dentro da tx',
      detail: orderRowInTx.rows[0],
    });

    const outboxInTx = await externalClient.query<{ c: string }>(
      `SELECT count(*)::text AS c FROM event_outbox
        WHERE tenant_id = $1::uuid AND event_id = $2::uuid`,
      [TENANT_ID, expectedEventIdC]
    );
    assertOk('T3.3 — PRESENÇA: event_outbox tem 1 row DENTRO da tx', {
      ok: outboxInTx.rows[0]?.c === '1',
      reason: 'outbox não foi inserido dentro da tx',
      detail: outboxInTx.rows[0],
    });

    // ROLLBACK forçado
    await externalClient.query('ROLLBACK');
  } catch (e) {
    t3CallThrew = e as Error;
    try { await externalClient.query('ROLLBACK'); } catch (_rb) {}
  } finally {
    externalClient.release();
  }

  assertOk('T3.4 — modo convidado não lançou erro inesperado', {
    ok: t3CallThrew === null,
    reason: 'completeOrder lançou em modo convidado',
    detail: { threw: t3CallThrew?.message ?? null },
  });

  // AUSÊNCIA pós-rollback (cliente novo)
  const orderRowAfter = await pool.query<{ status: string; deadline: Date | null }>(
    `SELECT status, buyer_confirmation_deadline_at AS deadline
       FROM service_orders WHERE tenant_id = $1::uuid AND id = $2::uuid`,
    [TENANT_ID, orderC]
  );
  assertOk('T3.5 — AUSÊNCIA pós-rollback: status volta a in_progress, deadline NULL', {
    ok:
      orderRowAfter.rows[0]?.status === 'in_progress' &&
      orderRowAfter.rows[0]?.deadline === null,
    reason: 'ROLLBACK não reverteu o UPDATE de service_orders',
    detail: orderRowAfter.rows[0],
  });

  const outboxAfter = await pool.query<{ c: string }>(
    `SELECT count(*)::text AS c FROM event_outbox
      WHERE tenant_id = $1::uuid AND event_id = $2::uuid`,
    [TENANT_ID, expectedEventIdC]
  );
  assertOk('T3.6 — AUSÊNCIA pós-rollback: event_outbox = 0 rows', {
    ok: outboxAfter.rows[0]?.c === '0',
    reason: 'ROLLBACK não reverteu o INSERT do outbox',
    detail: outboxAfter.rows[0],
  });

  // ============================================================
  // TEST 4 — Idempotência: 2ª chamada lança e NÃO duplica evento
  // ============================================================
  console.log('\n=== TEST 4 — Idempotência: 2ª chamada não duplica evento ===');
  const orderD = await seedServiceOrder(fixtures, 'fixed_price_escrow');
  const expectedEventIdD = deterministicServiceOrderPendingOutboxEventId(TENANT_ID, orderD);

  // 1ª chamada: sucesso
  const firstCallD = await serviceOrderService.completeOrder(TENANT_ID, orderD, {
    completedByActorId: fixtures.workerActorId,
    // E2E F1 mede bifurcação + atomicidade — gate genérico service_order:complete
    // não é o objeto de prova aqui. completedByUserId=undefined pula o gate
    // (service-order.service.ts:307-319: `if (input.completedByUserId) { ... }`).
    // DT-SERVICE-ORDER-AUTHORITY (sessão 2026-05-26) registra que a permissão
    // genérica não cruza com order.workerActorId — gap material a tratar em frente
    // própria. Aqui o E2E exerce a F1 sem o gate.
    completedByUserId: undefined,
    workerNotes: 'F1 test 4 — first call',
  });
  assertOk('T4.1 — 1ª chamada: seller_pending', {
    ok: firstCallD.status === 'seller_pending',
    reason: '1ª chamada não aplicou seller_pending',
    detail: { status: firstCallD.status },
  });

  // 2ª chamada: deve THROW porque status != 'in_progress'
  let secondCallThrew: Error | null = null;
  try {
    await serviceOrderService.completeOrder(TENANT_ID, orderD, {
      completedByActorId: fixtures.workerActorId,
      // E2E F1 mede bifurcação + atomicidade — gate genérico service_order:complete
    // não é o objeto de prova aqui. completedByUserId=undefined pula o gate
    // (service-order.service.ts:307-319: `if (input.completedByUserId) { ... }`).
    // DT-SERVICE-ORDER-AUTHORITY (sessão 2026-05-26) registra que a permissão
    // genérica não cruza com order.workerActorId — gap material a tratar em frente
    // própria. Aqui o E2E exerce a F1 sem o gate.
    completedByUserId: undefined,
      workerNotes: 'F1 test 4 — second call (must reject)',
    });
  } catch (e) {
    secondCallThrew = e as Error;
  }
  assertOk('T4.2 — 2ª chamada lança (status não é mais in_progress)', {
    ok: secondCallThrew !== null && /in_progress/i.test(secondCallThrew.message),
    reason: '2ª chamada deveria ter falhado',
    detail: { threw: secondCallThrew?.message ?? null },
  });

  // Outbox: ainda apenas 1 row (idempotência da chave determinística)
  const outboxD = await pool.query<{ c: string }>(
    `SELECT count(*)::text AS c FROM event_outbox
      WHERE tenant_id = $1::uuid AND event_id = $2::uuid`,
    [TENANT_ID, expectedEventIdD]
  );
  assertOk('T4.3 — event_outbox contém apenas 1 row (sem duplicação)', {
    ok: outboxD.rows[0]?.c === '1',
    reason: 'outbox duplicou apesar da 2ª chamada rejeitada',
    detail: outboxD.rows[0],
  });

  // Estado final intacto
  const finalRowD = await pool.query<{ status: string; deadline: Date | null }>(
    `SELECT status, buyer_confirmation_deadline_at AS deadline
       FROM service_orders WHERE tenant_id = $1::uuid AND id = $2::uuid`,
    [TENANT_ID, orderD]
  );
  assertOk('T4.4 — estado da order intacto após 2ª chamada (continua seller_pending)', {
    ok: finalRowD.rows[0]?.status === 'seller_pending' && finalRowD.rows[0]?.deadline !== null,
    reason: '2ª chamada alterou estado indevidamente',
    detail: finalRowD.rows[0],
  });

  // ============================================================
  // BALANÇO FINANCEIRO FINAL — todo o E2E deve ter movido ZERO centavos
  // ============================================================
  const moneyFinal = await captureMoneySnapshot();
  assertOk('FINAL — todo o E2E F1 NÃO MOVEU dinheiro: bank_ledger e escrow inalterados', {
    ok:
      moneyFinal.ledgerCount === moneyBefore.ledgerCount &&
      moneyFinal.escrowBalance === moneyBefore.escrowBalance,
    reason: 'algum passo F1 moveu dinheiro indevidamente',
    detail: { before: moneyBefore, final: moneyFinal },
  });

  console.log('\n═══ E2E F1 :: PASS — fixed_price_escrow funciona; legado preservado; atomicidade + idempotência provadas; ZERO movimento financeiro. ═══');
  await pool.end();
}

main().catch((err) => {
  console.error('❌ ERRO NÃO CAPTURADO:', err);
  process.exit(1);
});
