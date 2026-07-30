/**
 * E2E HTTP REAL — DT-SERVICE-BUNDLE-BOOKINGS-GHOST-TABLE-LIVE
 *
 * getBundleBookings lia de `service_bookings` (tabela morta desde o REBASE-03) enquanto
 * createBundleBookings escreve em `bookings` (via unifiedAvailabilityService.createBooking).
 * GET /service-bundles/:bundleId/bookings sempre devolvia 500 (42P01) — rota pública viva,
 * sem contenção, consumida pelo frontend (ServiceBundleBookingModal / fluxo RFQ).
 *
 * Fix: getBundleBookings passa a ler `bookings`, com service_id vindo de
 * metadata->>'serviceId' (onde createBundleBookings já grava, :225).
 *
 * Prova IDA E VOLTA: cria bundle com 2 serviços via POST /service-bundles/book, e confirma
 * que GET /service-bundles/:bundleId/bookings devolve as DUAS linhas, com serviceId correto
 * — prova que o leitor voltou a enxergar o que o escritor grava (não só "não dá mais 500").
 *
 * 🔒 DB EFÊMERA (run-service-bundle-bookings-ghost-table-fix-ephemeral.ps1). NUNCA toca unificard_dev.
 */
import 'tsconfig-paths/register';
import Fastify from 'fastify';
import { pool } from '../core/database/pool';
import { tenantService } from '../core/tenants/tenant.service';
import serviceBundleRoutes from '../modules/services/service-bundle.routes';
import { BundleDependencyType } from '../modules/services/service-bundle.types';
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
  if (!/bookings|bundle|ghost|ephemeral|test/i.test(db)) throw new Error(`ABORT: nome "${db}" não parece efêmero.`);
  console.log(`🔒 DB efêmera confirmada: ${db}`);
}

let seq = 0;
async function mkUserActor(tenantId: string, name: string): Promise<{ userId: string; actorId: string }> {
  seq += 1;
  const gu = randomUUID();
  const userId = randomUUID();
  const tax = String(Date.now() + seq).padStart(11, '0').slice(-11);
  await pool.query(
    `INSERT INTO identities (global_user_id, tax_id, tax_id_type, kyc_status, kyc_level)
       VALUES ($1::uuid,$2,'cpf','approved','basic')`,
    [gu, tax]
  );
  await pool.query(
    `INSERT INTO users (id, user_id, tenant_id, email, password_hash, token_version, is_test, created_at, updated_at)
       VALUES ($1::uuid,$1::uuid,$2::uuid,$3,'x',0,true,NOW(),NOW())`,
    [userId, tenantId, `${name}-${seq}@e2e.test`]
  );
  const actorId = (await pool.query<{ id: string }>(
    `INSERT INTO actors (tenant_id, actor_type, display_name, user_id, global_user_id)
       VALUES ($1::uuid,'user',$2,$3::uuid,$4::uuid) RETURNING id::text AS id`,
    [tenantId, name, userId, gu]
  )).rows[0].id;
  return { userId, actorId };
}

let canonicalServiceId = '';
async function mkService(tenantId: string, ownerActorId: string): Promise<string> {
  seq += 1;
  if (!canonicalServiceId) {
    canonicalServiceId = (await pool.query<{ id: string }>(
      `SELECT id::text AS id FROM canonical_services WHERE scope='global' LIMIT 1`
    )).rows[0].id;
  }
  return (await pool.query<{ id: string }>(
    `INSERT INTO services (tenant_id, actor_id, name, slug, canonical_service_id, service_type, status, currency, price_cents)
       VALUES ($1::uuid,$2::uuid,$3,$4,$5::uuid,'service','active','BRL',1000) RETURNING service_id::text AS id`,
    [tenantId, ownerActorId, `Servico${seq}`, `servico-${seq}-${Date.now()}`, canonicalServiceId]
  )).rows[0].id;
}

async function mkServiceAvailability(tenantId: string, serviceId: string): Promise<string> {
  return (await pool.query<{ id: string }>(
    `INSERT INTO availability (tenant_id, owner_type, owner_id, availability_type, status, start_datetime, end_datetime, timezone, capacity, metadata)
       VALUES ($1::uuid,'service',$2::uuid,'fixed','active',$3,$4,'America/Sao_Paulo',5,'{}'::jsonb)
       RETURNING availability_id::text AS id`,
    [tenantId, serviceId, new Date('2026-09-01T08:00:00Z'), new Date('2026-09-01T18:00:00Z')]
  )).rows[0].id;
}

let CURRENT_USER = '';
let CURRENT_AC: Record<string, unknown> = {};

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
  await tenantService.createTenant({ id: TENANT, name: 'Service Bundle Bookings Ghost Table', slug: `sbbgt-${Date.now()}` });

  const alice = await mkUserActor(TENANT, 'Alice');
  const carol = await mkUserActor(TENANT, 'Carol');
  const service1 = await mkService(TENANT, alice.actorId);
  const service2 = await mkService(TENANT, alice.actorId);
  const avail1 = await mkServiceAvailability(TENANT, service1);
  const avail2 = await mkServiceAvailability(TENANT, service2);

  const app = Fastify();
  app.decorateRequest('user', null);
  app.decorateRequest('tenant', null);
  app.decorateRequest('actionContext', null);
  app.addHook('onRequest', async (req: any) => {
    req.user = CURRENT_USER ? { id: CURRENT_USER, userId: CURRENT_USER } : undefined;
    req.tenant = { id: TENANT };
    req.actionContext = CURRENT_AC;
  });
  await app.register(serviceBundleRoutes);
  await app.ready();

  const as = (userId: string, actorId: string | null): void => {
    CURRENT_USER = userId;
    CURRENT_AC = actorId ? { actorId, actingUserId: userId } : {};
  };
  const post = (url: string, body: unknown) =>
    app.inject({ method: 'POST', url, headers: { 'content-type': 'application/json' }, payload: JSON.stringify(body) });
  const get = (url: string) => app.inject({ method: 'GET', url });
  const st = (r: any) => r.statusCode;

  try {
    // ───── A: GET num bundleId inexistente → 200 + lista VAZIA (resultado válido, não erro) ─────
    {
      as(carol.userId, carol.actorId);
      const fakeBundleId = `bundle_${randomUUID()}`;
      const r = await get(`/service-bundles/${fakeBundleId}/bookings`);
      let emptyList = false;
      if (st(r) === 200) {
        const body = JSON.parse(r.body);
        emptyList = Array.isArray(body.bookings) && body.bookings.length === 0;
      }
      record('A GET bundle inexistente → 200 + bookings=[] (vazio é resultado válido)',
        st(r) === 200 && emptyList, `status=${st(r)} body=${r.body?.slice(0, 150)}`);
    }

    // ───── B: cria bundle com 2 serviços via POST /service-bundles/book ─────
    let bundleId = '';
    let bookedServiceIds: string[] = [];
    let bookedStatuses: Record<string, string> = {};
    {
      as(carol.userId, carol.actorId);
      const r = await post('/service-bundles/book', {
        requesterActorId: carol.actorId,
        bundleId: '',
        serviceIds: [service1, service2],
        availabilityIds: [avail1, avail2],
        scheduledStart: '2026-09-01T09:00:00Z',
        scheduledEnd: '2026-09-01T10:00:00Z',
        dependencyType: BundleDependencyType.SAME_TIME,
      });
      let ok = false;
      if (st(r) < 300) {
        const body = JSON.parse(r.body);
        bundleId = body.bundleId;
        bookedServiceIds = (body.bookings || []).map((b: any) => b.serviceId);
        for (const b of body.bookings || []) bookedStatuses[b.bookingId] = b.status;
        ok = bundleId.length > 0 && bookedServiceIds.length === 2;
      }
      record('B POST /service-bundles/book (2 serviços) → 201 + bundleId + 2 bookings',
        st(r) < 300 && ok, `status=${st(r)} bundleId=${bundleId} services=${bookedServiceIds.join(',')}`);
    }

    // ───── C: IDA E VOLTA — GET tem que devolver AS DUAS linhas, com serviceId correto ─────
    {
      const r = await get(`/service-bundles/${bundleId}/bookings`);
      let twoRows = false;
      let serviceIdsMatch = false;
      let statusesMatch = false;
      let body: any = null;
      if (st(r) === 200) {
        body = JSON.parse(r.body);
        const rows = body.bookings || [];
        twoRows = rows.length === 2;
        const gotServiceIds = rows.map((row: any) => row.serviceId).sort();
        const wantServiceIds = [service1, service2].sort();
        serviceIdsMatch = JSON.stringify(gotServiceIds) === JSON.stringify(wantServiceIds);
        statusesMatch = rows.every((row: any) => row.status === bookedStatuses[row.bookingId]);
      }
      record('C GET /service-bundles/:bundleId/bookings → 200 + 2 linhas',
        st(r) === 200 && twoRows, `status=${st(r)} rows=${body?.bookings?.length}`);
      record('C1 serviceId de cada linha bate com o serviceId gravado no book (metadata->>serviceId)',
        serviceIdsMatch, `got=${JSON.stringify(body?.bookings?.map((b: any) => b.serviceId))} want=[${service1},${service2}]`);
      record('C2 status de cada linha bate com o status devolvido no book',
        statusesMatch, `bookings=${JSON.stringify(body?.bookings)}`);
    }

    const failed = results.filter((r) => !r.ok);
    console.log(`\n${'═'.repeat(64)}`);
    console.log(`RESULTADO: ${results.length - failed.length}/${results.length} verdes`);
    if (failed.length > 0) {
      console.log('FALHAS:');
      failed.forEach((f) => console.log(`  ❌ ${f.label} — ${f.reason ?? ''}`));
      await app.close();
      await pool.end();
      process.exit(1);
    }
    await app.close();
    await pool.end();
    console.log('✨ getBundleBookings lê de `bookings` (não mais `service_bookings`) — leitor enxerga o que o escritor grava.');
  } catch (e) {
    console.error('💥 Erro no corpo do teste:', e);
    try { await app.close(); } catch { /* noop */ }
    try { await pool.end(); } catch { /* noop */ }
    process.exit(1);
  }
}

main().catch(async (e) => {
  console.error('💥 Erro não tratado:', e);
  try { await pool.end(); } catch { /* noop */ }
  process.exit(1);
});
