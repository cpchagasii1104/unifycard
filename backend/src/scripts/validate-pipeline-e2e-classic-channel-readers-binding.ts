/**
 * E2E F-0113-CLASSIC-CHANNEL-READERS-BINDING.
 *
 * 🔒 DB EFÊMERA. Guard duro: current_database() === EXPECTED_DATABASE_NAME e NUNCA 'unificard_dev'.
 *    Orquestrado por scripts/run-classic-channel-readers-binding-ephemeral.ps1.
 *
 * Prova: public-profiles (writes) e marketplace /import passaram a exigir representabilidade server-side
 * (canRepresentActor) — actorId do body/actionContext é HINT. Lista pública força PUBLIC. Os 7 readers
 * admin/financeiro seguem baselineados com justificativa A-E (sem maquiagem). Bank/contenções intactos.
 */
import 'tsconfig-paths/register';
import Fastify from 'fastify';
import { pool } from '../core/database/pool';
import { tenantService } from '../core/tenants/tenant.service';
import publicProfileRoutes from '../modules/public-profiles/public-profile.routes';
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
  if (!/classic|channel|reader|binding|ephemeral|smoke|test/i.test(db)) throw new Error(`ABORT: nome "${db}" não parece efêmero.`);
  console.log(`🔒 DB efêmera confirmada: ${db}`);
}
const count = async (sql: string): Promise<number> => Number((await pool.query(sql)).rows[0].n);

let seq = 0;
async function mkUserActor(tenantId: string, name: string): Promise<{ userId: string; actorId: string; gu: string }> {
  seq += 1;
  const gu = randomUUID(); const userId = randomUUID();
  const tax = String(Date.now() + seq).padStart(11, '0').slice(-11);
  await pool.query(`INSERT INTO global_users (global_user_id, cpf, metadata, created_at, updated_at) VALUES ($1::uuid,$2,'{}'::jsonb,NOW(),NOW())`, [gu, tax]);
  await pool.query(`INSERT INTO identities (global_user_id, tax_id, tax_id_type, kyc_status, kyc_level) VALUES ($1::uuid,$2,'cpf','approved','basic')`, [gu, tax]);
  await pool.query(`INSERT INTO users (id, user_id, tenant_id, email, password_hash, token_version, is_test, global_user_id, created_at, updated_at) VALUES ($1::uuid,$1::uuid,$2::uuid,$3,'x',0,true,$4::uuid,NOW(),NOW())`, [userId, tenantId, `${name}-${seq}@e2e.test`, gu]);
  const actorId = (await pool.query<{ id: string }>(`INSERT INTO actors (tenant_id, actor_type, display_name, user_id, global_user_id) VALUES ($1::uuid,'user',$2,$3::uuid,$4::uuid) RETURNING id::text AS id`, [tenantId, name, userId, gu])).rows[0].id;
  return { userId, actorId, gu };
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
  const { authorizationService } = await import('../core/authorization/authorization.service');

  const TENANT_ID = randomUUID();
  await tenantService.createTenant({ id: TENANT_ID, name: 'Classic Readers', slug: `ccr-${Date.now()}` });
  const alice = await mkUserActor(TENANT_ID, 'Alice');
  const bob = await mkUserActor(TENANT_ID, 'Bob');
  const bankBefore = await count(`SELECT ((SELECT count(*) FROM bank_ledger)+(SELECT count(*) FROM bank_transactions))::int AS n`);

  // ── canRepresentActor truth (base do binding) ──
  record('T-rep canRepresentActor(Alice, AliceActor)=true', (await authorizationService.canRepresentActor(TENANT_ID, alice.userId, alice.actorId)) === true);
  record('T-rep canRepresentActor(Bob, AliceActor)=false', (await authorizationService.canRepresentActor(TENANT_ID, bob.userId, alice.actorId)) === false);

  // ── public-profiles HTTP behavioral ──
  const app = Fastify();
  app.decorateRequest('user', null);
  app.decorateRequest('tenant', null);
  app.decorateRequest('actionContext', null);
  app.addHook('onRequest', async (req: any) => {
    req.user = { userId: req.headers['x-test-user-id'], id: req.headers['x-test-user-id'] };
    req.tenant = { id: TENANT_ID };
    req.actionContext = { actorId: req.headers['x-test-actor-id'] };
  });
  await app.register(publicProfileRoutes);
  await app.ready();

  const postProfile = (userId: string, actorId: string) => app.inject({
    method: 'POST', url: '/public-profiles',
    headers: { 'x-test-user-id': userId, 'x-test-actor-id': actorId },
    payload: { actorId, profileType: 'person', displayName: 'E2E', slug: `e2e-${randomUUID().slice(0, 8)}` },
  });

  // T2 — Bob NÃO representa AliceActor → 403 (actionContext.actorId não autoriza)
  {
    const res = await postProfile(bob.userId, alice.actorId);
    record('T2 Bob (não-representa) POST /public-profiles actor=Alice → 403', res.statusCode === 403, `status=${res.statusCode}`);
  }
  // T3 — Alice representa o próprio actor → passa o gate (≠403)
  {
    const res = await postProfile(alice.userId, alice.actorId);
    record('T3 Alice (representa) POST /public-profiles → passa o gate (≠403)', res.statusCode !== 403, `status=${res.statusCode}`);
  }
  await app.close();

  // ── T-struct — binding e classificação no código ──
  {
    const pp = readFileSync(join(process.cwd(), 'src/modules/public-profiles/public-profile.routes.ts'), 'utf-8');
    const mk = readFileSync(join(process.cwd(), 'src/modules/marketplace/marketplace-categories.routes.ts'), 'utf-8');
    const ppBound = /authorizationService\.canRepresentActor\(/.test(pp) && (pp.match(/assertRepresentsActor\(req, reply/g) || []).length >= 3;
    const ppPublicForced = /filters\.visibility = 'PUBLIC'/.test(pp);
    const mkBound = /authorizationService\.canRepresentActor\(/.test(mk) && !/actor\.actor_id !== actorId/.test(mk);
    record('T-struct public-profiles: 3 writes com canRepresentActor + lista forçada PUBLIC', ppBound && ppPublicForced, `bound=${ppBound} publicForced=${ppPublicForced}`);
    record('T-struct marketplace /import: canRepresentActor substitui self-check', mkBound);
  }

  // ── T5 — guard: 2 removidos do baseline; 7 seguem baselineados com justificativa A-E ──
  {
    const guard = readFileSync(join(process.cwd(), 'scripts/audit-actor-authority-boundary.mjs'), 'utf-8');
    const removed = !/'modules\/public-profiles\/public-profile\.routes\.ts':/.test(guard) && !/'modules\/marketplace\/marketplace-categories\.routes\.ts':/.test(guard);
    const seven = ['business-audit', 'bank-http', 'risk-dashboard', 'policy', 'payout', 'trust', 'reporting'].every((f) => guard.includes(f + '.routes.ts'));
    record('T5 baseline: public-profiles+marketplace removidos; 7 admin/financeiro justificados (A-E)', removed && seven);
  }

  // ── T7 — Bank intocado ──
  record('T7 Bank intocado (bank_ledger + bank_transactions inalterados)', (await count(`SELECT ((SELECT count(*) FROM bank_ledger)+(SELECT count(*) FROM bank_transactions))::int AS n`)) === bankBefore);

  // ── T8 — contenções/bindings anteriores intactos ──
  {
    const disp = readFileSync(join(process.cwd(), 'src/modules/reconciliation/reconciliation-dispute.routes.ts'), 'utf-8');
    const so = readFileSync(join(process.cwd(), 'src/modules/services/service-order.routes.ts'), 'utf-8');
    const ev = readFileSync(join(process.cwd(), 'src/core/events/event.routes.ts'), 'utf-8');
    record('T8 contenções/bindings anteriores intactos (dispute 403 + service-order 403 + event canRepresentActor)',
      disp.includes('DISPUTE_REVERSAL_HTTP_DISABLED') && so.includes('SERVICE_ORDER_DIRECT_CREATE_DISABLED') && /userRepresentsActor\(/.test(ev));
  }

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${'═'.repeat(64)}`);
  console.log(`RESULTADO: ${results.length - failed.length}/${results.length} verdes`);
  if (failed.length > 0) {
    console.log('FALHAS:'); failed.forEach((f) => console.log(`  ❌ ${f.label} — ${f.reason ?? ''}`));
    await pool.end(); process.exit(1);
  }
  await pool.end();
  console.log('✨ classic readers: writes self/representado bindados (canRepresentActor); admin/financeiro = filtro autorizado baselineado justificado; Bank intocado.');
}
main().catch(async (e) => { console.error('💥 Erro não tratado:', e); try { await pool.end(); } catch { /* noop */ } process.exit(1); });
