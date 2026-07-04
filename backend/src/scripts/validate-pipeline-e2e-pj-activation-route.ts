/**
 * E2E F-PJ-ACTIVATION-ROUTE-WRITE-PAIR — rota HTTP de ativação operacional PJ (DECISION-0098).
 *
 * 🔒 DB EFÊMERA. Guard duro: current_database() === EXPECTED_DATABASE_NAME e NUNCA 'unificard_dev'.
 *    Orquestrado por scripts/run-pj-activation-route-ephemeral.ps1 (cria DB, migra FULL, roda, dropa).
 *
 * Prova o caminho vivo POST /companies/:companyId/operational-activation:
 *   - grava o par soberano (primary_company_type_id, primary_concept_id) via o writer
 *     activateCompanyOperationally, validado por company_type_allowed_concepts;
 *   - autoridade contextual via company_users (can_manage_company OR role='owner');
 *   - mapeia 1:1 os erros do writer (400/404/409) + 403 de autoridade + 400 de validação;
 *   - NÃO escreve tenant_concept_offerings; NÃO toca marketplace/hybrid/Bank.
 *
 * App mínimo = stack do protectedScope (sensible + auth + tenant + actionContext + rbac +
 * companiesModule), via app.inject — exercita auth JWT + guard + writer ponta a ponta.
 * Bank/marketplace NÃO são sequer registrados.
 *
 * Modo: orquestrado pelo wrapper (NUNCA rodar contra unificard_dev).
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
  if (!/activation|route|ephemeral|smoke|test/i.test(db)) throw new Error(`ABORT: nome de banco "${db}" não parece efêmero.`);
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
  await tenantService.createTenant({ id: TENANT_ID, name: 'PJ Activation Route Test', slug: `pj-activation-route-${Date.now()}` });

  // ── Identidade canônica do owner (chain identity → user) ──────────────────
  const ownerGlobalId = randomUUID();
  const ownerUserId = randomUUID(); // users.id === users.user_id (invariante deste schema)
  const ownerCpf = String(Date.now()).padStart(11, '0').slice(-11);
  await pool.query(`INSERT INTO global_users (global_user_id, cpf, full_name, metadata) VALUES ($1,$2,'E2E Owner','{}'::jsonb)`, [ownerGlobalId, ownerCpf]);
  await pool.query(
    `INSERT INTO identities (global_user_id, tax_id, tax_id_type, kyc_status, kyc_level) VALUES ($1,$2,'cpf','pending','none')`,
    [ownerGlobalId, ownerCpf]
  );
  await pool.query(
    `INSERT INTO users (id, user_id, tenant_id, global_user_id, email, password_hash, token_version)
     VALUES ($1,$1,$2,$3,$4,'x',0)`,
    [ownerUserId, TENANT_ID, ownerGlobalId, `${ownerUserId}@e2e.local`]
  );

  // ── Pares allowed: (typeA, conceptA) e (typeB, conceptB) ──────────────────
  const types = await pool.query<{ id: string }>(`SELECT id::text FROM company_types ORDER BY slug LIMIT 2`);
  if (types.rowCount! < 2) throw new Error('precisa de ≥2 company_types seedados por migration');
  const typeA = types.rows[0].id;
  const typeB = types.rows[1].id;
  const concepts = await pool.query<{ concept_id: string }>(`SELECT concept_id::text FROM concepts LIMIT 2`);
  if (concepts.rowCount! < 2) throw new Error('precisa de ≥2 concepts seedados por migration');
  const conceptA = concepts.rows[0].concept_id;
  const conceptB = concepts.rows[1].concept_id;
  await pool.query(`INSERT INTO company_type_allowed_concepts (company_type_id, concept_id) VALUES ($1,$2),($3,$4)`, [typeA, conceptA, typeB, conceptB]);

  // ── Actor humano do owner (nascimento C1 simulado) — PJ-B3: a ativação NÃO cura
  //    actors; o setup materializa o que o nascimento real teria criado. ────────────
  const { socialPortsRegistry } = await import('../core/social/ports-registry');
  const actorRepo = socialPortsRegistry.getActorRepository();
  const ownerActor = await actorRepo.findOrCreateUserActor(TENANT_ID, ownerUserId);

  // ── Companies (Momento 1 inerte, INSERT direto + page-actor como no nascimento) ──
  const mkCompany = async (name: string): Promise<string> => {
    const r = await pool.query<{ company_id: string }>(`INSERT INTO companies (tenant_id, company_name) VALUES ($1,$2) RETURNING company_id::text`, [TENANT_ID, name]);
    const companyId = r.rows[0].company_id;
    // PJ-B3: page-actor nasce com a empresa (F-ATOMIC-COMPANY-BIRTH); a ativação só RESOLVE.
    await actorRepo.findOrCreatePageActor(TENANT_ID, companyId, ownerActor.actor_id);
    return companyId;
  };
  const mkMember = async (companyId: string, role: string, canManage: boolean): Promise<void> => {
    await pool.query(
      `INSERT INTO company_users (tenant_id, company_id, global_user_id, role, can_manage_company, is_active, member_status)
       VALUES ($1,$2,$3,$4,$5,true,'active')`,
      [TENANT_ID, companyId, ownerGlobalId, role, canManage]
    );
  };

  const c1 = await mkCompany('C1 owner-manage');       await mkMember(c1, 'owner', true);
  const c3 = await mkCompany('C3 owner-manage fresh');  await mkMember(c3, 'owner', true);
  const cMember = await mkCompany('C-member no-manage'); await mkMember(cMember, 'member', false);
  const cNoMember = await mkCompany('C-no-membership'); // sem company_users para o owner

  const token = mintToken(ownerUserId, TENANT_ID, ownerGlobalId);
  // ActionContext obrigatório p/ rotas mutáveis (action-context.plugin do protectedScope).
  const acHeader = JSON.stringify({ actorId: ownerUserId, intent: 'company_operational_activation', source: 'e2e', scope: `tenant:${TENANT_ID}` });
  const auth = { authorization: `Bearer ${token}`, 'x-action-context': acHeader };

  const app = await buildMinimalApp();
  const post = (companyId: string, body: unknown, headers: Record<string, string> = auth) =>
    app.inject({ method: 'POST', url: `/companies/${companyId}/operational-activation`, headers, payload: body as object });

  try {
    // T0 — F-CNPJ-ACTIVATE-KYC-GATE (AUTHORITY_LAW Art.4.2): o owner nasceu kyc_status='pending'
    // (setup acima). Ativar (CONTROLAR o CNPJ) sem KYC mínimo → 403 COMPANY_ACTIVATION_REQUIRES_KYC.
    const rKyc = await post(c1, { companyTypeId: typeA, conceptId: conceptA });
    record('T0 ativar com owner KYC=pending → 403 COMPANY_ACTIVATION_REQUIRES_KYC',
      rKyc.statusCode === 403 && rKyc.json()?.code === 'COMPANY_ACTIVATION_REQUIRES_KYC',
      `status=${rKyc.statusCode} body=${JSON.stringify(rKyc.json())}`);
    // Owner conclui o KYC mínimo (identities.kyc_status='approved') — só então pode ATIVAR.
    await pool.query(`UPDATE identities SET kyc_status='approved', kyc_level='basic' WHERE global_user_id=$1`, [ownerGlobalId]);

    // T1 — par válido → 200, alreadyActive=false, par gravado, page-actor presente
    const r1 = await post(c1, { companyTypeId: typeA, conceptId: conceptA });
    const b1 = r1.json();
    record('T1 par válido → 200', r1.statusCode === 200, `status=${r1.statusCode} body=${JSON.stringify(b1)}`);
    record('T1 alreadyActive=false', b1?.data?.alreadyActive === false);
    record('T1 retorna pageActorId', typeof b1?.data?.pageActorId === 'string' && b1.data.pageActorId.length > 0);
    const cls = await pool.query<{ t: string | null; c: string | null }>(`SELECT primary_company_type_id::text AS t, primary_concept_id::text AS c FROM companies WHERE company_id=$1`, [c1]);
    record('T1 grava primary_company_type_id + primary_concept_id', cls.rows[0].t === typeA && cls.rows[0].c === conceptA);

    // T2 — idempotência mesmo par → 200 alreadyActive=true
    const r2 = await post(c1, { companyTypeId: typeA, conceptId: conceptA });
    record('T2 idempotente → 200 alreadyActive=true', r2.statusCode === 200 && r2.json()?.data?.alreadyActive === true, `status=${r2.statusCode}`);

    // T3 — par não permitido (typeA + conceptB) → 400 COMPANY_TYPE_CONCEPT_NOT_ALLOWED
    const r3 = await post(c3, { companyTypeId: typeA, conceptId: conceptB });
    record('T3 par não permitido → 400', r3.statusCode === 400, `status=${r3.statusCode}`);
    record('T3 code=COMPANY_TYPE_CONCEPT_NOT_ALLOWED', r3.json()?.code === 'COMPANY_TYPE_CONCEPT_NOT_ALLOWED', JSON.stringify(r3.json()));

    // T4 — troca para par diferente em empresa já operacional → 409
    const r4 = await post(c1, { companyTypeId: typeB, conceptId: conceptB });
    record('T4 troca pós-ativação → 409', r4.statusCode === 409, `status=${r4.statusCode} body=${JSON.stringify(r4.json())}`);

    // T5 — membro sem autoridade (can_manage_company=false, role=member) → 403
    const r5 = await post(cMember, { companyTypeId: typeA, conceptId: conceptA });
    record('T5 membro sem manage → 403', r5.statusCode === 403 && r5.json()?.code === 'COMPANY_OPERATIONAL_ACTIVATION_FORBIDDEN', `status=${r5.statusCode} body=${JSON.stringify(r5.json())}`);

    // T6 — não-membro → 403
    const r6 = await post(cNoMember, { companyTypeId: typeA, conceptId: conceptA });
    record('T6 não-membro → 403', r6.statusCode === 403 && r6.json()?.code === 'COMPANY_OPERATIONAL_ACTIVATION_FORBIDDEN', `status=${r6.statusCode}`);

    // T7 — body inválido (sem conceptId) → 400 INVALID_BODY
    const r7 = await post(c3, { companyTypeId: typeA });
    record('T7 body inválido → 400 INVALID_BODY', r7.statusCode === 400 && r7.json()?.code === 'INVALID_BODY', `status=${r7.statusCode} body=${JSON.stringify(r7.json())}`);

    // T8 — companyId não-uuid → 400 INVALID_COMPANY_ID
    const r8 = await post('not-a-uuid', { companyTypeId: typeA, conceptId: conceptA });
    record('T8 companyId inválido → 400 INVALID_COMPANY_ID', r8.statusCode === 400 && r8.json()?.code === 'INVALID_COMPANY_ID', `status=${r8.statusCode}`);

    // T9 — sem Authorization → 401
    const r9 = await post(c3, { companyTypeId: typeA, conceptId: conceptA }, {});
    record('T9 sem auth → 401', r9.statusCode === 401, `status=${r9.statusCode}`);

    // T10 — tenant_concept_offerings continua 0 (rota NÃO escreve oferta)
    const tco = await pool.query<{ n: string }>(`SELECT count(*)::text AS n FROM tenant_concept_offerings`);
    record('T10 tenant_concept_offerings = 0 (não escrito)', tco.rows[0].n === '0', `n=${tco.rows[0].n}`);

    // T11 — só actor_type user/page criados (nenhum store/service_provider de marketplace)
    const actorTypes = await pool.query<{ t: string; n: string }>(`SELECT actor_type AS t, count(*)::text AS n FROM actors GROUP BY actor_type ORDER BY actor_type`);
    const onlyUserPage = actorTypes.rows.every((r) => r.t === 'user' || r.t === 'page');
    record('T11 actors só user/page (marketplace/hybrid intocado)', onlyUserPage, JSON.stringify(actorTypes.rows));
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
  console.log('✨ Rota de ativação operacional PJ verde.');
}

main().catch(async (e) => {
  console.error('💥 Erro não tratado:', e);
  try { await pool.end(); } catch { /* noop */ }
  process.exit(1);
});
