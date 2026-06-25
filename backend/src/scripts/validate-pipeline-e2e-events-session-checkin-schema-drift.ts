/**
 * E2E F-EVENTS-SESSION-CHECKIN-SCHEMA-DRIFT (correção funcional).
 *
 * 🔒 DB EFÊMERA. Orquestrado por scripts/run-events-session-checkin-schema-drift-ephemeral.ps1.
 *
 * Prova que addSession e checkIn FUNCIONAM ponta-a-ponta após alinhar os INSERTs ao schema vivo (antes 42703/23502),
 * SEM mexer na quarentena (gate segue ANTES da escrita):
 *   • addSession ativo → OK: grava event_sessions(tenant_id, title, starts_at, ends_at);
 *   • checkIn ativo → OK: grava event_attendees(tenant_id, check_in_time);
 *   • bloqueado → 403 ANTES do insert (nenhuma linha nasce);
 *   • money-free; Δbank=0; canRepresentActor puro.
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
  if (!/session|checkin|drift|event|ephemeral|smoke|test/i.test(db)) throw new Error(`ABORT: nome "${db}" não parece efêmero.`);
  console.log(`🔒 DB efêmera confirmada: ${db}`);
}

let seq = 0;
async function seedActor(tenantId: string, name: string): Promise<{ userId: string; actorId: string; globalUserId: string }> {
  seq += 1; const gu = randomUUID(); const userId = randomUUID();
  const cpf = String(Date.now() + seq * 163).padStart(11, '0').slice(-11);
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
  await tenantService.createTenant({ id: TENANT_ID, name: 'Events Session CheckIn Drift', slug: `escd-${Date.now()}` });
  const A = await seedActor(TENANT_ID, 'OrganizerActive');
  const B = await seedActor(TENANT_ID, 'OrganizerBlocked');

  const start = new Date(Date.now() + 3600_000);
  const end = new Date(Date.now() + 7200_000);
  const ev = await eventsService.createEvent(TENANT_ID, { title: 'Ev', startTime: start, endTime: end, actorId: A.actorId } as any, A.globalUserId);
  const EVENT_ID = (ev as any).id;

  const addSession = (callerGlobalUserId: string) =>
    eventsService.addSession(TENANT_ID, EVENT_ID, { name: `S${seq++}`, startTime: start, endTime: end } as any, callerGlobalUserId)
      .then((s) => ({ ok: true, id: (s as any).id } as any)).catch((e) => ({ ok: false, err: errOf(e) }));
  const checkIn = (callerGlobalUserId: string) =>
    eventsService.checkIn(TENANT_ID, EVENT_ID, callerGlobalUserId).then((r) => ({ ok: true, r } as any)).catch((e) => ({ ok: false, err: errOf(e) }));

  const bankSql = `SELECT ((SELECT count(*) FROM bank_ledger)+(SELECT count(*) FROM bank_transactions)+(SELECT count(*) FROM bank_splits)+(SELECT count(*) FROM bank_accounts))::int AS n`;
  const bankBefore = await count(bankSql);
  const moneyBefore = await count(`SELECT (COALESCE((SELECT count(*) FROM bookings),0)+COALESCE((SELECT count(*) FROM payment_requests),0)+COALESCE((SELECT count(*) FROM payment_intents),0))::int AS n`).catch(() => 0);

  // ── addSession FUNCIONAL (drift corrigido) ──
  const s1 = await addSession(A.globalUserId);
  record('T1 addSession ativo → OK (antes 42703)', s1.ok === true && !!s1.id, JSON.stringify(s1.err));
  record('T2 event_sessions gravado com tenant_id/title/starts_at/ends_at', (await count(`SELECT count(*)::int AS n FROM event_sessions WHERE id=$1 AND tenant_id=$2 AND event_id=$3 AND title IS NOT NULL AND starts_at IS NOT NULL AND ends_at IS NOT NULL`, [s1.id, TENANT_ID, EVENT_ID])) === 1);

  // ── checkIn FUNCIONAL (drift corrigido) ──
  const c1 = await checkIn(A.globalUserId);
  record('T3 checkIn ativo → OK (antes 23502)', c1.ok === true && c1.r?.checkedIn === true, JSON.stringify(c1.err));
  record('T4 event_attendees gravado com tenant_id/checked_in_at', (await count(`SELECT count(*)::int AS n FROM event_attendees WHERE tenant_id=$1 AND event_id=$2 AND global_user_id=$3 AND checked_in_at IS NOT NULL`, [TENANT_ID, EVENT_ID, A.globalUserId])) === 1);

  // ── gate de quarentena PRESERVADO (8ª fatia) ──
  const sessBefore = await count(`SELECT count(*)::int AS n FROM event_sessions WHERE event_id=$1`, [EVENT_ID]);
  const attBefore = await count(`SELECT count(*)::int AS n FROM event_attendees WHERE event_id=$1`, [EVENT_ID]);
  await block(TENANT_ID, B.actorId);
  record('T5 addSession bloqueado → 403 (gate antes do insert)', isBlocked403((await addSession(B.globalUserId)).err));
  record('T6 bloqueado → nenhuma sessão nova', (await count(`SELECT count(*)::int AS n FROM event_sessions WHERE event_id=$1`, [EVENT_ID])) === sessBefore);
  record('T7 checkIn bloqueado → 403 (gate antes do insert)', isBlocked403((await checkIn(B.globalUserId)).err));
  record('T8 bloqueado → nenhum attendee novo', (await count(`SELECT count(*)::int AS n FROM event_attendees WHERE event_id=$1`, [EVENT_ID])) === attBefore);

  // ── NÃO-REGRESSÃO / MONEY-FREE ──
  record('T9 canRepresentActor segue TRUE bloqueado (representação ≠ autoridade-ativa)', (await authorizationService.canRepresentActor(TENANT_ID, B.userId, B.actorId)) === true);
  record('T10 zero booking/payment_request/payment_intents novos', (await count(`SELECT (COALESCE((SELECT count(*) FROM bookings),0)+COALESCE((SELECT count(*) FROM payment_requests),0)+COALESCE((SELECT count(*) FROM payment_intents),0))::int AS n`).catch(() => 0)) === moneyBefore);
  record('T11 Δbank=0', (await count(bankSql)) === bankBefore, `before=${bankBefore}`);
  record('T12 schedules/schedule_slots sem write', (await count(`SELECT (COALESCE((SELECT count(*) FROM schedules),0)+COALESCE((SELECT count(*) FROM schedule_slots),0))::int AS n`).catch(() => 0)) === 0);

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${'═'.repeat(64)}`);
  console.log(`RESULTADO: ${results.length - failed.length}/${results.length} verdes`);
  if (failed.length > 0) {
    console.log('FALHAS:'); failed.forEach((f) => console.log(`  ❌ ${f.label} — ${f.reason ?? ''}`));
    await pool.end(); process.exit(1);
  }
  await pool.end();
  console.log('✨ addSession/checkIn funcionam ponta-a-ponta (schema vivo: title/starts_at/ends_at/tenant_id · check_in_time/tenant_id); gate de quarentena ANTES da escrita; Δbank=0.');
}

main().catch(async (e) => { console.error('💥 Erro não tratado:', e); try { await pool.end(); } catch { /* noop */ } process.exit(1); });
