/**
 * E2E — F-C1-MONEY-PO-OWNER-ACTOR-SCHEMA-WIRING. NÃO MOVE DINHEIRO.
 *
 * Prova que purchase_order pertence ao lado COMPRADOR via owner_actor_id = actor operacional da empresa
 * (page+company_id), e que TODA operação exige representar o owner (canRepresentActor). created_by_actor_id,
 * supplier_id e tenant_id NÃO autorizam. receivePO continua CONTIDO (403). Zero inventory/Bank/AP.
 *
 * 🔒 DB EFÊMERA (run-po-owner-authority-ephemeral.ps1). NUNCA toca unificard_dev.
 */
import 'tsconfig-paths/register';
import Fastify from 'fastify';
import { pool } from '../core/database/pool';
import { tenantService } from '../core/tenants/tenant.service';
import purchaseOrderRoutes from '../modules/marketplace/purchase-order.routes';
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
  if (!/po|purchase|owner|authority|ephemeral|test/i.test(db)) throw new Error(`ABORT: nome "${db}" não parece efêmero.`);
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
async function mkSupplier(tenantId: string, actorId: string): Promise<string> {
  return (await pool.query<{ id: string }>(`INSERT INTO suppliers (tenant_id, name, created_by_actor_id) VALUES ($1::uuid,'Fornecedor',$2::uuid) RETURNING id::text AS id`, [tenantId, actorId])).rows[0].id;
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
  await tenantService.createTenant({ id: TENANT, name: 'PO Owner Authority', slug: `poo-${Date.now()}` });
  const TENANT_B = randomUUID();
  await tenantService.createTenant({ id: TENANT_B, name: 'PO Owner Other', slug: `poob-${Date.now()}` });

  const alice = await mkUserActor(TENANT, 'Alice');  // gere a empresa compradora A
  const carol = await mkUserActor(TENANT, 'Carol');  // terceiro do mesmo tenant
  const otherHuman = await mkUserActor(TENANT_B, 'OtherHuman'); // responsável do page-actor do outro tenant
  const coA = await mkCompanyPageActor(TENANT, 'EmpresaA', alice.actorId); await mkCompanyMember(TENANT, coA.companyId, alice.gu); // Alice gere A
  const coB = await mkCompanyPageActor(TENANT, 'EmpresaB', alice.actorId); // ninguém no teste gere B (owner org não representável)
  const coOther = await mkCompanyPageActor(TENANT_B, 'EmpresaOutroTenant', otherHuman.actorId); // page-actor de OUTRO tenant
  const supplier = await mkSupplier(TENANT, alice.actorId);

  const bankBefore = await count(`SELECT ((SELECT count(*) FROM bank_ledger)+(SELECT count(*) FROM bank_transactions))::int AS n`);
  const splitsBefore = await count(`SELECT count(*)::int AS n FROM bank_splits`);
  const apExists = (await pool.query<{ r: string | null }>(`SELECT to_regclass('public.accounts_payable') AS r`)).rows[0].r;

  const app = Fastify();
  app.decorateRequest('user', null);
  app.decorateRequest('tenant', null);
  app.decorateRequest('actionContext', null);
  app.addHook('onRequest', async (req: any) => { req.user = { id: CURRENT_USER, userId: CURRENT_USER }; req.tenant = { id: TENANT }; req.actionContext = CURRENT_AC; });
  await app.register(purchaseOrderRoutes);
  await app.ready();

  const asAlice = () => { CURRENT_USER = alice.userId; CURRENT_AC = { actorId: alice.actorId, actingUserId: alice.userId }; };
  const asCarol = () => { CURRENT_USER = carol.userId; CURRENT_AC = { actorId: carol.actorId, actingUserId: carol.userId }; };
  const createPO = (ownerActorId: string) => app.inject({ method: 'POST', url: '/purchase-orders', headers: { 'content-type': 'application/json' }, payload: JSON.stringify({ supplierId: supplier, ownerActorId }) });
  const st = (r: any) => r.statusCode;

  try {
    // T1 — Alice cria PO com owner=page-actor da empresa que ela gere → 201; PO.ownerActorId=page-actor.
    asAlice();
    const r1 = await createPO(coA.pageActorId);
    const po1 = (() => { try { return JSON.parse(r1.body); } catch { return null; } })();
    record('T1 create owner=empresa(page) representável → 201; ownerActorId=page-actor', st(r1) === 201 && po1?.ownerActorId === coA.pageActorId, `status=${st(r1)} owner=${po1?.ownerActorId}`);
    const poId = po1?.id;

    // T2 — owner = actor HUMANO (Alice) → 403 (não é empresa).
    const r2 = await createPO(alice.actorId);
    record('T2 create owner=actor humano (user) → 403', st(r2) === 403, `status=${st(r2)}`);

    // T3 — owner = page-actor de OUTRO tenant → 403 (não existe neste tenant).
    const r3 = await createPO(coOther.pageActorId);
    record('T3 create owner de outro tenant → 403', st(r3) === 403, `status=${st(r3)}`);

    // T4 — owner = empresa(page) válida MAS não representável por Alice → 403.
    const r4 = await createPO(coB.pageActorId);
    record('T4 create owner=empresa não representável → 403 (canRepresentActor)', st(r4) === 403, `status=${st(r4)}`);

    // T5 — Carol (spoof): body.ownerActorId=empresa de Alice; Carol não representa → 403.
    asCarol();
    const r5 = await createPO(coA.pageActorId);
    record('T5 spoof owner=empresa de Alice por Carol → 403 (não representa)', st(r5) === 403, `status=${st(r5)}`);

    // T6/T9 — Carol lê o PO de Alice (mesmo tenant, mas não representa) → 403 (tenant/created_by não bastam).
    const r6 = await app.inject({ method: 'GET', url: `/purchase-orders/${poId}` });
    record('T6/T9 GET by id: terceiro do mesmo tenant sem representar owner → 403', st(r6) === 403, `status=${st(r6)}`);

    // T10 — Carol GET items → 403.
    const r10 = await app.inject({ method: 'GET', url: `/purchase-orders/${poId}/items` });
    record('T10 GET items: terceiro → 403', st(r10) === 403, `status=${st(r10)}`);

    // T11 — Carol POST item → 403.
    const r11c = await app.inject({ method: 'POST', url: `/purchase-orders/${poId}/items`, headers: { 'content-type': 'application/json' }, payload: JSON.stringify({ productVariantId: randomUUID(), quantityOrdered: 1 }) });
    record('T11 POST item: terceiro → 403', st(r11c) === 403, `status=${st(r11c)}`);

    // T12 — Carol submit → 403.
    const r12 = await app.inject({ method: 'POST', url: `/purchase-orders/${poId}/submit`, headers: { 'content-type': 'application/json' }, payload: '{}' });
    record('T12 submit: terceiro → 403', st(r12) === 403, `status=${st(r12)}`);

    // T13 — Carol cancel → 403.
    const r13 = await app.inject({ method: 'POST', url: `/purchase-orders/${poId}/cancel`, headers: { 'content-type': 'application/json' }, payload: JSON.stringify({}) });
    record('T13 cancel: terceiro → 403', st(r13) === 403, `status=${st(r13)}`);

    // T8 — GET list: Carol NÃO vê o PO de Alice (owner não representável).
    const r8c = await app.inject({ method: 'GET', url: '/purchase-orders' });
    const listC = (() => { try { return JSON.parse(r8c.body)?.orders || []; } catch { return []; } })();
    record('T8 GET list: terceiro NÃO vê PO de owner não representável (tenant-only não basta)', st(r8c) === 200 && !listC.some((o: any) => o.id === poId), `count=${listC.length}`);

    // T8b — Alice VÊ o próprio PO; T13b Alice cancela (representa o owner).
    asAlice();
    const r8a = await app.inject({ method: 'GET', url: '/purchase-orders' });
    const listA = (() => { try { return JSON.parse(r8a.body)?.orders || []; } catch { return []; } })();
    record('T8b GET list: Alice (representa o owner) VÊ o próprio PO', st(r8a) === 200 && listA.some((o: any) => o.id === poId));
    const r13a = await app.inject({ method: 'POST', url: `/purchase-orders/${poId}/cancel`, headers: { 'content-type': 'application/json' }, payload: JSON.stringify({ cancellationReason: 'e2e' }) });
    record('T13b cancel: Alice (representa o owner) → 200', st(r13a) === 200, `status=${st(r13a)}`);

    // T14 — receivePO continua 403 CONTAINED.
    const r14 = await app.inject({ method: 'POST', url: `/purchase-orders/${poId}/receive`, headers: { 'content-type': 'application/json' }, payload: JSON.stringify({ items: [] }) });
    const b14 = (() => { try { return JSON.parse(r14.body)?.error; } catch { return null; } })();
    record('T14 receivePO continua 403 PURCHASE_ORDER_RECEIVE_CONTAINED', st(r14) === 403 && b14 === 'PURCHASE_ORDER_RECEIVE_CONTAINED', `status=${st(r14)} code=${b14}`);

    // T15 — zero inventory_movements.
    record('T15 zero inventory_movements', (await count(`SELECT count(*)::int AS n FROM inventory_movements`)) === 0);
    // T16 — Bank/ledger/split intocados.
    record('T16 Bank/ledger/split intocados', (await count(`SELECT ((SELECT count(*) FROM bank_ledger)+(SELECT count(*) FROM bank_transactions))::int AS n`)) === bankBefore && (await count(`SELECT count(*)::int AS n FROM bank_splits`)) === splitsBefore);
    // T17 — accounts_payable não chamado.
    record('T17 accounts_payable não chamado/religado', (apExists ? await count(`SELECT count(*)::int AS n FROM accounts_payable`) : 0) === 0);
  } finally {
    await app.close();
    await pool.end();
  }

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${'═'.repeat(64)}`);
  console.log(`RESULTADO: ${results.length - failed.length}/${results.length} verdes`);
  if (failed.length > 0) { failed.forEach((f) => console.log(`  ❌ ${f.label} — ${f.reason ?? ''}`)); process.exit(1); }
  console.log('✨ purchase_order tem owner empresarial material (page+company_id); toda operação exige representar o owner; created_by/supplier/tenant não autorizam; receivePO contido; zero dinheiro.');
  process.exit(0);
}

main().catch(async (e) => { console.error('💥 Erro não tratado:', e); try { await pool.end(); } catch { /* noop */ } process.exit(1); });
