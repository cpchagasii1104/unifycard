/**
 * E2E — PDV-F2A (PDV payment authority binding). NÃO MOVE DINHEIRO.
 *
 * Prova que `POST /pdv/orders/:orderId/pay` (money via Core) exige autoridade CANÔNICA por
 * REPRESENTABILIDADE do SELLER da ordem (canRepresentActor sobre order.sellerActorId, server-side),
 * ANTES do side-effect (payOrderFromPdv). role/capability/actionContext.actorId NÃO autorizam sozinhos.
 *
 *   T1 operador que REPRESENTA o seller da ordem → passa o gate (status != 403; falha downstream por
 *      falta de sessão = DEPOIS do gate; sem money).
 *   T2 operador que NÃO representa o seller da ordem → 403 "represent the order seller" ANTES de payOrderFromPdv.
 *   T3 spoof: actionContext.actorId = actor de outro usuário → 403 (não autoriza; bloqueado antes do gate/side-effect).
 *   T4 Bank intocado (bank_ledger/bank_transactions inalterados em todos).
 *   T5 guard pdv-authority-lock verde.
 *
 * 🔒 DB EFÊMERA (wrapper run-pdv-payment-authority-ephemeral.ps1).
 */
import 'tsconfig-paths/register';
import Fastify from 'fastify';
import { pool } from '../core/database/pool';
import { tenantService } from '../core/tenants/tenant.service';
import pdvRoutes from '../modules/pdv/pdv.routes';
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
  if (!/pdv|payment|authority|ephemeral|test/i.test(db)) throw new Error(`ABORT: nome "${db}" não parece efêmero.`);
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

async function mkOrder(tenantId: string, sellerActorId: string, buyerActorId: string): Promise<string> {
  return (await pool.query<{ id: string }>(
    `INSERT INTO orders (tenant_id, buyer_actor_id, seller_actor_id, total_cents, status) VALUES ($1::uuid,$2::uuid,$3::uuid,1000,'cancelled') RETURNING id::text AS id`,
    [tenantId, buyerActorId, sellerActorId]
  )).rows[0].id;
}

let CURRENT_USER = ''; let CURRENT_AC = '';

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
  await tenantService.createTenant({ id: TENANT, name: 'PDV Payment Authority', slug: `pdvpa-${Date.now()}` });
  const alice = await mkUserActor(TENANT, 'Alice'); // operadora; representa o seller actorAlice
  const bob = await mkUserActor(TENANT, 'Bob');
  // actor_registry p/ actorAlice com can_hold_assets → requirePermission(marketplace_execute_payments) passa via ownership.
  await pool.query(`INSERT INTO actor_registry (tenant_id, actor_id, actor_type, entity_table, entity_id, capabilities_json) VALUES ($1::uuid,$2::uuid,'user','users',$3,'{"can_hold_assets":true}'::jsonb)`, [TENANT, alice.actorId, alice.userId]);

  const orderOwn = await mkOrder(TENANT, alice.actorId, bob.actorId);   // seller = actorAlice
  const orderOther = await mkOrder(TENANT, bob.actorId, alice.actorId); // seller = actorBob

  const bankBefore = await count(`SELECT ((SELECT count(*) FROM bank_ledger)+(SELECT count(*) FROM bank_transactions))::int AS n`);

  const app = Fastify();
  app.decorateRequest('user', null);
  app.decorateRequest('tenant', null);
  app.decorateRequest('actionContext', null);
  app.addHook('onRequest', async (req: any) => {
    req.user = { id: CURRENT_USER, userId: CURRENT_USER };
    req.tenant = { id: TENANT };
    req.actionContext = { actorId: CURRENT_AC, scope: 'tenant', intent: 'execute' };
  });
  await app.register(pdvRoutes, { prefix: '/pdv' });
  await app.ready();

  const pay = (orderId: string, sellerActorId: string, buyerActorId: string) => app.inject({
    method: 'POST', url: `/pdv/orders/${orderId}/pay`, headers: { 'content-type': 'application/json' },
    payload: JSON.stringify({ sessionId: randomUUID(), orderId, amountCents: 1000, currency: 'BRL', sellerActorId, buyerActorId }),
  });
  const is403 = (r: any) => r.statusCode === 403;

  try {
    // T1 — operadora representa o seller da ordem (actorAlice) → passa o gate.
    CURRENT_USER = alice.userId; CURRENT_AC = alice.actorId;
    const r1 = await pay(orderOwn, alice.actorId, bob.actorId);
    record('T1 representa o seller da ordem → passa o gate (status != 403; falha downstream sem money)', !is403(r1), `status=${r1.statusCode}`);

    // T2 — operadora NÃO representa o seller (actorBob) → 403 antes de payOrderFromPdv.
    CURRENT_USER = alice.userId; CURRENT_AC = alice.actorId;
    const r2 = await pay(orderOther, bob.actorId, alice.actorId);
    const b2 = (() => { try { return JSON.parse(r2.body); } catch { return null; } })();
    record('T2 NÃO representa o seller → 403 (represent the order seller)', is403(r2) && /represent the order seller/i.test(b2?.error || ''), `status=${r2.statusCode} err=${b2?.error}`);

    // T3 — spoof: actionContext.actorId = actor de Bob (Alice não o possui) → 403, não autoriza.
    CURRENT_USER = alice.userId; CURRENT_AC = bob.actorId;
    const r3 = await pay(orderOwn, alice.actorId, bob.actorId);
    record('T3 spoof actionContext.actorId (actor de outro user) → 403', is403(r3), `status=${r3.statusCode}`);

    // T4 — Bank intocado em todos os cenários.
    record('T4 Bank intocado (bank_ledger+bank_transactions inalterados)', (await count(`SELECT ((SELECT count(*) FROM bank_ledger)+(SELECT count(*) FROM bank_transactions))::int AS n`)) === bankBefore);

    // T5 — guard verde.
    let guard = false; try { execSync('node scripts/audit-pdv-authority-lock.mjs', { cwd, encoding: 'utf8' }); guard = true; } catch { guard = false; }
    record('T5 guard pdv-authority-lock verde', guard);
  } finally {
    await app.close();
    await pool.end();
  }

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${'═'.repeat(60)}`);
  console.log(`RESULTADO: ${results.length - failed.length}/${results.length} verdes`);
  if (failed.length > 0) { failed.forEach((f) => console.log(`  ❌ ${f.label} — ${f.reason ?? ''}`)); process.exit(1); }
  console.log('✨ PDV pay exige representar o SELLER da ordem (canRepresentActor) antes do side-effect; role/capability/actionContext não autorizam sozinhos; Bank intocado.');
  process.exit(0);
}

main().catch(async (e) => { console.error('💥 Erro não tratado:', e); try { await pool.end(); } catch { /* noop */ } process.exit(1); });
