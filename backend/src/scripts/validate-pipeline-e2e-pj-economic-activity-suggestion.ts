/**
 * E2E F-PJ-ONBOARDING-WIZARD-ECONOMIC-ACTIVITY-SUGGESTION (B1 — backend read-only company-scoped).
 *
 * 🔒 DB EFÊMERA. Orquestrado por scripts/run-pj-economic-activity-suggestion-ephemeral.ps1.
 *
 * Prova o endpoint GET /companies/:companyId/economic-activity-suggestion:
 *   • company-scoped: frontend passa só companyId; backend resolve a EVIDÊNCIA FISCAL (fiscal_identity_economic_activities)
 *     e REUSA suggestConceptForCnae (CNAE = sinal/adapter BR; CONCEPT é SSOT);
 *   • atividade PRIMÁRIA escolhida; sem evidência/ambíguo/sem-sugestão → honest-empty com `reason`;
 *   • READ-ONLY: não escreve companies primary_ / publications; não ativa; não publica; Δbank=0;
 *   • autoridade canManageCompany (estranho → 403). CNAE nunca vira autoridade; nada autoativa.
 *
 * App mínimo = stack do protectedScope via app.inject (molde dos E2Es PJ). cnae_concept_suggestions vem do seed FULL.
 */
import 'tsconfig-paths/register';
import dotenv from 'dotenv';
import { join } from 'path';
import Fastify, { FastifyInstance } from 'fastify';
import sensible from '@fastify/sensible';
import jwt from 'jsonwebtoken';
import { randomUUID } from 'crypto';
import { pool } from '../core/database/pool';
import { tenantService } from '../core/tenants/tenant.service';
import { companiesModule } from '../core/companies/companies.module';
import authPlugin from '../core/auth/auth.plugin';
import { tenantPlugin } from '../plugins/tenant.plugin';
import { actionContextPlugin } from '../plugins/action-context.plugin';
import { rbacPlugin } from '../plugins/rbac.plugin';

dotenv.config({ path: join(process.cwd(), '.env') });

const EXPECTED = process.env.EXPECTED_DATABASE_NAME || '';
const JWT_SECRET = process.env.JWT_SECRET;
type Res = { label: string; ok: boolean; reason?: string };
const results: Res[] = [];
const record = (label: string, ok: boolean, reason?: string): void => {
  results.push({ label, ok, reason });
  console.log(`  ${ok ? '✅' : '❌'} ${label}${ok ? '' : ` — ${reason ?? ''}`}`);
};
const count = async (sql: string, p: unknown[] = []): Promise<number> => Number((await pool.query(sql, p)).rows[0].n);

async function assertEphemeralDb(): Promise<void> {
  const r = await pool.query<{ db: string }>('SELECT current_database() AS db');
  const db = r.rows[0]?.db;
  if (db === 'unificard_dev') throw new Error('ABORT: banco-alvo é "unificard_dev".');
  if (!EXPECTED || db !== EXPECTED) throw new Error(`ABORT: banco "${db}" ≠ EXPECTED "${EXPECTED}".`);
  if (!/economic|activity|suggestion|cnae|pj|ephemeral|smoke|test/i.test(db)) throw new Error(`ABORT: nome "${db}" não parece efêmero.`);
  if (!JWT_SECRET) throw new Error('ABORT: JWT_SECRET ausente.');
  console.log(`🔒 DB efêmera confirmada: ${db}`);
}

async function buildMinimalApp(): Promise<FastifyInstance> {
  const app = Fastify({ logger: false });
  await app.register(sensible);
  await app.register(authPlugin);
  await app.register(tenantPlugin);
  await app.register(actionContextPlugin);
  await app.register(rbacPlugin);
  await app.register(companiesModule, { prefix: '/companies' });
  await app.ready();
  return app;
}
const mintToken = (userId: string, tenantId: string, gid: string): string =>
  jwt.sign({ sub: userId, userId, tenantId, email: `${userId}@e2e.local`, tokenVersion: 0, globalUserId: gid, type: 'access' }, JWT_SECRET as string, { expiresIn: '10m' });

let seq = 0;
async function seedUser(tenantId: string, name: string): Promise<{ userId: string; gid: string }> {
  seq += 1;
  const gid = randomUUID();
  const userId = randomUUID();
  const cpf = String(Date.now() + seq).padStart(11, '0').slice(-11);
  await pool.query(`INSERT INTO global_users (global_user_id, cpf, full_name) VALUES ($1::uuid,$2,$3)`, [gid, cpf, name]);
  await pool.query(`INSERT INTO identities (global_user_id, tax_id, tax_id_type, kyc_status, kyc_level) VALUES ($1::uuid,$2,'cpf','approved','basic')`, [gid, cpf]);
  await pool.query(`INSERT INTO users (id, user_id, tenant_id, email, password_hash, token_version, is_test, global_user_id, created_at, updated_at) VALUES ($1::uuid,$1::uuid,$2::uuid,$3,'x',0,true,$4::uuid,NOW(),NOW())`, [userId, tenantId, `${name.toLowerCase()}-${seq}@e2e.local`, gid]);
  return { userId, gid };
}

/** company + fiscal_identity + membership owner (canManageCompany) + atividades econômicas test-only. */
async function seedCompany(tenantId: string, ownerGid: string, activities: { cnae: string; primary: boolean }[]): Promise<string> {
  seq += 1;
  const cnpj = String(Date.now() + seq).padStart(14, '0').slice(-14);
  const fid = (await pool.query<{ f: string }>(`INSERT INTO fiscal_identities (cnpj, kyb_status) VALUES ($1,'pending') RETURNING fiscal_identity_id::text AS f`, [cnpj])).rows[0].f;
  const companyId = (await pool.query<{ c: string }>(`INSERT INTO companies (tenant_id, company_name, fiscal_identity_id) VALUES ($1::uuid,$2,$3::uuid) RETURNING company_id::text AS c`, [tenantId, `Co ${seq}`, fid])).rows[0].c;
  await pool.query(`INSERT INTO company_users (tenant_id, company_id, global_user_id, role, can_manage_company, is_active, member_status) VALUES ($1::uuid,$2::uuid,$3::uuid,'owner',true,true,'active')`, [tenantId, companyId, ownerGid]);
  for (const a of activities) {
    await pool.query(
      `INSERT INTO fiscal_identity_economic_activities (fiscal_identity_id, cnae_code, cnae_description, is_primary, source, fetched_at) VALUES ($1::uuid,$2,$3,$4,'e2e-test-only',NOW())`,
      [fid, a.cnae, `atividade ${a.cnae}`, a.primary]
    );
  }
  return companyId;
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

  const TENANT_ID = randomUUID();
  await tenantService.createTenant({ id: TENANT_ID, name: 'Economic Activity Suggestion', slug: `eas-${Date.now()}` });

  // CNAE seedado pelo FULL (cnae_concept_suggestions): 4711302 → varejo-alimentar-integrado (supermercado, approved).
  const SEEDED_CNAE = (await pool.query<{ c: string }>(`SELECT cnae_code AS c FROM cnae_concept_suggestions WHERE review_status='approved' AND is_active=true ORDER BY cnae_code LIMIT 1`)).rows[0]?.c;
  if (!SEEDED_CNAE) throw new Error('seed FULL não trouxe cnae_concept_suggestions approved.');
  const expectedConcept = (await pool.query<{ id: string }>(`SELECT suggested_concept_id::text AS id FROM cnae_concept_suggestions WHERE cnae_code=$1 AND review_status='approved' AND is_active=true LIMIT 1`, [SEEDED_CNAE])).rows[0].id;

  const owner = await seedUser(TENANT_ID, 'Owner');
  const stranger = await seedUser(TENANT_ID, 'Stranger');
  const app = await buildMinimalApp();
  const ac = (gid: string) => JSON.stringify({ actorId: gid, intent: 'eas_e2e', source: 'e2e', scope: `tenant:${TENANT_ID}` });
  const getSuggestion = (companyId: string, u: { userId: string; gid: string }) =>
    app.inject({ method: 'GET', url: `/companies/${companyId}/economic-activity-suggestion`, headers: { authorization: `Bearer ${mintToken(u.userId, TENANT_ID, u.gid)}`, 'x-action-context': ac(u.gid) } });

  const bankBefore = await count(`SELECT ((SELECT count(*) FROM bank_ledger)+(SELECT count(*) FROM bank_transactions)+(SELECT count(*) FROM bank_splits)+(SELECT count(*) FROM bank_accounts))::int AS n`);

  try {
    // ── T1 — atividade primária com CNAE seedado → sugere o concept ──
    {
      const co = await seedCompany(TENANT_ID, owner.gid, [{ cnae: SEEDED_CNAE, primary: true }, { cnae: '0000001', primary: false }]);
      const r = await getSuggestion(co, owner);
      const d = r.json()?.data;
      record('T1 atividade primária (CNAE seedado) → sugestão company-scoped do concept',
        r.statusCode === 200 && d?.suggestion?.suggestedConceptId === expectedConcept && d?.countryCode === 'BR' && d?.classifierSystem === 'CNAE',
        `status=${r.statusCode} concept=${d?.suggestion?.suggestedConceptId}`);
    }
    // ── T2 — sem evidência fiscal → null honesto ──
    {
      const co = await seedCompany(TENANT_ID, owner.gid, []);
      const d = (await getSuggestion(co, owner)).json()?.data;
      record('T2 sem evidência econômica → suggestion=null reason=NO_ECONOMIC_ACTIVITY_EVIDENCE', d?.suggestion === null && d?.reason === 'NO_ECONOMIC_ACTIVITY_EVIDENCE', JSON.stringify(d));
    }
    // ── T3 — CNAE sem sugestão aprovada → null honesto ──
    {
      const co = await seedCompany(TENANT_ID, owner.gid, [{ cnae: '9999999', primary: true }]);
      const d = (await getSuggestion(co, owner)).json()?.data;
      record('T3 CNAE sem sugestão aprovada → suggestion=null reason=NO_APPROVED_SUGGESTION', d?.suggestion === null && d?.reason === 'NO_APPROVED_SUGGESTION', JSON.stringify(d));
    }
    // ── T4 — múltiplas atividades sem primária → ambíguo honesto ──
    {
      const co = await seedCompany(TENANT_ID, owner.gid, [{ cnae: SEEDED_CNAE, primary: false }, { cnae: '0000002', primary: false }]);
      const d = (await getSuggestion(co, owner)).json()?.data;
      record('T4 múltiplas atividades sem primária → suggestion=null reason=AMBIGUOUS_ECONOMIC_ACTIVITY', d?.suggestion === null && d?.reason === 'AMBIGUOUS_ECONOMIC_ACTIVITY', JSON.stringify(d));
    }
    // ── T5 — sem autoridade (estranho sem membership) → 403 ──
    {
      const co = await seedCompany(TENANT_ID, owner.gid, [{ cnae: SEEDED_CNAE, primary: true }]);
      const r = await getSuggestion(co, stranger);
      let code: string | undefined; try { code = r.json()?.code; } catch { /* noop */ }
      record('T5 sem autoridade de gestão → 403 ECONOMIC_ACTIVITY_SUGGESTION_FORBIDDEN', r.statusCode === 403 && code === 'ECONOMIC_ACTIVITY_SUGGESTION_FORBIDDEN', `status=${r.statusCode} code=${code}`);
    }
    // ── T6 — READ-ONLY: rota não escreve companies.primary_* nem publications ──
    {
      const co = await seedCompany(TENANT_ID, owner.gid, [{ cnae: SEEDED_CNAE, primary: true }]);
      await getSuggestion(co, owner);
      const row = (await pool.query<{ t: string | null; c: string | null }>(`SELECT primary_company_type_id::text AS t, primary_concept_id::text AS c FROM companies WHERE company_id=$1`, [co])).rows[0];
      const pubs = await count(`SELECT count(*)::int AS n FROM company_concept_publications WHERE company_id=$1`, [co]);
      record('T6 rota READ-ONLY: primary_* não escrito, zero publicação', row?.t === null && row?.c === null && pubs === 0, `primary_type=${row?.t} primary_concept=${row?.c} pubs=${pubs}`);
    }
  } finally {
    await app.close();
  }

  // ── T7 — Δbank=0 ──
  const bankAfter = await count(`SELECT ((SELECT count(*) FROM bank_ledger)+(SELECT count(*) FROM bank_transactions)+(SELECT count(*) FROM bank_splits)+(SELECT count(*) FROM bank_accounts))::int AS n`);
  record('T7 Δbank=0 (rota não toca dinheiro)', bankAfter === bankBefore, `before=${bankBefore} after=${bankAfter}`);
  // ── T8 — zero availability/schedules ──
  const av = await count(`SELECT (SELECT count(*) FROM availability)::int AS n`);
  const sc = await count(`SELECT (SELECT count(*) FROM schedules)::int AS n`).catch(() => 0);
  record('T8 zero availability/schedules (sem calendar)', av === 0 && sc === 0, `avail=${av} sched=${sc}`);

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${'═'.repeat(64)}`);
  console.log(`RESULTADO: ${results.length - failed.length}/${results.length} verdes`);
  if (failed.length > 0) {
    console.log('FALHAS:'); failed.forEach((f) => console.log(`  ❌ ${f.label} — ${f.reason ?? ''}`));
    await pool.end(); process.exit(1);
  }
  await pool.end();
  console.log('✨ economic-activity-suggestion company-scoped, read-only, honest-empty, autoridade canManageCompany; CNAE=sinal, CONCEPT=SSOT; Δbank=0.');
}

main().catch(async (e) => { console.error('💥 Erro não tratado:', e); try { await pool.end(); } catch { /* noop */ } process.exit(1); });
