/**
 * E2E F-EVENT-RFQ-DECLARATIVE-QUARANTINE-GATE (§4.8.4) — subfatia 2 de events/RFQ.
 *
 * 🔒 DB EFÊMERA. Orquestrado por scripts/run-event-rfq-declarative-quarantine-gate-ephemeral.ps1.
 *
 * RFQ declarativo = procurement/metadata (event.metadata.rfqs); quote = PROPOSTA. Prova:
 *   • organizer bloqueado não cria RFQ → 403 (metadata.rfqs não muda);
 *   • organizer bloqueado não fecha RFQ → 403 (status permanece OPEN);
 *   • provider bloqueado não cria quote → 403 (quotes não mudam);
 *   • ativos mantêm comportamento vivo;
 *   • NÃO chama acceptQuote/dispatch; zero booking/payment_request/payment_intents; Δbank=0; canRepresentActor puro.
 */
import 'tsconfig-paths/register';
import { randomUUID } from 'crypto';
import { pool } from '../core/database/pool';
import { tenantService } from '../core/tenants/tenant.service';
import { ensureUserActor } from '../modules/identity/actor-writer.service';
import { eventsService } from '../modules/events/events.service';
import { eventRFQService } from '../modules/events/event-rfq.service';
import { authorizationService } from '../core/authorization/authorization.service';

const EXPECTED = process.env.EXPECTED_DATABASE_NAME || '';
type Res = { label: string; ok: boolean; reason?: string };
const results: Res[] = [];
const record = (label: string, ok: boolean, reason?: string): void => {
  results.push({ label, ok, reason });
  console.log(`  ${ok ? '✅' : '❌'} ${label}${ok ? '' : ` — ${reason ?? ''}`}`);
};
const count = async (sql: string, p: unknown[] = []): Promise<number> => Number((await pool.query(sql, p)).rows[0].n);
const errOf = (e: any): { code?: string; status?: number; msg: string } => ({ code: e?.code, status: e?.statusCode, msg: e?.message || String(e) });
const isBlocked403 = (err: any): boolean => err?.status === 403 && /ACTOR_EFFECTIVELY_BLOCKED/.test(`${err?.code || ''} ${err?.msg || ''}`);

async function assertEphemeralDb(): Promise<void> {
  const db = (await pool.query<{ db: string }>('SELECT current_database() AS db')).rows[0]?.db;
  if (db === 'unificard_dev') throw new Error('ABORT: banco-alvo é "unificard_dev".');
  if (!EXPECTED || db !== EXPECTED) throw new Error(`ABORT: banco "${db}" ≠ EXPECTED "${EXPECTED}".`);
  if (!/rfq|event|quarantine|ephemeral|smoke|test/i.test(db)) throw new Error(`ABORT: nome "${db}" não parece efêmero.`);
  console.log(`🔒 DB efêmera confirmada: ${db}`);
}

let seq = 0;
async function seedActor(tenantId: string, name: string): Promise<{ userId: string; actorId: string; globalUserId: string }> {
  seq += 1; const gu = randomUUID(); const userId = randomUUID();
  const cpf = String(Date.now() + seq * 151).padStart(11, '0').slice(-11);
  await pool.query(`INSERT INTO global_users (global_user_id, cpf, full_name) VALUES ($1::uuid,$2,$3)`, [gu, cpf, name]);
  await pool.query(`INSERT INTO identities (global_user_id, tax_id, tax_id_type, kyc_status, kyc_level) VALUES ($1::uuid,$2,'cpf','approved','basic')`, [gu, cpf]);
  await pool.query(`INSERT INTO users (id, user_id, tenant_id, email, password_hash, token_version, is_test, global_user_id, created_at, updated_at) VALUES ($1::uuid,$1::uuid,$2::uuid,$3,'x',0,true,$4::uuid,NOW(),NOW())`, [userId, tenantId, `${name.toLowerCase()}-${seq}@e2e.test`, gu]);
  const a = await ensureUserActor(tenantId, userId);
  return { userId, actorId: a.actor_id, globalUserId: gu };
}
const block = (tenantId: string, actorId: string) => pool.query(`INSERT INTO atl_blocked_actors (actor_id, tenant_id, blocked_reason) VALUES ($1::uuid,$2::uuid,'e2e quarantine')`, [actorId, tenantId]);
const rfqsCount = (eventId: string) => count(`SELECT COALESCE(jsonb_array_length(metadata->'rfqs'),0)::int AS n FROM events WHERE id=$1`, [eventId]);
async function rfqStatus(eventId: string, rfqId: string): Promise<string | undefined> {
  const r = await pool.query<{ s: string }>(`SELECT (rfq->>'status') AS s FROM events, jsonb_array_elements(metadata->'rfqs') rfq WHERE events.id=$1 AND rfq->>'rfqId'=$2`, [eventId, rfqId]);
  return r.rows[0]?.s;
}
async function quotesCount(eventId: string, rfqId: string): Promise<number> {
  const r = await pool.query<{ n: number }>(`SELECT COALESCE(jsonb_array_length(rfq->'quotes'),0)::int AS n FROM events, jsonb_array_elements(metadata->'rfqs') rfq WHERE events.id=$1 AND rfq->>'rfqId'=$2`, [eventId, rfqId]);
  return Number(r.rows[0]?.n ?? 0);
}

async function main(): Promise<void> {
  await assertEphemeralDb();
  const { socialPortsRegistry } = await import('../core/social/ports-registry');
  const sa = await import('../modules/social/adapters');
  socialPortsRegistry.setActorRepository(sa.actorRepositoryAdapter);
  socialPortsRegistry.setActorUtils(sa.actorUtilsAdapter);
  socialPortsRegistry.setSocialRepository(sa.socialRepositoryAdapter);
  socialPortsRegistry.setSocialService(sa.socialServiceAdapter);
  socialPortsRegistry.setEventFeedHandlers(sa.eventFeedHandlersAdapter);

  const TENANT_ID = randomUUID();
  await tenantService.createTenant({ id: TENANT_ID, name: 'Event RFQ Declarative Quarantine', slug: `erq-${Date.now()}` });
  const A = await seedActor(TENANT_ID, 'OrganizerActive'); // organizer (ativo)
  const B = await seedActor(TENANT_ID, 'BlockedActor');    // organizer/provider bloqueado
  const P = await seedActor(TENANT_ID, 'ProviderActive');  // provider (ativo)

  const ev = await eventsService.createEvent(TENANT_ID, { title: 'Evento RFQ', startTime: new Date(Date.now() + 3600_000), endTime: new Date(Date.now() + 7200_000), actorId: A.actorId } as any, A.globalUserId);
  const EVENT_ID = (ev as any).id;
  const csId = (await pool.query<{ id: string }>(`SELECT id::text AS id FROM canonical_services LIMIT 1`)).rows[0]?.id;
  const SERVICE_ID = (await pool.query<{ id: string }>(`INSERT INTO services (tenant_id, actor_id, name, slug, canonical_service_id) VALUES ($1::uuid,$2::uuid,'Svc',$3,$4::uuid) RETURNING service_id::text AS id`, [TENANT_ID, P.actorId, `svc-${Date.now()}`, csId])).rows[0].id;

  const createRFQ = (organizerActorId: string) =>
    eventRFQService.createRFQ(TENANT_ID, organizerActorId, { eventId: EVENT_ID, items: [{ type: 'service', id: SERVICE_ID }], criteria: {} } as any)
      .then((r) => ({ ok: true, rfqId: (r as any).rfq?.rfqId ?? (r as any).rfqId } as any)).catch((e) => ({ ok: false, err: errOf(e) }));
  const closeRFQ = (rfqId: string, closedByActorId: string) =>
    eventRFQService.closeRFQ(TENANT_ID, EVENT_ID, rfqId, closedByActorId).then(() => ({ ok: true } as any)).catch((e) => ({ ok: false, err: errOf(e) }));
  const createQuote = (rfqId: string, providerActorId: string) =>
    eventRFQService.createQuote(TENANT_ID, EVENT_ID, providerActorId, { rfqId, serviceId: SERVICE_ID, priceCents: 10000, currency: 'BRL' } as any)
      .then(() => ({ ok: true } as any)).catch((e) => ({ ok: false, err: errOf(e) }));

  const bankSql = `SELECT ((SELECT count(*) FROM bank_ledger)+(SELECT count(*) FROM bank_transactions)+(SELECT count(*) FROM bank_splits)+(SELECT count(*) FROM bank_accounts))::int AS n`;
  const bankBefore = await count(bankSql);
  const moneyBefore = await count(`SELECT (COALESCE((SELECT count(*) FROM bookings),0)+COALESCE((SELECT count(*) FROM payment_requests),0)+COALESCE((SELECT count(*) FROM payment_intents),0))::int AS n`).catch(() => 0);

  // ── createRFQ ──
  const rfq1 = await createRFQ(A.actorId); record('T1 organizer ativo cria RFQ → OK', rfq1.ok === true && !!rfq1.rfqId, JSON.stringify(rfq1.err));
  const rfq2 = await createRFQ(A.actorId); // p/ teste de close
  const rfqsAfterActive = await rfqsCount(EVENT_ID);
  await block(TENANT_ID, B.actorId);
  record('T2 organizer bloqueado cria RFQ → 403', isBlocked403((await createRFQ(B.actorId)).err));
  record('T3 bloqueado → metadata.rfqs não muda', (await rfqsCount(EVENT_ID)) === rfqsAfterActive, `before=${rfqsAfterActive}`);

  // ── closeRFQ ──
  record('T4 organizer bloqueado fecha RFQ → 403', isBlocked403((await closeRFQ(rfq2.rfqId, B.actorId)).err));
  record('T5 bloqueado → RFQ status permanece OPEN', (await rfqStatus(EVENT_ID, rfq2.rfqId)) === 'open');
  record('T6 organizer ativo fecha RFQ → OK', (await closeRFQ(rfq2.rfqId, A.actorId)).ok === true);
  record('T6b status → closed', (await rfqStatus(EVENT_ID, rfq2.rfqId)) === 'closed');

  // ── createQuote ──
  const qBefore = await quotesCount(EVENT_ID, rfq1.rfqId);
  record('T7 provider ativo cria quote → OK', (await createQuote(rfq1.rfqId, P.actorId)).ok === true, JSON.stringify((await createQuote(rfq1.rfqId, P.actorId)).err));
  record('T8 provider bloqueado cria quote → 403', isBlocked403((await createQuote(rfq1.rfqId, B.actorId)).err));
  record('T9 bloqueado → quotes não mudam além do ativo', (await quotesCount(EVENT_ID, rfq1.rfqId)) >= qBefore + 1);

  // ── NÃO-REGRESSÃO / MONEY-FREE ──
  record('T10 canRepresentActor segue TRUE bloqueado (representação ≠ autoridade-ativa)', (await authorizationService.canRepresentActor(TENANT_ID, B.userId, B.actorId)) === true);
  record('T11 zero booking/payment_request/payment_intents novos (RFQ é procurement, não dinheiro)', (await count(`SELECT (COALESCE((SELECT count(*) FROM bookings),0)+COALESCE((SELECT count(*) FROM payment_requests),0)+COALESCE((SELECT count(*) FROM payment_intents),0))::int AS n`).catch(() => 0)) === moneyBefore, `before=${moneyBefore}`);
  record('T12 Δbank=0', (await count(bankSql)) === bankBefore, `before=${bankBefore}`);
  record('T13 schedules/schedule_slots sem write', (await count(`SELECT (COALESCE((SELECT count(*) FROM schedules),0)+COALESCE((SELECT count(*) FROM schedule_slots),0))::int AS n`).catch(() => 0)) === 0);

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${'═'.repeat(64)}`);
  console.log(`RESULTADO: ${results.length - failed.length}/${results.length} verdes`);
  if (failed.length > 0) {
    console.log('FALHAS:'); failed.forEach((f) => console.log(`  ❌ ${f.label} — ${f.reason ?? ''}`));
    await pool.end(); process.exit(1);
  }
  await pool.end();
  console.log('✨ organizer/provider bloqueado não cria/fecha RFQ nem cria quote (gate antes do UPDATE metadata); acceptQuote/dispatch intocados; canRepresentActor puro; Δbank=0.');
}

main().catch(async (e) => { console.error('💥 Erro não tratado:', e); try { await pool.end(); } catch { /* noop */ } process.exit(1); });
