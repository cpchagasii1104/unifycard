/**
 * E2E — F-ACTOR-CAPABILITY-GRANTS-ENDPOINTS-SLICE-1B (DECISION-0136). NÃO MOVE DINHEIRO.
 *
 * Prova os 3 endpoints de GESTÃO de grants (POST/GET/revoke) via Fastify inject:
 * autoridade = canRepresentActor(scope); grantee por slug grava actor_id; allowlist não-financeira;
 * listagem exige scopeActorId representado; revoke por representante; cross-tenant nega; referral não vira authority.
 * ZERO enforcement em rota de negócio.
 *
 * 🔒 DB EFÊMERA (run-actor-capability-grants-endpoints-slice1b-ephemeral.ps1). NUNCA toca unificard_dev.
 */
import 'tsconfig-paths/register';
import Fastify from 'fastify';
import { pool } from '../core/database/pool';
import { tenantService } from '../core/tenants/tenant.service';
import grantRoutes from '../modules/authority/actor-capability-grant.routes';
import { readFileSync } from 'fs';
import { join } from 'path';
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
  if (!/grant|capability|endpoint|ephemeral|test/i.test(db)) throw new Error(`ABORT: nome "${db}" não parece efêmero.`);
  console.log(`🔒 DB efêmera confirmada: ${db}`);
}

let seq = 0;
async function mkUserActor(tenantId: string, name: string, slug?: string): Promise<{ userId: string; actorId: string; gu: string }> {
  seq += 1;
  const gu = randomUUID(); const userId = randomUUID();
  const tax = String(Date.now() + seq).padStart(11, '0').slice(-11);
  await pool.query(`INSERT INTO global_users (global_user_id, cpf, metadata, created_at, updated_at) VALUES ($1::uuid,$2,'{}'::jsonb,NOW(),NOW())`, [gu, tax]);
  await pool.query(`INSERT INTO identities (global_user_id, tax_id, tax_id_type, kyc_status, kyc_level) VALUES ($1::uuid,$2,'cpf','approved','basic')`, [gu, tax]);
  await pool.query(`INSERT INTO users (id, user_id, tenant_id, email, password_hash, token_version, is_test, global_user_id, created_at, updated_at) VALUES ($1::uuid,$1::uuid,$2::uuid,$3,'x',0,true,$4::uuid,NOW(),NOW())`, [userId, tenantId, `${name}-${seq}@e2e.test`, gu]);
  const actorId = (await pool.query<{ id: string }>(`INSERT INTO actors (tenant_id, actor_type, display_name, user_id, global_user_id, slug) VALUES ($1::uuid,'user',$2,$3::uuid,$4::uuid,$5) RETURNING id::text AS id`, [tenantId, name, userId, gu, slug ?? null])).rows[0].id;
  return { userId, actorId, gu };
}
async function mkCompanyPageActor(tenantId: string, name: string, responsibleActorId: string): Promise<{ companyId: string; pageActorId: string }> {
  seq += 1;
  const companyId = (await pool.query<{ id: string }>(`INSERT INTO companies (tenant_id, company_name) VALUES ($1::uuid,$2) RETURNING company_id::text AS id`, [tenantId, name])).rows[0].id;
  const pageActorId = (await pool.query<{ id: string }>(`INSERT INTO actors (tenant_id, actor_type, display_name, company_id, slug, responsible_actor_id) VALUES ($1::uuid,'page',$2,$3::uuid,$4,$5::uuid) RETURNING id::text AS id`, [tenantId, name, companyId, `page-${companyId.substring(0, 8)}-${seq}`, responsibleActorId])).rows[0].id;
  return { companyId, pageActorId };
}
async function mkCompanyMember(tenantId: string, companyId: string, gu: string): Promise<void> {
  await pool.query(`INSERT INTO company_users (tenant_id, company_id, global_user_id, role, can_manage_company, is_active) VALUES ($1::uuid,$2::uuid,$3::uuid,'owner',true,true)`, [tenantId, companyId, gu]);
}

let CURRENT_USER = ''; let CURRENT_AC: Record<string, unknown> = {}; let CURRENT_TENANT = '';

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
  await tenantService.createTenant({ id: TENANT, name: 'Grant Endpoints', slug: `ge-${Date.now()}` });
  const TENANT_B = randomUUID();
  await tenantService.createTenant({ id: TENANT_B, name: 'Grant Endpoints B', slug: `geb-${Date.now()}` });

  const alice = await mkUserActor(TENANT, 'Alice');                 // gerente (concedente legítimo)
  const opSlug = `operator-${Date.now()}`;
  const bob = await mkUserActor(TENANT, 'Bob', opSlug);             // operador (grantee) com slug
  const carol = await mkUserActor(TENANT, 'Carol');                // sem autoridade
  const coA = await mkCompanyPageActor(TENANT, 'EmpresaA', alice.actorId);
  await mkCompanyMember(TENANT, coA.companyId, alice.gu);          // Alice gere A → representa o page-actor

  const bankBefore = await count(`SELECT ((SELECT count(*) FROM bank_ledger)+(SELECT count(*) FROM bank_transactions))::int AS n`);

  const app = Fastify();
  app.decorateRequest('user', null); app.decorateRequest('tenant', null); app.decorateRequest('actionContext', null);
  app.addHook('onRequest', async (req: any) => {
    req.user = CURRENT_USER ? { id: CURRENT_USER, userId: CURRENT_USER } : undefined;
    req.tenant = { id: CURRENT_TENANT || TENANT };
    req.actionContext = CURRENT_AC;
  });
  await app.register(grantRoutes);
  await app.ready();

  const as = (userId: string, actorId: string | null, tenant?: string) => { CURRENT_USER = userId; CURRENT_AC = actorId ? { actorId, actingUserId: userId } : {}; CURRENT_TENANT = tenant || TENANT; };
  const post = (url: string, body: unknown = {}) => app.inject({ method: 'POST', url, headers: { 'content-type': 'application/json' }, payload: JSON.stringify(body) });
  const get = (url: string) => app.inject({ method: 'GET', url });
  const st = (r: any) => r.statusCode;
  const body = (r: any) => { try { return JSON.parse(r.body); } catch { return {}; } };

  try {
    let grantId = '';
    // T1 — POST /grants legítimo via slug → 201; grava grantee_actor_id (não slug).
    {
      as(alice.userId, alice.actorId);
      const r = await post('/grants', { granteeActorSlug: opSlug, scopeActorId: coA.pageActorId, capabilityKey: 'calendar:block' });
      grantId = body(r)?.grantId || '';
      const row = (await pool.query<{ g: string }>(`SELECT grantee_actor_id::text AS g FROM actor_capability_grants WHERE grant_id=$1`, [grantId])).rows[0];
      record('T1 POST /grants (slug) → 201 + grantee_actor_id=actor (não slug)', st(r) === 201 && row?.g === bob.actorId, `status=${st(r)} grantee=${row?.g}`);
    }
    // T2 — slug inexistente → 404 fail-closed.
    { as(alice.userId, alice.actorId); const r = await post('/grants', { granteeActorSlug: 'nao-existe-xyz', scopeActorId: coA.pageActorId, capabilityKey: 'calendar:block' });
      record('T2 POST /grants slug inexistente → 404 (fail-closed)', st(r) === 404 && body(r)?.code === 'GRANT_GRANTEE_NOT_RESOLVED', `status=${st(r)}`); }
    // T3 — caller sem canRepresentActor(scope) → 403 (carol não gere a empresa).
    { as(carol.userId, carol.actorId); const r = await post('/grants', { granteeActorId: bob.actorId, scopeActorId: coA.pageActorId, capabilityKey: 'calendar:block' });
      record('T3 POST /grants sem autoridade sobre o scope → 403', st(r) === 403, `status=${st(r)}`); }
    // T4 — capability financeira → 400 (z.enum rejeita na borda).
    { as(alice.userId, alice.actorId); const r = await post('/grants', { granteeActorId: bob.actorId, scopeActorId: coA.pageActorId, capabilityKey: 'financial:execute_payout' });
      record('T4 POST /grants capability financeira → 400 (allowlist z.enum)', st(r) === 400, `status=${st(r)}`); }
    // T5 — capability fora da allowlist (válida em domínio mas não permitida) → 400.
    { as(alice.userId, alice.actorId); const r = await post('/grants', { granteeActorId: bob.actorId, scopeActorId: coA.pageActorId, capabilityKey: 'service_order:confirm' });
      record('T5 POST /grants capability fora da allowlist → 400', st(r) === 400, `status=${st(r)}`); }
    // T6 — duplicidade de grant ativo → 409.
    { as(alice.userId, alice.actorId); const r = await post('/grants', { granteeActorId: bob.actorId, scopeActorId: coA.pageActorId, capabilityKey: 'calendar:block' });
      record('T6 POST /grants duplicado ativo → 409', st(r) === 409 && body(r)?.code === 'GRANT_ALREADY_ACTIVE', `status=${st(r)}`); }
    // T7 — GET sem scopeActorId → 400 (sem listagem global).
    { as(alice.userId, alice.actorId); const r = await get('/grants');
      record('T7 GET /grants sem scopeActorId → 400 (sem listagem global)', st(r) === 400, `status=${st(r)}`); }
    // T8 — GET com scope representado → lista os grants do scope.
    { as(alice.userId, alice.actorId); const r = await get(`/grants?scopeActorId=${coA.pageActorId}`);
      const list = body(r)?.grants || [];
      record('T8 GET /grants?scope (representado) → 200 + lista do scope', st(r) === 200 && list.some((g: any) => g.grantId === grantId), `status=${st(r)} n=${list.length}`); }
    // T9 — GET com scope NÃO representado → 403.
    { as(carol.userId, carol.actorId); const r = await get(`/grants?scopeActorId=${coA.pageActorId}`);
      record('T9 GET /grants?scope não-representado → 403', st(r) === 403, `status=${st(r)}`); }
    // T10 — revoke por não-representante → 403.
    { as(carol.userId, carol.actorId); const r = await post(`/grants/${grantId}/revoke`, { reason: 'x' });
      record('T10 revoke por não-representante → 403', st(r) === 403, `status=${st(r)}`); }
    // T11 — revoke por representante → 200 + status revoked; some da lista ativa.
    { as(alice.userId, alice.actorId); const r = await post(`/grants/${grantId}/revoke`, { reason: 'fim' });
      const activeAfter = (await pool.query<{ s: string }>(`SELECT status::text AS s FROM actor_capability_grants WHERE grant_id=$1`, [grantId])).rows[0]?.s;
      record('T11 revoke por representante → 200 + status=revoked (não delete físico)', st(r) === 200 && activeAfter === 'revoked', `status=${st(r)} dbStatus=${activeAfter}`); }
    // T12 — cross-tenant: GET no tenant B sobre o scope de A → 403 (não-representável / não-leak).
    { as(alice.userId, alice.actorId, TENANT_B); const r = await get(`/grants?scopeActorId=${coA.pageActorId}`);
      record('T12 cross-tenant (tenant B sobre scope de A) → 403', st(r) === 403, `status=${st(r)}`); }
    // T-bank — Bank intocado.
    { const bankAfter = await count(`SELECT ((SELECT count(*) FROM bank_ledger)+(SELECT count(*) FROM bank_transactions))::int AS n`);
      record('T-bank Bank intocado', bankAfter === bankBefore, `before=${bankBefore} after=${bankAfter}`); }
    // C — estrutural: nenhum DELETE físico no banco; revogação só por status.
    { const physicalDeletes = await count(`SELECT count(*)::int AS n FROM actor_capability_grants`);
      record('C1 grant NÃO foi deletado fisicamente (linha persiste como revoked)', physicalDeletes >= 1, `rows=${physicalDeletes}`);
      const src = readFileSync(join(process.cwd(), 'src/modules/authority/actor-capability-grant.routes.ts'), 'utf8')
        .replace(/(^|[^:"'`])\/\/[^\n]*/g, '$1').replace(/\/\*[\s\S]*?\*\//g, ''); // strip comments (a explicação cita os termos)
      record('C2 rota (código) não usa hasCapabilityGrant / requirePermission / referral_code / business-permissions',
        !/hasCapabilityGrant\(/.test(src) && !/requirePermission|PermissionString/.test(src) && !/referral_code/.test(src) && !/business-permissions|BusinessPermission/.test(src)); }

    const failed = results.filter((r) => !r.ok);
    console.log(`\n${'═'.repeat(64)}`);
    console.log(`RESULTADO: ${results.length - failed.length}/${results.length} verdes`);
    if (failed.length > 0) { console.log('FALHAS:'); failed.forEach((f) => console.log(`  ❌ ${f.label} — ${f.reason ?? ''}`)); await app.close(); await pool.end(); process.exit(1); }
    await app.close(); await pool.end();
    console.log('✨ endpoints de grant (POST/GET/revoke) provados; autoridade por scope; allowlist; sem listagem global; revoke por status; cross-tenant nega.');
  } catch (e) {
    console.error('💥 Erro no corpo do teste:', e);
    try { await app.close(); } catch { /* noop */ } try { await pool.end(); } catch { /* noop */ }
    process.exit(1);
  }
}

main().catch(async (e) => { console.error('💥 Erro não tratado:', e); try { await pool.end(); } catch { /* noop */ } process.exit(1); });
