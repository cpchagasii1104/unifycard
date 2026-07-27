/**
 * E2E — F-ECONOMIC-POLICY-ADMIN-FRONT FATIA 1 (authority key + read-only consumer).
 *
 * Prova, via HTTP real (app.inject, JWT real, sem frontend), que a chave `economic_policy:manage`
 * (permission-keys.ts) NÃO é vocabulário fantasma: ela gateia de fato o único consumidor desta
 * fatia — `GET /economy/admin/policies` — que lista economic_policies (+ linhas) do tenant
 * autenticado. READ-ONLY: nenhuma escrita é exercida ou possível nesta fatia.
 *
 *   A · ADMIN do tenant GETa a lista → 200, enxerga as próprias policies fixture (draft).
 *   B · NÃO-ADMIN autenticado do MESMO tenant GETa → 403 (assert de autoridade load-bearing).
 *   C · Sem Authorization header → 401.
 *   D · Isolamento cross-tenant: ADMIN do tenant A NUNCA vê policy do tenant B (nem por acidente
 *       de query — tenant é sempre `req.tenant.id`, do JWT).
 *   E · Δbank = 0 (fatia é Bank-free).
 *   F · Guard estrutural (audit-economic-policy-authority-boundary) verde.
 *
 * As policies seedadas são FIXTURES DE TESTE (status='draft', policy_code prefixado 'e2e-'), SEM
 * nenhum percentual real — a decisão soberana dos números fica para a Fatia 5 (Clayton).
 *
 * 🔒 DB EFÊMERA (wrapper run-economic-policy-authority-ephemeral.ps1). NUNCA unificard_dev.
 */
import 'tsconfig-paths/register';
import dotenv from 'dotenv';
import { join } from 'path';
import Fastify, { FastifyInstance } from 'fastify';
import sensible from '@fastify/sensible';
import jwt from 'jsonwebtoken';
import { randomUUID } from 'crypto';
import { execSync } from 'child_process';

import { pool } from '../core/database/pool';
import { tenantService } from '../core/tenants/tenant.service';
import { rbacService } from '../core/rbac/rbac.service';
import authPlugin from '../core/auth/auth.plugin';
import { tenantPlugin } from '../plugins/tenant.plugin';
import { actionContextPlugin } from '../plugins/action-context.plugin';
import { rbacPlugin } from '../plugins/rbac.plugin';

dotenv.config({ path: join(process.cwd(), '.env') });

const EXPECTED = process.env.EXPECTED_DATABASE_NAME || '';
const JWT_SECRET = process.env.JWT_SECRET;
const cwd = process.cwd();

type Res = { label: string; ok: boolean; reason?: string };
const results: Res[] = [];
const record = (label: string, ok: boolean, reason?: string): void => {
  results.push({ label, ok, reason });
  console.log(`  ${ok ? '✅' : '❌'} ${label}${ok ? '' : ` — ${reason ?? ''}`}`);
};

async function assertEphemeralDb(): Promise<void> {
  const r = await pool.query<{ db: string }>('SELECT current_database() AS db');
  const db = r.rows[0]?.db;
  if (db === 'unificard_dev') throw new Error('ABORT: banco-alvo é "unificard_dev".');
  if (!EXPECTED || db !== EXPECTED) throw new Error(`ABORT: banco-alvo "${db}" ≠ EXPECTED "${EXPECTED}".`);
  if (!/economic|policy|ephemeral|test/i.test(db)) throw new Error(`ABORT: nome de banco "${db}" não parece efêmero.`);
  if (!JWT_SECRET) throw new Error('ABORT: JWT_SECRET ausente.');
  console.log(`🔒 DB efêmera confirmada: ${db}`);
}

async function bootstrapSocialPorts(): Promise<void> {
  const { socialPortsRegistry } = await import('../core/social/ports-registry');
  const adapters = await import('../modules/social/adapters');
  socialPortsRegistry.setActorRepository(adapters.actorRepositoryAdapter);
  socialPortsRegistry.setActorUtils(adapters.actorUtilsAdapter);
  socialPortsRegistry.setSocialRepository(adapters.socialRepositoryAdapter);
  socialPortsRegistry.setSocialService(adapters.socialServiceAdapter);
  socialPortsRegistry.setEventFeedHandlers(adapters.eventFeedHandlersAdapter);
}

async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({ logger: false });
  await app.register(sensible);
  await app.register(authPlugin);
  await app.register(tenantPlugin);
  await app.register(actionContextPlugin);
  await app.register(rbacPlugin);
  const economicPolicyAdminRoutes = (await import('../modules/economy/policy-engine/economic-policy-admin.routes')).default;
  await app.register(economicPolicyAdminRoutes, { prefix: '/economy' });
  await app.ready();
  return app;
}

interface Human { tenantId: string; globalId: string; userId: string; actorId: string; headers: Record<string, string> }

async function mkHuman(tenantId: string, name: string, seq: number, role?: 'admin'): Promise<Human> {
  const { socialPortsRegistry } = await import('../core/social/ports-registry');
  const actorRepo = socialPortsRegistry.getActorRepository();
  const globalId = randomUUID();
  const userId = randomUUID();
  const cpf = String(Date.now() + seq).padStart(11, '0').slice(-11);
  await pool.query(`INSERT INTO global_users (global_user_id, cpf, full_name, metadata) VALUES ($1,$2,$3,'{}'::jsonb)`, [globalId, cpf, name]);
  await pool.query(`INSERT INTO identities (global_user_id, tax_id, tax_id_type, kyc_status, kyc_level) VALUES ($1,$2,'cpf','pending','none')`, [globalId, cpf]);
  await pool.query(`INSERT INTO users (id, user_id, tenant_id, global_user_id, email, password_hash, token_version) VALUES ($1,$1,$2,$3,$4,'x',0)`, [userId, tenantId, globalId, `${userId}@e2e.local`]);
  const actorId = (await actorRepo.findOrCreateUserActor(tenantId, userId)).actor_id;
  if (role === 'admin') await rbacService.assignRoleByName(tenantId, userId, 'admin');
  const token = jwt.sign(
    { sub: userId, userId, tenantId, email: `${userId}@e2e.local`, tokenVersion: 0, globalUserId: globalId, type: 'access' },
    JWT_SECRET as string,
    { expiresIn: '15m' }
  );
  const ac = JSON.stringify({ actorId, intent: 'economic_policy_authority_e2e', source: 'e2e', scope: `tenant:${tenantId}` });
  return { tenantId, globalId, userId, actorId, headers: { authorization: `Bearer ${token}`, 'x-action-context': ac } };
}

/** Fixture DRAFT, sem percentuais reais (a decisão soberana dos números é Fatia 5). */
async function seedFixturePolicy(tenantId: string, code: string): Promise<string> {
  const row = await pool.query<{ id: string }>(
    `INSERT INTO economic_policies (tenant_id, policy_code, policy_type, module_context, status, effective_from)
     VALUES ($1::uuid, $2, 'COMMISSION_SPLIT', 'e2e_fatia1_fixture', 'draft', NOW())
     RETURNING id::text AS id`,
    [tenantId, code]
  );
  return row.rows[0].id;
}

const count = async (sql: string, p: unknown[] = []): Promise<number> => Number((await pool.query<{ n: string }>(sql, p)).rows[0].n);
const bankSnapshot = async (): Promise<number> =>
  count(`SELECT ((SELECT count(*) FROM bank_ledger)+(SELECT count(*) FROM bank_transactions))::text n`);

async function main(): Promise<void> {
  await assertEphemeralDb();
  await bootstrapSocialPorts();

  const bank0 = await bankSnapshot();

  const TENANT_A = randomUUID();
  const TENANT_B = randomUUID();
  await tenantService.createTenant({ id: TENANT_A, name: 'Economic Policy Authority Tenant A', slug: `epa-a-${Date.now()}` });
  await tenantService.createTenant({ id: TENANT_B, name: 'Economic Policy Authority Tenant B', slug: `epa-b-${Date.now()}` });
  await rbacService.seedDefaultRBAC(TENANT_A);
  await rbacService.seedDefaultRBAC(TENANT_B);

  const ADMIN_A = await mkHuman(TENANT_A, 'E2E Admin A', 1, 'admin');
  const NON_ADMIN_A = await mkHuman(TENANT_A, 'E2E Non-Admin A', 2);
  const ADMIN_B = await mkHuman(TENANT_B, 'E2E Admin B', 3, 'admin');

  // Duas policies DRAFT em A (a tela admin precisa enxergar draft, não só 'active'); uma em B.
  const policyA1 = await seedFixturePolicy(TENANT_A, `e2e-fatia1-a1-${Date.now()}`);
  const policyA2 = await seedFixturePolicy(TENANT_A, `e2e-fatia1-a2-${Date.now()}`);
  const policyB1 = await seedFixturePolicy(TENANT_B, `e2e-fatia1-b1-${Date.now()}`);

  const app = await buildApp();

  try {
    console.log('\n— F-ECONOMIC-POLICY-ADMIN-FRONT FATIA 1: authority key + read-only consumer —');

    // A · ADMIN GET → 200, enxerga as PRÓPRIAS 2 draft policies.
    const rAdmin = await app.inject({ method: 'GET', url: '/economy/admin/policies', headers: ADMIN_A.headers });
    const bodyAdmin = rAdmin.statusCode === 200 ? rAdmin.json() : undefined;
    const idsAdmin = ((bodyAdmin?.data ?? []) as Array<{ id: string }>).map((p) => p.id);
    record(
      'A ADMIN do tenant A → 200, enxerga as 2 policies DRAFT fixture de A',
      rAdmin.statusCode === 200 && idsAdmin.includes(policyA1) && idsAdmin.includes(policyA2),
      `status=${rAdmin.statusCode} ids=${JSON.stringify(idsAdmin)}`
    );

    // B · NÃO-ADMIN do MESMO tenant → 403 (assert de autoridade load-bearing).
    const rNonAdmin = await app.inject({ method: 'GET', url: '/economy/admin/policies', headers: NON_ADMIN_A.headers });
    record('B NÃO-ADMIN autenticado (mesmo tenant) → 403', rNonAdmin.statusCode === 403, `status=${rNonAdmin.statusCode} body=${rNonAdmin.body?.slice(0, 200)}`);

    // C · sem Authorization → 401.
    const rNoAuth = await app.inject({ method: 'GET', url: '/economy/admin/policies' });
    record('C sem Authorization header → 401', rNoAuth.statusCode === 401, `status=${rNoAuth.statusCode}`);

    // D · isolamento cross-tenant: ADMIN de A nunca vê a policy de B; ADMIN de B nunca vê as de A.
    const idsFromA = idsAdmin;
    const rAdminB = await app.inject({ method: 'GET', url: '/economy/admin/policies', headers: ADMIN_B.headers });
    const idsFromB = ((rAdminB.json()?.data ?? []) as Array<{ id: string }>).map((p) => p.id);
    record(
      'D1 ADMIN de A NUNCA vê a policy fixture de B (cross-tenant leak assert)',
      !idsFromA.includes(policyB1),
      `idsFromA=${JSON.stringify(idsFromA)} policyB1=${policyB1}`
    );
    record(
      'D2 ADMIN de B só vê a PRÓPRIA policy (não as 2 de A) — isolamento nos dois sentidos',
      rAdminB.statusCode === 200 && idsFromB.includes(policyB1) && !idsFromB.includes(policyA1) && !idsFromB.includes(policyA2),
      `status=${rAdminB.statusCode} idsFromB=${JSON.stringify(idsFromB)}`
    );

    // E · Δbank = 0 (fatia Bank-free; rota é read-only).
    const bankFinal = await bankSnapshot();
    record('E Δbank = 0', bankFinal === bank0, `${bank0} → ${bankFinal}`);

    // F · guard estrutural verde.
    let guard = false;
    try { execSync('node scripts/audit-economic-policy-authority-boundary.mjs', { cwd, encoding: 'utf8' }); guard = true; } catch { guard = false; }
    record('F guard audit-economic-policy-authority-boundary verde', guard);
  } finally {
    await app.close();
  }

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${'═'.repeat(64)}`);
  console.log(`RESULTADO: ${results.length - failed.length}/${results.length} verdes`);
  if (failed.length > 0) {
    failed.forEach((f) => console.log(`  ❌ ${f.label} — ${f.reason ?? ''}`));
    await pool.end();
    process.exit(1);
  }
  console.log('✨ economic_policy:manage não é vocabulário fantasma — gateia de fato GET /economy/admin/policies (admin/não-admin/anônimo/cross-tenant provados); Δbank=0.');
  await pool.end();
  process.exit(0);
}

main().catch(async (e) => {
  console.error('💥 Erro não tratado:', e);
  try { await pool.end(); } catch { /* noop */ }
  process.exit(1);
});
