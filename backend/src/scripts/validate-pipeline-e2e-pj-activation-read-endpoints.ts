/**
 * E2E F-PJ-ACTIVATION-READ-ENDPOINTS — catálogo governado de seleção do par (DECISION-0098).
 *
 * 🔒 DB EFÊMERA. Guard duro: current_database() === EXPECTED_DATABASE_NAME e NUNCA 'unificard_dev'.
 *    Orquestrado por scripts/run-pj-activation-read-endpoints-ephemeral.ps1.
 *
 * Prova os read-models que alimentam o onboarding a montar (primary_company_type_id,
 * primary_concept_id):
 *   - GET /companies/operational-activation/company-types
 *   - GET /companies/operational-activation/company-types/:companyTypeId/concepts
 * Read-only: SEM businessType/businessCategory/hybrid/metadata; NÃO grava o par; sem DML.
 *
 * App mínimo = stack do protectedScope via app.inject. GET sob protectedScope herda o
 * action-context.plugin (exige header x-action-context) — honrado no teste.
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
  if (!/activation|read|endpoint|route|ephemeral|smoke|test/i.test(db)) throw new Error(`ABORT: nome de banco "${db}" não parece efêmero.`);
  if (!JWT_SECRET) throw new Error('ABORT: JWT_SECRET ausente — necessário para forjar token de teste.');
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

function mintToken(userId: string, tenantId: string, globalUserId: string): string {
  return jwt.sign(
    { sub: userId, userId, tenantId, email: `${userId}@e2e.local`, tokenVersion: 0, globalUserId, type: 'access' },
    JWT_SECRET as string,
    { expiresIn: '10m' }
  );
}

async function main(): Promise<void> {
  await assertEphemeralDb();

  const TENANT_ID = randomUUID();
  await tenantService.createTenant({ id: TENANT_ID, name: 'PJ Activation Read Test', slug: `pj-activation-read-${Date.now()}` });

  // Identidade canônica do usuário autenticado (chain p/ verifyAccessToken).
  const gid = randomUUID();
  const uid = randomUUID(); // users.id === users.user_id (invariante do schema)
  const cpf = String(Date.now()).padStart(11, '0').slice(-11);
  await pool.query(`INSERT INTO global_users (global_user_id, cpf, full_name, metadata) VALUES ($1,$2,'E2E Read','{}'::jsonb)`, [gid, cpf]);
  await pool.query(`INSERT INTO identities (global_user_id, tax_id, tax_id_type, kyc_status, kyc_level) VALUES ($1,$2,'cpf','pending','none')`, [gid, cpf]);
  await pool.query(`INSERT INTO users (id, user_id, tenant_id, global_user_id, email, password_hash, token_version) VALUES ($1,$1,$2,$3,$4,'x',0)`, [uid, TENANT_ID, gid, `${uid}@e2e.local`]);

  // Catálogo é migration-seeded (company_types em 0114 + pares em 20260416125000_concepts_estabelecimento
  // via INSERT...SELECT). NÃO semeio pares: leio os vivos. typeWithPairs = type que já tem allowed concepts;
  // expectedConcepts = conjunto soberano esperado. typeEmpty = company_type novo (sem pares) p/ provar 200 [].
  const tp = await pool.query<{ company_type_id: string }>(`SELECT company_type_id::text FROM company_type_allowed_concepts LIMIT 1`);
  if (tp.rowCount! < 1) throw new Error('precisa de ≥1 par em company_type_allowed_concepts (migration seed)');
  const typeWithPairs = tp.rows[0].company_type_id;
  const expected = await pool.query<{ concept_id: string }>(
    `SELECT a.concept_id::text FROM company_type_allowed_concepts a WHERE a.company_type_id=$1 ORDER BY a.concept_id`,
    [typeWithPairs]
  );
  const expectedConceptIds = new Set(expected.rows.map((r) => r.concept_id));
  // company_type fresco SEM pares (slug único; não é DML de companies/tco).
  const typeEmpty = randomUUID();
  await pool.query(`INSERT INTO company_types (id, name, slug, default_department_slugs, default_branch_slugs) VALUES ($1,$2,$3,ARRAY[]::text[],ARRAY[]::text[])`, [typeEmpty, `E2E Empty ${Date.now()}`, `e2e-empty-${Date.now()}`]);

  const companiesBefore = Number((await pool.query(`SELECT count(*)::int AS n FROM companies`)).rows[0].n);
  const tcoBefore = Number((await pool.query(`SELECT count(*)::int AS n FROM tenant_concept_offerings`)).rows[0].n);

  const token = mintToken(uid, TENANT_ID, gid);
  const acHeader = JSON.stringify({ actorId: uid, intent: 'company_operational_activation_catalog', source: 'e2e', scope: `tenant:${TENANT_ID}` });
  const headers = { authorization: `Bearer ${token}`, 'x-action-context': acHeader };

  const app = await buildMinimalApp();
  const get = (url: string) => app.inject({ method: 'GET', url, headers });

  try {
    // T1 — GET company-types → 200, ≥7, shape correto, sem chaves de legado
    const r1 = await get('/companies/operational-activation/company-types');
    const b1 = r1.json();
    record('T1 company-types → 200', r1.statusCode === 200, `status=${r1.statusCode}`);
    const list1: any[] = Array.isArray(b1?.data) ? b1.data : [];
    record('T1 retorna ≥7 company_types seedados', list1.length >= 7, `len=${list1.length}`);
    record('T1 item tem companyTypeId/slug/name', list1.length > 0 && typeof list1[0].companyTypeId === 'string' && typeof list1[0].slug === 'string' && typeof list1[0].name === 'string');
    const noLegacy = list1.every((t) => !('businessType' in t) && !('businessCategory' in t) && !('hybrid' in t) && !('metadata' in t));
    record('T1 payload sem businessType/businessCategory/hybrid/metadata', noLegacy);

    // T2 — concepts permitidos do typeWithPairs → 200, shape conceptId/slug/domain, EXATAMENTE os allowed
    const r2 = await get(`/companies/operational-activation/company-types/${typeWithPairs}/concepts`);
    const b2 = r2.json();
    record('T2 concepts(typeWithPairs) → 200', r2.statusCode === 200, `status=${r2.statusCode}`);
    const list2: any[] = Array.isArray(b2?.data) ? b2.data : [];
    const returnedIds = new Set(list2.map((c) => c.conceptId));
    const sameSet = returnedIds.size === expectedConceptIds.size && [...returnedIds].every((id) => expectedConceptIds.has(id as string));
    record('T2 retorna EXATAMENTE os concepts allowed (set soberano)', sameSet, `returned=${JSON.stringify([...returnedIds])} expected=${JSON.stringify([...expectedConceptIds])}`);
    record('T2 cada item tem conceptId/slug/domain', list2.length > 0 && list2.every((c) => typeof c.conceptId === 'string' && typeof c.slug === 'string' && typeof c.domain === 'string'));

    // T3 — company_type fresco SEM pares → 200 []
    const r3 = await get(`/companies/operational-activation/company-types/${typeEmpty}/concepts`);
    record('T3 company_type sem pares → 200 []', r3.statusCode === 200 && Array.isArray(r3.json()?.data) && r3.json().data.length === 0, `status=${r3.statusCode} body=${JSON.stringify(r3.json())}`);

    // T4 — companyTypeId não-uuid → 400 INVALID_COMPANY_TYPE_ID
    const r4 = await get('/companies/operational-activation/company-types/not-a-uuid/concepts');
    record('T4 companyTypeId inválido → 400', r4.statusCode === 400 && r4.json()?.code === 'INVALID_COMPANY_TYPE_ID', `status=${r4.statusCode} body=${JSON.stringify(r4.json())}`);

    // T5 — uuid válido inexistente → 404 COMPANY_TYPE_NOT_FOUND
    const r5 = await get(`/companies/operational-activation/company-types/${randomUUID()}/concepts`);
    record('T5 company_type inexistente → 404', r5.statusCode === 404 && r5.json()?.code === 'COMPANY_TYPE_NOT_FOUND', `status=${r5.statusCode} body=${JSON.stringify(r5.json())}`);

    // T6 — rota estática NÃO capturada por GET /:companyId (não retorna shape de empresa/404 empresa)
    record('T6 estática não cai em /:companyId (retorna catálogo, não 404 empresa)', r1.statusCode === 200 && list1.length >= 7);

    // T7 — nenhum DML (companies/tco inalterados)
    const companiesAfter = Number((await pool.query(`SELECT count(*)::int AS n FROM companies`)).rows[0].n);
    const tcoAfter = Number((await pool.query(`SELECT count(*)::int AS n FROM tenant_concept_offerings`)).rows[0].n);
    record('T7 sem DML em companies', companiesAfter === companiesBefore, `before=${companiesBefore} after=${companiesAfter}`);
    record('T7 sem DML em tenant_concept_offerings', tcoAfter === tcoBefore, `before=${tcoBefore} after=${tcoAfter}`);
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
  console.log('✨ Read-endpoints do catálogo de ativação PJ verdes.');
}

main().catch(async (e) => {
  console.error('💥 Erro não tratado:', e);
  try { await pool.end(); } catch { /* noop */ }
  process.exit(1);
});
