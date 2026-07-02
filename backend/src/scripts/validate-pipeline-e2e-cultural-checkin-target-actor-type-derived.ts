/**
 * E2E — F-CULTURAL-CHECKIN-TARGET-ACTOR-TYPE-DERIVED (DT-CULTURAL-CHECKIN-TARGET-ACTOR-TYPE-SELF-
 * DIVERGENCE). NÃO MOVE DINHEIRO. Prova, via ROTA REAL (app.inject, POST /cultural/events/:eventId/
 * check-in), que actor_type é SEMPRE derivado server-side — nunca confiado do body.
 *
 * 🔴 A tabela `cultural_event_checkins` NÃO EXISTE no schema vivo (confirmado via to_regclass —
 * rota LATENTE, DT-mãe já classifica "impacto zero hoje"). Por isso este E2E ESPIA
 * `culturalEventService.checkIn` (singleton, método monkey-patched ANTES do registro da rota) para
 * capturar os argumentos que o HANDLER computaria, sem tentar escrever numa tabela inexistente.
 * Isso testa exatamente a camada onde o bug vivia (derivação de parâmetro na rota), sem fingir que
 * o schema cultural está ativo.
 *
 *   A self (target omitido): actor_type capturado = 'user' (derivado do actor real, não do body)
 *   B self com target_actor_type='page' MALICIOSO no body: actor_type capturado AINDA é 'user'
 *      (a derivação ignora o body para o caso self — mordida exata do bug original)
 *   C representável (canRepresent=true, actor-alvo é 'page' real): actor_type capturado = 'page'
 *      (do actor REAL, não do que o body declarar)
 *   D actor-alvo inexistente → 404 honesto, checkIn NUNCA chamado (spy não disparado)
 *   E estranho (sem representação) → 403, checkIn NUNCA chamado
 *   F Δbank=0 · G guard estrutural verde
 *
 * 🔒 DB EFÊMERA (run-cultural-checkin-target-actor-type-derived-ephemeral.ps1). NUNCA toca unificard_dev.
 */
import 'tsconfig-paths/register';
import Fastify from 'fastify';
import { pool } from '../core/database/pool';
import { tenantService } from '../core/tenants/tenant.service';
import { execSync } from 'child_process';
import { randomUUID } from 'crypto';

const EXPECTED = process.env.EXPECTED_DATABASE_NAME || '';
type Res = { label: string; ok: boolean; reason?: string };
const results: Res[] = [];
const record = (label: string, ok: boolean, reason?: string): void => { results.push({ label, ok, reason }); console.log(`  ${ok ? '✅' : '❌'} ${label}${ok ? '' : ` — ${reason ?? ''}`}`); };
const count = async (sql: string, p: unknown[] = []): Promise<number> => Number((await pool.query(sql, p)).rows[0].n);

async function assertEphemeralDb(): Promise<void> {
  const db = (await pool.query<{ db: string }>('SELECT current_database() AS db')).rows[0]?.db;
  if (db === 'unificard_dev') throw new Error('ABORT: banco-alvo é "unificard_dev".');
  if (!EXPECTED || db !== EXPECTED) throw new Error(`ABORT: banco "${db}" ≠ EXPECTED "${EXPECTED}".`);
  if (!/cultural|checkin|actor.?type|ephemeral|test/i.test(db)) throw new Error(`ABORT: nome "${db}" não parece efêmero.`);
  console.log(`🔒 DB efêmera confirmada: ${db}`);
}

let seq = 0;
async function mkUserActor(tenantId: string, name: string): Promise<{ userId: string; actorId: string; gu: string }> {
  seq += 1;
  const gu = randomUUID(); const userId = randomUUID();
  const tax = String(Date.now() + seq * 17).padStart(11, '0').slice(-11);
  await pool.query(`INSERT INTO global_users (global_user_id, cpf, metadata, created_at, updated_at) VALUES ($1::uuid,$2,'{}'::jsonb,NOW(),NOW())`, [gu, tax]);
  await pool.query(`INSERT INTO identities (global_user_id, tax_id, tax_id_type, kyc_status, kyc_level) VALUES ($1::uuid,$2,'cpf','approved','basic')`, [gu, tax]);
  await pool.query(`INSERT INTO users (id, user_id, tenant_id, email, password_hash, token_version, is_test, global_user_id, created_at, updated_at) VALUES ($1::uuid,$1::uuid,$2::uuid,$3,'x',0,true,$4::uuid,NOW(),NOW())`, [userId, tenantId, `${name}-${seq}@e2e.test`, gu]);
  const actorId = (await pool.query<{ id: string }>(`INSERT INTO actors (tenant_id, actor_type, display_name, user_id, global_user_id) VALUES ($1::uuid,'user',$2,$3::uuid,$4::uuid) RETURNING id::text AS id`, [tenantId, name, userId, gu])).rows[0].id;
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
  await tenantService.createTenant({ id: TENANT, name: 'Cultural Checkin Target Actor Type', slug: `cctat-${Date.now()}` });
  const alice = await mkUserActor(TENANT, 'Alice');
  const stranger = await mkUserActor(TENANT, 'Stranger');

  // Empresa (page-actor) que Alice REPRESENTA — para o caso C (representável).
  const companyId = randomUUID();
  await pool.query(`INSERT INTO companies (company_id, tenant_id, company_name, company_status, status) VALUES ($1::uuid,$2::uuid,'Empresa E2E','DRAFT','active')`, [companyId, TENANT]);
  await pool.query(`INSERT INTO company_users (tenant_id, company_id, global_user_id, role, can_manage_company, is_active, is_primary) VALUES ($1::uuid,$2::uuid,$3::uuid,'owner',true,true,true)`, [TENANT, companyId, alice.gu]);
  const pageActorId = (await pool.query<{ id: string }>(`INSERT INTO actors (tenant_id, actor_type, display_name, company_id, responsible_actor_id) VALUES ($1::uuid,'page','Empresa E2E',$2::uuid,$3::uuid) RETURNING id::text AS id`, [TENANT, companyId, alice.actorId])).rows[0].id;

  const bankBefore = await count(`SELECT ((SELECT count(*) FROM bank_ledger)+(SELECT count(*) FROM bank_transactions))::int AS n`);

  // 🔴 SPY: monkey-patch do singleton ANTES do registro da rota. checkIn NUNCA toca o banco — captura
  // os argumentos e retorna um resultado fake honesto (sem fingir sucesso real de negócio).
  const { culturalEventService } = await import('../modules/cultural/cultural-event.service');
  const captured: Array<{ actor_id: string; actor_type: string }> = [];
  let checkInCalls = 0;
  (culturalEventService as any).checkIn = async (_tenantId: string, _eventId: string, input: any) => {
    checkInCalls++;
    captured.push({ actor_id: input.actor_id, actor_type: input.actor_type });
    return { checkin_id: randomUUID(), event_id: _eventId, actor_id: input.actor_id, actor_type: input.actor_type, method: input.method, checked_in_at: new Date().toISOString() };
  };

  const culturalRoutes = (await import('../modules/cultural/cultural.routes')).default;
  const app = Fastify();
  app.decorateRequest('user', null);
  app.decorateRequest('tenant', null);
  let currentUser = alice;
  app.addHook('onRequest', async (req: any) => {
    req.user = { id: currentUser.userId, userId: currentUser.userId, globalUserId: currentUser.gu };
    req.tenant = { id: TENANT };
  });
  await app.register(culturalRoutes, { prefix: '/cultural' });
  await app.ready();

  const EVENT_ID = randomUUID();

  try {
    console.log('\n— A: self, target omitido —');
    currentUser = alice;
    captured.length = 0; checkInCalls = 0;
    await app.inject({ method: 'POST', url: `/cultural/events/${EVENT_ID}/check-in`, payload: { method: 'AUTO' } });
    record('A self (target omitido): actor_type capturado = user', checkInCalls === 1 && captured[0]?.actor_type === 'user' && captured[0]?.actor_id === alice.actorId, JSON.stringify(captured[0]));

    console.log('\n— B: self, target_actor_type MALICIOSO no body —');
    captured.length = 0; checkInCalls = 0;
    await app.inject({ method: 'POST', url: `/cultural/events/${EVENT_ID}/check-in`, payload: { method: 'AUTO', target_actor_type: 'page' } });
    record('B self com target_actor_type=page malicioso: actor_type capturado AINDA é user (bug mordido)', checkInCalls === 1 && captured[0]?.actor_type === 'user', JSON.stringify(captured[0]));

    console.log('\n— C: representável (page real de Alice) —');
    captured.length = 0; checkInCalls = 0;
    const rC = await app.inject({ method: 'POST', url: `/cultural/events/${EVENT_ID}/check-in`, payload: { method: 'AUTO', target_actor_id: pageActorId, target_actor_type: 'user' } });
    record('C representável: actor_type capturado = page (do actor REAL, não do body "user")', rC.statusCode === 200 && checkInCalls === 1 && captured[0]?.actor_type === 'page' && captured[0]?.actor_id === pageActorId, `status=${rC.statusCode} captured=${JSON.stringify(captured[0])}`);

    console.log('\n— D: actor-alvo inexistente —');
    captured.length = 0; checkInCalls = 0;
    const rD = await app.inject({ method: 'POST', url: `/cultural/events/${EVENT_ID}/check-in`, payload: { method: 'AUTO', target_actor_id: randomUUID() } });
    record('D actor-alvo inexistente → 404, checkIn NUNCA chamado', rD.statusCode === 404 && checkInCalls === 0, `status=${rD.statusCode} calls=${checkInCalls}`);

    console.log('\n— E: estranho sem representação —');
    currentUser = stranger;
    captured.length = 0; checkInCalls = 0;
    const rE = await app.inject({ method: 'POST', url: `/cultural/events/${EVENT_ID}/check-in`, payload: { method: 'AUTO', target_actor_id: pageActorId } });
    record('E estranho sem representação → 403, checkIn NUNCA chamado', rE.statusCode === 403 && checkInCalls === 0, `status=${rE.statusCode} calls=${checkInCalls}`);

    const bankAfter = await count(`SELECT ((SELECT count(*) FROM bank_ledger)+(SELECT count(*) FROM bank_transactions))::int AS n`);
    record('F Δbank=0', bankAfter === bankBefore, `before=${bankBefore} after=${bankAfter}`);

    const cwd = process.cwd();
    let g = 0; try { execSync('node scripts/audit-cultural-checkin-target-actor-type-derived.mjs', { cwd, encoding: 'utf8' }); } catch { g = 1; }
    record('G guard estrutural verde', g === 0);
  } finally {
    await app.close();
    await pool.end();
  }

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${'═'.repeat(64)}`);
  console.log(`RESULTADO: ${results.length - failed.length}/${results.length} verdes`);
  if (failed.length > 0) { failed.forEach((f) => console.log(`  ❌ ${f.label} — ${f.reason ?? ''}`)); process.exit(1); }
  console.log('✨ actor_type do check-in cultural é sempre derivado server-side (self ou actor-alvo real); body malicioso não tem efeito; actor inexistente → 404; estranho → 403; Δbank=0.');
  process.exit(0);
}

main().catch(async (e) => { console.error('💥 Erro não tratado:', e); try { await pool.end(); } catch { /* noop */ } process.exit(1); });
