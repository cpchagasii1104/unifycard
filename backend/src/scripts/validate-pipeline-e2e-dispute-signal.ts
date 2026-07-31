/**
 * E2E — F-DISPUTE-SIGNAL (2026-07-31)
 *
 * Prova COMPORTAMENTAL, HTTP real:
 *   1) GET /my-orders NÃO quebra (200, não 500) mesmo com evidence_packs ausente (schema-ghost,
 *      medido) — hoje qualquer usuário com 1+ service_order faria a rota inteira 500.
 *   2) service_order com disputed_at PREENCHIDO → hasOpenDispute=true, status='disputed'.
 *      service_order com disputed_at NULL → hasOpenDispute=false (conhecido, não unknown —
 *      contexto TEM service_order), status normal.
 *   3) o log estruturado da falha de leitura de evidence_packs APARECE (capturado de
 *      console.warn) — erro de "tabela não existe" não pode sumir em silêncio.
 *
 * 🔒 DB EFÊMERA. Orquestrado por scripts/run-dispute-signal-ephemeral.ps1.
 * Modo: npx tsx backend/src/scripts/validate-pipeline-e2e-dispute-signal.ts
 */
import 'tsconfig-paths/register';
import dotenv from 'dotenv';
import { join } from 'path';
import Fastify, { FastifyInstance } from 'fastify';
import sensible from '@fastify/sensible';
import jwt from 'jsonwebtoken';
import { randomUUID } from 'crypto';

import { pool } from '../core/database/pool';
import { tenantService } from '../core/tenants/tenant.service';
import { rbacService } from '../core/rbac/rbac.service';
import authPlugin from '../core/auth/auth.plugin';
import { tenantPlugin } from '../plugins/tenant.plugin';
import { actionContextPlugin } from '../plugins/action-context.plugin';
import { rbacPlugin } from '../plugins/rbac.plugin';

dotenv.config({ path: join(process.cwd(), '.env') });

const EXPECTED = process.env.EXPECTED_DATABASE_NAME || '';
const JWT_SECRET = process.env.JWT_SECRET;

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
  if (!EXPECTED || db !== EXPECTED) throw new Error(`ABORT: banco-alvo "${db}" ≠ EXPECTED "${EXPECTED}".`);
  if (!/dispute|signal|ephemeral|test/i.test(db)) throw new Error(`ABORT: nome de banco "${db}" não parece efêmero.`);
  if (!JWT_SECRET) throw new Error('ABORT: JWT_SECRET ausente.');
  console.log(`🔒 DB efêmera confirmada: ${db}`);
  const evPacks = await pool.query<{ t: string | null }>(`SELECT to_regclass('public.evidence_packs')::text AS t`);
  record('pré-condição: evidence_packs NÃO existe nesta DB (schema-ghost, como medido em unificard_dev)', evPacks.rows[0].t === null, `to_regclass=${evPacks.rows[0].t}`);
}

async function bootstrapSocialPorts(): Promise<void> {
  const { socialPortsRegistry } = await import('../core/social/ports-registry');
  const adapters = await import('../modules/social/adapters');
  socialPortsRegistry.setActorRepository(adapters.actorRepositoryAdapter);
  socialPortsRegistry.setActorUtils(adapters.actorUtilsAdapter);
  socialPortsRegistry.setSocialRepository(adapters.socialRepositoryAdapter);
  socialPortsRegistry.setSocialService(adapters.socialServiceAdapter);
  socialPortsRegistry.setEventFeedHandlers(adapters.eventFeedHandlersAdapter);
}

async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({ logger: false });
  await app.register(sensible);
  await app.register(authPlugin);
  await app.register(tenantPlugin);
  await app.register(actionContextPlugin);
  await app.register(rbacPlugin);
  const { default: myOrdersRoutes } = await import('../modules/my-orders/my-orders.routes');
  await app.register(myOrdersRoutes, { prefix: '/api' });
  await app.ready();
  return app;
}

async function main(): Promise<void> {
  await assertEphemeralDb();
  await bootstrapSocialPorts();

  const TENANT_ID = randomUUID();
  await tenantService.createTenant({ id: TENANT_ID, name: 'Dispute Signal Test', slug: `dispute-signal-${Date.now()}` });
  await rbacService.seedDefaultRBAC(TENANT_ID);

  const { socialPortsRegistry } = await import('../core/social/ports-registry');
  const actorRepo = socialPortsRegistry.getActorRepository();

  const globalId = randomUUID();
  const userId = randomUUID();
  const cpf = String(Date.now() % 100000000).padStart(11, '0').slice(-11);
  await pool.query(`INSERT INTO global_users (global_user_id, cpf, full_name, metadata) VALUES ($1,$2,$3,'{}'::jsonb)`, [globalId, cpf, 'E2E Customer']);
  await pool.query(`INSERT INTO identities (global_user_id, tax_id, tax_id_type, kyc_status, kyc_level) VALUES ($1,$2,'cpf','pending','none')`, [globalId, cpf]);
  await pool.query(`INSERT INTO users (id, user_id, tenant_id, global_user_id, email, password_hash, token_version) VALUES ($1,$1,$2,$3,$4,'x',0)`, [userId, TENANT_ID, globalId, `${userId}@e2e.local`]);
  const customerActorId = (await actorRepo.findOrCreateUserActor(TENANT_ID, userId)).actor_id;

  const token = jwt.sign(
    { sub: userId, userId, tenantId: TENANT_ID, email: `${userId}@e2e.local`, tokenVersion: 0, globalUserId: globalId, type: 'access' },
    JWT_SECRET as string,
    { expiresIn: '15m' }
  );
  const ac = JSON.stringify({ actorId: customerActorId, intent: 'dispute_signal_e2e', source: 'e2e', scope: `tenant:${TENANT_ID}` });
  const headers = { authorization: `Bearer ${token}`, 'x-action-context': ac };

  // worker (prestador) — pode ser o mesmo humano noutro papel, só pra satisfazer a FK
  const workerActorId = customerActorId;

  const conceptId = (await pool.query<{ id: string }>(`SELECT concept_id::text AS id FROM concepts LIMIT 1`)).rows[0].id;
  const canonicalServiceId = randomUUID();
  await pool.query(
    `INSERT INTO canonical_services (id, tenant_id, scope, concept_id, name, slug, status)
     VALUES ($1::uuid,$2::uuid,'scoped',$3::uuid,'E2E Canonical Service',$4,'active')`,
    [canonicalServiceId, TENANT_ID, conceptId, `e2e-canonical-${Date.now()}`]
  );
  const serviceId = (await pool.query<{ id: string }>(
    `INSERT INTO services (tenant_id, actor_id, name, slug, canonical_service_id) VALUES ($1,$2,'E2E Service', $3, $4::uuid) RETURNING service_id::text AS id`,
    [TENANT_ID, workerActorId, `e2e-service-${Date.now()}`, canonicalServiceId]
  )).rows[0].id;

  // service_order A: SEM disputa (disputed_at NULL)
  const orderNoDisputeId = (await pool.query<{ id: string }>(
    `INSERT INTO service_orders (tenant_id, service_id, worker_actor_id, customer_actor_id, status, scheduled_start, created_by_actor_id)
     VALUES ($1,$2,$3,$4,'confirmed', now() + interval '1 day', $3) RETURNING id::text AS id`,
    [TENANT_ID, serviceId, workerActorId, customerActorId]
  )).rows[0].id;

  // service_order B: COM disputa (disputed_at preenchido)
  const orderDisputedId = (await pool.query<{ id: string }>(
    `INSERT INTO service_orders (tenant_id, service_id, worker_actor_id, customer_actor_id, status, scheduled_start, created_by_actor_id, disputed_at)
     VALUES ($1,$2,$3,$4,'confirmed', now() + interval '1 day', $3, now()) RETURNING id::text AS id`,
    [TENANT_ID, serviceId, workerActorId, customerActorId]
  )).rows[0].id;

  const app = await buildApp();
  const warnLines: string[] = [];
  const originalWarn = console.warn;
  console.warn = (...args: unknown[]) => {
    warnLines.push(args.map((a) => (typeof a === 'string' ? a : JSON.stringify(a))).join(' '));
    originalWarn(...args);
  };

  try {
    console.log('\n— GET /my-orders: não quebra com evidence_packs ausente —');
    const res = await app.inject({ method: 'GET', url: '/api/my-orders?limit=100', headers });
    record('GET /my-orders → HTTP 200 (não 500)', res.statusCode === 200, `HTTP ${res.statusCode}: ${res.body.slice(0, 300)}`);

    const body = res.statusCode === 200 ? JSON.parse(res.body) : { orders: [] };
    const orders: any[] = body.orders || [];
    const withoutDispute = orders.find((o) => o.serviceOrderId === orderNoDisputeId);
    const withDispute = orders.find((o) => o.serviceOrderId === orderDisputedId);

    console.log('\n— ANTES/DEPOIS por sítio (valor que a comparação produz) —');
    record('service_order SEM disputa (disputed_at NULL) está na resposta', !!withoutDispute, JSON.stringify(orders.map((o) => o.serviceOrderId)));
    if (withoutDispute) {
      console.log(`  ordem sem disputa: hasOpenDispute=${withoutDispute.hasOpenDispute} status=${withoutDispute.status}`);
      record('  → hasOpenDispute === false (conhecido, não unknown — ANTES desta fatia seria sempre false por acaso; AGORA é false por LER disputed_at=NULL)', withoutDispute.hasOpenDispute === false, `hasOpenDispute=${withoutDispute.hasOpenDispute}`);
      record('  → status NÃO é "disputed"', withoutDispute.status !== 'disputed', `status=${withoutDispute.status}`);
    }
    record('service_order COM disputa (disputed_at preenchido) está na resposta', !!withDispute, JSON.stringify(orders.map((o) => o.serviceOrderId)));
    if (withDispute) {
      console.log(`  ordem com disputa: hasOpenDispute=${withDispute.hasOpenDispute} status=${withDispute.status}`);
      record('  → hasOpenDispute === true (ANTES desta fatia: sempre false, mesmo com disputa real — silencioso)', withDispute.hasOpenDispute === true, `hasOpenDispute=${withDispute.hasOpenDispute}`);
      record('  → status === "disputed"', withDispute.status === 'disputed', `status=${withDispute.status}`);
    }

    console.log('\n— erro de leitura (evidence_packs ausente) aparece, não some —');
    const sawWarn = warnLines.some((l) => l.includes('[MyOrdersService]') && l.includes('evidence_packs'));
    record('console.warn nomeando "evidence_packs" (schema-ghost) apareceu durante a chamada', sawWarn, `warnLines capturadas=${warnLines.length}`);

    console.log('\n— achado extra: my-orders.routes.ts:44 filtrava hasOpenDispute=false por padrão (corrigido) —');
    record('SEM filtro na URL: as 2 ordens aparecem (não filtra por padrão)', orders.length === 2, `orders.length=${orders.length}`);
    const resTrue = await app.inject({ method: 'GET', url: '/api/my-orders?limit=100&hasOpenDispute=true', headers });
    const bodyTrue = resTrue.statusCode === 200 ? JSON.parse(resTrue.body) : { orders: [] };
    const ordersTrue: any[] = bodyTrue.orders || [];
    record('?hasOpenDispute=true: só a ordem disputada volta', ordersTrue.length === 1 && ordersTrue[0]?.serviceOrderId === orderDisputedId, JSON.stringify(ordersTrue.map((o) => o.serviceOrderId)));
    const resFalse = await app.inject({ method: 'GET', url: '/api/my-orders?limit=100&hasOpenDispute=false', headers });
    const bodyFalse = resFalse.statusCode === 200 ? JSON.parse(resFalse.body) : { orders: [] };
    const ordersFalse: any[] = bodyFalse.orders || [];
    record('?hasOpenDispute=false: só a ordem SEM disputa volta', ordersFalse.length === 1 && ordersFalse[0]?.serviceOrderId === orderNoDisputeId, JSON.stringify(ordersFalse.map((o) => o.serviceOrderId)));
  } finally {
    console.warn = originalWarn;
    await app.close();
  }

  console.log('\n════════════════════════════════════════════');
  const failed = results.filter((r) => !r.ok);
  console.log(failed.length === 0 ? `✅ DISPUTE-SIGNAL :: PASS (${results.length}/${results.length})` : `❌ DISPUTE-SIGNAL :: FAIL (${results.length - failed.length}/${results.length})`);
  console.log('════════════════════════════════════════════');
  await pool.end();
  process.exit(failed.length === 0 ? 0 : 1);
}

main().catch(async (e) => {
  console.error('💥 Erro não tratado:', e);
  try { await pool.end(); } catch { /* noop */ }
  process.exit(1);
});
