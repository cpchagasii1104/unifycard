/**
 * E2E — F-SUPPORT-TICKET-BUSINESS-FACT-GATE (Fatia 6, DESENHO_PAGINA_DO_ACTOR.md §5/§5B SELADO).
 * Money-free; MATERIAL (tabela support_tickets nova). Roda SÓ em DB efêmera
 * (runner run-support-ticket-ephemeral.ps1). NUNCA unificard_dev.
 *
 * Prova o coração da fatia — "o Chamado só nasce se há FATO DE NEGÓCIO real, nunca por conexão":
 *   A · buyer abre chamado referenciando um `order` real (toActorId=seller) → 201;
 *   B · 🔴 estranho (sem nenhuma relação com o negócio) tenta abrir chamado no MESMO order,
 *       representando A SI MESMO (canRepresentActor passa) → 422 (não é parte do fato real);
 *   C · referência inexistente (order_id aleatório) → 404;
 *   D · order real mas toActorId ERRADO (não é o seller) → 422;
 *   E · atacante declara actionContext.actorId=buyer (impersonação) sem representá-lo → 403;
 *   F · customer abre chamado referenciando um `service_order` real (toActorId=worker) → 201;
 *   G · requester abre chamado referenciando um `booking` (owner_type='user' direto) → 201;
 *   H · requester abre chamado referenciando um `booking` contra um `service_offering`
 *       (resolve o provider via service_offerings.provider_actor_id — a cadeia de join) → 201;
 *   I · booking contra owner_type NÃO suportado nesta fatia (ex.: 'group') → 404 fail-closed
 *       (nunca adivinha o dono);
 *   J · GET /support-tickets/mine mostra o chamado pros DOIS lados; estranho não vê nada;
 *   K · GET /eligible-references lista o order entre buyer e seller;
 *   L · responder: a parte-alvo (seller) muda status; um estranho tentando responder → 403;
 *   M · reference_type fora do vocabulário → 400, zero chamado criado;
 *   N · Δbank=0.
 */

import 'tsconfig-paths/register';
import Fastify from 'fastify';
import { pool } from '../core/database/pool';
import { tenantService } from '../core/tenants/tenant.service';
import { randomUUID } from 'crypto';

const EXPECTED = process.env.EXPECTED_DATABASE_NAME || '';
type Res = { label: string; ok: boolean; reason?: string };
const results: Res[] = [];
const record = (label: string, ok: boolean, reason?: string): void => {
  results.push({ label, ok, reason });
  console.log(`  ${ok ? '✅' : '❌'} ${label}${ok ? '' : ` — ${reason ?? ''}`}`);
};

async function assertEphemeralDb(): Promise<void> {
  const db = (await pool.query<{ db: string }>('SELECT current_database() AS db')).rows[0]?.db;
  if (db === 'unificard_dev') throw new Error('ABORT: banco-alvo é "unificard_dev".');
  if (!EXPECTED || db !== EXPECTED) throw new Error(`ABORT: banco "${db}" ≠ EXPECTED "${EXPECTED}".`);
  if (!/support_ticket|ephemeral|test/i.test(db)) throw new Error(`ABORT: nome "${db}" não parece efêmero.`);
  console.log(`🔒 DB efêmera confirmada: ${db}`);
}

let seq = 0;
async function mkUserActor(tenantId: string, name: string): Promise<{ userId: string; actorId: string; gu: string }> {
  seq += 1;
  const gu = randomUUID();
  const userId = randomUUID();
  const tax = String(Date.now() + seq * 29).padStart(11, '0').slice(-11);
  await pool.query(`INSERT INTO global_users (global_user_id, cpf, metadata, created_at, updated_at) VALUES ($1::uuid,$2,'{}'::jsonb,NOW(),NOW())`, [gu, tax]);
  await pool.query(`INSERT INTO identities (global_user_id, tax_id, tax_id_type, kyc_status, kyc_level) VALUES ($1::uuid,$2,'cpf','approved','basic')`, [gu, tax]);
  await pool.query(`INSERT INTO users (id, user_id, tenant_id, email, password_hash, token_version, is_test, global_user_id, created_at, updated_at) VALUES ($1::uuid,$1::uuid,$2::uuid,$3,'x',0,true,$4::uuid,NOW(),NOW())`, [userId, tenantId, `st-${seq}@e2e.test`, gu]);
  const actorId = (
    await pool.query<{ id: string }>(
      `INSERT INTO actors (tenant_id, actor_type, display_name, user_id, global_user_id) VALUES ($1::uuid,'user',$2,$3::uuid,$4::uuid) RETURNING id::text AS id`,
      [tenantId, name, userId, gu]
    )
  ).rows[0].id;
  return { userId, actorId, gu };
}

async function main(): Promise<void> {
  await assertEphemeralDb();

  const { socialPortsRegistry } = await import('../core/social/ports-registry');
  const adapters = await import('../modules/social/adapters');
  socialPortsRegistry.setActorRepository(adapters.actorRepositoryAdapter);
  socialPortsRegistry.setActorUtils(adapters.actorUtilsAdapter);
  socialPortsRegistry.setSocialRepository(adapters.socialRepositoryAdapter);
  socialPortsRegistry.setSocialService(adapters.socialServiceAdapter);
  socialPortsRegistry.setEventFeedHandlers(adapters.eventFeedHandlersAdapter);

  const TENANT = randomUUID();
  await tenantService.createTenant({ id: TENANT, name: 'SupportTicket Tenant', slug: `st-${Date.now()}` });

  const buyer = await mkUserActor(TENANT, 'Buyer E2E');
  const seller = await mkUserActor(TENANT, 'Seller E2E');
  const customer = await mkUserActor(TENANT, 'Customer E2E');
  const worker = await mkUserActor(TENANT, 'Worker E2E');
  const requesterU = await mkUserActor(TENANT, 'Requester User-Owner E2E');
  const ownerU = await mkUserActor(TENANT, 'Owner Direct E2E');
  const requesterS = await mkUserActor(TENANT, 'Requester Offering E2E');
  const providerS = await mkUserActor(TENANT, 'Provider Offering E2E');
  const stranger = await mkUserActor(TENANT, 'Stranger E2E');
  const attacker = await mkUserActor(TENANT, 'Attacker E2E');

  // ── fixtures de FATO DE NEGÓCIO ────────────────────────────────────────────────────────────
  // reusa o repository REAL do marketplace (composição, Lei §5) em vez de INSERT bruto próprio.
  const { orderRepository } = await import('../modules/marketplace/order.repository');
  const order = await orderRepository.createOrder(TENANT, { buyerActorId: buyer.actorId, sellerActorId: seller.actorId, status: 'submitted' });
  const orderId = order.id;

  // concept/canonical/service governados — necessários p/ service_orders.service_id (NOT NULL)
  // e reusados depois pra service_offerings (mesmo padrão de fixture da Fatia 4).
  const gc = await pool.connect();
  let conceptId: string;
  try {
    await gc.query('BEGIN');
    await gc.query(`SELECT set_config('app.concept_governance','true', true)`);
    conceptId = (await gc.query<{ id: string }>(
      `INSERT INTO concepts (slug, domain) VALUES ($1,'servicos') RETURNING concept_id::text AS id`,
      [`st-corte-${Date.now()}`]
    )).rows[0].id;
    await gc.query('COMMIT');
  } catch (e) {
    await gc.query('ROLLBACK');
    throw e;
  } finally {
    gc.release();
  }
  const canonicalServiceId = (await pool.query<{ id: string }>(
    `INSERT INTO canonical_services (concept_id, name, slug, scope) VALUES ($1::uuid,'Corte ST E2E',$2,'global') RETURNING id::text AS id`,
    [conceptId, `st-corte-canon-${Date.now()}`]
  )).rows[0].id;
  const serviceId = (await pool.query<{ id: string }>(
    `INSERT INTO services (tenant_id, actor_id, name, slug, canonical_service_id, status) VALUES ($1::uuid,$2::uuid,'Corte ST E2E',$3,$4::uuid,'active') RETURNING service_id::text AS id`,
    [TENANT, providerS.actorId, `st-corte-svc-${Date.now()}`, canonicalServiceId]
  )).rows[0].id;

  const serviceOrderId = (await pool.query<{ id: string }>(
    `INSERT INTO service_orders (tenant_id, customer_actor_id, worker_actor_id, service_id, status, scheduled_start, created_by_actor_id)
     VALUES ($1::uuid,$2::uuid,$3::uuid,$4::uuid,'confirmed', now() + interval '1 day', $2::uuid) RETURNING id::text AS id`,
    [TENANT, customer.actorId, worker.actorId, serviceId]
  )).rows[0].id;

  // booking direto (owner_type='user')
  const availUserId = (await pool.query<{ id: string }>(
    `INSERT INTO availability (tenant_id, owner_type, owner_id, availability_type, status, start_datetime, end_datetime, timezone)
     VALUES ($1::uuid,'user',$2::uuid,'fixed','active', now() + interval '1 day', now() + interval '1 day 1 hour', 'America/Sao_Paulo')
     RETURNING availability_id::text AS id`,
    [TENANT, ownerU.actorId]
  )).rows[0].id;
  const bookingUserId = (await pool.query<{ id: string }>(
    `INSERT INTO bookings (tenant_id, availability_id, requester_actor_id, status) VALUES ($1::uuid,$2::uuid,$3::uuid,'confirmed') RETURNING booking_id::text AS id`,
    [TENANT, availUserId, requesterU.actorId]
  )).rows[0].id;

  // booking contra owner_type NÃO suportado (group) — prova o fail-closed do caso I
  const groupId = (await pool.query<{ id: string }>(
    `INSERT INTO groups (tenant_id, name, slug, owner_actor_id, status) VALUES ($1::uuid,'Grupo E2E',$2,$3::uuid,'active') RETURNING id::text AS id`,
    [TENANT, `st-grupo-${Date.now()}`, ownerU.actorId]
  )).rows[0].id;
  const availGroupId = (await pool.query<{ id: string }>(
    `INSERT INTO availability (tenant_id, owner_type, owner_id, availability_type, status, start_datetime, end_datetime, timezone)
     VALUES ($1::uuid,'group',$2::uuid,'fixed','active', now() + interval '2 days', now() + interval '2 days 1 hour', 'America/Sao_Paulo')
     RETURNING availability_id::text AS id`,
    [TENANT, groupId]
  )).rows[0].id;
  const bookingGroupId = (await pool.query<{ id: string }>(
    `INSERT INTO bookings (tenant_id, availability_id, requester_actor_id, status) VALUES ($1::uuid,$2::uuid,$3::uuid,'confirmed') RETURNING booking_id::text AS id`,
    [TENANT, availGroupId, requesterS.actorId]
  )).rows[0].id;

  // booking contra service_offering (resolve provider via join — o caso mais comum na vida real);
  // reusa o mesmo service/canonical_service criado acima (service_orders.service_id).
  const offeringId = (await pool.query<{ id: string }>(
    `INSERT INTO service_offerings (tenant_id, canonical_service_id, provider_actor_id, service_id, price_cents, duration_minutes, modality, status)
     VALUES ($1::uuid,$2::uuid,$3::uuid,$4::uuid,5000,30,'in_person','active') RETURNING id::text AS id`,
    [TENANT, canonicalServiceId, providerS.actorId, serviceId]
  )).rows[0].id;
  const availOfferingId = (await pool.query<{ id: string }>(
    `INSERT INTO availability (tenant_id, owner_type, owner_id, availability_type, status, start_datetime, end_datetime, timezone)
     VALUES ($1::uuid,'service_offering',$2::uuid,'fixed','active', now() + interval '3 days', now() + interval '3 days 1 hour', 'America/Sao_Paulo')
     RETURNING availability_id::text AS id`,
    [TENANT, offeringId]
  )).rows[0].id;
  const bookingOfferingId = (await pool.query<{ id: string }>(
    `INSERT INTO bookings (tenant_id, availability_id, requester_actor_id, status) VALUES ($1::uuid,$2::uuid,$3::uuid,'confirmed') RETURNING booking_id::text AS id`,
    [TENANT, availOfferingId, requesterS.actorId]
  )).rows[0].id;

  const supportTicketRoutes = (await import('../modules/support-tickets/support-ticket.routes')).default;
  const app = Fastify();
  app.decorateRequest('user', null);
  app.decorateRequest('tenant', null);
  app.decorateRequest('actionContext', null);
  app.addHook('onRequest', async (req: any) => {
    const uid = req.headers['x-test-user-id'];
    const aid = req.headers['x-test-actor-id'];
    const tid = req.headers['x-test-tenant-id'];
    req.user = uid ? { userId: uid, id: uid } : null;
    req.tenant = tid ? { id: tid } : null;
    req.actionContext = aid ? { actorId: aid, intent: 'e2e', source: 'e2e', scope: 'e2e' } : null;
  });
  await app.register(supportTicketRoutes);
  await app.ready();

  const call = (method: 'GET' | 'POST', url: string, opts: { userId?: string; actorId?: string; body?: unknown } = {}) =>
    app.inject({
      method,
      url,
      headers: {
        ...(opts.userId ? { 'x-test-user-id': opts.userId } : {}),
        ...(opts.actorId ? { 'x-test-actor-id': opts.actorId } : {}),
        'x-test-tenant-id': TENANT,
        'content-type': 'application/json',
      },
      payload: opts.body as string | object | undefined,
    });

  try {
    console.log('\n— support ticket business fact gate END-TO-END (Chamado só nasce de negócio real) —');

    const bankBefore = await pool.query<{ n: string }>(
      `SELECT (SELECT COUNT(*) FROM bank_ledger) || ':' || (SELECT COUNT(*) FROM bank_transactions) AS n`
    );

    // A · buyer abre chamado no order real
    const rA = await call('POST', '/support-tickets', {
      userId: buyer.userId, actorId: buyer.actorId,
      body: { referenceType: 'order', referenceId: orderId, toActorId: seller.actorId, subject: 'Produto quebrado', message: 'Chegou quebrado' },
    });
    const ticketA = (rA.json() as any)?.data;
    record('A buyer abre chamado no order real (toActorId=seller) → 201', rA.statusCode === 201 && ticketA?.status === 'open',
      `status=${rA.statusCode} body=${JSON.stringify(ticketA)}`);

    // B · estranho representando a si mesmo tenta abrir no MESMO order → 422 (não é parte real)
    const rB = await call('POST', '/support-tickets', {
      userId: stranger.userId, actorId: stranger.actorId,
      body: { referenceType: 'order', referenceId: orderId, toActorId: seller.actorId, subject: 'x', message: 'y' },
    });
    record('B estranho (não é parte do order) → 422', rB.statusCode === 422, `status=${rB.statusCode}`);

    // C · referência inexistente → 404
    const rC = await call('POST', '/support-tickets', {
      userId: buyer.userId, actorId: buyer.actorId,
      body: { referenceType: 'order', referenceId: randomUUID(), toActorId: seller.actorId, subject: 'x', message: 'y' },
    });
    record('C referência inexistente → 404', rC.statusCode === 404, `status=${rC.statusCode}`);

    // D · order real, toActorId ERRADO → 422
    const rD = await call('POST', '/support-tickets', {
      userId: buyer.userId, actorId: buyer.actorId,
      body: { referenceType: 'order', referenceId: orderId, toActorId: stranger.actorId, subject: 'x', message: 'y' },
    });
    record('D toActorId errado (não é o seller real) → 422', rD.statusCode === 422, `status=${rD.statusCode}`);

    // E · atacante impersona buyer → 403
    const rE = await call('POST', '/support-tickets', {
      userId: attacker.userId, actorId: buyer.actorId,
      body: { referenceType: 'order', referenceId: orderId, toActorId: seller.actorId, subject: 'x', message: 'y' },
    });
    record('E atacante impersonando buyer (sem representá-lo) → 403', rE.statusCode === 403, `status=${rE.statusCode}`);

    // F · service_order real
    const rF = await call('POST', '/support-tickets', {
      userId: customer.userId, actorId: customer.actorId,
      body: { referenceType: 'service_order', referenceId: serviceOrderId, toActorId: worker.actorId, subject: 'Serviço não concluído', message: 'Não veio' },
    });
    record('F customer abre chamado no service_order real (toActorId=worker) → 201', rF.statusCode === 201, `status=${rF.statusCode}`);

    // G · booking direto (owner_type='user')
    const rG = await call('POST', '/support-tickets', {
      userId: requesterU.userId, actorId: requesterU.actorId,
      body: { referenceType: 'booking', referenceId: bookingUserId, toActorId: ownerU.actorId, subject: 'Reserva com problema', message: 'x' },
    });
    record("G booking owner_type='user' direto (toActorId=owner) → 201", rG.statusCode === 201, `status=${rG.statusCode}`);

    // H · booking contra service_offering (resolve via provider_actor_id — a cadeia de join)
    const rH = await call('POST', '/support-tickets', {
      userId: requesterS.userId, actorId: requesterS.actorId,
      body: { referenceType: 'booking', referenceId: bookingOfferingId, toActorId: providerS.actorId, subject: 'Corte com problema', message: 'x' },
    });
    record("H booking contra service_offering resolve provider_actor_id via join → 201", rH.statusCode === 201, `status=${rH.statusCode}`);

    // I · booking contra owner_type não suportado (group) → 404 fail-closed
    const rI = await call('POST', '/support-tickets', {
      userId: requesterS.userId, actorId: requesterS.actorId,
      body: { referenceType: 'booking', referenceId: bookingGroupId, toActorId: ownerU.actorId, subject: 'x', message: 'y' },
    });
    record("I booking contra owner_type='group' (não suportado) → 404 fail-closed (nunca adivinha)", rI.statusCode === 404, `status=${rI.statusCode}`);

    // J · GET /mine — dos dois lados; estranho não vê nada
    const rJ1 = await call('GET', '/support-tickets/mine', { userId: buyer.userId, actorId: buyer.actorId });
    const rJ2 = await call('GET', '/support-tickets/mine', { userId: seller.userId, actorId: seller.actorId });
    const rJ3 = await call('GET', '/support-tickets/mine', { userId: stranger.userId, actorId: stranger.actorId });
    const j1 = (rJ1.json() as any)?.data ?? [];
    const j2 = (rJ2.json() as any)?.data ?? [];
    const j3 = (rJ3.json() as any)?.data ?? [];
    record('J GET /mine: buyer e seller veem o chamado do order; estranho não vê nada dele',
      j1.some((t: any) => t.id === ticketA?.id) && j2.some((t: any) => t.id === ticketA?.id) && !j3.some((t: any) => t.id === ticketA?.id),
      `buyer=${j1.length} seller=${j2.length} stranger=${j3.length}`);

    // K · eligible-references entre buyer e seller inclui o order
    const rK = await call('GET', `/support-tickets/eligible-references?withActorId=${seller.actorId}`, { userId: buyer.userId, actorId: buyer.actorId });
    const kRefs = (rK.json() as any)?.data ?? [];
    record('K eligible-references(buyer, seller) inclui o order real',
      rK.statusCode === 200 && kRefs.some((r: any) => r.referenceType === 'order' && r.referenceId === orderId),
      `refs=${JSON.stringify(kRefs)}`);

    // L · responder: seller (parte-alvo) muda status; estranho tentando responder → 403
    const rL1 = await call('POST', `/support-tickets/${ticketA.id}/respond`, {
      userId: seller.userId, actorId: seller.actorId, body: { status: 'in_progress' },
    });
    const rL2 = await call('POST', `/support-tickets/${ticketA.id}/respond`, {
      userId: stranger.userId, actorId: stranger.actorId, body: { status: 'resolved' },
    });
    record('L seller (parte-alvo) responde → 200; estranho tentando responder → 403',
      rL1.statusCode === 200 && (rL1.json() as any)?.data?.status === 'in_progress' && rL2.statusCode === 403,
      `seller=${rL1.statusCode} stranger=${rL2.statusCode}`);

    // M · reference_type inválido → 400, zero chamado criado
    const beforeCount = await pool.query<{ n: string }>(`SELECT COUNT(*)::text AS n FROM support_tickets`);
    const rM = await call('POST', '/support-tickets', {
      userId: buyer.userId, actorId: buyer.actorId,
      body: { referenceType: 'invalid_type', referenceId: orderId, toActorId: seller.actorId, subject: 'x', message: 'y' },
    });
    const afterCount = await pool.query<{ n: string }>(`SELECT COUNT(*)::text AS n FROM support_tickets`);
    record('M reference_type fora do vocabulário → 400, zero chamado novo',
      rM.statusCode === 400 && beforeCount.rows[0].n === afterCount.rows[0].n,
      `status=${rM.statusCode} count ${beforeCount.rows[0].n}→${afterCount.rows[0].n}`);

    // N · Δbank = 0
    const bankAfter = await pool.query<{ n: string }>(
      `SELECT (SELECT COUNT(*) FROM bank_ledger) || ':' || (SELECT COUNT(*) FROM bank_transactions) AS n`
    );
    record('N Δbank=0 (nenhuma tabela de valor tocada)', bankBefore.rows[0].n === bankAfter.rows[0].n,
      `${bankBefore.rows[0].n} → ${bankAfter.rows[0].n}`);
  } finally {
    await app.close();
  }

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${failed.length === 0 ? '🎉 PASS' : '💥 FAIL'} — ${results.length - failed.length}/${results.length}`);
  await pool.end();
  process.exit(failed.length === 0 ? 0 : 1);
}

main().catch(async (e) => {
  console.error('💥 erro fatal:', e?.message ?? e);
  try { await pool.end(); } catch { /* noop */ }
  process.exit(1);
});
