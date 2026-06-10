/**
 * E2E HTTP REAL — F-INVENTORY-COMPANY-CONSOLIDATED-AUTHORITY-IMPL (DECISION-0116 adendo)
 *
 * GET /marketplace/inventory/company/:companyId/balance — projeção COMPANY_INTERNAL.
 * Gate = canViewConsolidatedInventory (vínculo ATIVO em company_users com
 * can_manage_company OU can_view_consolidated_inventory). Actors resolvidos server-side
 * por actors.company_id = :companyId. Cliente NUNCA fornece actorIds.
 *
 * FAIL-FIRST capturado antes da implementação (failfirstprobe-consolidated.ts):
 *   (1) rota → 400 ActionContext/404 (inexistente); (2) page-actor com company_id
 *   falhava eligibility; (3) coluna can_view_consolidated_inventory ausente.
 *
 * Fixtures: empresas E+F · users A(admin E)/B(flag E)/C(membro E sem flags)/D(admin F)
 *   · actors EA1(page,E)/EA2(channel,E)/FB1(page,F)/H(page sem company) · variante V
 *   · movimentos IN distintos para EA1/EA2/FB1/H.
 *
 * Modo: npx tsx backend/src/scripts/validate-pipeline-e2e-inventory-company-consolidated-authority.ts
 */
import 'tsconfig-paths/register';
import dotenv from 'dotenv';
import { join } from 'path';
import { readFileSync } from 'fs';
dotenv.config({ path: join(process.cwd(), '.env') });

import jwt from 'jsonwebtoken';
import Fastify, { FastifyInstance } from 'fastify';
import sensible from '@fastify/sensible';
import { randomUUID, createHash } from 'crypto';
import { pool } from '../core/database/pool';
import authPlugin from '../core/auth/auth.plugin';
import { tenantPlugin } from '../plugins/tenant.plugin';
import { actionContextPlugin } from '../plugins/action-context.plugin';
import { rbacPlugin } from '../plugins/rbac.plugin';

const JWT_SECRET = process.env.JWT_SECRET!;
const TENANT_ID = process.env.E2E_TENANT_ID ?? 'fbe13b78-4516-493d-905a-363796aea1d1';
const MARKER = 'E2E-CONSOL';

type Res = { label: string; ok: boolean; reason?: string };
const results: Res[] = [];
function record(label: string, ok: boolean, reason?: string): void {
  results.push({ label, ok, reason });
  console.log(`  ${ok ? '✅' : '❌'} ${label}${ok ? '' : ` — ${reason ?? ''}`}`);
}

function mintToken(userId: string, globalUserId: string, email: string): string {
  return jwt.sign(
    { sub: userId, userId, globalUserId, tenantId: TENANT_ID, email, type: 'access', tokenVersion: 0 },
    JWT_SECRET,
    { expiresIn: '15m' }
  );
}

function acHeader(): Record<string, string> {
  // actionContext exigido pelo middleware global; NÃO é autoridade (DECISION-0113).
  return {
    'x-action-context': JSON.stringify({
      actorId: randomUUID(), intent: 'e2e-consolidated', source: 'e2e', scope: TENANT_ID,
    }),
  };
}

interface Fixture {
  companyE: string; companyF: string;
  users: Record<'A' | 'B' | 'C' | 'D', { userId: string; globalUserId: string; email: string; companyUserId: string }>;
  actors: Record<'EA1' | 'EA2' | 'FB1' | 'H', string>;
  productId: string; variantId: string;
  movementIds: string[];
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
  const companiesModule = await import('../core/companies/companies.routes');
  await app.register(companiesModule.companiesRoutes, { prefix: '/companies' });
  await app.ready();
  return app;
}

async function createFixtures(): Promise<Fixture> {
  const companyE = randomUUID();
  const companyF = randomUUID();
  for (const [cid, name] of [[companyE, `${MARKER}-CO-E`], [companyF, `${MARKER}-CO-F`]] as const) {
    await pool.query(
      `INSERT INTO companies (company_id, tenant_id, company_name, status, company_status)
       VALUES ($1, $2, $3, 'active', 'DRAFT')`,
      [cid, TENANT_ID, name]
    );
  }

  const users = {} as Fixture['users'];
  const cpfBase = String(Math.floor(Math.random() * 89999) + 10000);
  let i = 0;
  for (const key of ['A', 'B', 'C', 'D'] as const) {
    i += 1;
    const userId = randomUUID();
    const globalUserId = randomUUID();
    const email = `${MARKER.toLowerCase()}-${key.toLowerCase()}-${cpfBase}@e2e.local`;
    const cpf = `9${cpfBase}${String(i).padStart(5, '0')}`;
    await pool.query(
      `INSERT INTO global_users (global_user_id, cpf, full_name) VALUES ($1, $2, $3)`,
      [globalUserId, cpf, `${MARKER}-${key}`]
    );
    await pool.query(
      `INSERT INTO users (id, user_id, tenant_id, global_user_id, email, password_hash, token_version)
       VALUES ($1, $1, $2, $3, $4, $5, 0)`,
      [userId, TENANT_ID, globalUserId, email, createHash('sha256').update(randomUUID()).digest('hex')]
    );
    users[key] = { userId, globalUserId, email, companyUserId: '' };
  }

  // Vínculos company_users:
  //   A: admin geral de E · B: membro E com flag · C: membro E sem flags · D: admin de F
  const cuRows: Array<[string, string, string, boolean, boolean]> = [
    [companyE, users.A.globalUserId, 'owner', true, false],
    [companyE, users.B.globalUserId, 'member', false, true],
    [companyE, users.C.globalUserId, 'member', false, false],
    [companyF, users.D.globalUserId, 'owner', true, false],
  ];
  const keys: Array<'A' | 'B' | 'C' | 'D'> = ['A', 'B', 'C', 'D'];
  for (let r = 0; r < cuRows.length; r++) {
    const [cid, gid, role, manage, view] = cuRows[r];
    const res = await pool.query<{ id: string }>(
      `INSERT INTO company_users (
         tenant_id, company_id, global_user_id, role,
         can_manage_company, can_view_consolidated_inventory, is_active, is_primary, metadata
       ) VALUES ($1, $2, $3, $4, $5, $6, true, false, '{}') RETURNING id`,
      [TENANT_ID, cid, gid, role, manage, view]
    );
    users[keys[r]].companyUserId = res.rows[0].id;
  }

  // responsible_actor_id: user-actor existente do dev DB (trigger §4.8 para não-humanos)
  const respRow = await pool.query<{ id: string }>(
    `SELECT id::text AS id FROM actors WHERE tenant_id=$1 AND actor_type='user' LIMIT 1`, [TENANT_ID]
  );
  const responsible = respRow.rows[0].id;

  const actors = {} as Fixture['actors'];
  const actorSpecs: Array<['EA1' | 'EA2' | 'FB1' | 'H', string, string | null]> = [
    ['EA1', 'page', companyE],
    ['EA2', 'channel', companyE], // 2º actor empresarial (uq_actors_company_page impede 2º 'page')
    ['FB1', 'page', companyF],
    ['H', 'page', null],          // actor solto: mesmo tenant, SEM company_id
  ];
  for (const [key, type, cid] of actorSpecs) {
    const id = randomUUID();
    await pool.query(
      `INSERT INTO actors (id, actor_id, tenant_id, actor_type, display_name, company_id, responsible_actor_id, metadata)
       VALUES ($1, $1, $2, $3, $4, $5, $6, '{}')`,
      [id, TENANT_ID, type, `${MARKER}-${key}`, cid, responsible]
    );
    actors[key] = id;
  }

  const catRow = await pool.query<{ category_id: string }>(`SELECT category_id::text FROM categories LIMIT 1`);
  const productId = randomUUID();
  await pool.query(
    `INSERT INTO products (id, tenant_id, name, category_id) VALUES ($1, $2, $3, $4)`,
    [productId, TENANT_ID, `${MARKER}-PROD`, catRow.rows[0].category_id]
  );
  const variantId = randomUUID();
  await pool.query(
    `INSERT INTO product_variants (id, tenant_id, product_id, sku) VALUES ($1, $2, $3, $4)`,
    [variantId, TENANT_ID, productId, `${MARKER}-SKU-${cpfBase}`]
  );

  // Movimentos IN distintos: EA1=10, EA2=7, FB1=100, H=55 → consolidado E = 17.
  const movementIds: string[] = [];
  const movSpecs: Array<[string, number]> = [
    [actors.EA1, 10], [actors.EA2, 7], [actors.FB1, 100], [actors.H, 55],
  ];
  for (const [actorId, qty] of movSpecs) {
    const id = randomUUID();
    await pool.query(
      `INSERT INTO inventory_movements (id, tenant_id, actor_id, product_variant_id, movement_type, quantity, unit, reason, metadata)
       VALUES ($1, $2, $3, $4, 'IN', $5, 'un', $6, '{}')`,
      [id, TENANT_ID, actorId, variantId, qty, MARKER]
    );
    movementIds.push(id);
  }

  return { companyE, companyF, users, actors, productId, variantId, movementIds };
}

async function cleanupFixtures(f: Fixture): Promise<void> {
  // inventory_movements é append-only por trigger (0102 — invariante de runtime correto).
  // Cleanup de FIXTURE E2E em dev: desativa triggers SÓ NESTA SESSÃO (replica role),
  // deleta apenas as linhas marcadas e restaura. O invariante permanece para o runtime.
  // Cleanup por MARKER (não por IDs do run atual) — idempotente entre execuções,
  // remove inclusive resíduos de runs abortados.
  const client = await pool.connect();
  try {
    await client.query(`SET session_replication_role = replica`);
    await client.query(`DELETE FROM inventory_movements WHERE reason = $1`, [MARKER]);
    await client.query(`SET session_replication_role = DEFAULT`);
  } finally {
    client.release();
  }
  void f;
  await pool.query(`DELETE FROM product_variants WHERE sku LIKE $1`, [`${MARKER}-SKU-%`]);
  await pool.query(`DELETE FROM products WHERE name LIKE $1`, [`${MARKER}-%`]);
  await pool.query(`DELETE FROM actors WHERE display_name LIKE $1`, [`${MARKER}-%`]);
  await pool.query(
    `DELETE FROM company_users WHERE company_id IN (SELECT company_id FROM companies WHERE company_name LIKE $1)`,
    [`${MARKER}-%`]
  );
  await pool.query(`DELETE FROM companies WHERE company_name LIKE $1`, [`${MARKER}-%`]);
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
    C: mintToken(f.users.C.userId, f.users.C.globalUserId, f.users.C.email),
    D: mintToken(f.users.D.userId, f.users.D.globalUserId, f.users.D.email),
  };
  const urlE = `/marketplace/inventory/company/${f.companyE}/balance?variantId=${f.variantId}`;
  const urlF = `/marketplace/inventory/company/${f.companyF}/balance?variantId=${f.variantId}`;
  const get = (url: string, token?: string) => app.inject({
    method: 'GET', url,
    headers: { ...(token ? { authorization: `Bearer ${token}` } : {}), ...acHeader() },
  });

  try {
    console.log('\n— A: autorização e isolamento do consolidado —');
    const rA = await get(urlE, tokens.A);
    const bA = rA.statusCode === 200 ? JSON.parse(rA.body) : null;
    record('A1 admin A vê consolidado de E (200)', rA.statusCode === 200, `status ${rA.statusCode}: ${rA.body.slice(0, 120)}`);
    record('A2 soma = EA1+EA2 = 17 (sem FB1=100, sem H=55)', bA?.consolidatedQuantity === 17, `got ${bA?.consolidatedQuantity}`);
    record('A3 actorCount = 2 (EA1+EA2)', bA?.actorCount === 2, `got ${bA?.actorCount}`);
    record('A4 shape: companyId + productVariantId + resolvedAt presentes',
      bA?.companyId === f.companyE && bA?.productVariantId === f.variantId && typeof bA?.resolvedAt === 'string',
      JSON.stringify(bA)?.slice(0, 120));

    const rB = await get(urlE, tokens.B);
    const bB = rB.statusCode === 200 ? JSON.parse(rB.body) : null;
    record('A5 membro B com flag vê consolidado de E (200)', rB.statusCode === 200, `status ${rB.statusCode}`);
    record('A6 B vê a mesma soma 17', bB?.consolidatedQuantity === 17, `got ${bB?.consolidatedQuantity}`);

    const rC = await get(urlE, tokens.C);
    record('A7 membro C sem flags → 403', rC.statusCode === 403, `status ${rC.statusCode}: ${rC.body.slice(0, 100)}`);

    const rD = await get(urlE, tokens.D);
    record('A8 D (admin de F) consultando E → 403', rD.statusCode === 403, `status ${rD.statusCode}`);

    const rAF = await get(urlF, tokens.A);
    record('A9 A (admin de E) consultando F → 403 (não vê movimentos de F)', rAF.statusCode === 403, `status ${rAF.statusCode}`);

    console.log('\n— B: contrato e rejeições —');
    const rInj = await get(`${urlE}&actorId=${f.actors.FB1}`, tokens.A);
    record('B1 actorId na query → 400 (lista de actors nunca vem do cliente)', rInj.statusCode === 400, `status ${rInj.statusCode}`);
    const rInj2 = await get(`${urlE}&actorIds=${f.actors.FB1},${f.actors.H}`, tokens.A);
    record('B2 actorIds na query → 400', rInj2.statusCode === 400, `status ${rInj2.statusCode}`);
    const rNoAuth = await get(urlE);
    record('B3 sem autenticação → 401', rNoAuth.statusCode === 401, `status ${rNoAuth.statusCode}`);
    const rGhost = await get(`/marketplace/inventory/company/${randomUUID()}/balance?variantId=${f.variantId}`, tokens.A);
    record('B4 empresa inexistente → 403 fail-closed (sem vínculo)', rGhost.statusCode === 403, `status ${rGhost.statusCode}`);
    const rNoVar = await get(`/marketplace/inventory/company/${f.companyE}/balance`, tokens.A);
    record('B5 variantId ausente → 400', rNoVar.statusCode === 400, `status ${rNoVar.statusCode}`);
    const rBadCo = await get(`/marketplace/inventory/company/not-a-uuid/balance?variantId=${f.variantId}`, tokens.A);
    record('B6 companyId inválido → 400', rBadCo.statusCode === 400, `status ${rBadCo.statusCode}`);

    console.log('\n— C: GET não cria estado —');
    const counts = async () => {
      const a = await pool.query(`SELECT COUNT(*)::int AS c FROM actors WHERE tenant_id=$1`, [TENANT_ID]);
      const cu = await pool.query(`SELECT COUNT(*)::int AS c FROM company_users WHERE tenant_id=$1`, [TENANT_ID]);
      const m = await pool.query(`SELECT COUNT(*)::int AS c FROM inventory_movements WHERE tenant_id=$1`, [TENANT_ID]);
      return [a.rows[0].c, cu.rows[0].c, m.rows[0].c];
    };
    const before = await counts();
    await get(urlE, tokens.A); await get(urlE, tokens.C); await get(urlF, tokens.D);
    const after = await counts();
    record('C1 GET não cria actor/membership/permissão/movimento',
      before[0] === after[0] && before[1] === after[1] && before[2] === after[2],
      `before=${before} after=${after}`);

    console.log('\n— D: dinâmica da permissão —');
    // Admin mantém acesso mesmo com a flag explícita em false (can_manage_company basta)
    await pool.query(`UPDATE company_users SET can_view_consolidated_inventory=false WHERE id=$1`, [f.users.A.companyUserId]);
    const rA2 = await get(urlE, tokens.A);
    record('D1 admin mantém acesso com flag=false (can_manage_company autoriza)', rA2.statusCode === 200, `status ${rA2.statusCode}`);

    // Membro autorizado perde acesso quando flag vira false
    await pool.query(`UPDATE company_users SET can_view_consolidated_inventory=false WHERE id=$1`, [f.users.B.companyUserId]);
    const rB2 = await get(urlE, tokens.B);
    record('D2 B perde acesso quando flag vira false → 403', rB2.statusCode === 403, `status ${rB2.statusCode}`);
    await pool.query(`UPDATE company_users SET can_view_consolidated_inventory=true WHERE id=$1`, [f.users.B.companyUserId]);

    // Membro autorizado perde acesso quando membership fica inativa
    await pool.query(`UPDATE company_users SET is_active=false WHERE id=$1`, [f.users.B.companyUserId]);
    const rB3 = await get(urlE, tokens.B);
    record('D3 B perde acesso com membership inativa → 403', rB3.statusCode === 403, `status ${rB3.statusCode}`);
    await pool.query(`UPDATE company_users SET is_active=true WHERE id=$1`, [f.users.B.companyUserId]);

    console.log('\n— E: writer da permissão (concessão admin-gated) —');
    const putPerm = (companyId: string, companyUserId: string, token: string, value: boolean) => app.inject({
      method: 'PUT',
      url: `/companies/${companyId}/users/${companyUserId}/consolidated-inventory-permission`,
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json', ...acHeader() },
      payload: JSON.stringify({ canViewConsolidatedInventory: value }),
    });

    // C (não-admin) tenta conceder a própria permissão → 403
    const rSelf = await putPerm(f.companyE, f.users.C.companyUserId, tokens.C, true);
    record('E1 membro C não concede a própria permissão → 403', rSelf.statusCode === 403, `status ${rSelf.statusCode}: ${rSelf.body.slice(0, 100)}`);
    const cFlag = await pool.query<{ v: boolean }>(`SELECT can_view_consolidated_inventory AS v FROM company_users WHERE id=$1`, [f.users.C.companyUserId]);
    record('E2 flag de C permanece false após tentativa', cFlag.rows[0].v === false, `flag=${cFlag.rows[0].v}`);

    // D (admin de OUTRA empresa) tenta conceder em E → 403
    const rCross = await putPerm(f.companyE, f.users.C.companyUserId, tokens.D, true);
    record('E3 admin de outra empresa não concede em E → 403', rCross.statusCode === 403, `status ${rCross.statusCode}`);

    // A (admin de E) concede a C → 200, e C passa a ver o consolidado
    const rGrant = await putPerm(f.companyE, f.users.C.companyUserId, tokens.A, true);
    record('E4 admin A concede flag a C → 200', rGrant.statusCode === 200, `status ${rGrant.statusCode}: ${rGrant.body.slice(0, 100)}`);
    const rC2 = await get(urlE, tokens.C);
    record('E5 C autorizado agora vê consolidado (200)', rC2.statusCode === 200, `status ${rC2.statusCode}`);

    // A revoga → C volta a 403
    const rRevoke = await putPerm(f.companyE, f.users.C.companyUserId, tokens.A, false);
    record('E6 admin A revoga flag de C → 200', rRevoke.statusCode === 200, `status ${rRevoke.statusCode}`);
    const rC3 = await get(urlE, tokens.C);
    record('E7 C revogado volta a 403', rC3.statusCode === 403, `status ${rC3.statusCode}`);

    // Writer não toca can_manage_company
    const cManage = await pool.query<{ v: boolean }>(`SELECT can_manage_company AS v FROM company_users WHERE id=$1`, [f.users.C.companyUserId]);
    record('E8 writer não altera can_manage_company do alvo', cManage.rows[0].v === false, `can_manage=${cManage.rows[0].v}`);

    console.log('\n— F: eligibility empresarial (Decisão 2) —');
    const { assertInventoryUnitActorEligible } = await import('../modules/marketplace/inventory-unit-actor');
    let ea1Ok = true; try { await assertInventoryUnitActorEligible(TENANT_ID, f.actors.EA1); } catch { ea1Ok = false; }
    record('F1 page-actor com company_id é elegível', ea1Ok);
    let ea2Ok = true; try { await assertInventoryUnitActorEligible(TENANT_ID, f.actors.EA2); } catch { ea2Ok = false; }
    record('F2 segundo actor empresarial (channel, company_id) é elegível', ea2Ok);
    // H tem movimento (fixture), o que o torna elegível por critério comercial — provar o
    // critério de TIPO com um page novo sem company_id e sem atividade:
    const freshPage = randomUUID();
    const respRow2 = await pool.query<{ id: string }>(`SELECT id::text AS id FROM actors WHERE tenant_id=$1 AND actor_type='user' LIMIT 1`, [TENANT_ID]);
    await pool.query(
      `INSERT INTO actors (id, actor_id, tenant_id, actor_type, display_name, company_id, responsible_actor_id, metadata)
       VALUES ($1, $1, $2, 'page', $3, NULL, $4, '{}')`,
      [freshPage, TENANT_ID, `${MARKER}-FRESH-PAGE`, respRow2.rows[0].id]
    );
    let freshOk = true; try { await assertInventoryUnitActorEligible(TENANT_ID, freshPage); } catch { freshOk = false; }
    record('F3 page SEM company_id e sem atividade NÃO é elegível pelo tipo', freshOk === false, 'passou indevidamente');
    await pool.query(`DELETE FROM actors WHERE id=$1`, [freshPage]);

    console.log('\n— G: rotas por actor preservadas + estrutural —');
    // Nível 1 (ACTOR_PRIVATE) preservado: prova pelo PRIMITIVO + service (a regressão HTTP
    // completa da rota by-actor é o E2E selado f6-5-c3, rodado como regressão desta fatia;
    // o requirePermission da rota exige actor de actionContext registrado — fixture sintética
    // não está no actor_registry, então o caminho HTTP é coberto pelo E2E canônico).
    const { authorizationService } = await import('../core/authorization/authorization.service');
    const canRepA_EA1 = await authorizationService.canRepresentActor(TENANT_ID, f.users.A.userId, f.actors.EA1);
    const { inventoryService } = await import('../modules/marketplace/inventory.service');
    const byActorBal = await inventoryService.getCurrentBalanceByActor(TENANT_ID, f.actors.EA1, f.variantId);
    record('G1 nível 1 preservado: A representa EA1 (canRepresentActor) e saldo by-actor = 10',
      canRepA_EA1 === true && byActorBal.quantity === 10,
      `canRep=${canRepA_EA1} qty=${byActorBal.quantity}`);

    const routesSrc = readFileSync(join(process.cwd(), 'src/modules/marketplace/routes/marketplace-inventory.routes.ts'), 'utf8');
    record('G2 rota consolidada existe com gate canViewConsolidatedInventory',
      routesSrc.includes("'/inventory/company/:companyId/balance'") && routesSrc.includes('canViewConsolidatedInventory'));
    record('G3 consolidado NÃO usa requirePermission(can_manage_marketplace) como autoridade',
      !/inventory\/company[\s\S]{0,600}requirePermission/.test(routesSrc));
    const repoSrc = readFileSync(join(process.cwd(), 'src/modules/marketplace/inventory-movement.repository.ts'), 'utf8');
    record('G4 agregação restrita a company_actors (subquery server-side company_id)',
      repoSrc.includes('calculateConsolidatedBalanceByCompany') &&
      repoSrc.includes('WHERE tenant_id = $1 AND company_id = $3::uuid') &&
      /calculateConsolidatedBalanceByCompany[\s\S]{0,1600}actor_id IN \(SELECT id FROM company_actors\)/.test(repoSrc));
    const unitSrc = readFileSync(join(process.cwd(), 'src/modules/marketplace/inventory-unit-actor.ts'), 'utf8');
    record('G5 eligibility usa company_id IS NOT NULL + legado company preservado',
      unitSrc.includes('a.company_id IS NOT NULL') && unitSrc.includes("a.actor_type = 'company'"));
    record('G6 eligibility NÃO libera actor_type=page genérico',
      !unitSrc.includes("actor_type = 'page'"));
    record('G7 rota consolidada não toca Bank (sem bank_ledger/bankPorts)',
      !/inventory\/company[\s\S]{0,3000}(bank_ledger|bankPorts)/.test(routesSrc));
    const oldBalance = /\/inventory\/balance'[\s\S]{0,800}getCurrentBalance\(req\.tenant\.id, variantId\)/.test(routesSrc);
    record('G8 rota tenant-wide legada /inventory/balance preservada (DT aberta, fatia futura)', oldBalance);

    console.log('\n— H: cleanup —');
  } finally {
    await cleanupFixtures(f);
    const leftovers = await pool.query(
      `SELECT
        (SELECT COUNT(*) FROM actors WHERE display_name LIKE $1) +
        (SELECT COUNT(*) FROM companies WHERE company_name LIKE $1) +
        (SELECT COUNT(*) FROM inventory_movements WHERE reason = $2) +
        (SELECT COUNT(*) FROM global_users WHERE full_name LIKE $1) AS total`,
      [`${MARKER}-%`, MARKER]
    );
    record('H1 cleanup: zero fixtures residuais', Number(leftovers.rows[0].total) === 0, `restam ${leftovers.rows[0].total}`);
    await app.close();
    await pool.end();
  }

  const passed = results.filter(r => r.ok).length;
  console.log('\n' + '═'.repeat(60));
  console.log(`RESULTADO: ${passed}/${results.length} verdes`);
  if (passed !== results.length) {
    console.log('FALHAS:'); results.filter(r => !r.ok).forEach(r => console.log(`  ❌ ${r.label} — ${r.reason ?? ''}`));
    process.exit(1);
  }
  console.log('✨ Consolidado empresarial: gate company_users, actors por company_id, cliente sem lista, zero estado em GET.');
}

main().catch(e => { console.error(String(e)); process.exit(1); });
