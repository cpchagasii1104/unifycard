/**
 * E2E F-RISK-DASHBOARD-PERMISSION-SPOOF-CONTAINMENT.
 *
 * 🔒 DB EFÊMERA. Guard duro: current_database() === EXPECTED_DATABASE_NAME e NUNCA 'unificard_dev'.
 *    Orquestrado por scripts/run-risk-dashboard-permission-spoof-ephemeral.ps1.
 *
 * Prova: o SUBJECT da autorização do risk-dashboard vem de req.user (server-side/JWT), NUNCA do
 * actionContext.actorId (client-declared). O target actorId é hint. Um utilizador SEM o grant
 * financial:view_all_ledger NÃO se autoautoriza declarando actorId. Spoof subject==target fechado;
 * guard captura regressão; Bank/contenções intactos.
 */
import 'tsconfig-paths/register';
import Fastify from 'fastify';
import { pool } from '../core/database/pool';
import { tenantService } from '../core/tenants/tenant.service';
import riskDashboardRoutes from '../modules/risk-command-center/risk-dashboard.routes';
import { readFileSync } from 'fs';
import { join } from 'path';
import { randomUUID } from 'crypto';

const EXPECTED = process.env.EXPECTED_DATABASE_NAME || '';
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
  if (!/risk|dashboard|spoof|ephemeral|smoke|test/i.test(db)) throw new Error(`ABORT: nome "${db}" não parece efêmero.`);
  console.log(`🔒 DB efêmera confirmada: ${db}`);
}
const count = async (sql: string): Promise<number> => Number((await pool.query(sql)).rows[0].n);

let seq = 0;
async function mkUserActor(tenantId: string, name: string): Promise<{ userId: string; actorId: string }> {
  seq += 1;
  const gu = randomUUID(); const userId = randomUUID();
  const tax = String(Date.now() + seq).padStart(11, '0').slice(-11);
  await pool.query(`INSERT INTO global_users (global_user_id, cpf, metadata, created_at, updated_at) VALUES ($1::uuid,$2,'{}'::jsonb,NOW(),NOW())`, [gu, tax]);
  await pool.query(`INSERT INTO identities (global_user_id, tax_id, tax_id_type, kyc_status, kyc_level) VALUES ($1::uuid,$2,'cpf','approved','basic')`, [gu, tax]);
  await pool.query(`INSERT INTO users (id, user_id, tenant_id, email, password_hash, token_version, is_test, global_user_id, created_at, updated_at) VALUES ($1::uuid,$1::uuid,$2::uuid,$3,'x',0,true,$4::uuid,NOW(),NOW())`, [userId, tenantId, `${name}-${seq}@e2e.test`, gu]);
  const actorId = (await pool.query<{ id: string }>(`INSERT INTO actors (tenant_id, actor_type, display_name, user_id, global_user_id) VALUES ($1::uuid,'user',$2,$3::uuid,$4::uuid) RETURNING id::text AS id`, [tenantId, name, userId, gu])).rows[0].id;
  return { userId, actorId };
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
  await tenantService.createTenant({ id: TENANT_ID, name: 'Risk Spoof', slug: `rds-${Date.now()}` });
  const bob = await mkUserActor(TENANT_ID, 'Bob');     // SEM grant view_all_ledger
  const admin = await mkUserActor(TENANT_ID, 'Admin'); // actor-alvo declarável
  const bankBefore = await count(`SELECT ((SELECT count(*) FROM bank_ledger)+(SELECT count(*) FROM bank_transactions))::int AS n`);

  const app = Fastify();
  app.decorateRequest('user', null);
  app.decorateRequest('tenant', null);
  app.decorateRequest('actionContext', null);
  app.addHook('onRequest', async (req: any) => {
    const uid = req.headers['x-test-user-id'];
    req.user = uid ? { userId: uid, id: uid } : null;
    req.tenant = { id: TENANT_ID };
    req.actionContext = { actorId: req.headers['x-test-actor-id'] };
  });
  await app.register(riskDashboardRoutes);
  await app.ready();

  // ── T1/T2 — SPOOF FECHADO: Bob (sem grant) declara actorId=Admin como contexto → 403 (subject=req.user) ──
  {
    const res = await app.inject({ method: 'GET', url: '/risk/dashboard/overview', headers: { 'x-test-user-id': bob.userId, 'x-test-actor-id': admin.actorId } });
    record('T1/T2 Bob (sem grant) declarando actorId=Admin → 403 (subject=req.user, não actionContext)', res.statusCode === 403, `status=${res.statusCode}`);
  }
  // ── T1b — Bob declarando o próprio actor também 403 (sem grant; ownership não basta) ──
  {
    const res = await app.inject({ method: 'GET', url: '/risk/dashboard/overview', headers: { 'x-test-user-id': bob.userId, 'x-test-actor-id': bob.actorId } });
    record('T1b Bob declarando próprio actor → 403 (requirePermission enforça GRANT, não ownership)', res.statusCode === 403, `status=${res.statusCode}`);
  }
  // ── T-noauth — sem req.user → 401 ──
  {
    const res = await app.inject({ method: 'GET', url: '/risk/dashboard/overview', headers: { 'x-test-actor-id': admin.actorId } });
    record('T-noauth sem utilizador autenticado → 401', res.statusCode === 401, `status=${res.statusCode}`);
  }
  await app.close();

  // ── T-struct — subject = req.user; actorId = alvo/contexto; NÃO subject==target ──
  {
    const raw = readFileSync(join(process.cwd(), 'src/modules/risk-command-center/risk-dashboard.routes.ts'), 'utf-8');
    const src = raw.replace(/(^|[^:"'`])\/\/[^\n]*/g, '$1').replace(/\/\*[\s\S]*?\*\//g, ''); // comment-stripped
    const subjectFromUser = /const userId = req\.user\?\.userId \?\? req\.user\?\.id/.test(src);
    const requirePermSubjectUser = /requirePermission\(\s*tenantId,\s*userId,\s*actorId,/.test(src.replace(/\s+/g, ' '));
    const noSpoof = !/requirePermission\([^)]*,\s*actorId\s*,\s*actorId\s*,/.test(src.replace(/\s+/g, ' '));
    record('T-struct subject=req.user.userId; requirePermission(tenantId, userId, actorId); sem subject==target', subjectFromUser && requirePermSubjectUser && noSpoof, `subjectUser=${subjectFromUser} noSpoof=${noSpoof} permUser=${requirePermSubjectUser}`);
  }

  // ── T6 — guard new=0 stale=0; risk-dashboard nota spoof CLOSED ──
  {
    const guard = readFileSync(join(process.cwd(), 'scripts/audit-actor-authority-boundary.mjs'), 'utf-8');
    const hardCheck = /SUBJECT_EQUALS_TARGET\s*=\s*\/requirePermission/.test(guard);
    const note = /risk-dashboard\.routes\.ts': 'D · SPOOF subject==target CLOSED/.test(guard);
    record('T6 guard tem check SUBJECT_EQUALS_TARGET + nota risk-dashboard spoof CLOSED', hardCheck && note);
  }

  // ── T8 — Bank intocado ──
  record('T8 Bank intocado (bank_ledger + bank_transactions inalterados)', (await count(`SELECT ((SELECT count(*) FROM bank_ledger)+(SELECT count(*) FROM bank_transactions))::int AS n`)) === bankBefore);

  // ── T9 — contenções/bindings anteriores intactos ──
  {
    const disp = readFileSync(join(process.cwd(), 'src/modules/reconciliation/reconciliation-dispute.routes.ts'), 'utf-8');
    const so = readFileSync(join(process.cwd(), 'src/modules/services/service-order.routes.ts'), 'utf-8');
    const ev = readFileSync(join(process.cwd(), 'src/core/events/event.routes.ts'), 'utf-8');
    const pp = readFileSync(join(process.cwd(), 'src/modules/public-profiles/public-profile.routes.ts'), 'utf-8');
    record('T9 contenções/bindings anteriores intactos (dispute 403 + service-order 403 + event + public-profiles)',
      disp.includes('DISPUTE_REVERSAL_HTTP_DISABLED') && so.includes('SERVICE_ORDER_DIRECT_CREATE_DISABLED') && /userRepresentsActor\(/.test(ev) && /canRepresentActor\(/.test(pp));
  }

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${'═'.repeat(64)}`);
  console.log(`RESULTADO: ${results.length - failed.length}/${results.length} verdes`);
  if (failed.length > 0) {
    console.log('FALHAS:'); failed.forEach((f) => console.log(`  ❌ ${f.label} — ${f.reason ?? ''}`));
    await pool.end(); process.exit(1);
  }
  await pool.end();
  console.log('✨ risk-dashboard: subject server-side (req.user), actorId=hint; spoof subject==target fechado; grant admin enforçado; Bank intocado.');
}
main().catch(async (e) => { console.error('💥 Erro não tratado:', e); try { await pool.end(); } catch { /* noop */ } process.exit(1); });
