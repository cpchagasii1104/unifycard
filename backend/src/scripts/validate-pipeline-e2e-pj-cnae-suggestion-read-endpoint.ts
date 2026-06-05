/**
 * E2E F-PJ-CNAE-TO-CONCEPT-SUGGESTION-READ-ENDPOINT (DECISION-0104).
 *
 * 🔒 DB EFÊMERA. Guard duro: current_database() === EXPECTED_DATABASE_NAME e NUNCA 'unificard_dev'.
 *    Orquestrado por scripts/run-pj-cnae-suggestion-read-endpoint-ephemeral.ps1.
 *
 * Prova (read-only): CNAE com/sem máscara → mesma sugestão; CNAE inválido → 400 limpo; CNAE válido
 * sem sugestão → 200 data=null (vazio honesto, sem fallback); 8 sugestões curadas intactas; endpoint
 * NÃO escreve ativação/publicação; Bank/companies.primary_* intocados; companyType derivado com segurança.
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
  if (!/cnae|suggestion|endpoint|ephemeral|smoke|test/i.test(db)) throw new Error(`ABORT: nome de banco "${db}" não parece efêmero.`);
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
  await tenantService.createTenant({ id: TENANT_ID, name: 'CNAE Suggestion Test', slug: `cnae-sugg-${Date.now()}` });

  const ownerGlobalId = randomUUID();
  const ownerUserId = randomUUID();
  const ownerCpf = String(Date.now()).padStart(11, '0').slice(-11);
  await pool.query(`INSERT INTO global_users (global_user_id, cpf, full_name, metadata) VALUES ($1,$2,'E2E Sugg Owner','{}'::jsonb)`, [ownerGlobalId, ownerCpf]);
  await pool.query(`INSERT INTO identities (global_user_id, tax_id, tax_id_type, kyc_status, kyc_level) VALUES ($1,$2,'cpf','pending','none')`, [ownerGlobalId, ownerCpf]);
  await pool.query(`INSERT INTO users (id, user_id, tenant_id, global_user_id, email, password_hash, token_version) VALUES ($1,$1,$2,$3,$4,'x',0)`, [ownerUserId, TENANT_ID, ownerGlobalId, `${ownerUserId}@e2e.local`]);

  // Snapshots de não-toque.
  const seededBefore = Number((await pool.query(`SELECT count(*)::int AS n FROM cnae_concept_suggestions`)).rows[0].n);
  const primaryBefore = Number((await pool.query(`SELECT count(*)::int AS n FROM companies WHERE primary_company_type_id IS NOT NULL OR primary_concept_id IS NOT NULL`)).rows[0].n);
  const ccpBefore = Number((await pool.query(`SELECT count(*)::int AS n FROM company_concept_publications`)).rows[0].n);
  const tcoBefore = Number((await pool.query(`SELECT count(*)::int AS n FROM tenant_concept_offerings`)).rows[0].n);
  const bankBefore = Number((await pool.query(`SELECT ((SELECT count(*) FROM bank_ledger)+(SELECT count(*) FROM bank_transactions))::int AS n`)).rows[0].n);

  record('0 seed γ presente (8 sugestões curadas)', seededBefore === 8, `n=${seededBefore}`);

  const token = mintToken(ownerUserId, TENANT_ID, ownerGlobalId);
  const acHeader = JSON.stringify({ actorId: ownerUserId, intent: 'cnae_suggestion_read', source: 'e2e', scope: `tenant:${TENANT_ID}` });
  const headers = { authorization: `Bearer ${token}`, 'x-action-context': acHeader };

  const app = await buildMinimalApp();
  const get = (cnae: string) => app.inject({ method: 'GET', url: `/companies/operational-activation/cnae-suggestion?cnae=${encodeURIComponent(cnae)}`, headers });

  try {
    // ═══ 1 — sem máscara: 4711302 → supermercado (varejo-alimentar-integrado) ═══
    const rPlain = await get('4711302');
    const bPlain = rPlain.json();
    record('1a sem máscara → 200', rPlain.statusCode === 200, `status=${rPlain.statusCode}`);
    const sPlain = bPlain?.data;
    record('1b sugestão = varejo-alimentar-integrado [high]', sPlain?.suggestedConceptSlug === 'varejo-alimentar-integrado' && sPlain?.confidence === 'high', JSON.stringify(sPlain));
    record('1c normalizedCnaeCode=4711302 + source/version presentes', sPlain?.normalizedCnaeCode === '4711302' && !!sPlain?.source && !!sPlain?.version);
    record('1d companyType derivado com segurança (supermercado)', sPlain?.companyTypeSlug === 'supermercado' && !!sPlain?.companyTypeId);
    record('1e displayName = "Supermercado" (JOIN concept_labels)', sPlain?.suggestedConceptDisplayName === 'Supermercado', JSON.stringify(sPlain?.suggestedConceptDisplayName));

    // ═══ 2 — com máscara: 4711-3/02 → MESMA sugestão ═══
    const rMask = await get('4711-3/02');
    const bMask = rMask.json();
    record('2 com máscara → 200 + MESMA sugestão (normalização)', rMask.statusCode === 200 && bMask?.data?.suggestedConceptId === sPlain?.suggestedConceptId && bMask?.data?.normalizedCnaeCode === '4711302', `status=${rMask.statusCode}`);

    // ═══ 3 — CNAE inválido → 400 limpo ═══
    const rBad = await get('123');
    record('3 CNAE inválido (123) → 400 INVALID_CNAE', rBad.statusCode === 400 && rBad.json()?.code === 'INVALID_CNAE', `status=${rBad.statusCode}`);
    const rBad2 = await get('abc/def');
    record('3b CNAE não-numérico → 400 INVALID_CNAE', rBad2.statusCode === 400 && rBad2.json()?.code === 'INVALID_CNAE', `status=${rBad2.statusCode}`);

    // ═══ 4 — CNAE válido SEM sugestão → 200 data=null (vazio honesto, sem fallback) ═══
    const rNone = await get('9999999');
    const bNone = rNone.json();
    record('4 válido sem sugestão → 200 data=null (sem fallback)', rNone.statusCode === 200 && bNone?.ok === true && bNone?.data === null, `status=${rNone.statusCode} data=${JSON.stringify(bNone?.data)}`);

    // ═══ 5 — outra vertical: 9602501 → salão (servicos-pessoais-beleza) + displayName ═══
    const rSalon = await get('9602-5/01');
    record('5 9602-5/01 (máscara) → salão + displayName "Salão de Beleza / Estética"',
      rSalon.json()?.data?.suggestedConceptSlug === 'servicos-pessoais-beleza'
      && rSalon.json()?.data?.companyTypeSlug === 'salao'
      && rSalon.json()?.data?.suggestedConceptDisplayName === 'Salão de Beleza / Estética',
      JSON.stringify(rSalon.json()?.data));

    // ═══ 7 — listAllowedConceptsForCompanyType expõe displayName ═══
    const rTypes = await app.inject({ method: 'GET', url: '/companies/operational-activation/company-types', headers });
    const superType = (rTypes.json()?.data ?? []).find((t: any) => t.slug === 'supermercado');
    const rConcepts = await app.inject({ method: 'GET', url: `/companies/operational-activation/company-types/${superType.companyTypeId}/concepts`, headers });
    const conceptList: any[] = rConcepts.json()?.data ?? [];
    const superConcept = conceptList.find((c) => c.slug === 'varejo-alimentar-integrado');
    record('7 allowed-concepts expõe displayName "Supermercado" (+ shortLabel)',
      superConcept?.displayName === 'Supermercado' && superConcept?.shortLabel === 'Supermercado',
      JSON.stringify(superConcept));

    // ═══ 8 — fallback honesto: concept SEM label → displayName null (sem derivar do slug) ═══
    const unlabeled = (await pool.query<{ c: string }>(
      `SELECT c.concept_id::text AS c FROM concepts c
        WHERE NOT EXISTS (SELECT 1 FROM concept_labels cl WHERE cl.concept_id=c.concept_id) LIMIT 1`
    )).rows[0].c;
    await pool.query(
      `INSERT INTO cnae_concept_suggestions (cnae_code, suggested_concept_id, confidence, rationale, source, catalog_version, review_status)
       VALUES ('1234567', $1::uuid, 'high', 'teste fallback', 'e2e', 'e2e', 'approved')`, [unlabeled]
    );
    const rUnlabeled = await get('1234567');
    record('8 concept sem label → suggestedConceptDisplayName=null (fallback honesto)',
      rUnlabeled.statusCode === 200 && rUnlabeled.json()?.data?.suggestedConceptDisplayName === null
      && typeof rUnlabeled.json()?.data?.suggestedConceptId === 'string',
      JSON.stringify(rUnlabeled.json()?.data));
  } finally {
    await app.close();
  }

  // ═══ 6 — invariantes de não-toque ═══
  record('6a 8 sugestões curadas intactas', Number((await pool.query(`SELECT count(*)::int AS n FROM cnae_concept_suggestions WHERE source='clayton_curated_mvp_2026_06_05'`)).rows[0].n) === seededBefore);
  record('6b nenhuma companies.primary_* escrita', Number((await pool.query(`SELECT count(*)::int AS n FROM companies WHERE primary_company_type_id IS NOT NULL OR primary_concept_id IS NOT NULL`)).rows[0].n) === primaryBefore);
  record('6c company_concept_publications intocado', Number((await pool.query(`SELECT count(*)::int AS n FROM company_concept_publications`)).rows[0].n) === ccpBefore);
  record('6d tenant_concept_offerings intocado', Number((await pool.query(`SELECT count(*)::int AS n FROM tenant_concept_offerings`)).rows[0].n) === tcoBefore);
  record('6e Bank intocado', Number((await pool.query(`SELECT ((SELECT count(*) FROM bank_ledger)+(SELECT count(*) FROM bank_transactions))::int AS n`)).rows[0].n) === bankBefore);

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${'═'.repeat(64)}`);
  console.log(`RESULTADO: ${results.length - failed.length}/${results.length} verdes`);
  if (failed.length > 0) {
    console.log('FALHAS:');
    failed.forEach((f) => console.log(`  ❌ ${f.label} — ${f.reason ?? ''}`));
    await pool.end();
    process.exit(1);
  }
  await pool.end();
  console.log('✨ Read endpoint CNAE→concept: todos os cenários verdes.');
}

main().catch(async (e) => {
  console.error('💥 Erro não tratado:', e);
  try { await pool.end(); } catch { /* noop */ }
  process.exit(1);
});
