/**
 * E2E F-0113-EVENT-ACTOR-BODY-BINDING.
 *
 * 🔒 DB EFÊMERA. Guard duro: current_database() === EXPECTED_DATABASE_NAME e NUNCA 'unificard_dev'.
 *    Orquestrado por scripts/run-event-actor-body-binding-ephemeral.ps1.
 *
 * Prova que actor_id/actor_type/responsible_actor_id/observed_by_actor_id/attendee_actor_id vindos do
 * body são HINT: o utilizador autenticado (req.user.userId) DEVE representar o actor server-side via
 * canRepresentActor — fail-closed. Sem representabilidade → 403. body actor não autoriza.
 */
import 'tsconfig-paths/register';
import Fastify from 'fastify';
import { pool } from '../core/database/pool';
import { tenantService } from '../core/tenants/tenant.service';
import eventRoutes from '../core/events/event.routes';
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
  if (!/event|actor|binding|ephemeral|smoke|test/i.test(db)) throw new Error(`ABORT: nome "${db}" não parece efêmero.`);
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
  await tenantService.createTenant({ id: TENANT_ID, name: 'Event Actor Binding', slug: `eab-${Date.now()}` });
  const alice = await mkUserActor(TENANT_ID, 'Alice');
  const bob = await mkUserActor(TENANT_ID, 'Bob');

  // page actor da empresa gerida pela Alice (para o caminho page de canRepresentActor)
  const companyId = (await pool.query<{ c: string }>(`INSERT INTO companies (tenant_id, company_name) VALUES ($1::uuid,'Alice Co') RETURNING company_id::text AS c`, [TENANT_ID])).rows[0].c;
  await pool.query(`INSERT INTO company_users (tenant_id, company_id, global_user_id, role, can_manage_company, is_active, is_primary, can_manage_financial, can_manage_employees, can_view_reports) VALUES ($1::uuid,$2::uuid,$3::uuid,'owner',true,true,true,false,false,true)`, [TENANT_ID, companyId, alice.gu]);
  const alicePage = (await pool.query<{ id: string }>(`INSERT INTO actors (tenant_id, actor_type, display_name, company_id, responsible_actor_id) VALUES ($1::uuid,'page','Alice Page',$2::uuid,$3::uuid) RETURNING id::text AS id`, [TENANT_ID, companyId, alice.actorId])).rows[0].id;

  const bankBefore = await count(`SELECT ((SELECT count(*) FROM bank_ledger)+(SELECT count(*) FROM bank_transactions))::int AS n`);

  // ── canRepresentActor truth function (base do gate) ──
  record('T-rep ownership: canRepresentActor(Alice, AliceActor)=true', (await authorizationService.canRepresentActor(TENANT_ID, alice.userId, alice.actorId)) === true);
  record('T-rep non-rep: canRepresentActor(Bob, AliceActor)=false', (await authorizationService.canRepresentActor(TENANT_ID, bob.userId, alice.actorId)) === false);
  record('T-page company: canRepresentActor(Alice, AlicePage)=true (gere a empresa)', (await authorizationService.canRepresentActor(TENANT_ID, alice.userId, alicePage)) === true);
  record('T-page non-rep: canRepresentActor(Bob, AlicePage)=false', (await authorizationService.canRepresentActor(TENANT_ID, bob.userId, alicePage)) === false);

  // ── HTTP behavioral em POST /events ──
  const app = Fastify();
  app.decorateRequest('user', null);
  app.decorateRequest('tenant', null);
  app.decorateRequest('actionContext', null);
  app.addHook('onRequest', async (req: any) => {
    req.user = { userId: req.headers['x-test-user-id'] };
    req.tenant = { id: TENANT_ID };
    req.actionContext = { actorId: req.headers['x-test-actor-id'] };
  });
  await app.register(eventRoutes);
  await app.ready();

  const postEvent = async (userId: string, actorId: string) => app.inject({
    method: 'POST', url: '/',
    headers: { 'x-test-user-id': userId, 'x-test-actor-id': actorId },
    payload: { actor_id: actorId, actor_type: 'user', event_type: 'social', title: 'E2E Event', visibility: 'public' },
  });

  // T2 — Bob NÃO representa AliceActor → 403 (body.actor_id não autoriza)
  {
    const res = await postEvent(bob.userId, alice.actorId);
    let msg = ''; try { msg = JSON.parse(res.body)?.error?.message || JSON.parse(res.body)?.message || ''; } catch { /* noop */ }
    record('T2 Bob (não-representa) POST /events actor=Alice → 403', res.statusCode === 403, `status=${res.statusCode} msg=${msg}`);
  }
  // T1/T3 — Alice representa o próprio actor → passa o gate (não-403 de representabilidade)
  {
    const res = await postEvent(alice.userId, alice.actorId);
    record('T1/T3 Alice (representa) POST /events → passa o gate (status != 403)', res.statusCode !== 403, `status=${res.statusCode}`);
  }
  await app.close();

  // ── T4/T-struct — cada handler body-actor chama userRepresentsActor ANTES do service ──
  {
    const src = readFileSync(join(process.cwd(), 'src/core/events/event.routes.ts'), 'utf-8');
    const helper = /async function userRepresentsActor\(/.test(src) && /authorizationService\.canRepresentActor\(/.test(src);
    const gateCount = (src.match(/userRepresentsActor\(req\.tenant\.id, req\.user\.userId/g) || []).length;
    // POST /events, draft, v2/create, commitments, check-in, check-out, checkout = >=7 gates
    record('T4 helper canRepresentActor + >=7 gates server-side (body actor não é autoridade)', helper && gateCount >= 7, `gates=${gateCount}`);
    // nenhum handler ainda confia no match contra actionContext como autoridade de page
    const noWeakPageExistence = !/TODO: (Implementar valida|Validar ownership de page)/.test(src);
    record('T-struct caminhos page existence-only (TODO) removidos', noWeakPageExistence);
  }

  // ── T6 — checkout (money): gate de representabilidade ANTES de processCheckout ──
  {
    const src = readFileSync(join(process.cwd(), 'src/core/events/event.routes.ts'), 'utf-8');
    const idxGate = src.indexOf('representar o attendee declarado');
    const idxCheckout = src.indexOf('eventEconomyService.processCheckout(');
    record('T6 checkout: userRepresentsActor(attendee) ANTES de processCheckout (motor financeiro intocado)', idxGate > 0 && idxCheckout > 0 && idxGate < idxCheckout);
  }

  // ── T5 — guard 0113 sem new/stale (rodado externamente; aqui valida ausência de baseline event.routes) ──
  {
    const guard = readFileSync(join(process.cwd(), 'scripts/audit-actor-authority-boundary.mjs'), 'utf-8');
    record('T5 event.routes.ts removido do baseline 0113 (sem maquiagem)', !/'core\/events\/event\.routes\.ts':/.test(guard));
  }

  // ── T7 — Bank intocado ──
  record('T7 Bank intocado (bank_ledger + bank_transactions inalterados)', (await count(`SELECT ((SELECT count(*) FROM bank_ledger)+(SELECT count(*) FROM bank_transactions))::int AS n`)) === bankBefore);
  // ── T8 — contenções anteriores intactas ──
  {
    const disp = readFileSync(join(process.cwd(), 'src/modules/reconciliation/reconciliation-dispute.routes.ts'), 'utf-8');
    const so = readFileSync(join(process.cwd(), 'src/modules/services/service-order.routes.ts'), 'utf-8');
    record('T8 contenções intactas (dispute 403 + POST /service-orders 403)', disp.includes('DISPUTE_REVERSAL_HTTP_DISABLED') && so.includes('SERVICE_ORDER_DIRECT_CREATE_DISABLED'));
  }

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${'═'.repeat(64)}`);
  console.log(`RESULTADO: ${results.length - failed.length}/${results.length} verdes`);
  if (failed.length > 0) {
    console.log('FALHAS:'); failed.forEach((f) => console.log(`  ❌ ${f.label} — ${f.reason ?? ''}`));
    await pool.end(); process.exit(1);
  }
  await pool.end();
  console.log('✨ event body actor é HINT; autoridade = canRepresentActor(req.user.userId, actor) server-side; fail-closed; Bank intocado.');
}
main().catch(async (e) => { console.error('💥 Erro não tratado:', e); try { await pool.end(); } catch { /* noop */ } process.exit(1); });
