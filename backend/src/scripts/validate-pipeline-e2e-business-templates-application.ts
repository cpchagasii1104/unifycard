/**
 * E2E CP3 F-CANONICAL-CATALOG-BUSINESS-TEMPLATES-AND-OFFERING-CLOSURE — templates
 * empresariais versionados e aplicação manual-assistida (DECISION-0117 E), HTTP real.
 *
 * 🔒 DB EFÊMERA. Orquestrado por scripts/run-business-templates-ephemeral.ps1.
 *
 * Prova (GO §9.4):
 *   - supermercado recebe composição AMPLA; distribuidora recebe SÓ o recorte de
 *     bebidas; salão recebe serviços/agenda (templates por REFERÊNCIA a slugs vivos);
 *   - recomendação deriva do company_type da empresa CLASSIFICADA (sugestão; nunca auto-aplica);
 *   - aplicação registra template+versão+empresa+actor+timestamp+módulos (auditável);
 *   - repetir aplicação é IDEMPOTENTE (mesma linha; alreadyApplied);
 *   - personalização da empresa NÃO altera o template canônico;
 *   - template atualizado (v2) NÃO reescreve aplicações antigas (apontam v1, imutável);
 *   - aplicar exige canManageCompany (membro sem gestão → 403); actor por LEITURA (sem cura);
 *   - NENHUMA oferta/estoque/preço/agenda nasce do template; NENHUMA autoridade nasce;
 *   - zero Bank writer.
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
import { rbacService } from '../core/rbac/rbac.service';
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
  if (db === 'unificard_dev') throw new Error('ABORT: banco-alvo é "unificard_dev".');
  if (!EXPECTED || db !== EXPECTED) throw new Error(`ABORT: banco "${db}" ≠ EXPECTED "${EXPECTED}".`);
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
  await app.register(companiesModule, { prefix: '/companies' });
  const companyTemplatesRoutes = (await import('../core/companies/company-templates.routes')).default;
  await app.register(companyTemplatesRoutes, { prefix: '/companies' });
  await app.ready();
  return app;
}

function makeValidCnpj(seed: number): string {
  const base = String(seed).padStart(8, '0').slice(-8) + '0001';
  const calc = (nums: string): number => {
    const weights = nums.length === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const sum = nums.split('').reduce((acc, d, i) => acc + parseInt(d, 10) * weights[i], 0);
    const mod = sum % 11;
    return mod < 2 ? 0 : 11 - mod;
  };
  const d1 = calc(base);
  const d2 = calc(base + String(d1));
  return base + String(d1) + String(d2);
}

interface Human { globalId: string; userId: string; actorId: string; headers: Record<string, string> }

async function main(): Promise<void> {
  await assertEphemeralDb();
  await bootstrapSocialPorts();

  const TENANT_ID = randomUUID();
  await tenantService.createTenant({ id: TENANT_ID, name: 'Business Templates Test', slug: `business-templates-${Date.now()}` });
  await rbacService.seedDefaultRBAC(TENANT_ID);

  const { socialPortsRegistry } = await import('../core/social/ports-registry');
  const actorRepo = socialPortsRegistry.getActorRepository();

  let cpfSeq = Date.now() % 100000000;
  const mkHuman = async (name: string): Promise<Human> => {
    const globalId = randomUUID();
    const userId = randomUUID();
    const cpf = String(cpfSeq++).padStart(11, '0').slice(-11);
    await pool.query(`INSERT INTO global_users (global_user_id, cpf, full_name, metadata) VALUES ($1,$2,$3,'{}'::jsonb)`, [globalId, cpf, name]);
    await pool.query(`INSERT INTO identities (global_user_id, tax_id, tax_id_type, kyc_status, kyc_level) VALUES ($1,$2,'cpf','pending','none')`, [globalId, cpf]);
    await pool.query(`INSERT INTO users (id, user_id, tenant_id, global_user_id, email, password_hash, token_version) VALUES ($1,$1,$2,$3,$4,'x',0)`, [userId, TENANT_ID, globalId, `${userId}@e2e.local`]);
    const actorId = (await actorRepo.findOrCreateUserActor(TENANT_ID, userId)).actor_id;
    const token = jwt.sign(
      { sub: userId, userId, tenantId: TENANT_ID, email: `${userId}@e2e.local`, tokenVersion: 0, globalUserId: globalId, type: 'access' },
      JWT_SECRET as string,
      { expiresIn: '15m' }
    );
    const ac = JSON.stringify({ actorId, intent: 'templates_e2e', source: 'e2e', scope: `tenant:${TENANT_ID}` });
    return { globalId, userId, actorId, headers: { authorization: `Bearer ${token}`, 'x-action-context': ac } };
  };

  const FS = await mkHuman('E2E Tpl Founder Super');
  const FD = await mkHuman('E2E Tpl Founder Distrib');
  const FB = await mkHuman('E2E Tpl Founder Salao');
  const M = await mkHuman('E2E Tpl Member NoManage');

  const app = await buildApp();
  const seedBase = Date.now() % 90000000;

  const createCompany = async (h: Human, seed: number, name: string): Promise<string> => {
    const r = await app.inject({
      method: 'POST', url: '/companies', headers: h.headers,
      payload: { cnpj: makeValidCnpj(seed), companyName: name, role: 'owner', fetchFromRevenue: false },
    });
    if (r.statusCode !== 201) throw new Error(`createCompany falhou: ${r.statusCode} ${r.body}`);
    return r.json().company.companyId as string;
  };

  const activate = async (h: Human, companyId: string, typeSlug: string): Promise<void> => {
    const pair = await pool.query<{ company_type_id: string; concept_id: string }>(
      `SELECT ac.company_type_id, ac.concept_id
         FROM company_type_allowed_concepts ac
         JOIN company_types ct ON ct.id = ac.company_type_id
        WHERE ct.slug = $1 LIMIT 1`,
      [typeSlug]
    );
    if (pair.rowCount === 0) throw new Error(`par allowed_concepts ausente para ${typeSlug}`);
    const r = await app.inject({
      method: 'POST', url: `/companies/${companyId}/operational-activation`, headers: h.headers,
      payload: { companyTypeId: pair.rows[0].company_type_id, conceptId: pair.rows[0].concept_id },
    });
    if (r.statusCode !== 200 && r.statusCode !== 201) throw new Error(`ativação ${typeSlug} falhou: ${r.statusCode} ${r.body}`);
  };

  const SUPER = await createCompany(FS, seedBase + 1, 'E2E Tpl Supermercado');
  const DISTRIB = await createCompany(FD, seedBase + 2, 'E2E Tpl Distribuidora');
  const SALAO = await createCompany(FB, seedBase + 3, 'E2E Tpl Salao');
  await activate(FS, SUPER, 'supermercado');
  await activate(FD, DISTRIB, 'distribuidora-de-bebidas');
  await activate(FB, SALAO, 'salao');

  const econ0 = await pool.query<{ n: string }>(`SELECT ((SELECT count(*) FROM bank_ledger)+(SELECT count(*) FROM bank_transactions))::text n`);
  const cu0 = await pool.query<{ n: string }>(`SELECT count(*)::text n FROM company_users WHERE tenant_id=$1`, [TENANT_ID]);

  try {
    // C1 — recomendação deriva do company_type (sugestão, nunca auto-aplicação)
    const rec = await app.inject({ method: 'GET', url: `/companies/${SUPER}/templates/recommended`, headers: FS.headers });
    record('C1 recomendação por company_type (supermercado → supermercado-completo)',
      rec.statusCode === 200 && rec.json()?.data?.slug === 'supermercado-completo', `body=${rec.body.slice(0, 160)}`);
    const apps0 = await pool.query<{ n: string }>(`SELECT count(*)::text n FROM company_template_applications WHERE company_id=$1::uuid`, [SUPER]);
    record('C1b recomendação NÃO aplica nada (zero applications)', apps0.rows[0].n === '0', `n=${apps0.rows[0].n}`);

    // C2 — aplicar manual-assistido nos 3 contextos
    const applyTpl = async (h: Human, companyId: string, slug: string): Promise<{ status: number; data: { application?: { applicationId: string; templateVersion: number; modulesApplied: string[]; appliedByActorId: string; templateVersionId: string; templateId: string }; alreadyApplied?: boolean } }> => {
      const cat = await app.inject({ method: 'GET', url: '/companies/templates/catalog', headers: h.headers });
      const tpl = (cat.json()?.data ?? []).find((t: { slug: string }) => t.slug === slug);
      if (!tpl) throw new Error(`template ${slug} ausente no catálogo`);
      const r = await app.inject({
        method: 'POST', url: `/companies/${companyId}/templates/apply`, headers: h.headers,
        payload: { templateId: tpl.templateId },
      });
      return { status: r.statusCode, data: r.json()?.data ?? {} };
    };

    const aS = await applyTpl(FS, SUPER, 'supermercado-completo');
    record('C2a supermercado aplica composição AMPLA (6 recortes + marketplace/inventory)',
      aS.status === 201 && (aS.data.application?.modulesApplied ?? []).includes('marketplace'), `status=${aS.status}`);
    const compS = await pool.query<{ composition: { branchCategorySlugs: string[] } }>(
      `SELECT v.composition FROM company_template_applications a JOIN business_template_versions v ON v.id=a.template_version_id WHERE a.company_id=$1::uuid LIMIT 1`, [SUPER]);
    record('C2b composição do supermercado tem 6 ramos', (compS.rows[0]?.composition?.branchCategorySlugs ?? []).length === 6,
      JSON.stringify(compS.rows[0]?.composition?.branchCategorySlugs));

    const aD = await applyTpl(FD, DISTRIB, 'distribuidora-de-bebidas');
    const compD = await pool.query<{ composition: { branchCategorySlugs: string[] } }>(
      `SELECT v.composition FROM company_template_applications a JOIN business_template_versions v ON v.id=a.template_version_id WHERE a.company_id=$1::uuid LIMIT 1`, [DISTRIB]);
    record('C2c distribuidora recebe SÓ o recorte de bebidas',
      aD.status === 201 && JSON.stringify(compD.rows[0]?.composition?.branchCategorySlugs) === '["marketplace-bebidas"]',
      JSON.stringify(compD.rows[0]?.composition?.branchCategorySlugs));

    const aB = await applyTpl(FB, SALAO, 'salao-servicos');
    record('C2d salão recebe serviços + agenda',
      aB.status === 201 && (aB.data.application?.modulesApplied ?? []).includes('services') && (aB.data.application?.modulesApplied ?? []).includes('agenda'),
      JSON.stringify(aB.data.application?.modulesApplied));

    // C3 — auditabilidade: template + versão + actor + timestamp registrados
    const audit = await pool.query<{ applied_by_actor_id: string; applied_at: Date; version: number }>(
      `SELECT a.applied_by_actor_id, a.applied_at, v.version
         FROM company_template_applications a JOIN business_template_versions v ON v.id=a.template_version_id
        WHERE a.company_id=$1::uuid LIMIT 1`, [SUPER]);
    record('C3 aplicação auditável (actor aplicador + versão + timestamp)',
      audit.rows[0]?.applied_by_actor_id === FS.actorId && audit.rows[0]?.version === 1 && !!audit.rows[0]?.applied_at,
      JSON.stringify({ actor: audit.rows[0]?.applied_by_actor_id, v: audit.rows[0]?.version }));

    // C4 — idempotência
    const again = await applyTpl(FS, SUPER, 'supermercado-completo');
    const appsN = await pool.query<{ n: string }>(`SELECT count(*)::text n FROM company_template_applications WHERE company_id=$1::uuid`, [SUPER]);
    record('C4 reaplicar é idempotente (alreadyApplied; 1 linha)',
      again.status === 200 && again.data.alreadyApplied === true && appsN.rows[0].n === '1', `n=${appsN.rows[0].n}`);

    // C5 — personalização da empresa não altera o template
    const tplBefore = await pool.query<{ h: string }>(`SELECT md5(composition::text) h FROM business_template_versions v JOIN business_templates t ON t.id=v.template_id WHERE t.slug='supermercado-completo' AND v.version=1`);
    const cust = await app.inject({
      method: 'PATCH', url: `/companies/${SUPER}/templates/applications/${aS.data.application!.applicationId}/customize`, headers: FS.headers,
      payload: { customizations: { disabledModules: ['inventory'] } },
    });
    const tplAfter = await pool.query<{ h: string }>(`SELECT md5(composition::text) h FROM business_template_versions v JOIN business_templates t ON t.id=v.template_id WHERE t.slug='supermercado-completo' AND v.version=1`);
    const eff = await app.inject({ method: 'GET', url: `/companies/${SUPER}/templates/effective-modules`, headers: FS.headers });
    record('C5 personalização (desativa inventory) sem tocar o template canônico',
      cust.statusCode === 200 && tplBefore.rows[0].h === tplAfter.rows[0].h &&
      JSON.stringify(eff.json()?.data) === '["marketplace"]',
      `eff=${eff.body}`);

    // C6 — nova versão NÃO reescreve aplicação antiga
    const tplId = aS.data.application!.templateId;
    await pool.query(
      `INSERT INTO business_template_versions (template_id, version, composition, notes)
       VALUES ($1::uuid, 2, (SELECT composition FROM business_template_versions WHERE template_id=$1::uuid AND version=1) || '{"modules":["marketplace"]}'::jsonb, 'v2 e2e')`,
      [tplId]
    );
    const stillV1 = await pool.query<{ version: number }>(
      `SELECT v.version FROM company_template_applications a JOIN business_template_versions v ON v.id=a.template_version_id WHERE a.id=$1::uuid`,
      [aS.data.application!.applicationId]
    );
    record('C6 template v2 criado não reescreve aplicação antiga (segue v1 imutável)', stillV1.rows[0]?.version === 1, `v=${stillV1.rows[0]?.version}`);

    // C7 — autoridade: membro sem gestão → 403; template não concede autoridade
    await pool.query(
      `INSERT INTO company_users (tenant_id, company_id, global_user_id, role, can_manage_company, is_active, member_status)
       VALUES ($1,$2,$3,'member',false,true,'active')`,
      [TENANT_ID, SUPER, M.globalId]
    );
    const mApply = await app.inject({
      method: 'POST', url: `/companies/${SUPER}/templates/apply`, headers: M.headers,
      payload: { templateId: tplId },
    });
    record('C7a membro sem gestão não aplica template (403)', mApply.statusCode === 403 && /TEMPLATE_FORBIDDEN/.test(mApply.body), `status=${mApply.statusCode}`);
    const mRow = await pool.query<{ can_manage_company: boolean }>(
      `SELECT can_manage_company FROM company_users WHERE company_id=$1::uuid AND global_user_id=$2::uuid`, [SUPER, M.globalId]);
    record('C7b template não concede autoridade (flags intactas)', mRow.rows[0]?.can_manage_company === false, JSON.stringify(mRow.rows[0]));

    // C8 — ZERO efeito comercial: nenhuma oferta/estoque/preço/agenda nasce
    const zero = await pool.query<{ p: string; po: string; im: string; av: string; svc: string }>(
      `SELECT (SELECT count(*) FROM products WHERE tenant_id=$1)::text p,
              (SELECT count(*) FROM product_offers WHERE tenant_id=$1)::text po,
              (SELECT count(*) FROM inventory_movements WHERE tenant_id=$1)::text im,
              (SELECT count(*) FROM availability WHERE tenant_id=$1)::text av,
              (SELECT count(*) FROM services WHERE tenant_id=$1)::text svc`,
      [TENANT_ID]
    );
    record('C8 template NÃO cria oferta/estoque/agenda/serviço/preço',
      zero.rows[0].p === '0' && zero.rows[0].po === '0' && zero.rows[0].im === '0' && zero.rows[0].av === '0' && zero.rows[0].svc === '0',
      JSON.stringify(zero.rows[0]));

    // C9 — company_users delta apenas o membro fixture (nenhum vínculo nascido de template)
    const cu1 = await pool.query<{ n: string }>(`SELECT count(*)::text n FROM company_users WHERE tenant_id=$1`, [TENANT_ID]);
    record('C9 nenhuma membership nasce de template', Number(cu1.rows[0].n) === Number(cu0.rows[0].n) + 1, `${cu0.rows[0].n}→${cu1.rows[0].n}`);

    // C10 — zero Bank writer
    const econ1 = await pool.query<{ n: string }>(`SELECT ((SELECT count(*) FROM bank_ledger)+(SELECT count(*) FROM bank_transactions))::text n`);
    record('C10 zero Bank writer', econ0.rows[0].n === econ1.rows[0].n, `${econ0.rows[0].n} vs ${econ1.rows[0].n}`);
  } finally {
    await app.close();
  }

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${'═'.repeat(60)}`);
  console.log(`RESULTADO: ${results.length - failed.length}/${results.length} verdes`);
  if (failed.length > 0) {
    failed.forEach((f) => console.log(`  ❌ ${f.label} — ${f.reason ?? ''}`));
    await pool.end();
    process.exit(1);
  }
  await pool.end();
  console.log('✨ Templates empresariais versionados — verde.');
  process.exit(0); // CLI validator: encerra o event loop (handles transitivas de módulos importados)
}

main().catch(async (e) => {
  console.error('💥 Erro não tratado:', e);
  try { await pool.end(); } catch { /* noop */ }
  process.exit(1);
});
