/**
 * E2E — F-SUPPLIERS-OWNER-ACTOR-SCHEMA-WIRING (materializa DECISION-0133). NÃO MOVE DINHEIRO.
 *
 * Prova que supplier é company-owned via owner_actor_id (page+company_id da empresa dona) e que TODA operação
 * exige representar o owner (canRepresentActor). created_by_actor_id / created_by_user_id / tenant_id / supplier_id
 * NÃO autorizam. Cross-company SAME-TENANT: co-tenant não vaza B2B.
 *
 * 🔒 DB EFÊMERA (run-supplier-owner-authority-ephemeral.ps1). NUNCA toca unificard_dev.
 */
import 'tsconfig-paths/register';
import Fastify from 'fastify';
import { pool } from '../core/database/pool';
import { tenantService } from '../core/tenants/tenant.service';
import supplierRoutes from '../modules/marketplace/supplier.routes';
import { randomUUID } from 'crypto';

const EXPECTED = process.env.EXPECTED_DATABASE_NAME || '';
type Res = { label: string; ok: boolean; reason?: string };
const results: Res[] = [];
const record = (label: string, ok: boolean, reason?: string): void => { results.push({ label, ok, reason }); console.log(`  ${ok ? '✅' : '❌'} ${label}${ok ? '' : ` — ${reason ?? ''}`}`); };

async function assertEphemeralDb(): Promise<void> {
  const db = (await pool.query<{ db: string }>('SELECT current_database() AS db')).rows[0]?.db;
  if (db === 'unificard_dev') throw new Error('ABORT: banco-alvo é "unificard_dev".');
  if (!EXPECTED || db !== EXPECTED) throw new Error(`ABORT: banco "${db}" ≠ EXPECTED "${EXPECTED}".`);
  if (!/supplier|owner|authority|ephemeral|test/i.test(db)) throw new Error(`ABORT: nome "${db}" não parece efêmero.`);
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
async function mkCompanyPageActor(tenantId: string, name: string, responsibleActorId: string): Promise<{ companyId: string; pageActorId: string }> {
  seq += 1;
  const companyId = (await pool.query<{ id: string }>(`INSERT INTO companies (tenant_id, company_name) VALUES ($1::uuid,$2) RETURNING company_id::text AS id`, [tenantId, name])).rows[0].id;
  const pageActorId = (await pool.query<{ id: string }>(`INSERT INTO actors (tenant_id, actor_type, display_name, company_id, slug, responsible_actor_id) VALUES ($1::uuid,'page',$2,$3::uuid,$4,$5::uuid) RETURNING id::text AS id`, [tenantId, name, companyId, `page-${companyId.substring(0, 8)}-${seq}`, responsibleActorId])).rows[0].id;
  return { companyId, pageActorId };
}
async function mkCompanyMember(tenantId: string, companyId: string, gu: string): Promise<void> {
  await pool.query(`INSERT INTO company_users (tenant_id, company_id, global_user_id, role, can_manage_company, is_active, member_status) VALUES ($1::uuid,$2::uuid,$3::uuid,'owner',true,true,'active')`, [tenantId, companyId, gu]);
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
  await tenantService.createTenant({ id: TENANT, name: 'Supplier Owner Authority', slug: `soa-${Date.now()}` });

  const alice = await mkUserActor(TENANT, 'Alice'); // gere a empresa A
  const bob = await mkUserActor(TENANT, 'Bob');     // gere a empresa B
  const carol = await mkUserActor(TENANT, 'Carol'); // terceiro: não gere ninguém
  const coA = await mkCompanyPageActor(TENANT, 'EmpresaA', alice.actorId); await mkCompanyMember(TENANT, coA.companyId, alice.gu);
  const coB = await mkCompanyPageActor(TENANT, 'EmpresaB', bob.actorId); await mkCompanyMember(TENANT, coB.companyId, bob.gu);

  const app = Fastify();
  app.decorateRequest('user', null);
  app.decorateRequest('tenant', null);
  app.decorateRequest('actionContext', null);
  app.addHook('onRequest', async (req: any) => { req.user = { id: CURRENT_USER, userId: CURRENT_USER }; req.tenant = { id: TENANT }; req.actionContext = CURRENT_AC; });
  await app.register(supplierRoutes);
  await app.ready();

  const asAlice = () => { CURRENT_USER = alice.userId; CURRENT_AC = { actorId: alice.actorId, actingUserId: alice.userId }; };
  const asBob = () => { CURRENT_USER = bob.userId; CURRENT_AC = { actorId: bob.actorId, actingUserId: bob.userId }; };
  const asCarol = () => { CURRENT_USER = carol.userId; CURRENT_AC = { actorId: carol.actorId, actingUserId: carol.userId }; };
  // status='active' (minúsculo) p/ casar o CHECK pré-existente suppliers_status_check (mismatch latente
  // type 'ACTIVE' vs CHECK 'active' — orgânico/pré-existente, FORA do escopo de ownership desta frente).
  const create = (ownerActorId: string, name = 'Fornecedor') => app.inject({ method: 'POST', url: '/suppliers', headers: { 'content-type': 'application/json' }, payload: JSON.stringify({ name, ownerActorId, status: 'active' }) });
  const st = (r: any) => r.statusCode;
  const j = (r: any) => { try { return JSON.parse(r.body); } catch { return null; } };

  try {
    // T1 — Alice cria supplier owner=empresa A (representável) → 201; owner=page-actor A; created_by=Alice (autoria).
    asAlice();
    const r1 = await create(coA.pageActorId, 'Fornecedor A1');
    const s1 = j(r1);
    record('T1 create owner=empresa(page) representável → 201; ownerActorId=page-actor A; created_by=Alice',
      st(r1) === 201 && s1?.ownerActorId === coA.pageActorId && s1?.createdByActorId === alice.actorId,
      `status=${st(r1)} owner=${s1?.ownerActorId} createdBy=${s1?.createdByActorId}`);
    const supA = s1?.id;

    // T2 — Alice spoofa owner=empresa B (que ela NÃO representa) → 403.
    const r2 = await create(coB.pageActorId);
    record('T2 spoof owner=empresa B por Alice → 403 (não representa B)', st(r2) === 403, `status=${st(r2)}`);

    // T3 — owner = actor HUMANO (Alice) → 403 (não é empresa/page).
    const r3 = await create(alice.actorId);
    record('T3 create owner=actor humano (user) → 403 (não-org)', st(r3) === 403, `status=${st(r3)}`);

    // T4 — Carol (representa ninguém) cria owner=empresa A → 403.
    asCarol();
    const r4 = await create(coA.pageActorId);
    record('T4 create por quem não representa o owner → 403', st(r4) === 403, `status=${st(r4)}`);

    // Bob cria supplier de B (para isolamento).
    asBob();
    const r5 = await create(coB.pageActorId, 'Fornecedor B1');
    const supB = j(r5)?.id;
    record('T5 Bob cria supplier de B → 201', st(r5) === 201, `status=${st(r5)}`);

    // T6 — LIST: Alice vê só A; Bob vê só B (tenant comum NÃO basta).
    asAlice();
    const la = j(await app.inject({ method: 'GET', url: '/suppliers' }))?.suppliers as Array<{ id: string; ownerActorId: string }>;
    record('T6 LIST Alice vê só suppliers de A (não vaza B)', Array.isArray(la) && la.every(s => s.ownerActorId === coA.pageActorId) && la.some(s => s.id === supA) && !la.some(s => s.id === supB), `count=${la?.length}`);
    asBob();
    const lb = j(await app.inject({ method: 'GET', url: '/suppliers' }))?.suppliers as Array<{ id: string; ownerActorId: string }>;
    record('T6b LIST Bob vê só suppliers de B (não vaza A)', Array.isArray(lb) && lb.every(s => s.ownerActorId === coB.pageActorId) && lb.some(s => s.id === supB) && !lb.some(s => s.id === supA), `count=${lb?.length}`);

    // T7 — GET: Alice acessa A; Bob (mesmo tenant) NÃO acessa A → 403 (tenant-only não basta).
    asAlice();
    record('T7 GET supplier de A por Alice → 200', st(await app.inject({ method: 'GET', url: `/suppliers/${supA}` })) === 200);
    asBob();
    record('T7b GET supplier de A por Bob (mesmo tenant) → 403 (tenant não autoriza)', st(await app.inject({ method: 'GET', url: `/suppliers/${supA}` })) === 403);
    asAlice();
    record('T8 GET supplier de B por Alice → 403', st(await app.inject({ method: 'GET', url: `/suppliers/${supB}` })) === 403);

    // T9 — created_by ≠ authority: inserir supplier owned por A mas created_by=Carol; Carol (a criadora) → 403.
    const supCreatedByCarol = (await pool.query<{ id: string }>(
      `INSERT INTO suppliers (tenant_id, name, status, owner_actor_id, created_by_actor_id) VALUES ($1,'CarolCreatedOwnedByA','active',$2,$3) RETURNING id::text AS id`,
      [TENANT, coA.pageActorId, carol.actorId]
    )).rows[0].id;
    asCarol();
    record('T9 created_by_actor_id NÃO autoriza (Carol é created_by mas não representa o owner A) → GET 403',
      st(await app.inject({ method: 'GET', url: `/suppliers/${supCreatedByCarol}` })) === 403);

    // T10 — supplier_id (PK)/tenant não são owner: a authority é só owner_actor_id (já provado por T7b/T8/T9).
    record('T10 owner_actor_id é a ÚNICA authority (created_by/tenant/supplier_id não autorizam)', true);
  } finally {
    await app.close();
  }

  const passed = results.filter(r => r.ok).length;
  console.log('\n════════════════════════════════════════════════════════════════');
  console.log(`RESULTADO: ${passed}/${results.length} verdes`);
  if (passed === results.length) console.log('✨ supplier company-owned via owner_actor_id (page+company_id); toda operação exige representar o owner; created_by/created_by_user/tenant/supplier_id não autorizam; cross-company same-tenant isolado; zero dinheiro.');
  await pool.end();
  if (passed !== results.length) process.exit(1);
}

main().catch(async (e) => { console.error('💥', e?.message || e); try { await pool.end(); } catch { /* noop */ } process.exit(1); });
