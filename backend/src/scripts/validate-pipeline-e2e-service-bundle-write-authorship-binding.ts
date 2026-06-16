/**
 * E2E — F-SERVICE-BUNDLE-WRITE-AUTHORSHIP-BINDING (DECISION-0113 / DT-SERVICE-BUNDLE-WRITE-AUTHORSHIP-SPOOF).
 * NÃO MOVE DINHEIRO.
 *
 * Prova adversarial do fix do write-authorship-spoof dos 2 writes de service-bundle:
 *   POST /service-bundles/book     — gravava bookings com `requesterActorId` cru do body + actionContext.actorId
 *                                    como userId (sem canRepresentActor).
 *   POST /service-bundles/confirm  — gravava `confirmedBy* = actionContext.actorId` (conflação actor↔user).
 * Fix (espelha bindOrderWriteActor): bindWriteActor exige req.user.userId REAL + actor declarado +
 *   canRepresentActor ANTES do write → 403 honesto, sem write parcial; book grava requesterActorId validado
 *   + userId REAL; confirm grava confirmedByActorId validado + confirmedByUserId REAL.
 *
 * 🔒 DB EFÊMERA (run-service-bundle-write-authorship-binding-ephemeral.ps1). NUNCA toca unificard_dev.
 */
import 'tsconfig-paths/register';
import Fastify from 'fastify';
import { pool } from '../core/database/pool';
import { tenantService } from '../core/tenants/tenant.service';
import serviceBundleRoutes from '../modules/services/service-bundle.routes';
import { serviceBookingDecisionService } from '../modules/services/service-booking-decision.service';
import { BookingDecisionStatus } from '../modules/services/service-booking-decision.types';
import { BundleDependencyType } from '../modules/services/service-bundle.types';
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
const count = async (sql: string, p: unknown[] = []): Promise<number> => Number((await pool.query(sql, p)).rows[0].n);

async function assertEphemeralDb(): Promise<void> {
  const db = (await pool.query<{ db: string }>('SELECT current_database() AS db')).rows[0]?.db;
  if (db === 'unificard_dev') throw new Error('ABORT: banco-alvo é "unificard_dev".');
  if (!EXPECTED || db !== EXPECTED) throw new Error(`ABORT: banco "${db}" ≠ EXPECTED "${EXPECTED}".`);
  if (!/service|bundle|write|authorship|binding|ephemeral|test/i.test(db)) throw new Error(`ABORT: nome "${db}" não parece efêmero.`);
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

async function mkService(tenantId: string, ownerActorId: string): Promise<string> {
  seq += 1;
  return (await pool.query<{ id: string }>(
    `INSERT INTO services (tenant_id, actor_id, name, slug, service_type, status, currency, price_cents)
       VALUES ($1::uuid,$2::uuid,$3,$4,'service','active','BRL',1000) RETURNING service_id::text AS id`,
    [tenantId, ownerActorId, `Servico${seq}`, `servico-${seq}-${Date.now()}`]
  )).rows[0].id;
}

/** Disponibilidade owner_type='service' (owner_id=serviceId) cobrindo 08:00-18:00. */
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
  await tenantService.createTenant({ id: TENANT, name: 'Service Bundle Write Authorship', slug: `sbwa-${Date.now()}` });

  const alice = await mkUserActor(TENANT, 'Alice');       // dona dos serviços (organizadora/confirmadora)
  const carol = await mkUserActor(TENANT, 'Carol');       // cliente (requester)
  const attacker = await mkUserActor(TENANT, 'Attacker'); // terceiro do mesmo tenant (não representa Carol/Alice)
  const service1 = await mkService(TENANT, alice.actorId);
  const service2 = await mkService(TENANT, alice.actorId);
  const avail1 = await mkServiceAvailability(TENANT, service1);
  const avail2 = await mkServiceAvailability(TENANT, service2);

  const bankBefore = await count(`SELECT ((SELECT count(*) FROM bank_ledger)+(SELECT count(*) FROM bank_transactions))::int AS n`);

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
  const st = (r: any) => r.statusCode;

  const bookBody = (requesterActorId?: string) => ({
    ...(requesterActorId ? { requesterActorId } : {}),
    bundleId: '',
    serviceIds: [service1, service2],
    availabilityIds: [avail1, avail2],
    scheduledStart: '2026-09-01T09:00:00Z',
    scheduledEnd: '2026-09-01T10:00:00Z',
    dependencyType: BundleDependencyType.SAME_TIME,
  });
  const bookingCount = () => count(`SELECT count(*)::int AS n FROM bookings WHERE tenant_id=$1`, [TENANT]);
  const orderCount = () => count(`SELECT count(*)::int AS n FROM service_orders WHERE tenant_id=$1`, [TENANT]);

  try {
    let bundleBookingIds: string[] = [];

    // ───────────────────────── BOOK ─────────────────────────
    // T1 — LEGÍTIMO: Carol representa o próprio actor (requester) → 201 + 2 bookings com requester=Carol.
    {
      as(carol.userId, carol.actorId);
      const r = await post('/service-bundles/book', bookBody(carol.actorId));
      let okRequester = false;
      if (st(r) < 300) {
        const body = JSON.parse(r.body);
        bundleBookingIds = (body.bookings || []).map((b: any) => b.bookingId);
        const rows = await pool.query<{ n: number }>(
          `SELECT count(*)::int AS n FROM bookings WHERE tenant_id=$1 AND requester_actor_id=$2::uuid`,
          [TENANT, carol.actorId]
        );
        okRequester = Number(rows.rows[0].n) === 2 && bundleBookingIds.length === 2;
      }
      record('T1 book legítimo (Carol representa próprio actor) → 201 + 2 bookings requester=Carol',
        st(r) < 300 && okRequester, `status=${st(r)} bookings=${bundleBookingIds.length}`);
    }

    // T2 — SPOOF: atacante DECLARA requesterActorId=Carol (não representável) → 403 + nenhum booking novo.
    {
      const before = await bookingCount();
      as(attacker.userId, attacker.actorId); // actionContext próprio; mas requester declarado = Carol
      const r = await post('/service-bundles/book', bookBody(carol.actorId));
      const after = await bookingCount();
      record('T2 book SPOOF (atacante declara requester=Carol) → 403 + zero booking novo',
        st(r) === 403 && after === before, `status=${st(r)} before=${before} after=${after}`);
    }

    // T3 — requesterActorId ausente → 400.
    {
      const before = await bookingCount();
      as(carol.userId, carol.actorId);
      const r = await post('/service-bundles/book', bookBody(undefined));
      const after = await bookingCount();
      record('T3 book sem requesterActorId → 400 + zero booking novo',
        st(r) === 400 && after === before, `status=${st(r)} before=${before} after=${after}`);
    }

    // T4 — não autenticado → 401.
    {
      const before = await bookingCount();
      as('', carol.actorId);
      const r = await post('/service-bundles/book', bookBody(carol.actorId));
      const after = await bookingCount();
      record('T4 book não autenticado → 401 + zero booking novo',
        st(r) === 401 && after === before, `status=${st(r)} before=${before} after=${after}`);
    }

    // Decisões ACCEPTED (Alice, dona dos serviços → dona das service-availabilities) para os 2 bookings de T1.
    const decisionIds: string[] = [];
    for (const bId of bundleBookingIds) {
      const d = await serviceBookingDecisionService.createDecision(TENANT, alice.userId, {
        bookingId: bId,
        decidedByActorId: alice.actorId,
        status: BookingDecisionStatus.ACCEPTED,
      });
      decisionIds.push(d.decisionId);
    }
    record('setup decisões ACCEPTED criadas para os 2 bookings do bundle', decisionIds.length === 2, `decisões=${decisionIds.length}`);

    const confirmBody = () => ({
      bundleId: '',
      bookingIds: bundleBookingIds,
      decisionIds,
    });

    // ───────────────────────── CONFIRM ─────────────────────────
    // T5 — SPOOF: atacante DECLARA confirmedByActorId=Alice (não representável) → 403 + zero order.
    {
      const before = await orderCount();
      as(attacker.userId, alice.actorId); // declara actor da Alice
      const r = await post('/service-bundles/confirm', confirmBody());
      const after = await orderCount();
      record('T5 confirm SPOOF (atacante declara confirmedBy=Alice) → 403 + zero order',
        st(r) === 403 && after === before, `status=${st(r)} before=${before} after=${after}`);
    }

    // T6 — sem actionContext.actorId → 400.
    {
      const before = await orderCount();
      as(alice.userId, null);
      const r = await post('/service-bundles/confirm', confirmBody());
      const after = await orderCount();
      record('T6 confirm sem actionContext.actorId → 400 + zero order',
        st(r) === 400 && after === before, `status=${st(r)} before=${before} after=${after}`);
    }

    // T7 — não autenticado → 401.
    {
      const before = await orderCount();
      as('', alice.actorId);
      const r = await post('/service-bundles/confirm', confirmBody());
      const after = await orderCount();
      record('T7 confirm não autenticado → 401 + zero order',
        st(r) === 401 && after === before, `status=${st(r)} before=${before} after=${after}`);
    }

    // T8 — LEGÍTIMO: Alice representa o próprio actor (dona soberana das availabilities) → 201 + 2 orders.
    {
      const before = await orderCount();
      as(alice.userId, alice.actorId);
      const r = await post('/service-bundles/confirm', confirmBody());
      const after = await orderCount();
      record('T8 confirm legítimo (Alice, dona soberana) → 201 + 2 orders',
        st(r) < 300 && after === before + 2, `status=${st(r)} before=${before} after=${after} body=${r.body?.slice(0, 200)}`);
    }

    // ───────────────────────── BANK INTOCADO ─────────────────────────
    {
      const bankAfter = await count(`SELECT ((SELECT count(*) FROM bank_ledger)+(SELECT count(*) FROM bank_transactions))::int AS n`);
      record('T-bank Bank intocado (bank_ledger + bank_transactions inalterados)',
        bankAfter === bankBefore, `before=${bankBefore} after=${bankAfter}`);
    }

    // ───────────────────────── ESTRUTURAL ─────────────────────────
    {
      const src = readFileSync(join(process.cwd(), 'src/modules/services/service-bundle.routes.ts'), 'utf8');
      record('C1 helper bindWriteActor: req.user.userId + canRepresentActor',
        /const bindWriteActor = async/.test(src)
        && /req\.user\?\.userId/.test(src)
        && /canRepresentActor\(tenantId, userId, declaredActorId\)/.test(src));
      record('C2 book: bound.userId REAL + requesterActorId validado (não actionContext.actorId cru)',
        /createBundleBookings\(\s*tenantId,\s*bound\.userId/.test(src)
        && /requesterActorId: bound\.actorId/.test(src)
        && !/createBundleBookings\(\s*tenantId,\s*actionContext\.actorId/.test(src));
      record('C3 confirm: confirmedByActorId=bound.actorId + confirmedByUserId=bound.userId REAL',
        /confirmedByActorId: bound\.actorId/.test(src)
        && /confirmedByUserId: bound\.userId/.test(src)
        && !/(confirmedByActorId|confirmedByUserId): actionContext\.actorId/.test(src));
      record('C4 bind ANTES do write nos 2 handlers',
        (src.match(/const bound = await bindWriteActor\(req, reply, tenantId,/g) || []).length === 2);
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
    console.log('✨ service-bundle write-authorship bindada ao actor representável — spoof contido.');
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
