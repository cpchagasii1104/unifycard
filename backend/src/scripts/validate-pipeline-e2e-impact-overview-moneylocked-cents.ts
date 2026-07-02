/**
 * E2E — F-IMPACT-OVERVIEW-MONEYLOCKED-CENTS-FIX (DT-IMPACT-OVERVIEW-MONEYLOCKED-CENTS-100X-INFLATION).
 * NÃO MOVE DINHEIRO. Prova que GET /me/impact-overview reporta pendingImpact.moneyLockedCents = SUM dos
 * service_payment_requests pendentes JÁ EM CENTAVOS (amount_cents, nomenclatura 07) — sem o `* 100` legado
 * que inflava o display em 100×. É correção display/read-model: bank_ledger intocado, Δbank=0.
 *
 *   A GET /me/impact-overview → 200
 *   B moneyLockedCents = 5000 (2 payments pendentes 2000+3000; ANTES do fix seria 500000 = 100×)
 *   C pagamento NÃO-pending (paid) NÃO conta
 *   D pagamento de OUTRO payer NÃO conta (payer_actor_id filtra)
 *   E Δbank=0 (bank_ledger+transactions+splits inalterados) · F guard estrutural verde
 *
 * 🔒 DB EFÊMERA (run-impact-overview-moneylocked-cents-ephemeral.ps1). NUNCA toca unificard_dev.
 */
import 'tsconfig-paths/register';
import Fastify from 'fastify';
import { pool } from '../core/database/pool';
import { tenantService } from '../core/tenants/tenant.service';
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
  if (!/impact|moneylocked|cents|ephemeral|test/i.test(db)) throw new Error(`ABORT: nome "${db}" não parece efêmero.`);
  console.log(`🔒 DB efêmera confirmada: ${db}`);
}

let seq = 0;
async function mkUserActor(tenantId: string, name: string): Promise<{ userId: string; actorId: string; gu: string }> {
  seq += 1;
  const gu = randomUUID(); const userId = randomUUID();
  const tax = String(Date.now() + seq * 17).padStart(11, '0').slice(-11);
  await pool.query(`INSERT INTO global_users (global_user_id, cpf, metadata, created_at, updated_at) VALUES ($1::uuid,$2,'{}'::jsonb,NOW(),NOW())`, [gu, tax]);
  await pool.query(`INSERT INTO identities (global_user_id, tax_id, tax_id_type, kyc_status, kyc_level) VALUES ($1::uuid,$2,'cpf','approved','basic')`, [gu, tax]);
  await pool.query(`INSERT INTO users (id, user_id, tenant_id, email, password_hash, token_version, is_test, global_user_id, created_at, updated_at) VALUES ($1::uuid,$1::uuid,$2::uuid,$3,'x',0,true,$4::uuid,NOW(),NOW())`, [userId, tenantId, `${name}-${seq}@e2e.test`, gu]);
  const actorId = (await pool.query<{ id: string }>(`INSERT INTO actors (tenant_id, actor_type, display_name, user_id, global_user_id) VALUES ($1::uuid,'user',$2,$3::uuid,$4::uuid) RETURNING id::text AS id`, [tenantId, name, userId, gu])).rows[0].id;
  return { userId, actorId, gu };
}
async function mkPayment(tenantId: string, payerActorId: string, receiverActorId: string, amountCents: number, status: 'pending' | 'paid'): Promise<void> {
  await pool.query(
    `INSERT INTO service_payment_requests (tenant_id, booking_id, service_id, payer_actor_id, receiver_actor_id, payment_request_status, amount_cents, currency, requested_at)
       VALUES ($1::uuid,$2::uuid,$3::uuid,$4::uuid,$5::uuid,$6,$7,'BRL',NOW())`,
    [tenantId, randomUUID(), randomUUID(), payerActorId, receiverActorId, status, amountCents]
  );
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
  await tenantService.createTenant({ id: TENANT, name: 'Impact MoneyLocked Cents', slug: `imlc-${Date.now()}` });
  const alice = await mkUserActor(TENANT, 'Alice');   // payer sob teste
  const bob = await mkUserActor(TENANT, 'Bob');       // outro payer (não deve contar)
  const prov = await mkUserActor(TENANT, 'Prov');     // receiver

  // Alice: 2 pending (2000 + 3000 = 5000 cents) + 1 paid (9999, não conta). Bob: 1 pending (7777, não conta).
  await mkPayment(TENANT, alice.actorId, prov.actorId, 2000, 'pending');
  await mkPayment(TENANT, alice.actorId, prov.actorId, 3000, 'pending');
  await mkPayment(TENANT, alice.actorId, prov.actorId, 9999, 'paid');
  await mkPayment(TENANT, bob.actorId, prov.actorId, 7777, 'pending');

  const bankBefore = await count(`SELECT ((SELECT count(*) FROM bank_ledger)+(SELECT count(*) FROM bank_transactions)+(SELECT count(*) FROM bank_splits))::int AS n`);

  const impactRoutes = (await import('../core/profile/impact-overview.routes')).default;
  const app = Fastify();
  app.decorateRequest('user', null);
  app.decorateRequest('tenant', null);
  app.decorateRequest('actionContext', null);
  app.addHook('onRequest', async (req: any) => {
    const uid = req.headers['x-test-user-id'];
    req.user = { id: uid, userId: uid, globalUserId: req.headers['x-test-gu'] };
    req.tenant = { id: TENANT };
    req.actionContext = { actorId: req.headers['x-test-actor-id'], intent: 'e2e', source: 'e2e', scope: 'e2e' };
  });
  await app.register(impactRoutes);
  await app.ready();
  const get = () => app.inject({ method: 'GET', url: '/me/impact-overview', headers: { 'x-test-user-id': alice.userId, 'x-test-gu': alice.gu, 'x-test-actor-id': alice.actorId } });

  try {
    const r = await get();
    record('A GET /me/impact-overview → 200', r.statusCode === 200, `status=${r.statusCode}: ${r.body.slice(0, 160)}`);
    const body = r.statusCode === 200 ? JSON.parse(r.body) : {};
    const mlc = body?.pendingImpact?.moneyLockedCents;
    record('B moneyLockedCents = 5000 (soma direta em centavos; ANTES do fix seria 500000 = 100×)', mlc === 5000, `moneyLockedCents=${mlc} (esperado 5000; bug seria 500000)`);
    record('C+D pagamento paid e payer alheio NÃO contam (só 2000+3000 pending de Alice)', mlc === 5000, `moneyLockedCents=${mlc}`);

    const bankAfter = await count(`SELECT ((SELECT count(*) FROM bank_ledger)+(SELECT count(*) FROM bank_transactions)+(SELECT count(*) FROM bank_splits))::int AS n`);
    record('E Δbank=0 (bank_ledger+transactions+splits inalterados)', bankAfter === bankBefore, `before=${bankBefore} after=${bankAfter}`);

    let g = 0; try { execSync('node scripts/audit-provider-availability-readers-canonical.mjs', { cwd, encoding: 'utf8' }); } catch { g = 1; }
    record('F guard estrutural verde (anti-*100 + readers canônicos)', g === 0);
  } finally {
    await app.close();
    await pool.end();
  }

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${'═'.repeat(64)}`);
  console.log(`RESULTADO: ${results.length - failed.length}/${results.length} verdes`);
  if (failed.length > 0) { failed.forEach((f) => console.log(`  ❌ ${f.label} — ${f.reason ?? ''}`)); process.exit(1); }
  console.log('✨ moneyLockedCents = SUM(amount_cents) direto (sem *100); paid/alheio excluídos; Δbank=0. Painel honesto.');
  process.exit(0);
}

main().catch(async (e) => { console.error('💥 Erro não tratado:', e); try { await pool.end(); } catch { /* noop */ } process.exit(1); });
