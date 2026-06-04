/**
 * E2E F-PJ-ONBOARDING-ACTIVATION-FLOW (cadeia completa, DECISION-0098).
 *
 * 🔒 DB EFÊMERA. Guard duro: current_database() === EXPECTED_DATABASE_NAME e NUNCA 'unificard_dev'.
 *    Orquestrado por scripts/run-pj-onboarding-activation-flow-ephemeral.ps1.
 *
 * Prova, em UMA execução, a cadeia que o onboarding frontend exercita:
 *   GET /companies/operational-activation/company-types
 *     → escolhe um companyTypeId REAL do catálogo (sem hardcode de UUID)
 *   GET /companies/operational-activation/company-types/:companyTypeId/concepts
 *     → escolhe um conceptId REAL permitido
 *   POST /companies/:companyId/operational-activation { companyTypeId, conceptId }
 *     → grava o par soberano (primary_company_type_id, primary_concept_id)
 *   + invariantes de não-toque (tco/company_status/fiscal_identities/Bank/metadata).
 *
 * App mínimo = stack do protectedScope via app.inject (mesmo molde dos E2Es PJ).
 * NÃO altera runtime de produto. Bank/marketplace nem são registrados.
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

async function assertEphemeralDb(): Promise<void> {
  const r = await pool.query<{ db: string }>('SELECT current_database() AS db');
  const db = r.rows[0]?.db;
  if (db === 'unificard_dev') throw new Error('ABORT: banco-alvo é "unificard_dev" — esta validação NUNCA toca DEV.');
  if (!EXPECTED || db !== EXPECTED) throw new Error(`ABORT: banco-alvo "${db}" ≠ EXPECTED_DATABASE_NAME "${EXPECTED}".`);
  if (!/activation|onboarding|flow|ephemeral|smoke|test/i.test(db)) throw new Error(`ABORT: nome de banco "${db}" não parece efêmero.`);
  if (!JWT_SECRET) throw new Error('ABORT: JWT_SECRET ausente — necessário para forjar token de teste.');
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

function mintToken(userId: string, tenantId: string, globalUserId: string): string {
  return jwt.sign(
    { sub: userId, userId, tenantId, email: `${userId}@e2e.local`, tokenVersion: 0, globalUserId, type: 'access' },
    JWT_SECRET as string,
    { expiresIn: '10m' }
  );
}

async function main(): Promise<void> {
  await assertEphemeralDb();
  await bootstrapSocialPorts();

  const TENANT_ID = randomUUID();
  await tenantService.createTenant({ id: TENANT_ID, name: 'PJ Onboarding Flow Test', slug: `pj-onboarding-flow-${Date.now()}` });

  // ── Identidade canônica do owner (chain identity → user) ──────────────────
  const ownerGlobalId = randomUUID();
  const ownerUserId = randomUUID(); // users.id === users.user_id (invariante do schema)
  const ownerCpf = String(Date.now()).padStart(11, '0').slice(-11);
  await pool.query(`INSERT INTO global_users (global_user_id, cpf, full_name, metadata) VALUES ($1,$2,'E2E Flow Owner','{}'::jsonb)`, [ownerGlobalId, ownerCpf]);
  await pool.query(`INSERT INTO identities (global_user_id, tax_id, tax_id_type, kyc_status, kyc_level) VALUES ($1,$2,'cpf','pending','none')`, [ownerGlobalId, ownerCpf]);
  await pool.query(`INSERT INTO users (id, user_id, tenant_id, global_user_id, email, password_hash, token_version) VALUES ($1,$1,$2,$3,$4,'x',0)`, [ownerUserId, TENANT_ID, ownerGlobalId, `${ownerUserId}@e2e.local`]);

  // ── Empresas inertes (INSERT direto, Momento 1) + membership ──────────────
  const mkCompany = async (name: string): Promise<string> => {
    const r = await pool.query<{ company_id: string }>(`INSERT INTO companies (tenant_id, company_name) VALUES ($1,$2) RETURNING company_id::text`, [TENANT_ID, name]);
    return r.rows[0].company_id;
  };
  const companyId = await mkCompany('E2E Flow C1 (owner-manage)');
  await pool.query(
    `INSERT INTO company_users (tenant_id, company_id, global_user_id, role, can_manage_company, is_active, member_status)
     VALUES ($1,$2,$3,'owner',true,true,'active')`,
    [TENANT_ID, companyId, ownerGlobalId]
  );
  const companyNoAuth = await mkCompany('E2E Flow C2 (sem membership do owner)'); // owner não é membro → 403

  // Snapshots de não-toque (antes da ativação).
  const statusBefore = (await pool.query<{ s: string | null }>(`SELECT company_status::text AS s FROM companies WHERE company_id=$1`, [companyId])).rows[0].s;
  const fiscalBefore = (await pool.query<{ f: string | null }>(`SELECT fiscal_identity_id::text AS f FROM companies WHERE company_id=$1`, [companyId])).rows[0].f;
  const tcoBefore = Number((await pool.query(`SELECT count(*)::int AS n FROM tenant_concept_offerings`)).rows[0].n);
  const bankTxBefore = Number((await pool.query(`SELECT count(*)::int AS n FROM bank_transactions`)).rows[0].n);
  const fiscalCountBefore = Number((await pool.query(`SELECT count(*)::int AS n FROM fiscal_identities`)).rows[0].n);

  const token = mintToken(ownerUserId, TENANT_ID, ownerGlobalId);
  const acHeader = JSON.stringify({ actorId: ownerUserId, intent: 'company_operational_activation_flow', source: 'e2e', scope: `tenant:${TENANT_ID}` });
  const headers = { authorization: `Bearer ${token}`, 'x-action-context': acHeader };

  const app = await buildMinimalApp();
  const get = (url: string) => app.inject({ method: 'GET', url, headers });
  const post = (companyIdArg: string, body: unknown) =>
    app.inject({ method: 'POST', url: `/companies/${companyIdArg}/operational-activation`, headers, payload: body as object });

  try {
    // ═══ 1) GET catálogo de company-types ════════════════════════════════════
    const rTypes = await get('/companies/operational-activation/company-types');
    const bTypes = rTypes.json();
    record('1 GET company-types → 200', rTypes.statusCode === 200, `status=${rTypes.statusCode}`);
    const types: any[] = Array.isArray(bTypes?.data) ? bTypes.data : [];
    record('1 catálogo retorna company_types', types.length > 0, `len=${types.length}`);
    const noLegacyTypes = types.every((t) => !('businessType' in t) && !('businessCategory' in t) && !('serviceCategories' in t) && !('hybrid' in t) && !('metadata' in t));
    record('1 catálogo SEM businessType/businessCategory/serviceCategories/hybrid/metadata', noLegacyTypes);

    // ═══ 2/3) escolher o 1º type COM concepts (sem hardcode de UUID) ═════════
    let chosenTypeId = '';
    let chosenConceptId = '';
    let conceptsPayloadOk = true;
    for (const t of types) {
      const rc = await get(`/companies/operational-activation/company-types/${t.companyTypeId}/concepts`);
      if (rc.statusCode !== 200) continue;
      const list: any[] = Array.isArray(rc.json()?.data) ? rc.json().data : [];
      if (list.length > 0) {
        chosenTypeId = t.companyTypeId;
        chosenConceptId = list[0].conceptId;
        // shape + ausência de legado nos concepts escolhidos
        conceptsPayloadOk = list.every((c) => typeof c.conceptId === 'string' && typeof c.slug === 'string' && typeof c.domain === 'string'
          && !('businessType' in c) && !('hybrid' in c) && !('metadata' in c));
        break;
      }
    }
    record('2 escolheu companyTypeId real do catálogo (sem hardcode)', chosenTypeId !== '', `typeId=${chosenTypeId}`);
    record('3 escolheu conceptId real permitido', chosenConceptId !== '', `conceptId=${chosenConceptId}`);
    record('3 concepts {conceptId,slug,domain} sem legado', conceptsPayloadOk);
    if (!chosenTypeId || !chosenConceptId) throw new Error('catálogo não forneceu par — seed/migração inconsistente');

    // confirma que o par escolhido está mesmo em company_type_allowed_concepts
    const pairExists = (await pool.query<{ n: number }>(
      `SELECT count(*)::int AS n FROM company_type_allowed_concepts WHERE company_type_id=$1 AND concept_id=$2`,
      [chosenTypeId, chosenConceptId]
    )).rows[0].n;
    record('3 par escolhido ∈ company_type_allowed_concepts', pairExists === 1, `n=${pairExists}`);

    // ═══ 6/8) POST ativação com o par escolhido ══════════════════════════════
    const rAct = await post(companyId, { companyTypeId: chosenTypeId, conceptId: chosenConceptId });
    const bAct = rAct.json();
    record('6 POST ativação → 200', rAct.statusCode === 200, `status=${rAct.statusCode} body=${JSON.stringify(bAct)}`);
    record('8 response primaryCompanyTypeId = type escolhido', bAct?.data?.primaryCompanyTypeId === chosenTypeId);
    record('8 response primaryConceptId = concept escolhido', bAct?.data?.primaryConceptId === chosenConceptId);
    record('8 alreadyActive=false na 1ª chamada', bAct?.data?.alreadyActive === false);
    record('8 response traz pageActorId', typeof bAct?.data?.pageActorId === 'string' && bAct.data.pageActorId.length > 0);

    // ═══ 9) idempotência — mesmo par ═════════════════════════════════════════
    const rAct2 = await post(companyId, { companyTypeId: chosenTypeId, conceptId: chosenConceptId });
    record('9 POST mesmo par → 200 alreadyActive=true', rAct2.statusCode === 200 && rAct2.json()?.data?.alreadyActive === true, `status=${rAct2.statusCode}`);

    // ═══ 10) persistência + invariantes de não-toque ═════════════════════════
    // companies NÃO tem coluna metadata (a verdade operacional é o par; metadata/businessType
    // é preocupação do frontend, coberta nos greps da fatia de onboarding). A rota de ativação
    // toca SOMENTE primary_* + updated_at — provado pelos invariantes de não-toque abaixo.
    const persisted = (await pool.query<{ t: string | null; c: string | null; s: string | null; f: string | null }>(
      `SELECT primary_company_type_id::text AS t, primary_concept_id::text AS c, company_status::text AS s, fiscal_identity_id::text AS f FROM companies WHERE company_id=$1`,
      [companyId]
    )).rows[0];
    record('10 companies.primary_company_type_id persistido', persisted.t === chosenTypeId, `got=${persisted.t}`);
    record('10 companies.primary_concept_id persistido', persisted.c === chosenConceptId, `got=${persisted.c}`);
    record('10 company_status NÃO alterado', persisted.s === statusBefore, `before=${statusBefore} after=${persisted.s}`);
    record('10 fiscal_identity_id NÃO alterado (kyb intocado)', persisted.f === fiscalBefore, `before=${fiscalBefore} after=${persisted.f}`);

    const tcoAfter = Number((await pool.query(`SELECT count(*)::int AS n FROM tenant_concept_offerings`)).rows[0].n);
    record('10 tenant_concept_offerings NÃO escrito', tcoAfter === tcoBefore && tcoAfter === 0, `before=${tcoBefore} after=${tcoAfter}`);
    const bankTxAfter = Number((await pool.query(`SELECT count(*)::int AS n FROM bank_transactions`)).rows[0].n);
    record('10 Bank NÃO tocado (bank_transactions inalterado)', bankTxAfter === bankTxBefore, `before=${bankTxBefore} after=${bankTxAfter}`);
    const fiscalCountAfter = Number((await pool.query(`SELECT count(*)::int AS n FROM fiscal_identities`)).rows[0].n);
    record('10 fiscal_identities NÃO escrito', fiscalCountAfter === fiscalCountBefore, `before=${fiscalCountBefore} after=${fiscalCountAfter}`);

    // ═══ 12) autoridade — owner sem membership em C2 → 403 ════════════════════
    const rForbidden = await post(companyNoAuth, { companyTypeId: chosenTypeId, conceptId: chosenConceptId });
    record('12 sem autoridade contextual → 403', rForbidden.statusCode === 403 && rForbidden.json()?.code === 'COMPANY_OPERATIONAL_ACTIVATION_FORBIDDEN', `status=${rForbidden.statusCode} body=${JSON.stringify(rForbidden.json())}`);

    // ═══ 13) body inválido → 400 ═════════════════════════════════════════════
    const rBad = await post(companyId, { companyTypeId: chosenTypeId });
    record('13 body inválido (sem conceptId) → 400 INVALID_BODY', rBad.statusCode === 400 && rBad.json()?.code === 'INVALID_BODY', `status=${rBad.statusCode}`);
  } finally {
    await app.close();
  }

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${'═'.repeat(60)}`);
  console.log(`RESULTADO: ${results.length - failed.length}/${results.length} verdes`);
  if (failed.length > 0) {
    console.log('FALHAS:');
    failed.forEach((f) => console.log(`  ❌ ${f.label} — ${f.reason ?? ''}`));
    await pool.end();
    process.exit(1);
  }
  await pool.end();
  console.log('✨ Fluxo encadeado de ativação operacional PJ verde.');
}

main().catch(async (e) => {
  console.error('💥 Erro não tratado:', e);
  try { await pool.end(); } catch { /* noop */ }
  process.exit(1);
});
