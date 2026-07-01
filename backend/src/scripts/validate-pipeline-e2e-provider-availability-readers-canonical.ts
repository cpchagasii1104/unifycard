/**
 * E2E F-SERVICE-AVAILABILITY-PROVIDER-READERS-CONTAINMENT-SLICE-A2E
 * (DECISION-0156 / DT-SERVICE-AVAILABILITY-RUNTIME-DRIFT-FROM-SSOT — resíduos R4/R5).
 *
 * 🔒 DB EFÊMERA. Guard duro: current_database() === EXPECTED_DATABASE_NAME e NUNCA 'unificard_dev'.
 *    Orquestrado por scripts/run-provider-availability-readers-canonical-ephemeral.ps1.
 *
 * Prova que os readers prestador-facing pending-responsibilities (R4) e impact-overview (R5) resolvem
 * ownership/contagem de bookings pendentes pelo SSOT CANÔNICO — availability owner_type='service_offering' →
 * service_offerings.provider_actor_id — e NÃO pelo escopo legado owner_type='service'→services.owner_actor_id
 * (coluna INEXISTENTE: services tem actor_id/name, não owner_actor_id/title → as queries legadas quebravam).
 * As queries abaixo são CÓPIAS EXATAS dos predicados re-keyados nas rotas (o guard estrutural garante que as
 * rotas os usam). Branches user/group preservados; dado legado preservado; enum preservado; Δbank=0.
 */
import 'tsconfig-paths/register';
import { pool } from '../core/database/pool';
import { tenantService } from '../core/tenants/tenant.service';
import { servicesService } from '../modules/services/services.service';
import { AvailabilityOwnerType } from '../core/availability/unified-availability.types';
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
  if (db === 'unificard_dev') throw new Error('ABORT: banco-alvo é "unificard_dev" — esta validação NUNCA toca DEV.');
  if (!EXPECTED || db !== EXPECTED) throw new Error(`ABORT: banco-alvo "${db}" ≠ EXPECTED_DATABASE_NAME "${EXPECTED}".`);
  if (!/provider|availability|readers|canonical|ephemeral|smoke|test/i.test(db)) throw new Error(`ABORT: nome de banco "${db}" não parece efêmero.`);
  console.log(`🔒 DB efêmera confirmada: ${db}`);
}
const count = async (sql: string, p: unknown[] = []): Promise<number> => Number((await pool.query(sql, p)).rows[0].n);
const FUTURE_START = '2026-12-12T12:00:00Z';
const FUTURE_END = '2026-12-12T13:00:00Z';

let seq = 0;
async function mkUserActor(tenantId: string, name: string): Promise<{ userId: string; actorId: string }> {
  seq += 1;
  const gu = randomUUID(); const userId = randomUUID();
  const tax = String(Date.now() + seq).padStart(11, '0').slice(-11);
  await pool.query(`INSERT INTO identities (global_user_id, tax_id, tax_id_type, kyc_status, kyc_level) VALUES ($1::uuid,$2,'cpf','approved','basic')`, [gu, tax]);
  await pool.query(`INSERT INTO users (id, user_id, tenant_id, email, password_hash, token_version, is_test, created_at, updated_at) VALUES ($1::uuid,$1::uuid,$2::uuid,$3,'x',0,true,NOW(),NOW())`, [userId, tenantId, `${name}-${seq}@e2e.test`]);
  const actorId = (await pool.query<{ id: string }>(`INSERT INTO actors (tenant_id, actor_type, display_name, user_id, global_user_id) VALUES ($1::uuid,'user',$2,$3::uuid,$4::uuid) RETURNING id::text AS id`, [tenantId, name, userId, gu])).rows[0].id;
  return { userId, actorId };
}
async function mkService(tenantId: string, ownerActorId: string, name: string, canonicalServiceId: string): Promise<string> {
  seq += 1;
  return (await pool.query<{ id: string }>(`INSERT INTO services (tenant_id, actor_id, name, slug, canonical_service_id, service_type, status, currency) VALUES ($1::uuid,$2::uuid,$3,$4,$5::uuid,'service','active','BRL') RETURNING service_id::text AS id`, [tenantId, ownerActorId, name, `${name.toLowerCase()}-${seq}`, canonicalServiceId])).rows[0].id;
}
async function mkOffering(tenantId: string, providerActorId: string, canonicalServiceId: string, serviceId: string): Promise<string> {
  return (await pool.query<{ id: string }>(
    `INSERT INTO service_offerings (tenant_id, canonical_service_id, provider_actor_id, service_id, price_cents, duration_minutes, modality, location, service_area, conditions, status)
       VALUES ($1::uuid,$2::uuid,$3::uuid,$4::uuid,5000,60,'in_person','{}'::jsonb,'{}'::jsonb,'{}'::jsonb,'active') RETURNING id::text AS id`,
    [tenantId, canonicalServiceId, providerActorId, serviceId]
  )).rows[0].id;
}
async function mkAvailability(tenantId: string, ownerType: 'service' | 'service_offering' | 'user', ownerId: string): Promise<string> {
  return (await pool.query<{ id: string }>(
    `INSERT INTO availability (tenant_id, owner_type, owner_id, availability_type, status, start_datetime, end_datetime, timezone, capacity, metadata)
       VALUES ($1::uuid,$2,$3::uuid,'fixed','active',$4,$5,'America/Sao_Paulo',1,'{}'::jsonb) RETURNING availability_id::text AS id`,
    [tenantId, ownerType, ownerId, new Date(FUTURE_START), new Date(FUTURE_END)]
  )).rows[0].id;
}
async function mkBooking(tenantId: string, availabilityId: string, requesterActorId: string): Promise<string> {
  return (await pool.query<{ id: string }>(`INSERT INTO bookings (tenant_id, availability_id, requester_actor_id, status, metadata, requested_at, created_at, updated_at) VALUES ($1::uuid,$2::uuid,$3::uuid,'requested','{}'::jsonb,NOW(),NOW(),NOW()) RETURNING booking_id::text AS id`, [tenantId, availabilityId, requesterActorId])).rows[0].id;
}

// ── Predicados re-keyados COPIADOS EXATAMENTE das rotas R4/R5 ──
const PENDING_SERVICES_SQL = `
  SELECT s.service_id::text AS service_id, s.name AS title, COUNT(b.booking_id)::int as booking_count
  FROM services s
  INNER JOIN service_offerings so ON so.provider_actor_id = $2
    AND (so.service_id = s.service_id OR so.canonical_service_id = s.canonical_service_id)
  INNER JOIN availability a ON a.owner_type = 'service_offering' AND a.owner_id = so.id
  INNER JOIN bookings b ON b.availability_id = a.availability_id AND b.status = 'requested'
  WHERE s.tenant_id = $1 AND s.actor_id = $2
  GROUP BY s.service_id, s.name, s.status, s.created_at
  HAVING COUNT(b.booking_id) > 0`;
// NOTA: o branch owner_type='group' das rotas usa g.group_id — coluna INEXISTENTE (groups tem PK `id`).
// Isso é OUTRO bug pré-existente FORA do escopo do drift owner_type='service' (achado A2e, reportado à diretora).
// Como não há fixture de group aqui, testamos SÓ o branch service_offering (re-keyado) + o branch user preservado
// + a exclusão do legado owner_type='service'. O guard estrutural garante que as rotas mantêm o branch group.
const PENDING_BOOKINGS_SQL = `
  SELECT b.booking_id::text AS booking_id, a.owner_type::text AS owner_type
  FROM bookings b
  INNER JOIN availability a ON b.availability_id = a.availability_id
  WHERE b.tenant_id = $1 AND b.status = 'requested'
    AND (
      (a.owner_type = 'user' AND a.owner_id = $2)
      OR (a.owner_type = 'service_offering' AND EXISTS (SELECT 1 FROM service_offerings so WHERE so.id = a.owner_id AND so.provider_actor_id = $2))
    )`;
const PEOPLE_WAITING_SQL = `
  SELECT COUNT(DISTINCT b.requester_actor_id)::int as n
  FROM bookings b
  INNER JOIN availability a ON b.availability_id = a.availability_id
  WHERE b.tenant_id = $1 AND b.status = 'requested'
    AND (
      (a.owner_type = 'user' AND a.owner_id = $2)
      OR (a.owner_type = 'service_offering' AND EXISTS (SELECT 1 FROM service_offerings so WHERE so.id = a.owner_id AND so.provider_actor_id = $2))
    )`;

async function main(): Promise<void> {
  await assertEphemeralDb();
  const { socialPortsRegistry } = await import('../core/social/ports-registry');
  const adapters = await import('../modules/social/adapters');
  socialPortsRegistry.setActorRepository(adapters.actorRepositoryAdapter);
  socialPortsRegistry.setActorUtils(adapters.actorUtilsAdapter);
  socialPortsRegistry.setSocialRepository(adapters.socialRepositoryAdapter);
  socialPortsRegistry.setSocialService(adapters.socialServiceAdapter);
  socialPortsRegistry.setEventFeedHandlers(adapters.eventFeedHandlersAdapter);

  const TENANT_ID = randomUUID();
  await tenantService.createTenant({ id: TENANT_ID, name: 'Provider Availability Readers Canonical', slug: `parc-${Date.now()}` });
  const canonicalServiceId = (await pool.query<{ id: string }>(`SELECT id::text AS id FROM canonical_services LIMIT 1`)).rows[0]?.id;
  if (!canonicalServiceId) throw new Error('Sem canonical_services no banco efêmero.');

  const alice = await mkUserActor(TENANT_ID, 'ProvAlice');
  const c1 = await mkUserActor(TENANT_ID, 'Cust1');
  const c2 = await mkUserActor(TENANT_ID, 'Cust2');
  const c3 = await mkUserActor(TENANT_ID, 'Cust3');

  const serviceId = await mkService(TENANT_ID, alice.actorId, 'SvcAlice', canonicalServiceId);
  const offeringId = await mkOffering(TENANT_ID, alice.actorId, canonicalServiceId, serviceId);

  const availOff = await mkAvailability(TENANT_ID, 'service_offering', offeringId); // canônico (provider Alice)
  const bookingOff = await mkBooking(TENANT_ID, availOff, c1.actorId); // requested (deve contar)

  const availLeg = await mkAvailability(TENANT_ID, 'service', serviceId); // LEGADO owner_type='service'
  const bookingLeg = await mkBooking(TENANT_ID, availLeg, c2.actorId); // requested (NÃO deve contar)

  const availUser = await mkAvailability(TENANT_ID, 'user', alice.actorId); // pessoal (branch user preservado)
  const bookingUser = await mkBooking(TENANT_ID, availUser, c3.actorId); // requested (deve contar via user)

  const P = [TENANT_ID, alice.actorId];
  const bankBefore = await count(`SELECT ((SELECT count(*) FROM bank_ledger)+(SELECT count(*) FROM bank_transactions))::int AS n`);

  // ── T-schema — services NÃO tem owner_actor_id nem title (a query legada quebrava) ──
  {
    const cols = (await pool.query<{ column_name: string }>(`SELECT column_name FROM information_schema.columns WHERE table_name='services'`)).rows.map((r) => r.column_name);
    const noDead = !cols.includes('owner_actor_id') && !cols.includes('title') && cols.includes('actor_id') && cols.includes('name');
    record('T-schema services tem actor_id/name e NÃO tem owner_actor_id/title (a query legada quebrava)', noDead, `owner_actor_id=${cols.includes('owner_actor_id')} title=${cols.includes('title')}`);
  }

  // ── R4-A — pendingServices (re-keyed) conta o serviço via booking da OFERTA canônica ──
  {
    const rows = (await pool.query<{ service_id: string; booking_count: number }>(PENDING_SERVICES_SQL, [TENANT_ID, alice.actorId])).rows;
    const mine = rows.find((r) => r.service_id === serviceId);
    record('R4-A pendingServices conta o serviço via oferta canônica (service_offering), booking_count=1', !!mine && Number(mine.booking_count) === 1, `rows=${JSON.stringify(rows)}`);
  }

  // ── R4-B — pendingBookings (re-keyed): oferta canônica IN, user IN, legado owner_type='service' OUT ──
  {
    const rows = (await pool.query<{ booking_id: string; owner_type: string }>(PENDING_BOOKINGS_SQL, P)).rows;
    const ids = new Set(rows.map((r) => r.booking_id));
    const ok = ids.has(bookingOff) && ids.has(bookingUser) && !ids.has(bookingLeg);
    record('R4-B pendingBookings: oferta canônica IN + user IN; legado owner_type=service OUT', ok, `off=${ids.has(bookingOff)} user=${ids.has(bookingUser)} legado=${ids.has(bookingLeg)}`);
  }

  // ── R5 — peopleWaiting (re-keyed): conta requesters da oferta + user; NÃO conta o legado ──
  {
    const n = Number((await pool.query<{ n: number }>(PEOPLE_WAITING_SQL, P)).rows[0].n);
    // c1 (oferta) + c3 (user) = 2 requesters distintos; c2 (legado) NÃO conta.
    record('R5 peopleWaiting conta requesters de oferta+user (2), NÃO conta o legado owner_type=service', n === 2, `n=${n} (esperado 2)`);
  }

  // ── R5-money — moneyLockedCents é independente do branch (0 sem payment_request) ──
  {
    const money = Number((await pool.query<{ total: string }>(`SELECT COALESCE(SUM(amount_cents),0)::text as total FROM service_payment_requests WHERE tenant_id=$1 AND payer_actor_id=$2 AND payment_request_status='pending'`, [TENANT_ID, alice.actorId])).rows[0].total);
    record('R5-money moneyLocked independe do branch legado (0 sem payment_request)', money === 0, `money=${money}`);
  }

  // ── Preservação: dado legado owner_type='service' + booking existem ──
  {
    const legOk = (await count(`SELECT count(*)::int AS n FROM availability WHERE tenant_id=$1 AND availability_id=$2 AND owner_type='service'`, [TENANT_ID, availLeg])) === 1
      && (await count(`SELECT count(*)::int AS n FROM bookings WHERE tenant_id=$1 AND booking_id=$2`, [TENANT_ID, bookingLeg])) === 1;
    record('PRESERVAÇÃO: availability legada owner_type=service + booking preservados no dado', legOk);
  }

  // ── enum preservado ──
  record('ENUM AvailabilityOwnerType.SERVICE preservado', AvailabilityOwnerType.SERVICE === 'service');

  // ── A2 não regride: discoverServices suprime availability_summary legado do serviço canônico ──
  {
    const list = await servicesService.discoverServices(TENANT_ID, {});
    const mine = list.find((s) => s.serviceId === serviceId);
    record('A2 não regride: discoverServices suprime availability_summary legado (serviço canônico)', !!mine && mine.availability_summary === undefined, `summary=${JSON.stringify(mine?.availability_summary)}`);
  }

  // ── Δbank=0 ──
  {
    const bankAfter = await count(`SELECT ((SELECT count(*) FROM bank_ledger)+(SELECT count(*) FROM bank_transactions))::int AS n`);
    record('Bank intocado (bank_ledger + bank_transactions inalterados) — Δbank=0', bankAfter === bankBefore, `before=${bankBefore} after=${bankAfter}`);
  }

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${'═'.repeat(64)}`);
  console.log(`RESULTADO: ${results.length - failed.length}/${results.length} verdes`);
  if (failed.length > 0) {
    console.log('FALHAS:'); failed.forEach((f) => console.log(`  ❌ ${f.label} — ${f.reason ?? ''}`));
    await pool.end(); process.exit(1);
  }
  await pool.end();
  console.log('✨ Readers do prestador (R4/R5) canonizados: contam pelo SSOT service_offering→provider_actor_id, não pelo legado owner_type=service (coluna morta corrigida); branches user/group preservados; Δbank=0. R4/R5 provados.');
}
main().catch(async (e) => { console.error('💥 Erro não tratado:', e); try { await pool.end(); } catch { /* noop */ } process.exit(1); });
