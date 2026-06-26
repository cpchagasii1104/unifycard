/**
 * E2E — F-EVENTS-GHOST-CONTAINMENT. NÃO cria reputation_scores. NÃO cria event_locations. NÃO move dinheiro.
 *
 * Prova a CONTENÇÃO (decisão da direção 2026-06-25) — resolve os RESÍDUOS que a fatia anterior
 * (assignstaff-sessionread-schema-drift) registrou como bloqueados por ghost (T2/T4 daquele E2E):
 *   • reputation_scores GHOST (42P01) NÃO bloqueia mais assignStaff — o gate aspiracional vira soft-skip;
 *   • event_locations GHOST (42P01) NÃO crasha getEventWithDetails — locations=[] (contrato preservado);
 *   • as travas REAIS continuam: autorização/quarentena ATL ANTES do insert; INSERT actor-keyed;
 *     responsible_actor_id = actor resolvido (não global_user_id cru); reader de sessões title/starts_at/ends_at;
 *   • rotas de reputação respondem 501 semântico (REPUTATION_SOURCE_UNAVAILABLE), não 500 cru / 42P01;
 *   • o módulo social (actor_reputation) é sistema DISTINTO e vivo — NÃO foi usado como substituto;
 *   • money-free: Δbank=0; nenhum booking/payment novo; canRepresentActor puro.
 *
 * 🔒 DB EFÊMERA (run-events-reputation-locations-ghost-containment-ephemeral.ps1). NUNCA toca unificard_dev.
 */
import 'tsconfig-paths/register';
import Fastify from 'fastify';
import { randomUUID } from 'crypto';
import { pool } from '../core/database/pool';
import { tenantService } from '../core/tenants/tenant.service';
import { ensureUserActor } from '../modules/identity/actor-writer.service';
import { eventsService } from '../modules/events/events.service';
import { reputationService } from '../core/reputation/reputation.service';
import { authorizationService } from '../core/authorization/authorization.service';
import reputationRoutes from '../core/reputation/reputation.routes';
import { errorHandlerPlugin } from '../plugins/error-handler.plugin';

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
const is42P01 = (e: any): boolean => e?.code === '42P01';

async function assertEphemeralDb(): Promise<void> {
  const db = (await pool.query<{ db: string }>('SELECT current_database() AS db')).rows[0]?.db;
  if (db === 'unificard_dev') throw new Error('ABORT: banco-alvo é "unificard_dev".');
  if (!EXPECTED || db !== EXPECTED) throw new Error(`ABORT: banco "${db}" ≠ EXPECTED "${EXPECTED}".`);
  if (!/reputation|location|ghost|event|ephemeral|smoke|test/i.test(db)) throw new Error(`ABORT: nome "${db}" não parece efêmero.`);
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

  // ── G: ghost real na DB efêmera (migrations vivas NÃO criam estas tabelas) ──
  const repReg = (await pool.query<{ r: string | null }>(`SELECT to_regclass('public.reputation_scores')::text AS r`)).rows[0]?.r;
  const locReg = (await pool.query<{ r: string | null }>(`SELECT to_regclass('public.event_locations')::text AS r`)).rows[0]?.r;
  const sessReg = (await pool.query<{ r: string | null }>(`SELECT to_regclass('public.event_sessions')::text AS r`)).rows[0]?.r;
  const staffReg = (await pool.query<{ r: string | null }>(`SELECT to_regclass('public.event_staff')::text AS r`)).rows[0]?.r;
  const actorRepReg = (await pool.query<{ r: string | null }>(`SELECT to_regclass('public.actor_reputation')::text AS r`)).rows[0]?.r;
  const staffCols = (await pool.query<{ c: string }>(`SELECT column_name AS c FROM information_schema.columns WHERE table_name='event_staff'`)).rows.map((r) => r.c);
  record('G1 reputation_scores AUSENTE no schema vivo (ghost real)', repReg === null, `to_regclass=${repReg}`);
  record('G2 event_locations AUSENTE no schema vivo (ghost real)', locReg === null, `to_regclass=${locReg}`);
  record('G3 event_sessions PRESENTE (live, não é ghost)', sessReg !== null);
  record('G4 event_staff PRESENTE e actor-keyed (tenant_id+responsible_actor_id+responsible_actor_type)', staffReg !== null && ['tenant_id', 'responsible_actor_id', 'responsible_actor_type'].every((c) => staffCols.includes(c)), staffCols.join(','));
  record('G5 actor_reputation (social) PRESENTE — sistema DISTINTO/vivo, NÃO usado como substituto de reputation_scores', actorRepReg !== null);

  const TENANT_ID = randomUUID();
  await tenantService.createTenant({ id: TENANT_ID, name: 'Events Ghost Containment', slug: `egc-${Date.now()}` });
  const A = await seedActor(TENANT_ID, 'OrganizerActive');
  const Bk = await seedActor(TENANT_ID, 'AssignerBlocked');
  const St = await seedActor(TENANT_ID, 'StaffMember');

  // ── S: o call site exato que as rotas/serviço contêm realmente lança 42P01 (fonte ghost) ──
  let s1: any; try { await reputationService.getScoreByGlobalUserId(A.globalUserId); s1 = null; } catch (e) { s1 = e; }
  record('S1 getScoreByGlobalUserId lança 42P01 (fonte ghost no call site de assignStaff e da rota /identity)', is42P01(s1), JSON.stringify(errOf(s1)));
  let s2: any; try { await reputationService.getScore(TENANT_ID, 'actor', A.actorId); s2 = null; } catch (e) { s2 = e; }
  record('S2 getScore lança 42P01 (fonte ghost no call site da rota /reputation/:type/:id)', is42P01(s2), JSON.stringify(errOf(s2)));

  const start = new Date(Date.now() + 3600_000);
  const end = new Date(Date.now() + 7200_000);
  const ev = await eventsService.createEvent(TENANT_ID, { title: 'Ev', startTime: start, endTime: end, actorId: A.actorId } as any, A.globalUserId);
  const EVENT_ID = (ev as any).id;
  await eventsService.addSession(TENANT_ID, EVENT_ID, { name: 'Sessão 1', startTime: start, endTime: end } as any, A.globalUserId);

  const bankSql = `SELECT ((SELECT count(*) FROM bank_ledger)+(SELECT count(*) FROM bank_transactions)+(SELECT count(*) FROM bank_splits)+(SELECT count(*) FROM bank_accounts))::int AS n`;
  const bankBefore = await count(bankSql);
  const moneySql = `SELECT (COALESCE((SELECT count(*) FROM bookings),0)+COALESCE((SELECT count(*) FROM payment_requests),0)+COALESCE((SELECT count(*) FROM payment_intents),0))::int AS n`;
  const moneyBefore = await count(moneySql).catch(() => 0);

  const assignStaff = (staffGlobalUserId: string, assignerGlobalUserId: string) =>
    eventsService.assignStaff(TENANT_ID, EVENT_ID, { globalUserId: staffGlobalUserId, role: 'usher' } as any, assignerGlobalUserId)
      .then((s) => ({ ok: true, id: (s as any).id } as any)).catch((e) => ({ ok: false, err: errOf(e) }));

  // ── CONTENÇÃO assignStaff: reputation_scores ghost NÃO bloqueia mais (resolve resíduo T4 da fatia anterior) ──
  const a1 = await assignStaff(St.globalUserId, A.globalUserId);
  record('T1 assignStaff ATIVO → OK (reputation_scores ghost soft-skip; resolve resíduo prévio)', a1.ok === true, JSON.stringify(a1.err));
  const rowsAfter = await pool.query<{ tenant_id: string; responsible_actor_id: string; responsible_actor_type: string; global_user_id: string }>(`SELECT tenant_id, responsible_actor_id, responsible_actor_type, global_user_id FROM event_staff WHERE event_id=$1`, [EVENT_ID]);
  record('T2 exatamente 1 linha event_staff criada para o evento', rowsAfter.rows.length === 1, `n=${rowsAfter.rows.length}`);
  const row = rowsAfter.rows[0] || ({} as any);
  record('T3 linha actor-keyed: responsible_actor_id == actor resolvido do staff (ensureUserActor)', row.responsible_actor_id === St.actorId, `${row.responsible_actor_id} vs ${St.actorId}`);
  record('T4 responsible_actor_id NÃO é global_user_id cru', row.responsible_actor_id !== St.globalUserId);
  record('T5 responsible_actor_type preenchido', !!row.responsible_actor_type, row.responsible_actor_type);
  record('T6 tenant_id da linha == TENANT_ID', row.tenant_id === TENANT_ID);
  record('T7 global_user_id legado preservado == staff', row.global_user_id === St.globalUserId);

  // ── trava REAL preservada: quarentena ANTES do insert (independe do soft-skip de reputação) ──
  const staffBefore = await count(`SELECT count(*)::int AS n FROM event_staff WHERE event_id=$1`, [EVENT_ID]);
  await block(TENANT_ID, Bk.actorId);
  const a2 = await assignStaff(St.globalUserId, Bk.globalUserId);
  record('T8 assigner bloqueado → 403 ACTOR_EFFECTIVELY_BLOCKED (gate antes do insert)', isBlocked403(a2.err), JSON.stringify(a2.err));
  record('T9 bloqueado → nenhuma linha nova em event_staff', (await count(`SELECT count(*)::int AS n FROM event_staff WHERE event_id=$1`, [EVENT_ID])) === staffBefore);

  // ── CONTENÇÃO getEventWithDetails: event_locations ghost NÃO crasha (resolve resíduo T2 da fatia anterior) ──
  const det = await eventsService.getEventWithDetails(TENANT_ID, EVENT_ID).then((d) => ({ ok: true, d } as any)).catch((e) => ({ ok: false, err: errOf(e) }));
  record('T10 getEventWithDetails → OK, não crasha por event_locations ghost (resolve resíduo prévio)', det.ok === true, JSON.stringify(det.err));
  record('T11 locations === [] (contido, não materializado)', det.ok === true && Array.isArray(det.d.locations) && det.d.locations.length === 0);
  record('T12 sessions contém a sessão adicionada (reader completo funciona)', det.ok === true && Array.isArray(det.d.sessions) && det.d.sessions.length === 1);
  record('T13 sessions[0].name == "Sessão 1" (alias title AS name)', det.ok === true && det.d.sessions?.[0]?.name === 'Sessão 1');
  record('T14 staff contém o staff designado', det.ok === true && Array.isArray(det.d.staff) && det.d.staff.some((s: any) => s.globalUserId === St.globalUserId || s.global_user_id === St.globalUserId));
  record('T15 getEventWithDetails retorna o evento correto (id)', det.ok === true && (det.d.id === EVENT_ID || det.d.event?.id === EVENT_ID));

  // ── CONTENÇÃO rota HTTP /reputation/:type/:id: 42P01 → 501 semântico (não 500 cru) ──
  const app = Fastify();
  await app.register(errorHandlerPlugin);
  app.decorate('requirePermission', () => async () => { /* test: permissão concedida */ });
  app.decorateRequest('tenant', null);
  app.decorateRequest('user', null);
  app.addHook('onRequest', async (req: any) => { req.tenant = { id: TENANT_ID }; req.user = { id: A.userId, userId: A.userId }; });
  await app.register(reputationRoutes);
  await app.ready();
  const r = await app.inject({ method: 'GET', url: `/actor/${randomUUID()}` });
  const body = (() => { try { return JSON.parse(r.body); } catch { return {}; } })();
  record('R1 GET /reputation/:type/:id → 501 (não 500 cru por ghost)', r.statusCode === 501, `status=${r.statusCode}`);
  record('R2 código == REPUTATION_SOURCE_UNAVAILABLE', body?.code === 'REPUTATION_SOURCE_UNAVAILABLE', JSON.stringify(body));
  record('R3 corpo NÃO vaza 42P01 / undefined_table (falha honesta, não erro cru)', !/42P01|undefined_table|relation .* does not exist/i.test(r.body || ''));
  await app.close();

  // ── NÃO-REGRESSÃO / MONEY-FREE ──
  record('N1 checkIn ativo → OK (não regrediu)', await eventsService.checkIn(TENANT_ID, EVENT_ID, A.globalUserId).then((x) => x.checkedIn === true).catch(() => false));
  record('N2 checkIn bloqueado → 403 (gate intacto)', isBlocked403((await eventsService.checkIn(TENANT_ID, EVENT_ID, Bk.globalUserId).then(() => ({ ok: true })).catch((e) => ({ ok: false, err: errOf(e) })) as any).err));
  record('N3 canRepresentActor TRUE bloqueado (representação ≠ autoridade-ativa; pura)', (await authorizationService.canRepresentActor(TENANT_ID, Bk.userId, Bk.actorId)) === true);
  record('N4 Δbank=0', (await count(bankSql)) === bankBefore, `before=${bankBefore}`);
  record('N5 zero booking/payment_request/payment_intents novos', (await count(moneySql).catch(() => 0)) === moneyBefore);
  record('N6 schedules/schedule_slots sem write', (await count(`SELECT (COALESCE((SELECT count(*) FROM schedules),0)+COALESCE((SELECT count(*) FROM schedule_slots),0))::int AS n`).catch(() => 0)) === 0);
  record('N7 nenhum caso contido vazou 42P01 nas asserts (a contenção firou antes em todo caminho contido)', !results.some((rr) => /42P01|undefined_table|relation .* does not exist/i.test(rr.reason ?? '') && /^(T1|T10|T11|R1|R2|R3)/.test(rr.label)));

  const failed = results.filter((rr) => !rr.ok);
  console.log(`\n${'═'.repeat(64)}`);
  console.log(`RESULTADO: ${results.length - failed.length}/${results.length} verdes`);
  if (failed.length > 0) {
    console.log('FALHAS:'); failed.forEach((f) => console.log(`  ❌ ${f.label} — ${f.reason ?? ''}`));
    await pool.end(); process.exit(1);
  }
  await pool.end();
  console.log('✨ reputation_scores e event_locations CONTIDOS (não materializados); assignStaff sem hard-fail (quarentena+actor-keyed intactos); getEventWithDetails locations=[]; rota /reputation 42P01→501; social distinto; Δbank=0.');
}

main().catch(async (e) => { console.error('💥 Erro não tratado:', e); try { await pool.end(); } catch { /* noop */ } process.exit(1); });
