/**
 * E2E HTTP REAL — F-COMPANY-USERS-SELF-UPDATE-AUTHORITY-ESCALATION-CLOSURE
 *
 * Fecha a escalation provada pela Yala: `PUT /companies/:companyId/users/:companyUserId`
 * (self-scoped) aceitava campos de autoridade (role/permissions/is_active/is_primary/
 * member_status) e um membro comum se auto-promovia a admin, ganhando acesso ao
 * consolidado COMPANY_INTERNAL.
 *
 * Prova: allowlist explícita (só roleDescription) → 403 observável p/ qualquer campo de
 * autoridade; banco inalterado; C continua 403 no consolidado. Writers administrativos
 * (PUT /members/:memberId, setConsolidatedInventoryPermission) intactos.
 *
 * Modo: npx tsx backend/src/scripts/validate-pipeline-e2e-company-users-self-escalation-closure.ts
 */
import 'tsconfig-paths/register';
import dotenv from 'dotenv';
import { join } from 'path';
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
const MARKER = 'E2E-ESCAL';

type Res = { label: string; ok: boolean; reason?: string };
const results: Res[] = [];
function record(label: string, ok: boolean, reason?: string): void {
  results.push({ label, ok, reason });
  console.log(`  ${ok ? '✅' : '❌'} ${label}${ok ? '' : ` — ${reason ?? ''}`}`);
}

function mintToken(userId: string, globalUserId: string, email: string): string {
  return jwt.sign(
    { sub: userId, userId, globalUserId, tenantId: TENANT_ID, email, type: 'access', tokenVersion: 0 },
    JWT_SECRET, { expiresIn: '15m' }
  );
}
function acHeader(): Record<string, string> {
  return { 'x-action-context': JSON.stringify({ actorId: randomUUID(), intent: 'e2e-escal', source: 'e2e', scope: TENANT_ID }) };
}

interface Fixture {
  companyE: string; companyF: string;
  users: Record<'A' | 'C' | 'B' | 'D', { userId: string; globalUserId: string; email: string; companyUserId: string }>;
  pageActorE: string; productId: string; variantId: string;
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
       VALUES ($1, $2, $3, 'active', 'DRAFT')`, [cid, TENANT_ID, name]
    );
  }
  const users = {} as Fixture['users'];
  const cpfBase = String(Math.floor(Math.random() * 89999) + 10000);
  let i = 0;
  for (const key of ['A', 'C', 'B', 'D'] as const) {
    i += 1;
    const userId = randomUUID();
    const globalUserId = randomUUID();
    const email = `${MARKER.toLowerCase()}-${key.toLowerCase()}-${cpfBase}@e2e.local`;
    const cpf = `9${cpfBase}${String(i).padStart(5, '0')}`;
    await pool.query(`INSERT INTO global_users (global_user_id, cpf, full_name) VALUES ($1, $2, $3)`, [globalUserId, cpf, `${MARKER}-${key}`]);
    await pool.query(
      `INSERT INTO users (id, user_id, tenant_id, global_user_id, email, password_hash, token_version)
       VALUES ($1, $1, $2, $3, $4, $5, 0)`,
      [userId, TENANT_ID, globalUserId, email, createHash('sha256').update(randomUUID()).digest('hex')]
    );
    users[key] = { userId, globalUserId, email, companyUserId: '' };
  }
  // A admin de E; C membro comum de E (todas flags false); B membro de E (controle); D admin de F.
  const rows: Array<[string, string, string, boolean]> = [
    [companyE, users.A.globalUserId, 'owner', true],
    [companyE, users.C.globalUserId, 'member', false],
    [companyE, users.B.globalUserId, 'member', false],
    [companyF, users.D.globalUserId, 'owner', true],
  ];
  const keys: Array<'A' | 'C' | 'B' | 'D'> = ['A', 'C', 'B', 'D'];
  for (let r = 0; r < rows.length; r++) {
    const [cid, gid, role, manage] = rows[r];
    const res = await pool.query<{ id: string }>(
      `INSERT INTO company_users (tenant_id, company_id, global_user_id, role,
         can_manage_company, can_manage_financial, can_manage_employees, can_view_reports,
         can_manage_services, can_view_consolidated_inventory, is_active, is_primary, member_status, metadata)
       VALUES ($1,$2,$3,$4,$5,false,false,false,false,false,true,false,'active','{}') RETURNING id`,
      [TENANT_ID, cid, gid, role, manage]
    );
    users[keys[r]].companyUserId = res.rows[0].id;
  }
  // page-actor de E + variante + movimento p/ o consolidado ter dado.
  const respRow = await pool.query<{ id: string }>(`SELECT id::text AS id FROM actors WHERE tenant_id=$1 AND actor_type='user' LIMIT 1`, [TENANT_ID]);
  const pageActorE = randomUUID();
  await pool.query(
    `INSERT INTO actors (id, actor_id, tenant_id, actor_type, display_name, company_id, responsible_actor_id, metadata)
     VALUES ($1,$1,$2,'page',$3,$4,$5,'{}')`, [pageActorE, TENANT_ID, `${MARKER}-PAGE-E`, companyE, respRow.rows[0].id]
  );
  const catRow = await pool.query<{ category_id: string }>(`SELECT category_id::text FROM categories LIMIT 1`);
  const productId = randomUUID();
  await pool.query(`INSERT INTO products (id, tenant_id, name, category_id) VALUES ($1,$2,$3,$4)`, [productId, TENANT_ID, `${MARKER}-PROD`, catRow.rows[0].category_id]);
  const variantId = randomUUID();
  await pool.query(`INSERT INTO product_variants (id, tenant_id, product_id, sku) VALUES ($1,$2,$3,$4)`, [variantId, TENANT_ID, productId, `${MARKER}-SKU-${cpfBase}`]);
  await pool.query(
    `INSERT INTO inventory_movements (id, tenant_id, actor_id, product_variant_id, movement_type, quantity, unit, reason, metadata)
     VALUES ($1,$2,$3,$4,'IN',42,'un',$5,'{}')`, [randomUUID(), TENANT_ID, pageActorE, variantId, MARKER]
  );
  return { companyE, companyF, users, pageActorE, productId, variantId };
}

async function cleanupFixtures(): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query(`SET session_replication_role = replica`);
    await client.query(`DELETE FROM inventory_movements WHERE reason = $1`, [MARKER]);
    await client.query(`SET session_replication_role = DEFAULT`);
  } finally { client.release(); }
  await pool.query(`DELETE FROM product_variants WHERE sku LIKE $1`, [`${MARKER}-SKU-%`]);
  await pool.query(`DELETE FROM products WHERE name LIKE $1`, [`${MARKER}-%`]);
  await pool.query(`DELETE FROM actors WHERE display_name LIKE $1`, [`${MARKER}-%`]);
  await pool.query(`DELETE FROM company_users WHERE company_id IN (SELECT company_id FROM companies WHERE company_name LIKE $1)`, [`${MARKER}-%`]);
  await deleteCompaniesAndFiscal(pool, "company_name LIKE $1", [`${MARKER}-%`]);
  await pool.query(`DELETE FROM users WHERE email LIKE $1`, [`${MARKER.toLowerCase()}-%`]);
  await pool.query(`DELETE FROM global_users WHERE full_name ILIKE $1`, [`${MARKER}-%`]);
}

async function authorityRow(companyUserId: string): Promise<Record<string, unknown>> {
  const r = await pool.query(
    `SELECT role, can_manage_company, can_manage_financial, can_manage_employees, can_view_reports,
            can_manage_services, can_view_consolidated_inventory, is_active, is_primary, member_status, role_description
       FROM company_users WHERE id = $1`, [companyUserId]
  );
  return r.rows[0];
}
function allAuthorityFalse(row: Record<string, unknown>): boolean {
  return row.role === 'member' && row.can_manage_company === false && row.can_manage_financial === false &&
    row.can_manage_employees === false && row.can_view_reports === false && row.can_manage_services === false &&
    row.can_view_consolidated_inventory === false && row.is_active === true && row.is_primary === false &&
    row.member_status === 'active';
}

async function main(): Promise<void> {
  await bootstrapPorts();
  const app = await buildApp();
  const f = await createFixtures();
  const tokens = {
    A: mintToken(f.users.A.userId, f.users.A.globalUserId, f.users.A.email),
    C: mintToken(f.users.C.userId, f.users.C.globalUserId, f.users.C.email),
    B: mintToken(f.users.B.userId, f.users.B.globalUserId, f.users.B.email),
    D: mintToken(f.users.D.userId, f.users.D.globalUserId, f.users.D.email),
  };
  const consolUrlE = `/marketplace/inventory/company/${f.companyE}/balance?variantId=${f.variantId}`;
  const selfPut = (companyUserId: string, token: string, body: unknown) => app.inject({
    method: 'PUT', url: `/companies/${f.companyE}/users/${companyUserId}`,
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json', ...acHeader() },
    payload: JSON.stringify(body),
  });
  const getConsol = (token: string, url = consolUrlE) => app.inject({
    method: 'GET', url, headers: { authorization: `Bearer ${token}`, ...acHeader() },
  });

  try {
    console.log('\n— baseline —');
    const base = await authorityRow(f.users.C.companyUserId);
    record('BL1 C nasce sem autoridade (todas flags false, role=member)', allAuthorityFalse(base), JSON.stringify(base));
    const rC0 = await getConsol(tokens.C);
    record('BL2 C recebe 403 no consolidado (baseline)', rC0.statusCode === 403, `status ${rC0.statusCode}`);

    console.log('\n— PROVAS DE BLOQUEIO no self-update (cada campo de autoridade) —');
    const attempts: Array<[string, unknown]> = [
      ['P1 permissions.canManageCompany=true', { permissions: { canManageCompany: true } }],
      ['P2 permissions.canManageFinancial=true', { permissions: { canManageFinancial: true } }],
      ['P3 permissions.canManageEmployees=true', { permissions: { canManageEmployees: true } }],
      ['P4 permissions.canManageServices=true', { permissions: { canManageServices: true } }],
      ['P5 permissions.canViewReports=true', { permissions: { canViewReports: true } }],
      ['P6 permissions.canViewConsolidatedInventory=true', { permissions: { canViewConsolidatedInventory: true } }],
      ["P7 role='owner'", { role: 'owner' }],
      ['P8 isActive=false', { isActive: false }],
      ['P9 memberStatus=suspended', { memberStatus: 'suspended' }],
      ['P10 isPrimary=true', { isPrimary: true }],
      ['P11 misto (roleDescription legítimo + role=owner proibido)', { roleDescription: 'X', role: 'owner' }],
      ['P12 alias inesperado (can_manage_company snake)', { can_manage_company: true }],
      ['P13 permissions com campo extra', { permissions: { foo: true } }],
      ['P14 campo totalmente desconhecido', { superAdmin: true }],
    ];
    for (const [label, body] of attempts) {
      const r = await selfPut(f.users.C.companyUserId, tokens.C, body);
      const blocked = r.statusCode === 403;
      record(`${label} → 403 (não 200)`, blocked, `status ${r.statusCode}: ${r.body.slice(0, 90)}`);
    }

    console.log('\n— banco inalterado + sem novo acesso após todas as tentativas —');
    const afterC = await authorityRow(f.users.C.companyUserId);
    record('Q1 linha de C inalterada (toda autoridade ainda false)', allAuthorityFalse(afterC), JSON.stringify(afterC));
    const rC1 = await getConsol(tokens.C);
    record('Q2 C continua 403 no consolidado após tentativas', rC1.statusCode === 403, `status ${rC1.statusCode}`);

    console.log('\n— PROVAS POSITIVAS (self-editable legítimo) —');
    const rOk = await selfPut(f.users.C.companyUserId, tokens.C, { roleDescription: 'Analista de Estoque' });
    record('S1 C altera roleDescription (self-editable) → 200', rOk.statusCode === 200, `status ${rOk.statusCode}: ${rOk.body.slice(0, 90)}`);
    const afterDesc = await authorityRow(f.users.C.companyUserId);
    record('S2 role_description mudou e nenhuma autoridade junto', afterDesc.role_description === 'Analista de Estoque' && allAuthorityFalse(afterDesc), JSON.stringify(afterDesc));
    const rC2 = await getConsol(tokens.C);
    record('S3 C ainda 403 no consolidado (roleDescription não é autoridade)', rC2.statusCode === 403, `status ${rC2.statusCode}`);

    console.log('\n— writers administrativos intactos (concessão correta) —');
    const putPerm = (companyUserId: string, token: string, value: boolean) => app.inject({
      method: 'PUT', url: `/companies/${f.companyE}/users/${companyUserId}/consolidated-inventory-permission`,
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json', ...acHeader() },
      payload: JSON.stringify({ canViewConsolidatedInventory: value }),
    });
    const rGrant = await putPerm(f.users.C.companyUserId, tokens.A, true);
    record('W1 admin A concede flag a C (writer admin-gated) → 200', rGrant.statusCode === 200, `status ${rGrant.statusCode}`);
    const rC3 = await getConsol(tokens.C);
    record('W2 C autorizado agora vê consolidado (200, soma 42)', rC3.statusCode === 200 && JSON.parse(rC3.body).consolidatedQuantity === 42, `status ${rC3.statusCode}`);
    const rRevoke = await putPerm(f.users.C.companyUserId, tokens.A, false);
    record('W3 admin A revoga (200) e C volta a 403', rRevoke.statusCode === 200 && (await getConsol(tokens.C)).statusCode === 403);
    // C tenta conceder a si mesmo pela rota específica → 403 (writer admin-gated, regressão da fatia anterior)
    const rSelfGrant = await putPerm(f.users.C.companyUserId, tokens.C, true);
    record('W4 C não se autoconcede pela rota específica → 403', rSelfGrant.statusCode === 403, `status ${rSelfGrant.statusCode}`);
    // D (admin de F) não toca membro de E pelo self-update (linha não é dele) — self-scoped: roleDescription
    // numa linha alheia não acha a row (404), mas o ponto é que NÃO altera autoridade.
    const rCross = await selfPut(f.users.B.companyUserId, tokens.D, { roleDescription: 'hack' });
    const crossRow = await authorityRow(f.users.B.companyUserId);
    record('W5 D não altera linha de B via self-update (não-200 ou sem mudança de autoridade)',
      (rCross.statusCode !== 200 || crossRow.role_description !== 'hack') && allAuthorityFalse(crossRow), `status ${rCross.statusCode}`);
    // C tenta self-update na linha de B (alheia) → não acha (self-scoped)
    const rCB = await selfPut(f.users.B.companyUserId, tokens.C, { roleDescription: 'hack2' });
    const bRow = await authorityRow(f.users.B.companyUserId);
    record('W6 C não altera linha de B (self-scoped, não-200)', rCB.statusCode !== 200 && bRow.role_description !== 'hack2', `status ${rCB.statusCode}`);

    console.log('\n— GET não cria estado + estrutural —');
    const before = await pool.query<{ c: number }>(`SELECT COUNT(*)::int AS c FROM company_users WHERE tenant_id=$1`, [TENANT_ID]);
    await selfPut(f.users.C.companyUserId, tokens.C, { role: 'owner' });
    await getConsol(tokens.C);
    const after = await pool.query<{ c: number }>(`SELECT COUNT(*)::int AS c FROM company_users WHERE tenant_id=$1`, [TENANT_ID]);
    record('X1 nenhuma linha company_users criada por tentativas', before.rows[0].c === after.rows[0].c, `before=${before.rows[0].c} after=${after.rows[0].c}`);

    const { readFileSync } = await import('fs');
    const routesSrc = readFileSync(join(process.cwd(), 'src/core/companies/companies.routes.ts'), 'utf8');
    record('X2 rota usa selfUpdateCompanyUser (não updateCompanyUser mass-assignment)',
      routesSrc.includes('selfUpdateCompanyUser') && !routesSrc.includes('companiesService.updateCompanyUser('));
    record('X3 allowlist explícita SELF_EDITABLE_COMPANY_USER_FIELDS na rota', routesSrc.includes('SELF_EDITABLE_COMPANY_USER_FIELDS'));
    const svcSrc = readFileSync(join(process.cwd(), 'src/core/companies/companies.service.ts'), 'utf8');
    record('X4 service: método mass-assignment updateCompanyUser REMOVIDO', !/async updateCompanyUser\(/.test(svcSrc));
    record('X5 selfUpdateCompanyUser SQL menciona só role_description (sem can_/role=/is_active)',
      /selfUpdateCompanyUser[\s\S]{0,1200}SET role_description = \$1, updated_at = NOW\(\)/.test(svcSrc) &&
      !/selfUpdateCompanyUser[\s\S]{0,1200}can_manage_company = \$/.test(svcSrc));
  } finally {
    await cleanupFixtures();
    const leftovers = await pool.query(
      `SELECT (SELECT COUNT(*) FROM companies WHERE company_name LIKE $1) +
              (SELECT COUNT(*) FROM company_users WHERE company_id IN (SELECT company_id FROM companies WHERE company_name LIKE $1)) +
              (SELECT COUNT(*) FROM inventory_movements WHERE reason = $2) +
              (SELECT COUNT(*) FROM global_users WHERE full_name ILIKE $1) AS total`,
      [`${MARKER}-%`, MARKER]
    );
    record('Z1 cleanup: zero fixtures residuais', Number(leftovers.rows[0].total) === 0, `restam ${leftovers.rows[0].total}`);
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
  console.log('✨ Self-update self-scoped: allowlist roleDescription; toda autoridade → 403; banco inalterado; admin writers intactos.');
}

main().catch(e => { console.error(String(e)); process.exit(1); });
