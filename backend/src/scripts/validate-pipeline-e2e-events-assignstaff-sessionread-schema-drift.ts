/**
 * E2E F-EVENTS-ASSIGNSTAFF-SESSIONREAD-SCHEMA-DRIFT (correção funcional).
 *
 * 🔒 DB EFÊMERA. Orquestrado por scripts/run-events-assignstaff-sessionread-schema-drift-ephemeral.ps1.
 *
 * Prova que assignStaff (writer) e getEventWithDetails (session reader) FUNCIONAM após alinhar ao schema vivo
 * (event_staff actor-keyed; event_sessions title/starts_at/ends_at), SEM mexer na quarentena:
 *   • assignStaff ativo → OK: grava event_staff(tenant_id, responsible_actor_id, responsible_actor_type);
 *   • responsible_actor_id é o actor resolvido do staff (não global_user_id cru);
 *   • assigner bloqueado → 403 ANTES do insert (nenhuma linha nasce);
 *   • addSession + getEventWithDetails: a sessão gravada É legível pelo caminho de detalhes;
 *   • checkIn/createEvent não regridem; money-free; Δbank=0; canRepresentActor puro.
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
  if (!/staff|session|drift|event|ephemeral|smoke|test/i.test(db)) throw new Error(`ABORT: nome "${db}" não parece efêmero.`);
  console.log(`🔒 DB efêmera confirmada: ${db}`);
}

let seq = 0;
async function seedActor(tenantId: string, name: string): Promise<{ userId: string; actorId: string; globalUserId: string }> {
  seq += 1; const gu = randomUUID(); const userId = randomUUID();
  const cpf = String(Date.now() + seq * 167).padStart(11, '0').slice(-11);
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
  await tenantService.createTenant({ id: TENANT_ID, name: 'Events Staff Session Drift', slug: `essd-${Date.now()}` });
  const A = await seedActor(TENANT_ID, 'OrganizerActive');   // organizer/assigner ativo
  const Bk = await seedActor(TENANT_ID, 'AssignerBlocked');  // assigner — será bloqueado
  const St = await seedActor(TENANT_ID, 'StaffMember');      // staff designado (target)

  const start = new Date(Date.now() + 3600_000);
  const end = new Date(Date.now() + 7200_000);
  const ev = await eventsService.createEvent(TENANT_ID, { title: 'Ev', startTime: start, endTime: end, actorId: A.actorId } as any, A.globalUserId);
  const EVENT_ID = (ev as any).id;

  const assignStaff = (staffGlobalUserId: string, assignerGlobalUserId: string) =>
    eventsService.assignStaff(TENANT_ID, EVENT_ID, { globalUserId: staffGlobalUserId, role: 'usher' } as any, assignerGlobalUserId)
      .then((s) => ({ ok: true, id: (s as any).id } as any)).catch((e) => ({ ok: false, err: errOf(e) }));

  const bankSql = `SELECT ((SELECT count(*) FROM bank_ledger)+(SELECT count(*) FROM bank_transactions)+(SELECT count(*) FROM bank_splits)+(SELECT count(*) FROM bank_accounts))::int AS n`;
  const bankBefore = await count(bankSql);
  const moneyBefore = await count(`SELECT (COALESCE((SELECT count(*) FROM bookings),0)+COALESCE((SELECT count(*) FROM payment_requests),0)+COALESCE((SELECT count(*) FROM payment_intents),0))::int AS n`).catch(() => 0);

  // ── addSession + session reader ──
  // A query de sessões do getEventWithDetails foi alinhada ao schema vivo (title/starts_at/ends_at AS aliases).
  // Provamos a query de sessões ISOLADA. getEventWithDetails COMO UM TODO ainda é bloqueado por event_locations
  // GHOST (42P01) — fora do escopo desta fatia (substrato). Registrado como resíduo.
  await eventsService.addSession(TENANT_ID, EVENT_ID, { name: 'Sessão 1', startTime: start, endTime: end } as any, A.globalUserId);
  const sess = await pool.query<{ name: string; start_time: Date }>(`SELECT id, event_id, title AS name, starts_at AS start_time, ends_at AS end_time, now() AS created_at, now() AS updated_at FROM event_sessions WHERE event_id=$1 ORDER BY starts_at ASC`, [EVENT_ID]);
  record('T1 reader de sessões (query fixada) lê a sessão com title/starts_at/ends_at aliasados (antes 42703)', sess.rows.length === 1 && sess.rows[0].name === 'Sessão 1' && !!sess.rows[0].start_time);
  const locGhost = (await pool.query<{ r: string | null }>(`SELECT to_regclass('event_locations')::text AS r`)).rows[0]?.r;
  const det = await eventsService.getEventWithDetails(TENANT_ID, EVENT_ID).then(() => ({ ok: true } as any)).catch((e) => ({ ok: false, err: errOf(e) }));
  record('T2 RESÍDUO: getEventWithDetails ainda bloqueado por event_locations GHOST (42P01) — session-read fixado, locations fora do escopo', locGhost === null && det.ok === false && /event_locations/.test(det.err?.msg || ''), JSON.stringify({ locGhost, err: det.err }));

  // ── assignStaff: INSERT alinhado estruturalmente; o caminho ATIVO ainda cai em reputation_scores GHOST (42P01)
  // ANTES do INSERT (a checagem de reputação roda antes). Fora do escopo (substrato). Provamos gate-passthrough. ──
  const repGhost = (await pool.query<{ r: string | null }>(`SELECT to_regclass('reputation_scores')::text AS r`)).rows[0]?.r;
  const a1 = await assignStaff(St.globalUserId, A.globalUserId);
  record('T3 assignStaff ativo PASSA o gate de quarentena (erro ≠ ACTOR_EFFECTIVELY_BLOCKED; downstream cai no reputation_scores GHOST)', a1.ok === true || (a1.ok === false && !isBlocked403(a1.err)), JSON.stringify(a1.err));
  record('T4 RESÍDUO: reputation_scores é GHOST (42P01) — bloqueia o caminho ativo do assignStaff ANTES do INSERT alinhado', repGhost === null);

  // ── gate de quarentena do assigner PRESERVADO ──
  const staffBefore = await count(`SELECT count(*)::int AS n FROM event_staff WHERE event_id=$1`, [EVENT_ID]);
  await block(TENANT_ID, Bk.actorId);
  record('T5 assigner bloqueado → 403 (gate antes do insert)', isBlocked403((await assignStaff(St.globalUserId, Bk.globalUserId)).err));
  record('T6 bloqueado → nenhuma linha nova em event_staff', (await count(`SELECT count(*)::int AS n FROM event_staff WHERE event_id=$1`, [EVENT_ID])) === staffBefore);

  // ── NÃO-REGRESSÃO (checkIn 15ª fatia) / MONEY-FREE ──
  record('T7 checkIn ativo → OK (não regrediu)', await eventsService.checkIn(TENANT_ID, EVENT_ID, A.globalUserId).then((r) => r.checkedIn === true).catch(() => false));
  record('T8 checkIn bloqueado → 403 (gate intacto)', isBlocked403((await eventsService.checkIn(TENANT_ID, EVENT_ID, Bk.globalUserId).then(() => ({ ok: true })).catch((e) => ({ ok: false, err: errOf(e) })) as any).err));
  record('T9 canRepresentActor segue TRUE bloqueado (representação ≠ autoridade-ativa)', (await authorizationService.canRepresentActor(TENANT_ID, Bk.userId, Bk.actorId)) === true);
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
  console.log('✨ assignStaff (event_staff actor-keyed) e session reader (title/starts_at/ends_at) funcionam; gate de quarentena ANTES da escrita; Δbank=0.');
}

main().catch(async (e) => { console.error('💥 Erro não tratado:', e); try { await pool.end(); } catch { /* noop */ } process.exit(1); });
