/**
 * E2E F-SERVICE-DISCOVERY-HAS-AVAILABILITY-CANONICAL-FILTER-SLICE-A2D
 * (DECISION-0156 / DT-SERVICE-AVAILABILITY-RUNTIME-DRIFT-FROM-SSOT — resíduo R1).
 *
 * 🔒 DB EFÊMERA. Guard duro: current_database() === EXPECTED_DATABASE_NAME e NUNCA 'unificard_dev'.
 *    Orquestrado por scripts/run-discovery-has-availability-canonical-filter-ephemeral.ps1.
 *
 * Prova que o filtro `has_availability=true` da descoberta mede disponibilidade pelo SSOT CANÔNICO —
 * ≥1 `service_offering` ativa do serviço/canonical (mesmo provider) com `availability` owner_type='service_offering'
 * e janela FUTURA (end>now) — NUNCA pelo escopo legado `owner_type='service'`. Martelo semântico ratificado:
 * ANY offering + future window; conflito de booking NÃO exclui; sem filtro por data. Cobre a matriz A–G.
 */
import 'tsconfig-paths/register';
import Fastify from 'fastify';
import { pool } from '../core/database/pool';
import { tenantService } from '../core/tenants/tenant.service';
import { servicesService } from '../modules/services/services.service';
import servicesRoutes from '../modules/services/services.routes';
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
  if (!/discovery|availability|filter|canonical|ephemeral|smoke|test/i.test(db)) throw new Error(`ABORT: nome de banco "${db}" não parece efêmero.`);
  console.log(`🔒 DB efêmera confirmada: ${db}`);
}
const count = async (sql: string, p: unknown[] = []): Promise<number> => Number((await pool.query(sql, p)).rows[0].n);

const FUTURE_START = '2026-12-10T12:00:00Z';
const FUTURE_END = '2026-12-10T13:00:00Z';
const PAST_START = '2020-01-01T12:00:00Z';
const PAST_END = '2020-01-01T13:00:00Z';

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
async function mkAvailability(tenantId: string, ownerType: 'service' | 'service_offering', ownerId: string, startIso: string, endIso: string): Promise<string> {
  return (await pool.query<{ id: string }>(
    `INSERT INTO availability (tenant_id, owner_type, owner_id, availability_type, status, start_datetime, end_datetime, timezone, capacity, metadata)
       VALUES ($1::uuid,$2,$3::uuid,'fixed','active',$4,$5,'America/Sao_Paulo',1,'{}'::jsonb) RETURNING availability_id::text AS id`,
    [tenantId, ownerType, ownerId, new Date(startIso), new Date(endIso)]
  )).rows[0].id;
}
async function mkBooking(tenantId: string, availabilityId: string, requesterActorId: string): Promise<string> {
  return (await pool.query<{ id: string }>(`INSERT INTO bookings (tenant_id, availability_id, requester_actor_id, status, metadata, requested_at, confirmed_at, created_at, updated_at) VALUES ($1::uuid,$2::uuid,$3::uuid,'confirmed','{}'::jsonb,NOW(),NOW(),NOW(),NOW()) RETURNING booking_id::text AS id`, [tenantId, availabilityId, requesterActorId])).rows[0].id;
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

  const TENANT_ID = randomUUID();
  await tenantService.createTenant({ id: TENANT_ID, name: 'Discovery Has Availability Canonical Filter', slug: `dhacf-${Date.now()}` });
  const canon = (await pool.query<{ id: string }>(`SELECT id::text AS id FROM canonical_services LIMIT 10`)).rows.map((r) => r.id);
  if (canon.length < 7) throw new Error(`Precisa de ≥7 canonical_services no banco efêmero (achou ${canon.length}).`);

  // ── Fixtures por caso (cada caso: actor/provider próprio + canonical próprio → sem colisão UNIQUE(provider,canonical)) ──
  const A = await mkUserActor(TENANT_ID, 'ProvA'); const svcA = await mkService(TENANT_ID, A.actorId, 'SvcA', canon[0]);
  await mkAvailability(TENANT_ID, 'service', svcA, FUTURE_START, FUTURE_END); // janela LEGADA futura, SEM offering

  const B = await mkUserActor(TENANT_ID, 'ProvB'); const svcB = await mkService(TENANT_ID, B.actorId, 'SvcB', canon[1]);
  await mkOffering(TENANT_ID, B.actorId, canon[1], svcB); // offering ativa, SEM availability

  const C = await mkUserActor(TENANT_ID, 'ProvC'); const svcC = await mkService(TENANT_ID, C.actorId, 'SvcC', canon[2]);
  const offC = await mkOffering(TENANT_ID, C.actorId, canon[2], svcC);
  await mkAvailability(TENANT_ID, 'service_offering', offC, FUTURE_START, FUTURE_END); // offering + janela canônica FUTURA

  const D = await mkUserActor(TENANT_ID, 'ProvD'); const svcD = await mkService(TENANT_ID, D.actorId, 'SvcD', canon[3]);
  // sem availability nenhuma

  const F = await mkUserActor(TENANT_ID, 'ProvF'); const svcF = await mkService(TENANT_ID, F.actorId, 'SvcF', canon[4]);
  const offF = await mkOffering(TENANT_ID, F.actorId, canon[4], svcF);
  await mkAvailability(TENANT_ID, 'service_offering', offF, PAST_START, PAST_END); // offering + janela EXPIRADA

  const G = await mkUserActor(TENANT_ID, 'ProvG'); const svcG = await mkService(TENANT_ID, G.actorId, 'SvcG', canon[5]);
  const offG = await mkOffering(TENANT_ID, G.actorId, canon[5], svcG);
  const availG = await mkAvailability(TENANT_ID, 'service_offering', offG, FUTURE_START, FUTURE_END); // offering + janela FUTURA
  const cust = await mkUserActor(TENANT_ID, 'Customer');
  await mkBooking(TENANT_ID, availG, cust.actorId); // booking CONFIRMADO sobre a janela (conflito)

  const allSvc = [svcA, svcB, svcC, svcD, svcF, svcG];
  const bankBefore = await count(`SELECT ((SELECT count(*) FROM bank_ledger)+(SELECT count(*) FROM bank_transactions))::int AS n`);

  // ── Descoberta COM filtro has_availability=true ──
  const filtered = await servicesService.discoverServices(TENANT_ID, { hasAvailability: true });
  const inFiltered = new Set(filtered.map((s) => s.serviceId));

  record('A canônico + janela legada owner_type=service (SEM offering) → NÃO aparece (legado ≠ reservável)', !inFiltered.has(svcA));
  record('B canônico + offering ativa SEM availability → NÃO aparece', !inFiltered.has(svcB));
  record('C canônico + offering + availability service_offering FUTURA → APARECE', inFiltered.has(svcC));
  record('D canônico sem availability nenhuma → NÃO aparece', !inFiltered.has(svcD));
  record('F canônico + offering + janela EXPIRADA → NÃO aparece', !inFiltered.has(svcF));
  record('G canônico + offering + janela FUTURA + booking conflitante → APARECE (conflito não exclui; resolve no lock A1)', inFiltered.has(svcG));

  // ── E — serviço legado puro sem canonical é inexistente sob F-OFFER-2A (canonical_service_id NOT NULL) ──
  {
    let blocked = false;
    try {
      await pool.query(`INSERT INTO services (tenant_id, actor_id, name, slug, service_type, status, currency) VALUES ($1::uuid,$2::uuid,'SvcE','svce-x','service','active','BRL')`, [TENANT_ID, A.actorId]);
    } catch (e) { blocked = /canonical_service_id/.test(e instanceof Error ? e.message : String(e)); }
    record('E serviço legado puro (sem canonical) é inexistente sob F-OFFER-2A (NOT NULL bloqueia)', blocked);
  }

  // ── Default SEM filtro: todos os 6 serviços aparecem (filtro dormante não dropa) ──
  {
    const all = await servicesService.discoverServices(TENANT_ID, {});
    const inAll = new Set(all.map((s) => s.serviceId));
    const everyone = allSvc.every((id) => inAll.has(id));
    record('DEFAULT sem filtro: todos os 6 serviços aparecem (filtro dormante não altera membership)', everyone, `faltando=${allSvc.filter((id) => !inAll.has(id)).length}`);
  }

  // ── Prova do RE-KEY: A (tem janela legada, sem offering) sai; C (sem janela legada, com offering) entra ──
  {
    const rekeyed = !inFiltered.has(svcA) && inFiltered.has(svcC);
    record('RE-KEY provado: filtro NÃO usa owner_type=service (A sai apesar da janela legada; C entra só por offering canônica)', rekeyed);
  }

  // ── A2 não regride: availability_summary do serviço canônico segue suprimido ──
  {
    const all = await servicesService.discoverServices(TENANT_ID, {});
    const mine = all.find((s) => s.serviceId === svcC);
    record('A2 não regride: discoverServices suprime availability_summary legado (serviço canônico)', !!mine && mine.availability_summary === undefined, `summary=${JSON.stringify(mine?.availability_summary)}`);
  }

  // ── A2b não regride: GET público /services/:id/availability segue contido ──
  {
    const app = Fastify();
    app.decorateRequest('tenant', null); app.decorateRequest('user', null); app.decorateRequest('actionContext', null);
    app.addHook('onRequest', async (req) => { (req as any).tenant = { id: TENANT_ID }; });
    await app.register(servicesRoutes); await app.ready();
    const res = await app.inject({ method: 'GET', url: `/${svcC}/availability` });
    let body: any = {}; try { body = JSON.parse(res.body); } catch { /* noop */ }
    await app.close();
    record('A2b não regride: GET /services/:id/availability segue contido (data vazio + contained=true)', res.statusCode === 200 && Array.isArray(body?.data) && body.data.length === 0 && body?.contained === true, `status=${res.statusCode}`);
  }

  // ── Preservação: janela legada e enum intactos ──
  record('PRESERVAÇÃO: janela legada owner_type=service preservada no dado', (await count(`SELECT count(*)::int AS n FROM availability WHERE tenant_id=$1 AND owner_type='service'`, [TENANT_ID])) === 1);
  record('PRESERVAÇÃO: enum AvailabilityOwnerType.SERVICE preservado', AvailabilityOwnerType.SERVICE === 'service');

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
  console.log('✨ Filtro "Agenda aberta" re-keyed ao SSOT canônico (service_offering futura): matriz A–G correta; owner_type=service não decide membership; A2/A2b intactos; Δbank=0. R1 provado.');
}
main().catch(async (e) => { console.error('💥 Erro não tratado:', e); try { await pool.end(); } catch { /* noop */ } process.exit(1); });
