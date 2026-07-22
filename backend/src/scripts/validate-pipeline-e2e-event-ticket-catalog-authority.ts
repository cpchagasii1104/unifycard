/**
 * E2E — F-EVENT-TICKETING-CONVERGENCE (Fatia 1): catálogo de TIPO de ingresso governado.
 * POST/PATCH /events/:id/tickets(/:ticketId) carimbavam actionContext.actorId (HINT client-
 * declarado, DECISION-0113) sem prova; o repositório mirava um schema ARQUIVADO (coluna-fantasma
 * quantity_sold), estourando 500 em toda query. FIX: autoridade = chave exata (create_events/
 * manage_events) sobre o DONO DO EVENTO (event.organizerActorId, server-resolved), nunca o hint;
 * repositório convergido ao schema vivo (quantity_available). Bank-free: price_cents é valor
 * ANUNCIADO, nunca cobrado. DB efêmera. NUNCA unificard_dev.
 *
 *   (pos)  organizador (representa/é dono do evento) cria tipo → 201, row com
 *          quantity_available = quantity_total, created_by_actor_id = dono do evento;
 *   (neg)  não-representante do organizador tenta criar → 403, ZERO escrita;
 *   (pos2) organizador edita preço/quantidade → 200, valores refletidos, delta de
 *          quantity_available preservado;
 *   (neg2) não-representante tenta editar → 403, valores INALTERADOS;
 *   (d)    Δbank = 0.
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
  if (!/ticket|event|catalog|authority|ephemeral|test|e2e/i.test(db)) throw new Error(`ABORT: nome "${db}" não parece efêmero.`);
  console.log(`🔒 DB efêmera confirmada: ${db}`);
}

let seq = 0;
async function mkUserActor(tenantId: string, name: string): Promise<{ userId: string; actorId: string; globalUserId: string }> {
  seq += 1;
  const gu = randomUUID();
  const userId = randomUUID();
  const tax = String(Date.now() + seq * 41).padStart(11, '0').slice(-11);
  await pool.query(`INSERT INTO global_users (global_user_id, cpf, full_name, metadata, created_at, updated_at) VALUES ($1::uuid,$2,$3,'{}'::jsonb,NOW(),NOW())`, [gu, tax, name]);
  await pool.query(`INSERT INTO identities (global_user_id, tax_id, tax_id_type, kyc_status, kyc_level) VALUES ($1::uuid,$2,'cpf','approved','basic')`, [gu, tax]);
  await pool.query(`INSERT INTO users (id, user_id, tenant_id, email, password_hash, token_version, is_test, global_user_id, created_at, updated_at) VALUES ($1::uuid,$1::uuid,$2::uuid,$3,'x',0,true,$4::uuid,NOW(),NOW())`, [userId, tenantId, `ticketcat-${seq}@e2e.test`, gu]);
  const actorId = (
    await pool.query<{ id: string }>(
      `INSERT INTO actors (tenant_id, actor_type, display_name, user_id, global_user_id) VALUES ($1::uuid,'user',$2,$3::uuid,$4::uuid) RETURNING id::text AS id`,
      [tenantId, name, userId, gu]
    )
  ).rows[0].id;
  return { userId, actorId, globalUserId: gu };
}

async function seedEvent(tenantId: string, organizerActorId: string, title: string): Promise<string> {
  const row = (
    await pool.query<{ id: string }>(
      `INSERT INTO events (tenant_id, actor_id, actor_type, title, status, visibility)
       VALUES ($1::uuid, $2::uuid, 'user', $3, 'published', 'public') RETURNING id::text AS id`,
      [tenantId, organizerActorId, title]
    )
  ).rows[0];
  return row.id;
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
  await tenantService.createTenant({ id: TENANT, name: 'Event Ticket Catalog Authority E2E', slug: `ticketcat-${Date.now()}` });

  const organizer = await mkUserActor(TENANT, 'Organizador Real');
  const attacker = await mkUserActor(TENANT, 'Atacante');

  const eventId = await seedEvent(TENANT, organizer.actorId, 'Show da Vitima');

  const eventsSprint76Routes = (await import('../modules/events/events-sprint76.routes')).default;
  const app = Fastify();
  app.decorateRequest('user', null);
  app.decorateRequest('tenant', null);
  app.decorateRequest('actionContext', null);
  app.addHook('onRequest', async (req: any) => {
    const uid = req.headers['x-test-user-id'];
    const aid = req.headers['x-test-actor-id'];
    req.user = uid ? { userId: uid, id: uid } : null;
    req.tenant = { id: TENANT };
    req.actionContext = aid ? { actorId: aid, intent: 'e2e', source: 'e2e', scope: `e2e-${TENANT}` } : null;
  });
  await app.register(eventsSprint76Routes);
  await app.ready();

  const call = (method: 'POST' | 'PATCH', url: string, opts: { userId?: string; actorId?: string; body?: unknown }) =>
    app.inject({
      method, url,
      headers: {
        ...(opts.userId ? { 'x-test-user-id': opts.userId } : {}),
        ...(opts.actorId ? { 'x-test-actor-id': opts.actorId } : {}),
        'content-type': 'application/json',
      },
      payload: opts.body as object,
    });

  const countTickets = async (): Promise<number> =>
    Number((await pool.query<{ n: string }>(`SELECT COUNT(*)::int AS n FROM event_tickets WHERE event_id = $1`, [eventId])).rows[0].n);

  const readRow = async (ticketId: string) =>
    (await pool.query(`SELECT price_cents, quantity_total, quantity_available FROM event_tickets WHERE id = $1`, [ticketId])).rows[0];

  try {
    console.log('\n— event ticket-type catalog authority (F-EVENT-TICKETING-CONVERGENCE Fatia 1) —');
    const bankBefore = (await pool.query<{ n: string }>(
      `SELECT (SELECT COUNT(*) FROM bank_ledger) || ':' || (SELECT COUNT(*) FROM bank_transactions) AS n`
    )).rows[0].n;

    // (neg) atacante (não representa/não é dono do evento) tenta CRIAR tipo → 403, zero escrita
    const cBefore = await countTickets();
    const rHack = await call('POST', `/events/${eventId}/tickets`, {
      userId: attacker.userId,
      body: { ticketType: 'inteira', priceCents: 5000, quantityTotal: 100 },
    });
    const hackBody = JSON.parse(rHack.body || '{}');
    record('(neg) atacante cria tipo de ingresso → 403 EVENT_TICKET_TYPE_ACTOR_NOT_AUTHORIZED, ZERO escrita',
      rHack.statusCode === 403 && hackBody?.code === 'EVENT_TICKET_TYPE_ACTOR_NOT_AUTHORIZED' && (await countTickets()) === cBefore,
      `status=${rHack.statusCode} code=${hackBody?.code}`);

    // (pos) organizador cria tipo → 201, quantity_available=quantity_total, created_by=dono do evento
    const rCreate = await call('POST', `/events/${eventId}/tickets`, {
      userId: organizer.userId,
      body: { ticketType: 'inteira', priceCents: 5000, quantityTotal: 100 },
    });
    const created = JSON.parse(rCreate.body || '{}');
    const row1 = created?.id ? await readRow(created.id) : null;
    record('(pos) organizador cria tipo → 201 + quantity_available=quantity_total + created_by=dono do evento',
      rCreate.statusCode === 201 && !!created?.id && created.createdByActorId === organizer.actorId &&
      !!row1 && row1.quantity_available === row1.quantity_total && row1.quantity_total === 100,
      `status=${rCreate.statusCode} createdBy=${created?.createdByActorId} row=${JSON.stringify(row1)}`);
    const ticketId = created.id as string;

    // (neg2) atacante tenta EDITAR o tipo → 403, valores inalterados
    const beforeEdit = await readRow(ticketId);
    const rHackEdit = await call('PATCH', `/events/${eventId}/tickets/${ticketId}`, {
      userId: attacker.userId,
      body: { priceCents: 1, quantityTotal: 1 },
    });
    const hackEditBody = JSON.parse(rHackEdit.body || '{}');
    const afterHackEdit = await readRow(ticketId);
    record('(neg2) atacante edita tipo → 403; preço/quantidade INALTERADOS',
      rHackEdit.statusCode === 403 && hackEditBody?.code === 'EVENT_TICKET_TYPE_ACTOR_NOT_AUTHORIZED' &&
      afterHackEdit.price_cents === beforeEdit.price_cents && afterHackEdit.quantity_total === beforeEdit.quantity_total,
      `status=${rHackEdit.statusCode} antes=${JSON.stringify(beforeEdit)} depois=${JSON.stringify(afterHackEdit)}`);

    // (pos2) organizador edita preço + aumenta quantidade em 20 → 200, delta preservado (available sobe 20)
    const rEdit = await call('PATCH', `/events/${eventId}/tickets/${ticketId}`, {
      userId: organizer.userId,
      body: { priceCents: 7500, quantityTotal: 120 },
    });
    const edited = JSON.parse(rEdit.body || '{}');
    const row2 = await readRow(ticketId);
    // price_cents é BIGINT — node-pg devolve como string (segurança de 64-bit); coagir p/ comparar.
    record('(pos2) organizador edita preço+quantidade → 200, valores refletidos, delta de disponibilidade preservado',
      rEdit.statusCode === 200 && Number(edited.priceCents) === 7500 && edited.quantityTotal === 120 &&
      Number(row2.price_cents) === 7500 && row2.quantity_total === 120 && row2.quantity_available === 120,
      `status=${rEdit.statusCode} row=${JSON.stringify(row2)}`);

    // (contenção ADDENDUM) /reserve e /pay são DEFERIDOS (ticket_sales não convergido) — devem
    // devolver 501 honesto ANTES de qualquer escrita (reproduzido: /reserve criava `orders` órfão;
    // /pay estourava 500 na 1ª leitura). Zero linhas novas em orders/payment_intents/ticket_sales.
    const count = async (t: string) => Number((await pool.query<{ n: string }>(`SELECT COUNT(*)::int AS n FROM ${t}`)).rows[0].n);
    const ordersBefore = await count('orders');
    const paymentIntentsBefore = await count('payment_intents');
    const ticketSalesBefore = await count('ticket_sales');

    const rReserve = await call('POST', `/tickets/${ticketId}/reserve`, {
      userId: organizer.userId, actorId: organizer.actorId,
      body: { buyerActorId: organizer.actorId, quantity: 1 },
    });
    const reserveBody = JSON.parse(rReserve.body || '{}');
    record('(contenção) POST /tickets/:id/reserve → 501 TICKET_PURCHASE_DEFERRED_FATIA2, ZERO escrita',
      rReserve.statusCode === 501 && reserveBody?.code === 'TICKET_PURCHASE_DEFERRED_FATIA2' &&
      (await count('orders')) === ordersBefore && (await count('payment_intents')) === paymentIntentsBefore && (await count('ticket_sales')) === ticketSalesBefore,
      `status=${rReserve.statusCode} code=${reserveBody?.code}`);

    const rPay = await call('POST', `/tickets/${ticketId}/pay`, { userId: organizer.userId, actorId: organizer.actorId, body: {} });
    const payBody = JSON.parse(rPay.body || '{}');
    record('(contenção) POST /tickets/:id/pay → 501 TICKET_PURCHASE_DEFERRED_FATIA2, ZERO escrita',
      rPay.statusCode === 501 && payBody?.code === 'TICKET_PURCHASE_DEFERRED_FATIA2' &&
      (await count('orders')) === ordersBefore && (await count('payment_intents')) === paymentIntentsBefore && (await count('ticket_sales')) === ticketSalesBefore,
      `status=${rPay.statusCode} code=${payBody?.code}`);

    // (d) Δbank = 0
    const bankAfter = (await pool.query<{ n: string }>(
      `SELECT (SELECT COUNT(*) FROM bank_ledger) || ':' || (SELECT COUNT(*) FROM bank_transactions) AS n`
    )).rows[0].n;
    record('(d) Δbank=0', bankBefore === bankAfter, `${bankBefore} → ${bankAfter}`);
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
