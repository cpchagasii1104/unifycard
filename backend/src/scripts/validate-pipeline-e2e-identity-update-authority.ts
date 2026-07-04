/**
 * E2E — BOLA FIX (triagem de autoridade 2026-07-04): POST /identity/update editava a identidade
 * CIVIL (fullName/birthdate/avatar) de OUTRA pessoa, porque resolvia o alvo do actionContext.actorId
 * (client-declared) sem provar representação. Money-free; MATERIAL. DB efêmera. NUNCA unificard_dev.
 *
 *   A · ATACANTE declara actorId da VÍTIMA em x-action-context + body {fullName:'HACKED'} → 403;
 *       global_users.full_name da vítima INALTERADO;
 *   B · ATACANTE atualiza o PRÓPRIO actor → NÃO-403 (a catraca deixa o self passar);
 *   C · Δbank = 0.
 */

import 'tsconfig-paths/register';
import Fastify from 'fastify';
import { pool } from '../core/database/pool';
import { tenantService } from '../core/tenants/tenant.service';
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
  if (!/identity|authority|ephemeral|test/i.test(db)) throw new Error(`ABORT: nome "${db}" não parece efêmero.`);
  console.log(`🔒 DB efêmera confirmada: ${db}`);
}

let seq = 0;
async function mkUserActor(tenantId: string, name: string): Promise<{ userId: string; actorId: string; globalUserId: string }> {
  seq += 1;
  const gu = randomUUID();
  const userId = randomUUID();
  const tax = String(Date.now() + seq * 31).padStart(11, '0').slice(-11);
  await pool.query(`INSERT INTO global_users (global_user_id, cpf, full_name, metadata, created_at, updated_at) VALUES ($1::uuid,$2,$3,'{}'::jsonb,NOW(),NOW())`, [gu, tax, name]);
  await pool.query(`INSERT INTO identities (global_user_id, tax_id, tax_id_type, kyc_status, kyc_level) VALUES ($1::uuid,$2,'cpf','approved','basic')`, [gu, tax]);
  await pool.query(`INSERT INTO users (id, user_id, tenant_id, email, password_hash, token_version, is_test, global_user_id, created_at, updated_at) VALUES ($1::uuid,$1::uuid,$2::uuid,$3,'x',0,true,$4::uuid,NOW(),NOW())`, [userId, tenantId, `idauth-${seq}@e2e.test`, gu]);
  const actorId = (
    await pool.query<{ id: string }>(
      `INSERT INTO actors (tenant_id, actor_type, display_name, user_id, global_user_id) VALUES ($1::uuid,'user',$2,$3::uuid,$4::uuid) RETURNING id::text AS id`,
      [tenantId, name, userId, gu]
    )
  ).rows[0].id;
  return { userId, actorId, globalUserId: gu };
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

  const TENANT = randomUUID();
  await tenantService.createTenant({ id: TENANT, name: 'Identity Update Authority E2E', slug: `idauth-${Date.now()}` });

  const victim = await mkUserActor(TENANT, 'Vitima Real');
  const attacker = await mkUserActor(TENANT, 'Atacante');

  const identityRoutes = (await import('../core/identity/identity.routes')).default;
  const app = Fastify();
  // stub do decorator rbac (só as rotas admin KYB usam requireRole; o alvo /update não) — permite
  // registrar o plugin sem o rbac completo. NÃO afeta o gate testado (canRepresentActor no handler).
  app.decorate('requireRole', () => async () => { /* noop p/ E2E */ });
  app.decorateRequest('user', null);
  app.decorateRequest('tenant', null);
  app.decorateRequest('actionContext', null);
  app.addHook('onRequest', async (req: any) => {
    const uid = req.headers['x-test-user-id'];
    const gid = req.headers['x-test-global-id'];
    const aid = req.headers['x-test-actor-id'];
    req.user = uid ? { userId: uid, id: uid, globalUserId: gid } : null;
    req.tenant = { id: TENANT };
    req.actionContext = aid ? { actorId: aid, intent: 'e2e', source: 'e2e', scope: 'e2e' } : null;
  });
  await app.register(identityRoutes);
  await app.ready();

  const call = (method: 'POST', url: string, opts: { userId?: string; globalId?: string; actorId?: string; body?: unknown }) =>
    app.inject({
      method, url,
      headers: {
        ...(opts.userId ? { 'x-test-user-id': opts.userId } : {}),
        ...(opts.globalId ? { 'x-test-global-id': opts.globalId } : {}),
        ...(opts.actorId ? { 'x-test-actor-id': opts.actorId } : {}),
        'content-type': 'application/json',
      },
      payload: opts.body as object,
    });

  const nameOf = async (gu: string) => (await pool.query<{ n: string }>(`SELECT full_name AS n FROM global_users WHERE global_user_id=$1`, [gu])).rows[0]?.n;

  try {
    console.log('\n— identity update authority END-TO-END (BOLA civil fechado) —');
    const bankBefore = await pool.query<{ n: string }>(
      `SELECT (SELECT COUNT(*) FROM bank_ledger) || ':' || (SELECT COUNT(*) FROM bank_transactions) AS n`
    );

    // A · ATACANTE declara actorId da VÍTIMA → 403, nome da vítima inalterado
    const rHack = await call('POST', '/update', {
      userId: attacker.userId, globalId: attacker.globalUserId,
      actorId: victim.actorId, // o atacante NÃO representa a vítima
      body: { fullName: 'HACKED PELO ATACANTE', birthdate: '1990-01-01' },
    });
    const victimNameAfter = await nameOf(victim.globalUserId);
    record('A /update com actorId da VÍTIMA por ATACANTE → 403, nome civil inalterado',
      rHack.statusCode === 403 && victimNameAfter === 'Vitima Real',
      `status=${rHack.statusCode} nome=${victimNameAfter}`);

    // B · ATACANTE atualiza o PRÓPRIO actor → NÃO-403 (self passa a catraca)
    const rSelf = await call('POST', '/update', {
      userId: attacker.userId, globalId: attacker.globalUserId,
      actorId: attacker.actorId,
      body: { fullName: 'Atacante Editou o Proprio' },
    });
    record('B /update do PRÓPRIO actor → NÃO-403 (self passa)',
      rSelf.statusCode !== 403,
      `status=${rSelf.statusCode} body=${rSelf.body?.slice(0, 160)}`);

    // C · Δbank = 0
    const bankAfter = await pool.query<{ n: string }>(
      `SELECT (SELECT COUNT(*) FROM bank_ledger) || ':' || (SELECT COUNT(*) FROM bank_transactions) AS n`
    );
    record('C Δbank=0', bankBefore.rows[0].n === bankAfter.rows[0].n, `${bankBefore.rows[0].n} → ${bankAfter.rows[0].n}`);
  } finally {
    await app.close();
  }

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${failed.length === 0 ? '🎉 PASS' : '💥 FAIL'} — ${results.length - failed.length}/${results.length}`);
  await pool.end();
  process.exit(failed.length === 0 ? 0 : 1);
}

main().catch(async (e) => {
  console.error('💥 erro fatal:', e?.message ?? e);
  try { await pool.end(); } catch { /* noop */ }
  process.exit(1);
});
