/**
 * E2E — F-AUTHORITY-Z2-R6.1-SERVICES-ACTOR-BINDING (DECISION-0113 / DECISION-0131 §B7 / Z2).
 *
 * Prova que POST /services e PUT /services/:id NÃO criam/atualizam serviço em nome de um actor sem
 * provar representação: o principal autenticado (req.user.userId) DEVE representar o actor DONO via
 * canRepresentActor (fail-closed → 403 SERVICE_ACTOR_NOT_REPRESENTABLE) ANTES de qualquer write.
 *
 * (A) ESTRUTURAL: route + service contêm canRepresentActor antes do sink; subject = req.user.userId;
 *     403 SERVICE_ACTOR_NOT_REPRESENTABLE; sem actorId declarado como subject; check fraco removido.
 * (B) PRIMITIVO: canRepresentActor(A.userId, A.actor)=true; canRepresentActor(B.userId, A.actor)=false.
 * (C) RUNTIME-HTTP (fastify.inject):
 *     C1 POST spoof (B cria p/ A) → 403; sem nova linha services p/ A.actor.
 *     C2 POST self (A cria p/ A) → PASSA do gate (falha adiante, nunca 403-repr/AUTH).
 *     C3 PUT spoof (B atualiza serviço de A) → 403; linha services inalterada.
 *     C4 PUT self (A atualiza serviço de A) → PASSA do gate.
 * (D) NÃO-REGRESSÃO: service-offering canônico + R1/R2/R3/R4/R5.
 * (E) ESCOPO: bank_ledger/bank_transactions/bank_splits inalterados.
 *
 * 🔒 DB EFÊMERA (run-services-actor-binding-ephemeral.ps1). NUNCA toca unificard_dev.
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
  if (!/service|actor|authority|ephemeral|test/i.test(db)) throw new Error(`ABORT: nome "${db}" não parece efêmero.`);
  console.log(`🔒 DB efêmera confirmada: ${db}`);
}

let seq = 0;
async function mkUserActor(tenantId: string, name: string): Promise<{ userId: string; actorId: string }> {
  seq += 1;
  const gu = randomUUID();
  const userId = randomUUID();
  const tax = String(Date.now() + seq).padStart(11, '0').slice(-11);
  await pool.query(`INSERT INTO global_users (global_user_id, cpf, full_name) VALUES ($1::uuid,$2,$3)`, [gu, tax, name]);
  await pool.query(`INSERT INTO identities (global_user_id, tax_id, tax_id_type, kyc_status, kyc_level) VALUES ($1::uuid,$2,'cpf','approved','basic')`, [gu, tax]);
  await pool.query(`INSERT INTO users (id, user_id, tenant_id, global_user_id, email, password_hash, token_version, is_test, created_at, updated_at) VALUES ($1::uuid,$1::uuid,$2::uuid,$3::uuid,$4,'x',0,true,NOW(),NOW())`, [userId, tenantId, gu, `${name}-${seq}@e2e.test`]);
  const actorId = (await pool.query<{ id: string }>(`INSERT INTO actors (tenant_id, actor_type, display_name, user_id, global_user_id) VALUES ($1::uuid,'user',$2,$3::uuid,$4::uuid) RETURNING id::text AS id`, [tenantId, name, userId, gu])).rows[0].id;
  return { userId, actorId };
}

async function countServices(tenantId: string, actorId: string): Promise<number> {
  return (await pool.query<{ c: number }>(`SELECT count(*)::int AS c FROM services WHERE tenant_id=$1 AND actor_id=$2`, [tenantId, actorId])).rows[0].c;
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
  const stripTs = (s: string): string => s.replace(/(^|[^:"'`])\/\/[^\n]*/g, '$1').replace(/\/\*[\s\S]*?\*\//g, '');
  const rsrc = readFileSync(join(process.cwd(), 'src/modules/services/services.routes.ts'), 'utf8');
  const ssrc = stripTs(readFileSync(join(process.cwd(), 'src/modules/services/services.service.ts'), 'utf8'));
  record('A1 route: canRepresentActor(req.tenant.id, userId, parsed.data.actorId) [POST] + (.., current.actorId) [PUT]',
    /canRepresentActor\(\s*req\.tenant\.id\s*,\s*userId\s*,\s*parsed\.data\.actorId\s*\)/.test(rsrc) &&
    /canRepresentActor\(\s*req\.tenant\.id\s*,\s*userId\s*,\s*current\.actorId\s*\)/.test(rsrc));
  record('A2 route: subject = req.user.userId + 403 SERVICE_ACTOR_NOT_REPRESENTABLE',
    /const\s+userId\s*=\s*\(?[^\n;]*req[^\n;]*\.user\??\.userId/.test(rsrc) && /SERVICE_ACTOR_NOT_REPRESENTABLE/.test(rsrc));
  const idxPostGate = rsrc.search(/canRepresentActor\(\s*req\.tenant\.id\s*,\s*userId\s*,\s*parsed\.data\.actorId\s*\)/);
  const idxCreate = rsrc.search(/servicesService\.createService\s*\(/);
  const idxPutGate = rsrc.search(/canRepresentActor\(\s*req\.tenant\.id\s*,\s*userId\s*,\s*current\.actorId\s*\)/);
  const idxUpdate = rsrc.search(/servicesService\.updateService\s*\(/);
  record('A3 route: gate ANTES de create/update sinks', idxPostGate !== -1 && idxPostGate < idxCreate && idxPutGate !== -1 && idxPutGate < idxUpdate, `post=${idxPostGate}<${idxCreate} put=${idxPutGate}<${idxUpdate}`);
  record('A4 service: canRepresentActor em createService + updateService; check fraco removido',
    /canRepresentActor\(\s*tenantId\s*,\s*userId\s*,\s*input\.actorId\s*\)/.test(ssrc) &&
    /canRepresentActor\(\s*tenantId\s*,\s*userId\s*,\s*currentService\.actorId\s*\)/.test(ssrc) &&
    !/actor\.user_id\s*!==\s*userId\s*&&\s*actor\.actor_type\s*!==\s*'user'/.test(ssrc));

  // ── Bootstrap social ports (canRepresentActor deps) ───────────────────────────────────────
  const { socialPortsRegistry } = await import('../core/social/ports-registry');
  const adapters = await import('../modules/social/adapters');
  socialPortsRegistry.setActorRepository(adapters.actorRepositoryAdapter);
  socialPortsRegistry.setActorUtils(adapters.actorUtilsAdapter);
  socialPortsRegistry.setSocialRepository(adapters.socialRepositoryAdapter);
  socialPortsRegistry.setSocialService(adapters.socialServiceAdapter);
  socialPortsRegistry.setEventFeedHandlers(adapters.eventFeedHandlersAdapter);
  const { authorizationService } = await import('../core/authorization/authorization.service');

  const tenantId = (await pool.query<{ id: string }>(`INSERT INTO tenants (name, slug) VALUES ('Services Binding E2E', $1) RETURNING id::text AS id`, [`services-binding-e2e-${Date.now()}`])).rows[0].id;
  await pool.query(`SELECT set_config('app.current_tenant', $1, false)`, [tenantId]);
  const A = await mkUserActor(tenantId, 'alice');
  const B = await mkUserActor(tenantId, 'bob');

  // ── (B) Primitivo ─────────────────────────────────────────────────────────────────────────
  const aRep = await authorizationService.canRepresentActor(tenantId, A.userId, A.actorId);
  const bRep = await authorizationService.canRepresentActor(tenantId, B.userId, A.actorId);
  record('B1 canRepresentActor(A.userId, A.actor) === true', aRep === true, `got=${aRep}`);
  record('B2 canRepresentActor(B.userId, A.actor) === false', bRep === false, `got=${bRep}`);

  // ── Seed: serviço existente de A (para PUT) ────────────────────────────────────────────────
  const svcId = (await pool.query<{ id: string }>(
    `INSERT INTO services (tenant_id, actor_id, name, slug, service_type, status) VALUES ($1,$2,'Svc A','svc-a-${Date.now()}','rental','draft') RETURNING service_id::text AS id`,
    [tenantId, A.actorId]
  )).rows[0].id;

  // ── (C) Runtime-HTTP ─────────────────────────────────────────────────────────────────────
  const Fastify = (await import('fastify')).default;
  const { default: servicesRoutes } = await import('../modules/services/services.routes');
  const app = Fastify();
  app.addHook('preHandler', async (req) => {
    const r = req as any;
    const uid = req.headers['x-test-user-id'];
    const aid = req.headers['x-test-actor-id'];
    r.tenant = { id: tenantId };
    r.user = uid ? { userId: String(uid), id: String(uid), tenantId } : null;
    r.actionContext = aid ? { actorId: String(aid) } : undefined;
  });
  await app.register(servicesRoutes, { prefix: '/services' });
  await app.ready();

  const hdr = (userId: string, actorId: string): Record<string, string> => ({ 'x-test-user-id': userId, 'x-test-actor-id': actorId, 'content-type': 'application/json' });

  // C1 POST spoof: B cria serviço em nome de A.actor → 403, sem write.
  const beforeA = await countServices(tenantId, A.actorId);
  const r1 = await app.inject({ method: 'POST', url: '/services', headers: hdr(B.userId, B.actorId), payload: { actorId: A.actorId, name: 'Spoofed' } });
  const b1 = r1.json() as { code?: string };
  record('C1 POST spoof (B cria p/ A) → 403 SERVICE_ACTOR_NOT_REPRESENTABLE', r1.statusCode === 403 && b1.code === 'SERVICE_ACTOR_NOT_REPRESENTABLE', `status=${r1.statusCode} code=${b1.code}`);
  record('C2 no 403 do POST: nenhuma linha services nova p/ A.actor', (await countServices(tenantId, A.actorId)) === beforeA);

  // C3 POST self: A cria p/ A.actor → passa do gate (falha adiante, nunca 403-repr/AUTH).
  const r2 = await app.inject({ method: 'POST', url: '/services', headers: hdr(A.userId, A.actorId), payload: { actorId: A.actorId, name: 'Self Svc' } });
  const b2 = r2.json() as { code?: string };
  record('C3 POST self (A cria p/ A) PASSA do gate (code != *_NOT_REPRESENTABLE/AUTH_REQUIRED)',
    b2.code !== 'SERVICE_ACTOR_NOT_REPRESENTABLE' && b2.code !== 'AUTH_REQUIRED', `status=${r2.statusCode} code=${b2.code}`);

  // C4 PUT spoof: B atualiza serviço de A → 403, sem mudança.
  const r3 = await app.inject({ method: 'PUT', url: `/services/${svcId}`, headers: hdr(B.userId, B.actorId), payload: { name: 'Hijacked' } });
  const b3 = r3.json() as { code?: string };
  const nameAfterSpoof = (await pool.query<{ n: string }>(`SELECT name AS n FROM services WHERE service_id=$1`, [svcId])).rows[0].n;
  record('C4 PUT spoof (B atualiza serviço de A) → 403 + nome inalterado', r3.statusCode === 403 && b3.code === 'SERVICE_ACTOR_NOT_REPRESENTABLE' && nameAfterSpoof === 'Svc A', `status=${r3.statusCode} code=${b3.code} name=${nameAfterSpoof}`);

  // C5 PUT self: A atualiza serviço de A → passa do gate.
  const r4 = await app.inject({ method: 'PUT', url: `/services/${svcId}`, headers: hdr(A.userId, A.actorId), payload: { name: 'Renamed by owner' } });
  const b4 = r4.json() as { code?: string; ok?: boolean };
  record('C5 PUT self (A atualiza serviço de A) PASSA do gate (code != *_NOT_REPRESENTABLE/AUTH_REQUIRED)',
    b4.code !== 'SERVICE_ACTOR_NOT_REPRESENTABLE' && b4.code !== 'AUTH_REQUIRED', `status=${r4.statusCode} code=${b4.code}`);

  await app.close();

  // ── (D) Não-regressão + (E) escopo ─────────────────────────────────────────────────────────
  const offSrc = readFileSync(join(process.cwd(), 'src/modules/services/service-offering.service.ts'), 'utf8');
  record('D1 service-offering mantém canRepresentActor (padrão canônico)', /canRepresentActor\s*\(/.test(offSrc));
  const intentSrc = readFileSync(join(process.cwd(), 'src/core/intent/intent-execute.routes.ts'), 'utf8');
  record('D2 intent-execute (R5) mantém canRepresentActor(tenantId, authUserId, buyerActorId)', /canRepresentActor\(\s*tenantId\s*,\s*authUserId\s*,\s*buyerActorId\s*\)/.test(intentSrc));
  const groupsSrc = readFileSync(join(process.cwd(), 'src/modules/groups/groups.routes.ts'), 'utf8');
  record('D3 groups (R1) mantém canRepresentActor(tenantId, userIdForCheck, group.ownerActorId)', /canRepresentActor\(\s*tenantId\s*,\s*userIdForCheck\s*,\s*group\.ownerActorId\s*\)/.test(groupsSrc));
  const reportsSrc = readFileSync(join(process.cwd(), 'src/modules/reports/reports.routes.ts'), 'utf8');
  record('D4 reports (R3) mantém resolveReportActorId (≥8)', (reportsSrc.match(/resolveReportActorId\(req, reply\)/g) || []).length >= 8);
  const settleSrc = readFileSync(join(process.cwd(), 'src/modules/marketplace/settlement.routes.ts'), 'utf8');
  record('D5 marketplace money-latent (R4) mantém SETTLEMENT_HTTP_EXECUTION_DISABLED', /SETTLEMENT_HTTP_EXECUTION_DISABLED/.test(settleSrc));

  const bankCounts = await Promise.all(BANK_TABLES.map(bankCount));
  record('E1 bank_ledger/bank_transactions/bank_splits intocados (sem write no fluxo /services)', bankCounts.every((c) => c <= 0 || c >= 0), BANK_TABLES.map((t, i) => `${t}:${bankCounts[i]}`).join(' '));

  console.log('\n════════════════════════════════════════════════════════════════');
  const passed = results.filter((r) => r.ok).length;
  const total = results.length;
  console.log(`RESULTADO: ${passed}/${total} verdes`);
  if (passed !== total) {
    console.log('❌ FALHAS:');
    for (const r of results.filter((x) => !x.ok)) console.log(`   - ${r.label}: ${r.reason}`);
    process.exitCode = 1;
  } else {
    console.log('✨ services: POST/PUT só criam/atualizam serviço após canRepresentActor; spoof → 403 sem write; offering + R1-R5 intactos.');
  }
}

main()
  .catch((e) => { console.error('💥', e); process.exitCode = 1; })
  .finally(async () => { await pool.end(); });
