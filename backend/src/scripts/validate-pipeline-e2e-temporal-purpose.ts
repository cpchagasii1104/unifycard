/**
 * E2E — F-AGENDA-PURPOSE-CONCEPT-MATERIALIZATION (DECISION-0132). NÃO MOVE DINHEIRO.
 *
 * Prova: finalidade temporal = CONCEPT em availability.purpose_concept_id; weekly-template grava por
 * faixa; read-back devolve por faixa; gate de booking protege estudo/cuidados/lazer (400) e aceita
 * trabalho + NULL; governança bloqueia INSERT cru em concepts; FK RESTRICT impede apagar concept em uso.
 *
 * 🔒 DB EFÊMERA (run-temporal-purpose-ephemeral.ps1). NUNCA toca unificard_dev.
 */
import 'tsconfig-paths/register';
import Fastify from 'fastify';
import { pool } from '../core/database/pool';
import { tenantService } from '../core/tenants/tenant.service';
import { unifiedAvailabilityRoutes } from '../core/availability/unified-availability.routes';
import { randomUUID } from 'crypto';

const EXPECTED = process.env.EXPECTED_DATABASE_NAME || '';
type Res = { label: string; ok: boolean; reason?: string };
const results: Res[] = [];
const record = (label: string, ok: boolean, reason?: string): void => { results.push({ label, ok, reason }); console.log(`  ${ok ? '✅' : '❌'} ${label}${ok ? '' : ` — ${reason ?? ''}`}`); };

async function assertEphemeralDb(): Promise<void> {
  const db = (await pool.query<{ db: string }>('SELECT current_database() AS db')).rows[0]?.db;
  if (db === 'unificard_dev') throw new Error('ABORT: banco-alvo é "unificard_dev".');
  if (!EXPECTED || db !== EXPECTED) throw new Error(`ABORT: banco "${db}" ≠ EXPECTED "${EXPECTED}".`);
  if (!/purpose|temporal|ephemeral|test/i.test(db)) throw new Error(`ABORT: nome "${db}" não parece efêmero.`);
  console.log(`🔒 DB efêmera confirmada: ${db}`);
}

let seq = 0;
async function mkUserActor(tenantId: string, name: string): Promise<{ userId: string; actorId: string; gu: string }> {
  seq += 1;
  const gu = randomUUID(); const userId = randomUUID();
  const tax = String(Date.now() + seq).padStart(11, '0').slice(-11);
  await pool.query(`INSERT INTO global_users (global_user_id, cpf, metadata, created_at, updated_at) VALUES ($1::uuid,$2,'{}'::jsonb,NOW(),NOW())`, [gu, tax]);
  await pool.query(`INSERT INTO identities (global_user_id, tax_id, tax_id_type, kyc_status, kyc_level) VALUES ($1::uuid,$2,'cpf','approved','basic')`, [gu, tax]);
  await pool.query(`INSERT INTO users (id, user_id, tenant_id, email, password_hash, token_version, is_test, global_user_id, created_at, updated_at) VALUES ($1::uuid,$1::uuid,$2::uuid,$3,'x',0,true,$4::uuid,NOW(),NOW())`, [userId, tenantId, `${name}-${seq}@e2e.test`, gu]);
  const actorId = (await pool.query<{ id: string }>(`INSERT INTO actors (tenant_id, actor_type, display_name, user_id, global_user_id) VALUES ($1::uuid,'user',$2,$3::uuid,$4::uuid) RETURNING id::text AS id`, [tenantId, name, userId, gu])).rows[0].id;
  return { userId, actorId, gu };
}

let CURRENT_USER = ''; let CURRENT_AC: Record<string, unknown> = {};

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
  await tenantService.createTenant({ id: TENANT, name: 'Temporal Purpose', slug: `tp-${Date.now()}` });

  const alice = await mkUserActor(TENANT, 'Alice'); // dona da agenda pessoal
  const bob = await mkUserActor(TENANT, 'Bob');     // solicitante de booking

  const app = Fastify();
  app.decorateRequest('user', null);
  app.decorateRequest('tenant', null);
  app.decorateRequest('actionContext', null);
  app.addHook('onRequest', async (req: any) => { req.user = { id: CURRENT_USER, userId: CURRENT_USER }; req.tenant = { id: TENANT }; req.actionContext = CURRENT_AC; });
  await app.register(unifiedAvailabilityRoutes);
  await app.ready();

  const asAlice = () => { CURRENT_USER = alice.userId; CURRENT_AC = { actorId: alice.actorId, actingUserId: alice.userId }; };
  const asBob = () => { CURRENT_USER = bob.userId; CURRENT_AC = { actorId: bob.actorId, actingUserId: bob.userId }; };
  const st = (r: any) => r.statusCode;
  const json = (r: any) => { try { return JSON.parse(r.body); } catch { return null; } };

  try {
    // ── Concepts seedados (pela migration FULL) ────────────────────────────────────────
    const seeded = await pool.query<{ slug: string; concept_id: string; domain: string }>(
      `SELECT slug, concept_id, domain FROM concepts WHERE slug IN ('trabalho','estudo','cuidados-pessoais','lazer') ORDER BY slug`
    );
    const bySlug = new Map(seeded.rows.map(r => [r.slug, r.concept_id]));
    record('S1 4 finalidades semeadas em domínios naturais', seeded.rows.length === 4
      && seeded.rows.find(r => r.slug === 'trabalho')?.domain === 'servicos'
      && seeded.rows.find(r => r.slug === 'lazer')?.domain === 'cultura-lazer-e-eventos',
      `rows=${seeded.rows.length}`);

    // ── Governança: INSERT cru em concepts é bloqueado ─────────────────────────────────
    let govBlocked = false;
    try { await pool.query(`INSERT INTO concepts (slug, domain) VALUES ('e2e-cru','servicos')`); }
    catch { govBlocked = true; }
    record('S2 INSERT em concepts sem governança → BLOQUEADO (trigger 0075)', govBlocked);

    // ── weekly-template com finalidade por faixa ───────────────────────────────────────
    asAlice();
    const putBody = {
      schedule: { monday: ['09:00-10:00', '10:00-11:00', '11:00-12:00'] },
      timezone: 'America/Sao_Paulo',
      purposes: { 'monday|09:00-10:00': 'trabalho', 'monday|10:00-11:00': 'estudo' }, // 11-12 = sem finalidade
    };
    const rPut = await app.inject({ method: 'PUT', url: '/weekly-template', headers: { 'content-type': 'application/json' }, payload: JSON.stringify(putBody) });
    record('T1 weekly-template salva (200)', st(rPut) === 200, `status=${st(rPut)} body=${rPut.body?.slice(0, 200)}`);

    // ── slug inválido → 400 ────────────────────────────────────────────────────────────
    const rBad = await app.inject({ method: 'PUT', url: '/weekly-template', headers: { 'content-type': 'application/json' }, payload: JSON.stringify({ ...putBody, purposes: { 'monday|09:00-10:00': 'academia' } }) });
    record('T2 finalidade fora dos 4 (ex.: academia) → 400', st(rBad) === 400, `status=${st(rBad)}`);

    // ── persistência por janela (DB) ───────────────────────────────────────────────────
    const win = await pool.query<{ availability_id: string; purpose_concept_id: string | null; sd: string }>(
      `SELECT availability_id, purpose_concept_id, to_char(start_datetime AT TIME ZONE 'America/Sao_Paulo','HH24:MI') AS sd
       FROM availability WHERE tenant_id=$1 AND owner_id=$2 AND availability_type='recurring' AND status='active'
       ORDER BY start_datetime`, [TENANT, alice.actorId]);
    const trabalhoWin = win.rows.find(w => w.sd === '09:00');
    const estudoWin = win.rows.find(w => w.sd === '10:00');
    const nullWin = win.rows.find(w => w.sd === '11:00');
    record('T3 janela 09:00 persistida com finalidade=trabalho', trabalhoWin?.purpose_concept_id === bySlug.get('trabalho'), `got=${trabalhoWin?.purpose_concept_id}`);
    record('T4 janela 10:00 persistida com finalidade=estudo', estudoWin?.purpose_concept_id === bySlug.get('estudo'), `got=${estudoWin?.purpose_concept_id}`);
    record('T5 janela 11:00 SEM finalidade (NULL)', nullWin?.purpose_concept_id === null, `got=${nullWin?.purpose_concept_id}`);

    // ── read-back via GET expõe purposeConceptId ───────────────────────────────────────
    const rGet = await app.inject({ method: 'GET', url: `/?ownerType=user&ownerId=${alice.actorId}&status=active` });
    const getData = json(rGet)?.data as Array<{ startDatetime: string; purposeConceptId: string | null }> | undefined;
    const exposes = Array.isArray(getData) && getData.some(a => a.purposeConceptId === bySlug.get('trabalho'));
    record('T6 GET /availability expõe purposeConceptId (read-back por faixa)', exposes, `status=${st(rGet)}`);

    // ── gate de booking ────────────────────────────────────────────────────────────────
    asBob();
    const book = (availabilityId: string) => app.inject({ method: 'POST', url: '/bookings', headers: { 'content-type': 'application/json' }, payload: JSON.stringify({ availabilityId, requesterActorId: bob.actorId }) });
    const rTrab = await book(trabalhoWin!.availability_id);
    record('T7 booking em janela TRABALHO → permitido (201)', st(rTrab) === 201, `status=${st(rTrab)} body=${rTrab.body?.slice(0, 160)}`);
    const rNull = await book(nullWin!.availability_id);
    record('T8 booking em janela NULL (legado) → permitido (201)', st(rNull) === 201, `status=${st(rNull)}`);
    const rEst = await book(estudoWin!.availability_id);
    const estBody = json(rEst);
    record('T9 booking em janela ESTUDO → 400 AVAILABILITY_PERSONAL_PROTECTED', st(rEst) === 400 && String(estBody?.error || '').includes('AVAILABILITY_PERSONAL_PROTECTED'), `status=${st(rEst)} err=${estBody?.error}`);

    // cuidados-pessoais e lazer: criar 2 janelas diretas e provar 400 (sem depender do materializer)
    const mkWin = async (slug: string): Promise<string> => {
      const id = (await pool.query<{ id: string }>(
        `INSERT INTO availability (tenant_id, owner_type, owner_id, availability_type, status, start_datetime, end_datetime, timezone, purpose_concept_id)
         VALUES ($1,'user',$2,'fixed','active', now()+interval '2 day', now()+interval '2 day 1 hour','America/Sao_Paulo',$3) RETURNING availability_id::text AS id`,
        [TENANT, alice.actorId, bySlug.get(slug)]
      )).rows[0].id;
      return id;
    };
    const cuidWin = await mkWin('cuidados-pessoais');
    const lazerWin = await mkWin('lazer');
    const rCuid = await book(cuidWin);
    record('T10 booking em CUIDADOS-PESSOAIS → 400 protegido', st(rCuid) === 400 && String(json(rCuid)?.error || '').includes('AVAILABILITY_PERSONAL_PROTECTED'), `status=${st(rCuid)}`);
    const rLaz = await book(lazerWin);
    record('T11 booking em LAZER → 400 protegido', st(rLaz) === 400 && String(json(rLaz)?.error || '').includes('AVAILABILITY_PERSONAL_PROTECTED'), `status=${st(rLaz)}`);

    // ── FK RESTRICT: apagar concept em uso é bloqueado ─────────────────────────────────
    let fkBlocked = false;
    try { await pool.query(`DELETE FROM concepts WHERE concept_id=$1`, [bySlug.get('trabalho')]); }
    catch { fkBlocked = true; }
    record('T12 DELETE de concept de finalidade EM USO → BLOQUEADO (FK RESTRICT)', fkBlocked);

    // ── finalidade muda no mesmo horário → update (sem recibo falso) ────────────────────
    asAlice();
    const putChange = { schedule: { monday: ['09:00-10:00'] }, timezone: 'America/Sao_Paulo', purposes: { 'monday|09:00-10:00': 'lazer' } };
    const rChange = await app.inject({ method: 'PUT', url: '/weekly-template', headers: { 'content-type': 'application/json' }, payload: JSON.stringify(putChange) });
    const after = await pool.query<{ p: string | null }>(
      `SELECT purpose_concept_id AS p FROM availability
       WHERE tenant_id=$1 AND owner_id=$2 AND availability_type='recurring' AND status='active'
         AND to_char(start_datetime AT TIME ZONE 'America/Sao_Paulo','HH24:MI')='09:00'
       ORDER BY start_datetime LIMIT 1`, [TENANT, alice.actorId]);
    record('T13 mudança de finalidade no MESMO horário persiste (trabalho→lazer)', after.rows[0]?.p === bySlug.get('lazer'), `putStatus=${st(rChange)} got=${after.rows[0]?.p} lazer=${bySlug.get('lazer')}`);
  } finally {
    await app.close();
  }

  const passed = results.filter(r => r.ok).length;
  console.log('\n════════════════════════════════════════════════════════════════');
  console.log(`RESULTADO: ${passed}/${results.length} verdes`);
  if (passed === results.length) console.log('✨ finalidade temporal = CONCEPT em availability.purpose_concept_id; gate protege estudo/cuidados/lazer; trabalho/NULL bookáveis; governança+FK enforce; zero dinheiro.');
  await pool.end();
  if (passed !== results.length) process.exit(1);
}

main().catch(async (e) => { console.error('💥', e?.message || e); try { await pool.end(); } catch { /* noop */ } process.exit(1); });
