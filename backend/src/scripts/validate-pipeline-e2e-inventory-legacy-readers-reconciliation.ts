/**
 * E2E HTTP REAL — F-INVENTORY-LEGACY-READERS-RECONCILIATION-IMPL-PARTIAL
 *
 * Fecha 2 folhas tenant-wide de inventory:
 *   FOLHA 1: GET /marketplace/inventory/balance → TOMBSTONE 501.
 *   FOLHA 2: GET /marketplace/inventory/movements → actorId OBRIGATÓRIO (400 sem; canRepresentActor).
 * by-actor e company-consolidated permanecem intactos. Gate G1 (estrutural) verde com KNOWN_OPEN>0.
 *
 * Modo: npx tsx backend/src/scripts/validate-pipeline-e2e-inventory-legacy-readers-reconciliation.ts
 */
import 'tsconfig-paths/register';
import dotenv from 'dotenv';
import { join } from 'path';
import { readFileSync } from 'fs';
import { execSync } from 'child_process';
dotenv.config({ path: join(process.cwd(), '.env') });

import jwt from 'jsonwebtoken';
import Fastify, { FastifyInstance } from 'fastify';
import sensible from '@fastify/sensible';
import { randomUUID, createHash } from 'crypto';
import { pool } from '../core/database/pool';
import { deleteCompaniesAndFiscal } from './helpers/pj-fiscal-cleanup';
import authPlugin from '../core/auth/auth.plugin';
import { tenantPlugin } from '../plugins/tenant.plugin';
import { actionContextPlugin } from '../plugins/action-context.plugin';
import { rbacPlugin } from '../plugins/rbac.plugin';

const JWT_SECRET = process.env.JWT_SECRET!;
const TENANT_ID = process.env.E2E_TENANT_ID ?? 'fbe13b78-4516-493d-905a-363796aea1d1';
const MARKER = 'E2E-LEGRD';

type Res = { label: string; ok: boolean; reason?: string };
const results: Res[] = [];
function record(label: string, ok: boolean, reason?: string): void {
  results.push({ label, ok, reason });
  console.log(`  ${ok ? '✅' : '❌'} ${label}${ok ? '' : ` — ${reason ?? ''}`}`);
}
function mintToken(userId: string, globalUserId: string, email: string): string {
  return jwt.sign({ sub: userId, userId, globalUserId, tenantId: TENANT_ID, email, type: 'access', tokenVersion: 0 }, JWT_SECRET, { expiresIn: '15m' });
}
function acHeader(actorId?: string): Record<string, string> {
  return { 'x-action-context': JSON.stringify({ actorId: actorId ?? randomUUID(), intent: 'e2e-legrd', source: 'e2e', scope: TENANT_ID }) };
}

interface Fixture {
  companyE: string; companyF: string;
  users: Record<'A' | 'B' | 'D', { userId: string; globalUserId: string; email: string }>;
  actors: Record<'EA1' | 'EA2' | 'FB1' | 'H', string>;
  variantId: string; productId: string;
}

async function bootstrapPorts(): Promise<void> {
  const { socialPortsRegistry } = await import('../core/social/ports-registry');
  const sa = await import('../modules/social/adapters');
  socialPortsRegistry.setActorRepository(sa.actorRepositoryAdapter);
  socialPortsRegistry.setActorUtils(sa.actorUtilsAdapter);
  socialPortsRegistry.setSocialRepository(sa.socialRepositoryAdapter);
  socialPortsRegistry.setSocialService(sa.socialServiceAdapter);
  socialPortsRegistry.setEventFeedHandlers(sa.eventFeedHandlersAdapter);
  const { bankPortsRegistry } = await import('../core/bank/ports-registry');
  const ba = await import('../modules/bank/adapters');
  bankPortsRegistry.setBankAccount(ba.bankAccountAdapter);
  bankPortsRegistry.setBankTransaction(ba.bankTransactionAdapter);
  bankPortsRegistry.setBankTransactionRead(ba.bankTransactionReadAdapter);
  bankPortsRegistry.setBankIntegration(ba.bankIntegrationAdapter);
  bankPortsRegistry.setBankLimit(ba.bankLimitAdapter);
}

async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({ logger: false });
  await app.register(sensible);
  await app.register(authPlugin);
  await app.register(tenantPlugin);
  await app.register(actionContextPlugin);
  await app.register(rbacPlugin);
  const marketplaceModule = await import('../modules/marketplace/marketplace.routes');
  await app.register(marketplaceModule.default, { prefix: '/marketplace' });
  await app.ready();
  return app;
}

async function createFixtures(): Promise<Fixture> {
  const companyE = randomUUID();
  const companyF = randomUUID();
  for (const [cid, name] of [[companyE, `${MARKER}-CO-E`], [companyF, `${MARKER}-CO-F`]] as const) {
    await pool.query(`INSERT INTO companies (company_id, tenant_id, company_name, status, company_status) VALUES ($1,$2,$3,'active','DRAFT')`, [cid, TENANT_ID, name]);
  }
  const users = {} as Fixture['users'];
  const cpfBase = String(Math.floor(Math.random() * 89999) + 10000);
  let i = 0;
  for (const key of ['A', 'B', 'D'] as const) {
    i += 1;
    const userId = randomUUID(); const globalUserId = randomUUID();
    const email = `${MARKER.toLowerCase()}-${key.toLowerCase()}-${cpfBase}@e2e.local`;
    await pool.query(`INSERT INTO global_users (global_user_id, cpf, full_name) VALUES ($1,$2,$3)`, [globalUserId, `9${cpfBase}${String(i).padStart(5, '0')}`, `${MARKER}-${key}`]);
    await pool.query(`INSERT INTO users (id, user_id, tenant_id, global_user_id, email, password_hash, token_version) VALUES ($1,$1,$2,$3,$4,$5,0)`,
      [userId, TENANT_ID, globalUserId, email, createHash('sha256').update(randomUUID()).digest('hex')]);
    users[key] = { userId, globalUserId, email };
  }
  // A admin/owner de E (is_primary → checkOwnership('companies') na canActAs); B membro de E
  // (não-gestor → não representa EA1); D admin/owner de F.
  const cu: Array<[string, string, string, boolean, boolean]> = [
    [companyE, users.A.globalUserId, 'owner', true, true],
    [companyE, users.B.globalUserId, 'member', false, false],
    [companyF, users.D.globalUserId, 'owner', true, true],
  ];
  for (const [cid, gid, role, manage, primary] of cu) {
    await pool.query(`INSERT INTO company_users (tenant_id, company_id, global_user_id, role, can_manage_company, is_active, is_primary, member_status, metadata) VALUES ($1,$2,$3,$4,$5,true,$6,'active','{}')`, [TENANT_ID, cid, gid, role, manage, primary]);
  }
  const respRow = await pool.query<{ id: string }>(`SELECT id::text AS id FROM actors WHERE tenant_id=$1 AND actor_type='user' LIMIT 1`, [TENANT_ID]);
  const responsible = respRow.rows[0].id;
  const actors = {} as Fixture['actors'];
  const specs: Array<['EA1' | 'EA2' | 'FB1' | 'H', string, string | null]> = [
    ['EA1', 'page', companyE], ['EA2', 'channel', companyE], ['FB1', 'page', companyF], ['H', 'page', null],
  ];
  for (const [key, type, cid] of specs) {
    const id = randomUUID();
    await pool.query(`INSERT INTO actors (id, actor_id, tenant_id, actor_type, display_name, company_id, responsible_actor_id, metadata) VALUES ($1,$1,$2,$3,$4,$5,$6,'{}')`, [id, TENANT_ID, type, `${MARKER}-${key}`, cid, responsible]);
    actors[key] = id;
  }
  // Registrar EA1 e FB1 no actor_registry (entity=companies + capability marketplace) — necessário
  // para o requirePermission('marketplace_manage_inventory') das rotas by-actor/movements (canActAs
  // resolve ownership via checkOwnership('companies') + capability via capabilities_json). MARKER no
  // display_name dos actors já cobre o cleanup; aqui limpamos por actor_id.
  for (const [actorId, cid] of [[actors.EA1, companyE], [actors.FB1, companyF]] as const) {
    await pool.query(
      `INSERT INTO actor_registry (registry_id, tenant_id, actor_id, actor_type, entity_table, entity_id, capabilities_json)
       VALUES ($1,$2,$3,'company','companies',$4,$5)`,
      [randomUUID(), TENANT_ID, actorId, cid, JSON.stringify({ can_manage_marketplace: true })]
    );
  }
  const cat = await pool.query<{ category_id: string }>(`SELECT category_id::text FROM categories LIMIT 1`);
  const productId = randomUUID();
  await pool.query(`INSERT INTO products (id, tenant_id, name, category_id) VALUES ($1,$2,$3,$4)`, [productId, TENANT_ID, `${MARKER}-PROD`, cat.rows[0].category_id]);
  const variantId = randomUUID();
  await pool.query(`INSERT INTO product_variants (id, tenant_id, product_id, sku) VALUES ($1,$2,$3,$4)`, [variantId, TENANT_ID, productId, `${MARKER}-SKU-${cpfBase}`]);
  // Movimentos: EA1=10, EA2=7, FB1=100, H=55.
  for (const [actorId, qty] of [[actors.EA1, 10], [actors.EA2, 7], [actors.FB1, 100], [actors.H, 55]] as const) {
    await pool.query(`INSERT INTO inventory_movements (id, tenant_id, actor_id, product_variant_id, movement_type, quantity, unit, reason, metadata) VALUES ($1,$2,$3,$4,'IN',$5,'un',$6,'{}')`, [randomUUID(), TENANT_ID, actorId, variantId, qty, MARKER]);
  }
  return { companyE, companyF, users, actors, variantId, productId };
}

async function cleanup(): Promise<void> {
  const client = await pool.connect();
  try { await client.query(`SET session_replication_role = replica`); await client.query(`DELETE FROM inventory_movements WHERE reason = $1`, [MARKER]); await client.query(`SET session_replication_role = DEFAULT`); } finally { client.release(); }
  await pool.query(`DELETE FROM product_variants WHERE sku LIKE $1`, [`${MARKER}-SKU-%`]);
  await pool.query(`DELETE FROM products WHERE name LIKE $1`, [`${MARKER}-%`]);
  await pool.query(`DELETE FROM actor_registry WHERE actor_id IN (SELECT id FROM actors WHERE display_name LIKE $1)`, [`${MARKER}-%`]);
  await pool.query(`DELETE FROM actors WHERE display_name LIKE $1`, [`${MARKER}-%`]);
  await pool.query(`DELETE FROM company_users WHERE company_id IN (SELECT company_id FROM companies WHERE company_name LIKE $1)`, [`${MARKER}-%`]);
  await deleteCompaniesAndFiscal(pool, "company_name LIKE $1", [`${MARKER}-%`]);
  await pool.query(`DELETE FROM users WHERE email LIKE $1`, [`${MARKER.toLowerCase()}-%`]);
  await pool.query(`DELETE FROM global_users WHERE full_name LIKE $1`, [`${MARKER}-%`]);
}

async function main(): Promise<void> {
  await bootstrapPorts();
  const app = await buildApp();
  const f = await createFixtures();
  const tokens = {
    A: mintToken(f.users.A.userId, f.users.A.globalUserId, f.users.A.email),
    B: mintToken(f.users.B.userId, f.users.B.globalUserId, f.users.B.email),
    D: mintToken(f.users.D.userId, f.users.D.globalUserId, f.users.D.email),
  };
  const get = (url: string, token?: string, ctxActor?: string) => app.inject({ method: 'GET', url, headers: { ...(token ? { authorization: `Bearer ${token}` } : {}), ...acHeader(ctxActor) } });
  const V = f.variantId;
  const EA1 = f.actors.EA1; // actionContext actor capaz/representável por A para passar requirePermission

  try {
    console.log('\n— FOLHA 1: balance tenant-wide = TOMBSTONE 501 —');
    const before = await pool.query<{ c: number }>(`SELECT COUNT(*)::int AS c FROM inventory_movements WHERE tenant_id=$1`, [TENANT_ID]);
    const rNoAuth = await get(`/marketplace/inventory/balance?variantId=${V}`);
    record('B1 balance sem auth → 401', rNoAuth.statusCode === 401, `status ${rNoAuth.statusCode}`);
    const r501 = await get(`/marketplace/inventory/balance?variantId=${V}`, tokens.A);
    const b501 = r501.statusCode === 501 ? JSON.parse(r501.body) : null;
    record('B2 balance autenticado → 501', r501.statusCode === 501, `status ${r501.statusCode}`);
    record('B3 código INVENTORY_TENANT_WIDE_BALANCE_DISABLED', b501?.code === 'INVENTORY_TENANT_WIDE_BALANCE_DISABLED', JSON.stringify(b501)?.slice(0, 80));
    const after = await pool.query<{ c: number }>(`SELECT COUNT(*)::int AS c FROM inventory_movements WHERE tenant_id=$1`, [TENANT_ID]);
    record('B4 tombstone não cria estado', before.rows[0].c === after.rows[0].c, `before=${before.rows[0].c} after=${after.rows[0].c}`);

    console.log('\n— by-actor e consolidado continuam funcionando —');
    const rByActor = await get(`/marketplace/inventory/balance/by-actor?actorId=${f.actors.EA1}&variantId=${V}`, tokens.A, EA1);
    record('B5 by-actor (A representa EA1) → 200 saldo 10', rByActor.statusCode === 200 && JSON.parse(rByActor.body).quantity === 10, `status ${rByActor.statusCode}: ${rByActor.body.slice(0, 80)}`);
    const rConsol = await get(`/marketplace/inventory/company/${f.companyE}/balance?variantId=${V}`, tokens.A);
    const consolBody = rConsol.statusCode === 200 ? JSON.parse(rConsol.body) : null;
    record('B6 consolidado empresa E → 200 soma 17 (EA1+EA2)', consolBody?.consolidatedQuantity === 17, `status ${rConsol.statusCode} q=${consolBody?.consolidatedQuantity}`);
    record('B7 consolidado E NÃO inclui F (100) nem H (55)', consolBody?.consolidatedQuantity === 17 && consolBody?.actorCount === 2);

    console.log('\n— FOLHA 2: movements actorId obrigatório —');
    const mNoActor = await get(`/marketplace/inventory/movements?variantId=${V}`, tokens.A, EA1);
    record('M1 movements sem actorId → 400 INVENTORY_ACTOR_ID_REQUIRED', mNoActor.statusCode === 400 && JSON.parse(mNoActor.body).code === 'INVENTORY_ACTOR_ID_REQUIRED', `status ${mNoActor.statusCode}: ${mNoActor.body.slice(0, 80)}`);
    const mBadId = await get(`/marketplace/inventory/movements?variantId=${V}&actorId=not-a-uuid`, tokens.A, EA1);
    record('M2 actorId inválido → 400', mBadId.statusCode === 400, `status ${mBadId.statusCode}`);
    const mEA1 = await get(`/marketplace/inventory/movements?variantId=${V}&actorId=${f.actors.EA1}`, tokens.A, EA1);
    const mEA1Body = mEA1.statusCode === 200 ? JSON.parse(mEA1.body) : null;
    record('M3 actor representável (A→EA1) → 200', mEA1.statusCode === 200, `status ${mEA1.statusCode}: ${mEA1.body.slice(0, 80)}`);
    record('M4 só linhas de EA1 (1 movimento, qty 10)', Array.isArray(mEA1Body?.movements) && mEA1Body.movements.length === 1 && mEA1Body.movements[0].actorId === f.actors.EA1 && mEA1Body.movements[0].quantity === 10, JSON.stringify(mEA1Body?.movements)?.slice(0, 100));
    record('M5 não traz EA2/FB1/H automaticamente', (mEA1Body?.movements ?? []).every((m: { actorId: string }) => m.actorId === f.actors.EA1));
    const mFB1byA = await get(`/marketplace/inventory/movements?variantId=${V}&actorId=${f.actors.FB1}`, tokens.A, EA1);
    record('M6 actor de outra empresa (A→FB1) → 403', mFB1byA.statusCode === 403, `status ${mFB1byA.statusCode}`);
    const mHbyA = await get(`/marketplace/inventory/movements?variantId=${V}&actorId=${f.actors.H}`, tokens.A, EA1);
    record('M7 actor solto não representável (A→H) → 403', mHbyA.statusCode === 403, `status ${mHbyA.statusCode}`);
    const mNoAuth = await get(`/marketplace/inventory/movements?variantId=${V}&actorId=${f.actors.EA1}`, undefined, EA1);
    record('M8 movements sem auth → 401', mNoAuth.statusCode === 401, `status ${mNoAuth.statusCode}`);
    const mFilter = await get(`/marketplace/inventory/movements?variantId=${V}&actorId=${f.actors.EA1}&movementType=IN&limit=10&offset=0`, tokens.A, EA1);
    record('M9 filtros/paginação preservados (movementType+limit+offset) → 200', mFilter.statusCode === 200, `status ${mFilter.statusCode}`);
    record('M10 GET não cria estado (movimentos imutáveis, count estável)', (await pool.query<{ c: number }>(`SELECT COUNT(*)::int AS c FROM inventory_movements WHERE tenant_id=$1`, [TENANT_ID])).rows[0].c === before.rows[0].c);
    // B é membro de E mas NÃO gere E (não-owner, não-primary) → não representa EA1 → 403 (mesmo com
    // can_manage_marketplace default da company): capability não supera representação.
    const mByB = await get(`/marketplace/inventory/movements?variantId=${V}&actorId=${f.actors.EA1}`, tokens.B, EA1);
    record('M11 can_manage_marketplace não supera canRepresentActor (B membro não-gestor → 403)', mByB.statusCode === 403, `status ${mByB.statusCode}`);

    console.log('\n— ESTRUTURAL: callers frontend + page pública —');
    const apiSrc = readFileSync(join(process.cwd(), '../frontend/src/api/marketplace.ts'), 'utf8');
    record('S1 getMovements exige actorId (assinatura actorId primeiro)', /export async function getMovements\(\s*actorId: string,\s*variantId: string/.test(apiSrc));
    const invSrc = readFileSync(join(process.cwd(), '../frontend/src/components/marketplace/MarketplaceInventory.tsx'), 'utf8');
    record('S2 MarketplaceInventory não chama getBalance tenant-wide', !/getBalance\(/.test(invSrc) || !/import[\s\S]{0,200}getBalance\b/.test(invSrc));
    record('S3 MarketplaceInventory sem actorId não chama API (guard early-return)', /if \(!actorId\)\s*\{[\s\S]{0,200}return;/.test(invSrc));
    record('S4 getMovements chamado com actorId no componente', /getMovements\(actorId, variantId\)/.test(invSrc));
    const pageSrc = readFileSync(join(process.cwd(), '../frontend/src/pages/MarketplacePage.tsx'), 'utf8');
    record('S5 MarketplacePage NÃO importa nem monta MarketplaceInventory', !/import\s+MarketplaceInventory/.test(pageSrc) && !/<MarketplaceInventory/.test(pageSrc));
    record('S6 MarketplacePage tab inventory removida (TabType sem inventory)', !/'inventory'/.test(pageSrc));
    const tabSrc = readFileSync(join(process.cwd(), '../frontend/src/components/company/tabs/CompanyInventoryTab.tsx'), 'utf8');
    record('S7 CompanyInventoryTab passa actorId ao componente', /MarketplaceInventory actorId=\{companyActor\.actor_id\}/.test(tabSrc));

    console.log('\n— GATE G1 estrutural —');
    let gateOut = ''; let gateExit = 0;
    try { gateOut = execSync('node scripts/audit-inventory-reader-scope.mjs', { cwd: process.cwd(), encoding: 'utf8' }); } catch (e: unknown) { gateExit = 1; gateOut = String((e as { stdout?: string }).stdout ?? ''); }
    record('G1a gate passa no código final (exit 0)', gateExit === 0);
    record('G1b baseline contém readers nominais (repository + product-visibility + reconciliation + reports)',
      gateOut.includes('inventory-movement.repository.ts') && gateOut.includes('product-visibility.service.ts') && gateOut.includes('reconciliation.service.ts') && gateOut.includes('inventory-report.service.ts'));
    record('G1c KNOWN_OPEN aparece honestamente (>0) e NEW_UNCLASSIFIED=0', /KNOWN_OPEN=[1-9]/.test(gateOut) && /NEW_UNCLASSIFIED=0/.test(gateOut), gateOut.split('\n').filter(l => /KNOWN_OPEN|NEW_UNCLASSIFIED|FIXED_REGRESSION/.test(l)).join(' | '));
    record('G1d FIXED_REGRESSION=2 (balance tombstone + movements actor-required)', /FIXED_REGRESSION=2/.test(gateOut));
    record('G1e gate NUNCA imprime "fully safe"', !/fully safe/i.test(gateOut));
    // Prova negativa: reader sintético tenant-only → gate falha.
    const probePath = join(process.cwd(), 'src/modules/marketplace/_e2e_g1probe.ts');
    const fs = await import('fs');
    fs.writeFileSync(probePath, 'const q = `SELECT * FROM inventory_movements WHERE tenant_id = $1`;\n');
    let negExit = 0;
    try { execSync('node scripts/audit-inventory-reader-scope.mjs', { cwd: process.cwd(), encoding: 'utf8' }); } catch { negExit = 1; }
    fs.unlinkSync(probePath);
    record('G1f prova negativa: reader sintético tenant-only → gate FALHA', negExit === 1);

  } finally {
    await cleanup();
    const left = await pool.query(`SELECT (SELECT COUNT(*) FROM companies WHERE company_name LIKE $1)+(SELECT COUNT(*) FROM inventory_movements WHERE reason=$2)+(SELECT COUNT(*) FROM global_users WHERE full_name LIKE $1) AS total`, [`${MARKER}-%`, MARKER]);
    record('Z1 cleanup: zero fixtures residuais', Number(left.rows[0].total) === 0, `restam ${left.rows[0].total}`);
    await app.close();
    await pool.end();
  }

  const passed = results.filter(r => r.ok).length;
  console.log('\n' + '═'.repeat(60));
  console.log(`RESULTADO: ${passed}/${results.length} verdes`);
  if (passed !== results.length) { console.log('FALHAS:'); results.filter(r => !r.ok).forEach(r => console.log(`  ❌ ${r.label} — ${r.reason ?? ''}`)); process.exit(1); }
  console.log('✨ balance tenant-wide=501; movements exige actorId+canRepresentActor; page pública sem estoque; gate G1 baselined honesto (KNOWN_OPEN>0).');
}

main().catch(e => { console.error(String(e)); process.exit(1); });
