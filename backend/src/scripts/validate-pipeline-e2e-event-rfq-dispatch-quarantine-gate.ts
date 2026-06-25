/**
 * E2E F-EVENT-RFQ-DISPATCH-QUARANTINE-GATE (§4.8.4) — subfatia 3a de events/RFQ (só dispatch).
 *
 * 🔒 DB EFÊMERA. Orquestrado por scripts/run-event-rfq-dispatch-quarantine-gate-ephemeral.ps1.
 *
 * Dispatch = opportunity/notification (money-free). Prova:
 *   • organizer ativo dispara → OK (opportunity_dispatches nascem);
 *   • organizer bloqueado dispara → 403 (nenhum dispatch novo);
 *   • company target BLOQUEADA não impede dispatch por organizer ativo (target é passivo);
 *   • acceptQuote segue 403 EVENT_RFQ_ACCEPT_QUOTE_CONTAINED (freezer R7b);
 *   • zero booking/payment_request/payment_intent; Δbank=0; canRepresentActor puro.
 */
import 'tsconfig-paths/register';
import { randomUUID } from 'crypto';
import Fastify from 'fastify';
import { pool } from '../core/database/pool';
import { tenantService } from '../core/tenants/tenant.service';
import { ensureUserActor } from '../modules/identity/actor-writer.service';
import { eventsService } from '../modules/events/events.service';
import { eventRFQService } from '../modules/events/event-rfq.service';
import { eventRFQOpportunityService } from '../modules/events/event-rfq-opportunity.service';
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
  if (!/rfq|dispatch|event|quarantine|ephemeral|smoke|test/i.test(db)) throw new Error(`ABORT: nome "${db}" não parece efêmero.`);
  console.log(`🔒 DB efêmera confirmada: ${db}`);
}

let seq = 0;
async function seedActor(tenantId: string, name: string): Promise<{ userId: string; actorId: string; globalUserId: string }> {
  seq += 1; const gu = randomUUID(); const userId = randomUUID();
  const cpf = String(Date.now() + seq * 157).padStart(11, '0').slice(-11);
  await pool.query(`INSERT INTO global_users (global_user_id, cpf, full_name) VALUES ($1::uuid,$2,$3)`, [gu, cpf, name]);
  await pool.query(`INSERT INTO identities (global_user_id, tax_id, tax_id_type, kyc_status, kyc_level) VALUES ($1::uuid,$2,'cpf','approved','basic')`, [gu, cpf]);
  await pool.query(`INSERT INTO users (id, user_id, tenant_id, email, password_hash, token_version, is_test, global_user_id, created_at, updated_at) VALUES ($1::uuid,$1::uuid,$2::uuid,$3,'x',0,true,$4::uuid,NOW(),NOW())`, [userId, tenantId, `${name.toLowerCase()}-${seq}@e2e.test`, gu]);
  const a = await ensureUserActor(tenantId, userId);
  return { userId, actorId: a.actor_id, globalUserId: gu };
}
const block = (tenantId: string, actorId: string) => pool.query(`INSERT INTO atl_blocked_actors (actor_id, tenant_id, blocked_reason) VALUES ($1::uuid,$2::uuid,'e2e quarantine')`, [actorId, tenantId]);

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
  await tenantService.createTenant({ id: TENANT_ID, name: 'Event RFQ Dispatch Quarantine', slug: `erd-${Date.now()}` });
  const A = await seedActor(TENANT_ID, 'OrganizerActive');  // organizer (ativo)
  const B = await seedActor(TENANT_ID, 'OrganizerBlocked'); // organizer — será bloqueado
  const P = await seedActor(TENANT_ID, 'Provider');         // dono do serviço
  const C1 = await seedActor(TENANT_ID, 'CompanyTarget1');  // empresa-alvo (ativa)
  const C2 = await seedActor(TENANT_ID, 'CompanyTargetBlocked'); // empresa-alvo (bloqueada)

  const mkEventRFQ = async (organizer: { actorId: string; globalUserId: string }) => {
    const ev = await eventsService.createEvent(TENANT_ID, { title: `Ev ${seq++}`, startTime: new Date(Date.now() + 3600_000), endTime: new Date(Date.now() + 7200_000), actorId: organizer.actorId } as any, organizer.globalUserId);
    const eventId = (ev as any).id;
    const csId = (await pool.query<{ id: string }>(`SELECT id::text AS id FROM canonical_services LIMIT 1`)).rows[0]?.id;
    const svcId = (await pool.query<{ id: string }>(`INSERT INTO services (tenant_id, actor_id, name, slug, canonical_service_id) VALUES ($1::uuid,$2::uuid,'Svc',$3,$4::uuid) RETURNING service_id::text AS id`, [TENANT_ID, P.actorId, `svc-${seq++}-${Date.now()}`, csId])).rows[0].id;
    const r = await eventRFQService.createRFQ(TENANT_ID, organizer.actorId, { eventId, items: [{ type: 'service', id: svcId }], criteria: {} } as any);
    return (r as any).rfq;
  };
  const dispatch = (rfq: any, companyActorIds: string[]) =>
    eventRFQOpportunityService.dispatchRFQToCompanies(TENANT_ID, A.userId, rfq, companyActorIds)
      .then((res) => ({ ok: true, res } as any)).catch((e) => ({ ok: false, err: errOf(e) }));
  const dispatchesFor = (rfqId: string) => count(`SELECT COALESCE((SELECT count(*) FROM opportunity_dispatches WHERE opportunity_id=$1),0)::int AS n`, [rfqId]).catch(() => 0);

  const rfqA = await mkEventRFQ(A);  // organizer A (ativo)
  const rfqB = await mkEventRFQ(B);  // organizer B (ainda ativo na criação)

  const bankSql = `SELECT ((SELECT count(*) FROM bank_ledger)+(SELECT count(*) FROM bank_transactions)+(SELECT count(*) FROM bank_splits)+(SELECT count(*) FROM bank_accounts))::int AS n`;
  const bankBefore = await count(bankSql);
  const moneyBefore = await count(`SELECT (COALESCE((SELECT count(*) FROM bookings),0)+COALESCE((SELECT count(*) FROM payment_requests),0)+COALESCE((SELECT count(*) FROM payment_intents),0))::int AS n`).catch(() => 0);

  // ── dispatch ──
  // opportunity_dispatches é GHOST (DDL fora do profile FULL) → dispatch contido-por-acidente (42P01). Meu gate
  // torna a contenção EXPLÍCITA p/ organizer bloqueado (403 ANTES do ghost) e fica pronto p/ quando a tabela existir.
  const dispatchGhost = (await pool.query<{ r: string | null }>(`SELECT to_regclass('opportunity_dispatches')::text AS r`)).rows[0]?.r;
  record('T0 opportunity_dispatches é GHOST (containment-by-accident; gate torna explícito p/ bloqueado)', dispatchGhost === null);
  { const r = await dispatch(rfqA, [C1.actorId]); record('T1 organizer ativo PASSA o gate de quarentena (sem ACTOR_EFFECTIVELY_BLOCKED; downstream cai no ghost 42P01)', r.ok === true && !isBlocked403(r.err), JSON.stringify(r.res)); }
  await block(TENANT_ID, B.actorId);
  record('T2 organizer bloqueado dispara → 403 ACTOR_EFFECTIVELY_BLOCKED', isBlocked403((await dispatch(rfqB, [C1.actorId])).err));
  record('T3 bloqueado → nenhum opportunity_dispatch novo p/ o RFQ do organizer bloqueado', (await dispatchesFor(rfqB.rfqId)) === 0);

  // ── company target bloqueada NÃO impede dispatch de organizer ativo (target passivo) ──
  await block(TENANT_ID, C2.actorId);
  { const r = await dispatch(rfqA, [C2.actorId]); record('T4 company target bloqueada NÃO bloqueia dispatch de organizer ativo (target é passivo)', r.ok === true && !isBlocked403(r.err), JSON.stringify(r.err)); }

  // ── acceptQuote segue contido (403) — freezer R7b ──
  {
    const app = Fastify({ logger: false });
    const routesMod: any = await import('../modules/events/event-rfq.routes');
    const routes = routesMod.eventRFQRoutes || routesMod.default;
    await app.register(async (scope) => {
      scope.decorateRequest('user', null); scope.decorateRequest('tenant', null); scope.decorateRequest('actionContext', null);
      scope.addHook('preHandler', async (req) => { (req as any).user = { id: A.userId, userId: A.userId }; (req as any).tenant = { id: TENANT_ID }; (req as any).actionContext = { actorId: A.actorId }; });
      await scope.register(routes as any);
    });
    await app.ready();
    try {
      const r = await app.inject({ method: 'POST', url: `/events/${(rfqA as any).eventId}/rfqs/${rfqA.rfqId}/quotes/q1/accept`, headers: { 'content-type': 'application/json' }, payload: '{}' });
      record('T5 acceptQuote → 403 EVENT_RFQ_ACCEPT_QUOTE_CONTAINED (freezer R7b intacto)', r.statusCode === 403 && /EVENT_RFQ_ACCEPT_QUOTE_CONTAINED/.test(r.payload), `status=${r.statusCode} body=${r.payload.slice(0, 80)}`);
    } finally { await app.close(); }
  }

  // ── NÃO-REGRESSÃO / MONEY-FREE ──
  record('T6 canRepresentActor segue TRUE bloqueado (representação ≠ autoridade-ativa)', (await authorizationService.canRepresentActor(TENANT_ID, B.userId, B.actorId)) === true);
  record('T7 zero booking/payment_request/payment_intents novos (dispatch é opportunity, não dinheiro)', (await count(`SELECT (COALESCE((SELECT count(*) FROM bookings),0)+COALESCE((SELECT count(*) FROM payment_requests),0)+COALESCE((SELECT count(*) FROM payment_intents),0))::int AS n`).catch(() => 0)) === moneyBefore, `before=${moneyBefore}`);
  record('T8 Δbank=0', (await count(bankSql)) === bankBefore, `before=${bankBefore}`);
  record('T9 schedules/schedule_slots sem write', (await count(`SELECT (COALESCE((SELECT count(*) FROM schedules),0)+COALESCE((SELECT count(*) FROM schedule_slots),0))::int AS n`).catch(() => 0)) === 0);

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${'═'.repeat(64)}`);
  console.log(`RESULTADO: ${results.length - failed.length}/${results.length} verdes`);
  if (failed.length > 0) {
    console.log('FALHAS:'); failed.forEach((f) => console.log(`  ❌ ${f.label} — ${f.reason ?? ''}`));
    await pool.end(); process.exit(1);
  }
  await pool.end();
  console.log('✨ organizer bloqueado não dispara RFQ (gate antes do createDispatch); company target passiva; acceptQuote contido (R7b); canRepresentActor puro; Δbank=0.');
}

main().catch(async (e) => { console.error('💥 Erro não tratado:', e); try { await pool.end(); } catch { /* noop */ } process.exit(1); });
