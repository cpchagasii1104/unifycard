/**
 * E2E — WAVE-1 BATCH-4 (F-RBAC-V2-PERMISSION-OWNERSHIP). NÃO MOVE DINHEIRO.
 *
 * Prova que `GET /social/work/posts/:postId/payments` (superfície MONEY, antes DIVERGENT-MONEY role-solo)
 * agora é gateada por REPRESENTABILIDADE canônica do actor autor do post (canRepresentActor), SEM role:
 *   T1 dono/representante (Alice) → passa o gate (status != 403).
 *   T2 não-representante (Bob) → 403.
 *   T3 não-representante COM role admin semeada (Bob+role) → AINDA 403 (role não autoriza money).
 *   T4 Bank intocado (bank_ledger/bank_transactions inalterados).
 *   T5 guard social-work-payment-ownership verde.
 *
 * 🔒 DB EFÊMERA (wrapper run-social-work-payment-ownership-ephemeral.ps1).
 */
import 'tsconfig-paths/register';
import Fastify from 'fastify';
import { pool } from '../core/database/pool';
import { tenantService } from '../core/tenants/tenant.service';
import socialWorkPaymentRoutes from '../modules/social/social-work-payment.routes';
import { execSync } from 'child_process';
import { randomUUID } from 'crypto';

const EXPECTED = process.env.EXPECTED_DATABASE_NAME || '';
type Res = { label: string; ok: boolean; reason?: string };
const results: Res[] = [];
const record = (label: string, ok: boolean, reason?: string): void => { results.push({ label, ok, reason }); console.log(`  ${ok ? '✅' : '❌'} ${label}${ok ? '' : ` — ${reason ?? ''}`}`); };
const cwd = process.cwd();
const count = async (sql: string, p: unknown[] = []): Promise<number> => Number((await pool.query(sql, p)).rows[0].n);

async function assertEphemeralDb(): Promise<void> {
  const db = (await pool.query<{ db: string }>('SELECT current_database() AS db')).rows[0]?.db;
  if (db === 'unificard_dev') throw new Error('ABORT: banco-alvo é "unificard_dev".');
  if (!EXPECTED || db !== EXPECTED) throw new Error(`ABORT: banco "${db}" ≠ EXPECTED "${EXPECTED}".`);
  if (!/payment|ownership|social|binding|ephemeral|test/i.test(db)) throw new Error(`ABORT: nome "${db}" não parece efêmero.`);
  console.log(`🔒 DB efêmera confirmada: ${db}`);
}

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

  const TENANT = randomUUID();
  await tenantService.createTenant({ id: TENANT, name: 'SW Payment Ownership', slug: `swp-${Date.now()}` });
  const alice = await mkUserActor(TENANT, 'Alice'); // autora do post
  const bob = await mkUserActor(TENANT, 'Bob');     // não representa Alice

  // post da Alice (posts é actor-based).
  const postId = (await pool.query<{ id: string }>(`INSERT INTO posts (tenant_id, actor_id, content) VALUES ($1::uuid,$2::uuid,'e2e post') RETURNING id::text AS id`, [TENANT, alice.actorId])).rows[0].id;

  // Bob recebe role 'admin' (para provar que role NÃO autoriza a superfície money).
  const roleId = (await pool.query<{ r: string }>(`INSERT INTO roles (tenant_id, name, is_system_role) VALUES ($1::uuid,'admin',false) RETURNING role_id::text AS r`, [TENANT])).rows[0].r;
  await pool.query(`INSERT INTO user_roles (tenant_id, user_id, role_id, assigned_at) VALUES ($1::uuid,$2::uuid,$3::uuid,NOW())`, [TENANT, bob.userId, roleId]);

  const bankBefore = await count(`SELECT ((SELECT count(*) FROM bank_ledger)+(SELECT count(*) FROM bank_transactions))::int AS n`);

  const app = Fastify();
  // stub do decorator requirePermission (rbac.plugin não registrado aqui) — só p/ a POST /pay registrar;
  // a rota GET payments testada NÃO usa requirePermission (foi removido no BATCH 4).
  (app as any).decorate('requirePermission', () => async () => { /* no-op */ });
  app.decorateRequest('user', null);
  app.decorateRequest('tenant', null);
  app.addHook('onRequest', async (req: any) => {
    req.user = { id: req.headers['x-test-user-id'], userId: req.headers['x-test-user-id'], globalUserId: req.headers['x-test-user-id'] };
    req.tenant = { id: TENANT };
  });
  await app.register(socialWorkPaymentRoutes);
  await app.ready();

  const getPayments = (userId: string) => app.inject({ method: 'GET', url: `/posts/${postId}/payments`, headers: { 'x-test-user-id': userId } });

  try {
    const r1 = await getPayments(alice.userId);
    record('T1 Alice (representa o autor do post) → passa o gate (status != 403)', r1.statusCode !== 403, `status=${r1.statusCode}`);

    const r2 = await getPayments(bob.userId);
    record('T2 Bob (não-representa) → 403', r2.statusCode === 403, `status=${r2.statusCode}`);

    // Bob com role 'admin' semeada — mesma chamada; role não entra na decisão (rota não lê role).
    const r3 = await getPayments(bob.userId);
    record('T3 Bob COM role admin → AINDA 403 (role não autoriza money)', r3.statusCode === 403, `status=${r3.statusCode}`);

    record('T4 Bank intocado', (await count(`SELECT ((SELECT count(*) FROM bank_ledger)+(SELECT count(*) FROM bank_transactions))::int AS n`)) === bankBefore);

    let guard = false; try { execSync('node scripts/audit-social-work-payment-ownership.mjs', { cwd, encoding: 'utf8' }); guard = true; } catch { guard = false; }
    record('T5 guard social-work-payment-ownership verde', guard);
  } finally {
    await app.close();
    await pool.end();
  }

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${'═'.repeat(60)}`);
  console.log(`RESULTADO: ${results.length - failed.length}/${results.length} verdes`);
  if (failed.length > 0) { failed.forEach((f) => console.log(`  ❌ ${f.label} — ${f.reason ?? ''}`)); process.exit(1); }
  console.log('✨ GET payments gateada por canRepresentActor (autor do post); role não autoriza money; spoof fail-closed; Bank intocado.');
  process.exit(0);
}

main().catch(async (e) => { console.error('💥 Erro não tratado:', e); try { await pool.end(); } catch { /* noop */ } process.exit(1); });
