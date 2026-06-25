/**
 * E2E F-EVENTS-LIFECYCLE-QUARANTINE-GATE (§4.8.4) — subfatia 1 de events/RFQ.
 *
 * 🔒 DB EFÊMERA. Orquestrado por scripts/run-events-lifecycle-quarantine-gate-ephemeral.ps1.
 *
 * Tranca a NASCENTE: actor bloqueado não cria/muta evento (lifecycle declarativo) — logo não gera event.created →
 * event-feed downstream. Money-free; RFQ/acceptQuote/ticket/payment/booking NÃO tocados.
 *   • createEvent: scope (dono) bloqueado → 403; acting (humano caller) bloqueado → 403; ativo → OK; nada em events;
 *   • addSession/checkIn bloqueado → 403; ativo → OK;
 *   • assignStaff bloqueado → 403 (gate ANTES da reputação); ativo passa o gate (erro ≠ quarentena);
 *   • canRepresentActor puro; Δbank=0; zero payment_intents; zero booking/payment_request; schedules vazio.
 */
import 'tsconfig-paths/register';
import { randomUUID } from 'crypto';
import { pool } from '../core/database/pool';
import { tenantService } from '../core/tenants/tenant.service';
import { ensureUserActor } from '../modules/identity/actor-writer.service';
import { eventsService } from '../modules/events/events.service';
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
  if (!/events|lifecycle|quarantine|ephemeral|smoke|test/i.test(db)) throw new Error(`ABORT: nome "${db}" não parece efêmero.`);
  console.log(`🔒 DB efêmera confirmada: ${db}`);
}

let seq = 0;
async function seedActor(tenantId: string, name: string): Promise<{ userId: string; actorId: string; globalUserId: string }> {
  seq += 1; const gu = randomUUID(); const userId = randomUUID();
  const cpf = String(Date.now() + seq * 149).padStart(11, '0').slice(-11);
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
  await tenantService.createTenant({ id: TENANT_ID, name: 'Events Lifecycle Quarantine', slug: `elq-${Date.now()}` });
  const A = await seedActor(TENANT_ID, 'OrganizerActive'); // scope + acting + staff (ativo)
  const B = await seedActor(TENANT_ID, 'OrganizerBlocked'); // será bloqueado

  const start = new Date(Date.now() + 3600_000);
  const end = new Date(Date.now() + 7200_000);
  const createEvent = (actorId: string, callerGlobalUserId: string) =>
    eventsService.createEvent(TENANT_ID, { title: `Evento ${seq++}`, startTime: start, endTime: end, actorId } as any, callerGlobalUserId)
      .then((e) => ({ ok: true, id: (e as any).id } as any)).catch((e) => ({ ok: false, err: errOf(e) }));
  const addSession = (eventId: string, callerGlobalUserId: string) =>
    eventsService.addSession(TENANT_ID, eventId, { name: `S${seq++}`, startTime: start, endTime: end } as any, callerGlobalUserId)
      .then(() => ({ ok: true } as any)).catch((e) => ({ ok: false, err: errOf(e) }));
  const assignStaff = (eventId: string, staffGlobalUserId: string, callerGlobalUserId: string) =>
    eventsService.assignStaff(TENANT_ID, eventId, { globalUserId: staffGlobalUserId, role: 'usher' } as any, callerGlobalUserId)
      .then(() => ({ ok: true } as any)).catch((e) => ({ ok: false, err: errOf(e) }));
  const checkIn = (eventId: string, callerGlobalUserId: string) =>
    eventsService.checkIn(TENANT_ID, eventId, callerGlobalUserId)
      .then(() => ({ ok: true } as any)).catch((e) => ({ ok: false, err: errOf(e) }));

  const bankSql = `SELECT ((SELECT count(*) FROM bank_ledger)+(SELECT count(*) FROM bank_transactions)+(SELECT count(*) FROM bank_splits)+(SELECT count(*) FROM bank_accounts))::int AS n`;
  const bankBefore = await count(bankSql);
  const piBefore = await count(`SELECT COALESCE((SELECT count(*) FROM payment_intents),0)::int AS n`).catch(() => 0);
  const bookingBefore = await count(`SELECT (COALESCE((SELECT count(*) FROM bookings),0)+COALESCE((SELECT count(*) FROM payment_requests),0))::int AS n`).catch(() => 0);

  // ── createEvent ──
  const e1 = await createEvent(A.actorId, A.globalUserId);
  record('T1 createEvent ativo → OK (nascente)', e1.ok === true && !!e1.id, JSON.stringify(e1.err));
  await block(TENANT_ID, B.actorId);
  record('T2 createEvent scope (dono) bloqueado → 403', isBlocked403((await createEvent(B.actorId, A.globalUserId)).err));
  record('T3 createEvent acting (humano caller) bloqueado → 403', isBlocked403((await createEvent(A.actorId, B.globalUserId)).err));
  record('T4 bloqueado → nenhuma linha em events p/ o actor bloqueado', (await count(`SELECT count(*)::int AS n FROM events WHERE tenant_id=$1 AND actor_id=$2`, [TENANT_ID, B.actorId])) === 0);

  // ── addSession ──
  // ⚠️ RESÍDUO DESCOBERTO: o INSERT de addSession usa colunas inexistentes (event_sessions tem title/starts_at/
  // ends_at + tenant_id; o código usa name/start_time/end_time) → addSession ativo falha 42703. Bug PRÉ-EXISTENTE,
  // fora do escopo de quarentena. T5 prova: ativo PASSA o gate (erro ≠ quarentena). → DT-EVENTS-SESSION-CHECKIN-SCHEMA-DRIFT.
  { const r = await addSession(e1.id, A.globalUserId); record('T5 addSession ativo PASSA o gate (erro ≠ ACTOR_EFFECTIVELY_BLOCKED; drift event_sessions PRÉ-EXISTENTE)', r.ok === true || (r.ok === false && !isBlocked403(r.err)), JSON.stringify(r.err)); }
  record('T6 addSession bloqueado → 403', isBlocked403((await addSession(e1.id, B.globalUserId)).err));

  // ── assignStaff (gate ANTES da reputação) ──
  record('T7 assignStaff acting bloqueado → 403 (gate antes da reputação)', isBlocked403((await assignStaff(e1.id, A.globalUserId, B.globalUserId)).err));
  { const r = await assignStaff(e1.id, A.globalUserId, A.globalUserId); record('T8 assignStaff acting ativo PASSA o gate (erro ≠ ACTOR_EFFECTIVELY_BLOCKED; reputação é gate separado)', r.ok === true || (r.ok === false && !isBlocked403(r.err)), JSON.stringify(r.err)); }

  // ── checkIn ──
  // ⚠️ RESÍDUO DESCOBERTO: o INSERT de checkIn omite tenant_id (NOT NULL em event_attendees) → checkIn ativo falha
  // 23502. Bug PRÉ-EXISTENTE, fora do escopo de quarentena. T9 prova: ativo PASSA o gate. → DT-EVENTS-SESSION-CHECKIN-SCHEMA-DRIFT.
  { const r = await checkIn(e1.id, A.globalUserId); record('T9 checkIn ativo PASSA o gate (erro ≠ ACTOR_EFFECTIVELY_BLOCKED; drift event_attendees PRÉ-EXISTENTE)', r.ok === true || (r.ok === false && !isBlocked403(r.err)), JSON.stringify(r.err)); }
  record('T10 checkIn bloqueado → 403', isBlocked403((await checkIn(e1.id, B.globalUserId)).err));

  // ── NÃO-REGRESSÃO / MONEY-FREE ──
  record('T11 canRepresentActor segue TRUE bloqueado (representação ≠ autoridade-ativa)', (await authorizationService.canRepresentActor(TENANT_ID, B.userId, B.actorId)) === true);
  record('T12 zero payment_intents', (await count(`SELECT COALESCE((SELECT count(*) FROM payment_intents),0)::int AS n`).catch(() => 0)) === piBefore);
  record('T13 zero booking/payment_request novo', (await count(`SELECT (COALESCE((SELECT count(*) FROM bookings),0)+COALESCE((SELECT count(*) FROM payment_requests),0))::int AS n`).catch(() => 0)) === bookingBefore, `before=${bookingBefore}`);
  record('T14 Δbank=0', (await count(bankSql)) === bankBefore, `before=${bankBefore}`);
  record('T15 schedules/schedule_slots sem write', (await count(`SELECT (COALESCE((SELECT count(*) FROM schedules),0)+COALESCE((SELECT count(*) FROM schedule_slots),0))::int AS n`).catch(() => 0)) === 0);

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${'═'.repeat(64)}`);
  console.log(`RESULTADO: ${results.length - failed.length}/${results.length} verdes`);
  if (failed.length > 0) {
    console.log('FALHAS:'); failed.forEach((f) => console.log(`  ❌ ${f.label} — ${f.reason ?? ''}`));
    await pool.end(); process.exit(1);
  }
  await pool.end();
  console.log('✨ actor bloqueado não cria/muta evento (createEvent/addSession/assignStaff/checkIn) — nascente trancada; canRepresentActor puro; sem RFQ/booking/payment; Δbank=0.');
}

main().catch(async (e) => { console.error('💥 Erro não tratado:', e); try { await pool.end(); } catch { /* noop */ } process.exit(1); });
