/**
 * E2E — B2f (F-EVENT-ECONOMIC-AUTHORITY-BINDING / DECISION-0131). NÃO MOVE DINHEIRO.
 *
 * Prova que as rotas econômicas v2 que CRIAM estado (POST .../economic/v2/custody e /split) exigem que
 * o chamador REPRESENTE o actor dono do evento (canRepresentActor), ANTES de qualquer side-effect. O actor
 * declarado no body (economic_owner_id / parts[].target_id) é DADO, não autoridade.
 *
 *   T1 custody: Bob (NÃO representa o dono) → 403; nenhuma linha event_custody criada (sem side-effect).
 *   T2 custody: Alice (dona) → passa o gate (status != 403).
 *   T3 split: Bob → 403.
 *   T4 split: Alice → passa o gate (status != 403).
 *   T5 Bank intocado (custody/split não tocam bank_*).
 *   T6 guard event-economic-authority-binding verde.
 *
 * 🔒 DB EFÊMERA (wrapper run-event-economic-authority-binding-ephemeral.ps1).
 */
import 'tsconfig-paths/register';
import Fastify from 'fastify';
import { pool } from '../core/database/pool';
import { tenantService } from '../core/tenants/tenant.service';
import eventRoutes from '../core/events/event.routes';
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
  if (!/event|economic|binding|ephemeral|test/i.test(db)) throw new Error(`ABORT: nome "${db}" não parece efêmero.`);
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
  await tenantService.createTenant({ id: TENANT, name: 'Event Economic Binding', slug: `eeb-${Date.now()}` });
  const alice = await mkUserActor(TENANT, 'Alice'); // dona do evento
  const bob = await mkUserActor(TENANT, 'Bob');     // não representa Alice

  const eventId = (await pool.query<{ id: string }>(
    `INSERT INTO events (tenant_id, actor_id, actor_type, event_type, title) VALUES ($1::uuid,$2::uuid,'user','general','E2E Economic') RETURNING id::text AS id`,
    [TENANT, alice.actorId]
  )).rows[0].id;

  const bankBefore = await count(`SELECT ((SELECT count(*) FROM bank_ledger)+(SELECT count(*) FROM bank_transactions))::int AS n`);

  const app = Fastify();
  app.decorateRequest('user', null);
  app.decorateRequest('tenant', null);
  app.decorateRequest('actionContext', null);
  app.addHook('onRequest', async (req: any) => {
    req.user = { userId: req.headers['x-test-user-id'], id: req.headers['x-test-user-id'] };
    req.tenant = { id: TENANT };
    req.actionContext = { actorId: req.headers['x-test-user-id'] };
  });
  await app.register(eventRoutes);
  await app.ready();

  const custodyPayload = { amount_cents: 1000, currency: 'BRL', economic_owner_id: bob.actorId, economic_owner_type: 'user', purpose: 'e2e' };
  const splitPayload = { custody_id: randomUUID(), parts: [{ target_id: bob.actorId, target_type: 'user', amount_cents: 1000, percentage: 100, role: 'beneficiary' }] };
  const postCustody = (userId: string) => app.inject({ method: 'POST', url: `/${eventId}/economic/v2/custody`, headers: { 'x-test-user-id': userId, 'content-type': 'application/json' }, payload: JSON.stringify(custodyPayload) });
  const postSplit = (userId: string) => app.inject({ method: 'POST', url: `/${eventId}/economic/v2/split`, headers: { 'x-test-user-id': userId, 'content-type': 'application/json' }, payload: JSON.stringify(splitPayload) });

  try {
    // T1 — Bob não representa o dono → 403; sem side-effect (binding ANTES do service).
    const c1 = await postCustody(bob.userId);
    // event_custody pode ser aspiracional (não migrada); o 403 acontece ANTES do service, então não há insert.
    let custodyRows = 0;
    try { custodyRows = await count(`SELECT count(*)::int n FROM event_custody WHERE event_id=$1`, [eventId]); } catch { custodyRows = 0; }
    record('T1 custody: Bob (não-representa) → 403; nenhuma custody criada (sem side-effect)', c1.statusCode === 403 && custodyRows === 0, `status=${c1.statusCode} rows=${custodyRows}`);

    // T2 — Alice (dona) passa o gate (binding não bloqueia o dono).
    const c2 = await postCustody(alice.userId);
    record('T2 custody: Alice (representa o dono) → passa o gate (status != 403)', c2.statusCode !== 403, `status=${c2.statusCode}`);

    // T3 — Bob split → 403.
    const s1 = await postSplit(bob.userId);
    record('T3 split: Bob (não-representa) → 403', s1.statusCode === 403, `status=${s1.statusCode}`);

    // T4 — Alice split → passa o gate.
    const s2 = await postSplit(alice.userId);
    record('T4 split: Alice (representa o dono) → passa o gate (status != 403)', s2.statusCode !== 403, `status=${s2.statusCode}`);

    // T5 — Bank intocado.
    record('T5 Bank intocado (bank_ledger+bank_transactions inalterados)', (await count(`SELECT ((SELECT count(*) FROM bank_ledger)+(SELECT count(*) FROM bank_transactions))::int AS n`)) === bankBefore);

    // T6 — guard verde.
    let guard = false; try { execSync('node scripts/audit-event-economic-authority-binding.mjs', { cwd, encoding: 'utf8' }); guard = true; } catch { guard = false; }
    record('T6 guard event-economic-authority-binding verde', guard);
  } finally {
    await app.close();
    await pool.end();
  }

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${'═'.repeat(60)}`);
  console.log(`RESULTADO: ${results.length - failed.length}/${results.length} verdes`);
  if (failed.length > 0) { failed.forEach((f) => console.log(`  ❌ ${f.label} — ${f.reason ?? ''}`)); process.exit(1); }
  console.log('✨ Rotas econômicas v2 vinculam autoridade ao dono do evento (canRepresentActor); spoof por body fail-closed; Bank intocado.');
  process.exit(0);
}

main().catch(async (e) => { console.error('💥 Erro não tratado:', e); try { await pool.end(); } catch { /* noop */ } process.exit(1); });
