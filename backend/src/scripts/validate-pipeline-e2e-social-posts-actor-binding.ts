/**
 * E2E — F-AUTHORITY-Z2-R6.2-SOCIAL-POSTS-ACTOR-BINDING (DECISION-0113 / DECISION-0131 §B7 / Z2).
 *
 * Prova que POST /social/posts NÃO cria post "como" um actor declarado (`body.actor_id`) sem provar
 * representação: o principal autenticado (req.user.userId) DEVE representar o actor autor via
 * canRepresentActor (fail-closed → 403 SOCIAL_POST_ACTOR_NOT_REPRESENTABLE) ANTES de criar o post.
 *
 * (A) ESTRUTURAL: gate canRepresentActor(req.tenant.id, req.user.userId, validated.actor_id) antes de
 *     social2Service.createPost; 403 SOCIAL_POST_ACTOR_NOT_REPRESENTABLE.
 * (B) PRIMITIVO: canRepresentActor(A.userId, pageA)=true; canRepresentActor(B.userId, pageA)=false.
 * (C) RUNTIME-HTTP (fastify.inject):
 *     C1 POST spoof (B publica como page de A) → 403 + zero linha nova em posts(pageA).
 *     C2 POST legítimo (A publica como page de A) → PASSA do gate (falha adiante por KYB/publish_feed,
 *        nunca 403-repr).
 * (D) NÃO-REGRESSÃO: R6.1 services · R5 intent-execute · R1 groups · R3 reports · R4 marketplace.
 * (E) ESCOPO: bank_ledger/bank_transactions/bank_splits inalterados.
 *
 * 🔒 DB EFÊMERA (run-social-posts-actor-binding-ephemeral.ps1). NUNCA toca unificard_dev.
 */
import 'tsconfig-paths/register';
import { readFileSync } from 'fs';
import { join } from 'path';
import { pool } from '../core/database/pool';
import { randomUUID } from 'crypto';

const EXPECTED = process.env.EXPECTED_DATABASE_NAME || '';
type Res = { label: string; ok: boolean; reason?: string };
const results: Res[] = [];
const record = (label: string, ok: boolean, reason?: string): void => {
  results.push({ label, ok, reason });
  console.log(`  ${ok ? '✅' : '❌'} ${label}${ok ? '' : ` — ${reason ?? ''}`}`);
};

async function assertEphemeralDb(): Promise<void> {
  const db = (await pool.query<{ db: string }>('SELECT current_database() AS db')).rows[0]?.db;
  if (db === 'unificard_dev') throw new Error('ABORT: banco-alvo é "unificard_dev".');
  if (!EXPECTED || db !== EXPECTED) throw new Error(`ABORT: banco "${db}" ≠ EXPECTED "${EXPECTED}".`);
  if (!/social|posts|actor|authority|ephemeral|test/i.test(db)) throw new Error(`ABORT: nome "${db}" não parece efêmero.`);
  console.log(`🔒 DB efêmera confirmada: ${db}`);
}

let seq = 0;
async function mkUserActor(tenantId: string, name: string): Promise<{ userId: string; actorId: string; globalUserId: string }> {
  seq += 1;
  const gu = randomUUID();
  const userId = randomUUID();
  const tax = String(Date.now() + seq).padStart(11, '0').slice(-11);
  await pool.query(`INSERT INTO global_users (global_user_id, cpf, full_name) VALUES ($1::uuid,$2,$3)`, [gu, tax, name]);
  await pool.query(`INSERT INTO identities (global_user_id, tax_id, tax_id_type, kyc_status, kyc_level) VALUES ($1::uuid,$2,'cpf','approved','basic')`, [gu, tax]);
  await pool.query(`INSERT INTO users (id, user_id, tenant_id, global_user_id, email, password_hash, token_version, is_test, created_at, updated_at) VALUES ($1::uuid,$1::uuid,$2::uuid,$3::uuid,$4,'x',0,true,NOW(),NOW())`, [userId, tenantId, gu, `${name}-${seq}@e2e.test`]);
  const actorId = (await pool.query<{ id: string }>(`INSERT INTO actors (tenant_id, actor_type, display_name, user_id, global_user_id) VALUES ($1::uuid,'user',$2,$3::uuid,$4::uuid) RETURNING id::text AS id`, [tenantId, name, userId, gu])).rows[0].id;
  return { userId, actorId, globalUserId: gu };
}

// Page actor "dono" do usuário owner (company_users.can_manage_company=true) → canRepresentActor(owner)=true.
async function mkPageActor(tenantId: string, name: string, owner: { actorId: string; globalUserId: string }): Promise<string> {
  seq += 1;
  const cnpj = String(Date.now() + seq).padStart(14, '0').slice(-14);
  const companyId = (await pool.query<{ id: string }>(
    `INSERT INTO companies (tenant_id, company_name, cnpj, status, global_user_id) VALUES ($1::uuid,$2,$3,'active',$4::uuid) RETURNING company_id::text AS id`,
    [tenantId, name, cnpj, owner.globalUserId]
  )).rows[0].id;
  await pool.query(
    `INSERT INTO company_users (tenant_id, company_id, global_user_id, role, can_manage_company, is_active, member_status) VALUES ($1::uuid,$2::uuid,$3::uuid,'owner',true,true,'active')`,
    [tenantId, companyId, owner.globalUserId]
  );
  const pageId = (await pool.query<{ id: string }>(
    `INSERT INTO actors (tenant_id, actor_type, display_name, company_id, responsible_actor_id) VALUES ($1::uuid,'page',$2,$3::uuid,$4::uuid) RETURNING id::text AS id`,
    [tenantId, name, companyId, owner.actorId]
  )).rows[0].id;
  return pageId;
}

async function countPosts(tenantId: string, actorId: string): Promise<number> {
  return (await pool.query<{ c: number }>(`SELECT count(*)::int AS c FROM posts WHERE tenant_id=$1 AND actor_id=$2`, [tenantId, actorId])).rows[0].c;
}
async function bankCount(table: string): Promise<number> {
  const reg = (await pool.query<{ t: string | null }>(`SELECT to_regclass($1) AS t`, [table])).rows[0].t;
  if (!reg) return -1;
  return (await pool.query<{ c: number }>(`SELECT count(*)::int AS c FROM ${table}`)).rows[0].c;
}
const BANK_TABLES = ['bank_ledger', 'bank_transactions', 'bank_splits'];

async function main(): Promise<void> {
  await assertEphemeralDb();

  // ── (A) Estrutural ──────────────────────────────────────────────────────────────────────
  const src = readFileSync(join(process.cwd(), 'src/modules/social/social-2.0.routes.ts'), 'utf8');
  record('A1 gate canRepresentActor(req.tenant.id, req.user.userId, validated.actor_id) presente',
    /canRepresentActor\(\s*req\.tenant\.id\s*,\s*req\.user\.userId\s*,\s*validated\.actor_id\s*\)/.test(src));
  record('A2 403 SOCIAL_POST_ACTOR_NOT_REPRESENTABLE fail-closed',
    /status\(\s*403\s*\)[\s\S]{0,200}SOCIAL_POST_ACTOR_NOT_REPRESENTABLE/.test(src));
  const idxGate = src.search(/canRepresentActor\(\s*req\.tenant\.id\s*,\s*req\.user\.userId\s*,\s*validated\.actor_id\s*\)/);
  const idxSink = src.search(/social2Service\.createPost\s*\(/);
  record('A3 gate ANTES de social2Service.createPost', idxGate !== -1 && idxSink !== -1 && idxGate < idxSink, `gate=${idxGate} sink=${idxSink}`);

  // ── Bootstrap social ports (canRepresentActor deps) ───────────────────────────────────────
  const { socialPortsRegistry } = await import('../core/social/ports-registry');
  const adapters = await import('../modules/social/adapters');
  socialPortsRegistry.setActorRepository(adapters.actorRepositoryAdapter);
  socialPortsRegistry.setActorUtils(adapters.actorUtilsAdapter);
  socialPortsRegistry.setSocialRepository(adapters.socialRepositoryAdapter);
  socialPortsRegistry.setSocialService(adapters.socialServiceAdapter);
  socialPortsRegistry.setEventFeedHandlers(adapters.eventFeedHandlersAdapter);
  const { authorizationService } = await import('../core/authorization/authorization.service');

  const tenantId = (await pool.query<{ id: string }>(`INSERT INTO tenants (name, slug) VALUES ('Social Posts Binding E2E', $1) RETURNING id::text AS id`, [`social-posts-e2e-${Date.now()}`])).rows[0].id;
  await pool.query(`SELECT set_config('app.current_tenant', $1, false)`, [tenantId]);
  const A = await mkUserActor(tenantId, 'alice');
  const B = await mkUserActor(tenantId, 'bob');
  const pageA = await mkPageActor(tenantId, 'AliceCo', A);

  // ── (B) Primitivo ─────────────────────────────────────────────────────────────────────────
  const aRepPage = await authorizationService.canRepresentActor(tenantId, A.userId, pageA);
  const bRepPage = await authorizationService.canRepresentActor(tenantId, B.userId, pageA);
  record('B1 canRepresentActor(A.userId, pageA) === true (owner via canManageCompany)', aRepPage === true, `got=${aRepPage}`);
  record('B2 canRepresentActor(B.userId, pageA) === false', bRepPage === false, `got=${bRepPage}`);

  // ── (C) Runtime-HTTP ─────────────────────────────────────────────────────────────────────
  const Fastify = (await import('fastify')).default;
  const { default: social2Routes } = await import('../modules/social/social-2.0.routes');
  const app = Fastify();
  app.addHook('preHandler', async (req) => {
    const r = req as any;
    const uid = req.headers['x-test-user-id'];
    const aid = req.headers['x-test-actor-id'];
    r.tenant = { id: tenantId };
    r.user = uid ? { userId: String(uid), id: String(uid), tenantId, globalUserId: String(req.headers['x-test-gu'] || '') } : null;
    r.actionContext = aid ? { actorId: String(aid) } : undefined;
  });
  await app.register(social2Routes, { prefix: '/social' });
  await app.ready();

  const hdr = (u: { userId: string; globalUserId: string; actorId: string }): Record<string, string> => ({ 'x-test-user-id': u.userId, 'x-test-gu': u.globalUserId, 'x-test-actor-id': u.actorId, 'content-type': 'application/json' });

  // C1 spoof: B publica como page de A → 403, sem write.
  const beforePage = await countPosts(tenantId, pageA);
  const r1 = await app.inject({ method: 'POST', url: '/social/posts', headers: hdr(B), payload: { content: 'spoofed post', actor_id: pageA } });
  const b1 = r1.json() as { code?: string };
  record('C1 spoof (B publica como page de A) → 403 SOCIAL_POST_ACTOR_NOT_REPRESENTABLE', r1.statusCode === 403 && b1.code === 'SOCIAL_POST_ACTOR_NOT_REPRESENTABLE', `status=${r1.statusCode} code=${b1.code}`);
  record('C2 no 403: nenhuma linha posts nova p/ pageA', (await countPosts(tenantId, pageA)) === beforePage);

  // C3 legítimo: A publica como page de A → passa do gate (falha adiante por KYB/publish_feed, nunca 403-repr).
  const r2 = await app.inject({ method: 'POST', url: '/social/posts', headers: hdr(A), payload: { content: 'legit post', actor_id: pageA } });
  const b2 = r2.json() as { code?: string };
  record('C3 legítimo (A publica como page de A) PASSA do gate (code != SOCIAL_POST_ACTOR_NOT_REPRESENTABLE)',
    b2.code !== 'SOCIAL_POST_ACTOR_NOT_REPRESENTABLE', `status=${r2.statusCode} code=${b2.code}`);

  await app.close();

  // ── (D) Não-regressão + (E) escopo ─────────────────────────────────────────────────────────
  const servicesSrc = readFileSync(join(process.cwd(), 'src/modules/services/services.routes.ts'), 'utf8');
  record('D1 services (R6.1) mantém canRepresentActor(req.tenant.id, userId, parsed.data.actorId)', /canRepresentActor\(\s*req\.tenant\.id\s*,\s*userId\s*,\s*parsed\.data\.actorId\s*\)/.test(servicesSrc));
  const intentSrc = readFileSync(join(process.cwd(), 'src/core/intent/intent-execute.routes.ts'), 'utf8');
  record('D2 intent-execute (R5) mantém canRepresentActor(tenantId, authUserId, buyerActorId)', /canRepresentActor\(\s*tenantId\s*,\s*authUserId\s*,\s*buyerActorId\s*\)/.test(intentSrc));
  const groupsSrc = readFileSync(join(process.cwd(), 'src/modules/groups/groups.routes.ts'), 'utf8');
  record('D3 groups (R1) mantém canRepresentActor(tenantId, userIdForCheck, group.ownerActorId)', /canRepresentActor\(\s*tenantId\s*,\s*userIdForCheck\s*,\s*group\.ownerActorId\s*\)/.test(groupsSrc));
  const reportsSrc = readFileSync(join(process.cwd(), 'src/modules/reports/reports.routes.ts'), 'utf8');
  record('D4 reports (R3) mantém resolveReportActorId (≥8)', (reportsSrc.match(/resolveReportActorId\(req, reply\)/g) || []).length >= 8);
  const settleSrc = readFileSync(join(process.cwd(), 'src/modules/marketplace/settlement.routes.ts'), 'utf8');
  record('D5 marketplace money-latent (R4) mantém SETTLEMENT_HTTP_EXECUTION_DISABLED', /SETTLEMENT_HTTP_EXECUTION_DISABLED/.test(settleSrc));

  const bankCounts = await Promise.all(BANK_TABLES.map(bankCount));
  record('E1 bank_ledger/bank_transactions/bank_splits intocados (sem write no fluxo /social/posts)', bankCounts.every((c) => c <= 0), BANK_TABLES.map((t, i) => `${t}:${bankCounts[i]}`).join(' '));

  console.log('\n════════════════════════════════════════════════════════════════');
  const passed = results.filter((r) => r.ok).length;
  const total = results.length;
  console.log(`RESULTADO: ${passed}/${total} verdes`);
  if (passed !== total) {
    console.log('❌ FALHAS:');
    for (const r of results.filter((x) => !x.ok)) console.log(`   - ${r.label}: ${r.reason}`);
    process.exitCode = 1;
  } else {
    console.log('✨ social-posts: POST /social/posts só publica como actor declarado após canRepresentActor; spoof → 403 sem write; R1-R6.1 intactos; bank intocado.');
  }
}

main()
  .catch((e) => { console.error('💥', e); process.exitCode = 1; })
  .finally(async () => { await pool.end(); });
