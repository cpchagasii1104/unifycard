/**
 * E2E — DT-SERVICE-ORDER-STATUS-VOCABULARY-MISMATCH (2026-07-31)
 *
 * Prova COMPORTAMENTAL, HTTP real: GET /services/service-orders?status=X para CADA um dos 8
 * valores vivos de service_order_status devolve 200 (frontend/backend alinhados, achado da
 * auditoria: FE só declarava 5 valores em MAIÚSCULA, filtro cru quebrava com 500). E que um
 * valor fora do enum agora devolve 400 (validação nova em service-order.routes.ts), não 500.
 *
 * 🔒 DB EFÊMERA. Orquestrado por scripts/run-service-order-status-vocabulary-ephemeral.ps1.
 * Modo: npx tsx backend/src/scripts/validate-pipeline-e2e-service-order-status-vocabulary.ts
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

const EIGHT_STATUSES = [
  'draft',
  'confirmed',
  'in_progress',
  'completed',
  'seller_pending',
  'release_approved',
  'funds_released',
  'cancelled',
] as const;

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
  if (!/service.order|status|vocabulary|ephemeral|test/i.test(db)) throw new Error(`ABORT: nome de banco "${db}" não parece efêmero.`);
  if (!JWT_SECRET) throw new Error('ABORT: JWT_SECRET ausente.');
  console.log(`🔒 DB efêmera confirmada: ${db}`);
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
  const { default: serviceOrderRoutes } = await import('../modules/services/service-order.routes');
  await app.register(serviceOrderRoutes, { prefix: '/services' });
  await app.ready();
  return app;
}

async function main(): Promise<void> {
  await assertEphemeralDb();
  await bootstrapSocialPorts();

  const TENANT_ID = randomUUID();
  await tenantService.createTenant({ id: TENANT_ID, name: 'Service Order Status Vocabulary Test', slug: `so-status-vocab-${Date.now()}` });
  await rbacService.seedDefaultRBAC(TENANT_ID);

  const { socialPortsRegistry } = await import('../core/social/ports-registry');
  const actorRepo = socialPortsRegistry.getActorRepository();

  const globalId = randomUUID();
  const userId = randomUUID();
  const cpf = String(Date.now() % 100000000).padStart(11, '0').slice(-11);
  await pool.query(`INSERT INTO global_users (global_user_id, cpf, full_name, metadata) VALUES ($1,$2,$3,'{}'::jsonb)`, [globalId, cpf, 'E2E Worker']);
  await pool.query(`INSERT INTO identities (global_user_id, tax_id, tax_id_type, kyc_status, kyc_level) VALUES ($1,$2,'cpf','pending','none')`, [globalId, cpf]);
  await pool.query(`INSERT INTO users (id, user_id, tenant_id, global_user_id, email, password_hash, token_version) VALUES ($1,$1,$2,$3,$4,'x',0)`, [userId, TENANT_ID, globalId, `${userId}@e2e.local`]);
  const workerActorId = (await actorRepo.findOrCreateUserActor(TENANT_ID, userId)).actor_id;

  // customer é o mesmo humano-actor noutro papel só para satisfazer a FK (não é objeto do teste)
  const customerActorId = workerActorId;

  const token = jwt.sign(
    { sub: userId, userId, tenantId: TENANT_ID, email: `${userId}@e2e.local`, tokenVersion: 0, globalUserId: globalId, type: 'access' },
    JWT_SECRET as string,
    { expiresIn: '15m' }
  );
  const ac = JSON.stringify({ actorId: workerActorId, intent: 'so_status_vocab_e2e', source: 'e2e', scope: `tenant:${TENANT_ID}` });
  const headers = { authorization: `Bearer ${token}`, 'x-action-context': ac };

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

  // uma service_order por status — todas com o mesmo worker/customer p/ o filtro de parte funcionar
  for (const status of EIGHT_STATUSES) {
    await pool.query(
      `INSERT INTO service_orders (tenant_id, service_id, worker_actor_id, customer_actor_id, status, scheduled_start, created_by_actor_id)
       VALUES ($1,$2,$3,$4,$5::service_order_status, now() + interval '1 day', $3)`,
      [TENANT_ID, serviceId, workerActorId, customerActorId, status]
    );
  }

  const app = await buildApp();
  try {
    console.log('\n— 1c: filtro por CADA um dos 8 valores devolve 200 —');
    for (const status of EIGHT_STATUSES) {
      const res = await app.inject({
        method: 'GET',
        url: `/services/service-orders?workerActorId=${workerActorId}&status=${status}`,
        headers,
      });
      const body = res.statusCode === 200 ? JSON.parse(res.body) : null;
      const matched = body?.orders?.some((o: { status: string }) => o.status === status);
      record(`status=${status} → HTTP 200`, res.statusCode === 200, `HTTP ${res.statusCode}: ${res.body.slice(0, 200)}`);
      record(`status=${status} → linha com esse status está na resposta`, !!matched, `orders=${JSON.stringify(body?.orders?.map((o: any) => o.status))}`);
    }

    console.log('\n— valor FORA do vocabulário → 400, não 500 —');
    const bad = await app.inject({
      method: 'GET',
      url: `/services/service-orders?workerActorId=${workerActorId}&status=DRAFT`,
      headers,
    });
    record('status=DRAFT (maiúsculo, fora do enum vivo) → HTTP 400 (não 500)', bad.statusCode === 400, `HTTP ${bad.statusCode}: ${bad.body}`);

    const bad2 = await app.inject({
      method: 'GET',
      url: `/services/service-orders?workerActorId=${workerActorId}&status=nonsense`,
      headers,
    });
    record('status=nonsense → HTTP 400', bad2.statusCode === 400, `HTTP ${bad2.statusCode}: ${bad2.body}`);
  } finally {
    await app.close();
  }

  console.log('\n════════════════════════════════════════════');
  const failed = results.filter((r) => !r.ok);
  console.log(failed.length === 0 ? `✅ SERVICE-ORDER-STATUS-VOCABULARY :: PASS (${results.length}/${results.length})` : `❌ SERVICE-ORDER-STATUS-VOCABULARY :: FAIL (${results.length - failed.length}/${results.length})`);
  console.log('════════════════════════════════════════════');
  await pool.end();
  process.exit(failed.length === 0 ? 0 : 1);
}

main().catch(async (e) => {
  console.error('💥 Erro não tratado:', e);
  try { await pool.end(); } catch { /* noop */ }
  process.exit(1);
});
