/**
 * E2E F-SERVICE-AVAILABILITY-LEGACY-PUBLIC-ENDPOINT-CONTAINMENT-SLICE-A2B
 * (DECISION-0156 / DT-SERVICE-AVAILABILITY-RUNTIME-DRIFT-FROM-SSOT — resíduo R2).
 *
 * 🔒 DB EFÊMERA. Guard duro: current_database() === EXPECTED_DATABASE_NAME e NUNCA 'unificard_dev'.
 *    Orquestrado por scripts/run-legacy-service-availability-endpoint-containment-ephemeral.ps1.
 *
 * Prova que o endpoint público legado GET /services/:serviceId/availability NÃO expõe mais janelas
 * `owner_type='service'` como agenda reservável verdadeira para serviço canônico-bound: retorna terminal
 * honesto + vazio controlado (a agenda reservável vive na OFERTA, owner_type='service_offering'). Sem apagar
 * dado legado, sem remover enum, sem tocar writers/booking/dinheiro.
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
  if (!/legacy|service|availability|endpoint|containment|ephemeral|smoke|test/i.test(db)) throw new Error(`ABORT: nome de banco "${db}" não parece efêmero.`);
  console.log(`🔒 DB efêmera confirmada: ${db}`);
}
const count = async (sql: string, p: unknown[] = []): Promise<number> => Number((await pool.query(sql, p)).rows[0].n);

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
async function mkAvailability(tenantId: string, ownerType: 'service' | 'service_offering', ownerId: string): Promise<string> {
  return (await pool.query<{ id: string }>(
    `INSERT INTO availability (tenant_id, owner_type, owner_id, availability_type, status, start_datetime, end_datetime, timezone, capacity, metadata)
       VALUES ($1::uuid,$2,$3::uuid,'fixed','active',$4,$5,'America/Sao_Paulo',1,'{}'::jsonb) RETURNING availability_id::text AS id`,
    [tenantId, ownerType, ownerId, new Date('2026-12-05T12:00:00Z'), new Date('2026-12-05T13:00:00Z')]
  )).rows[0].id;
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
  await tenantService.createTenant({ id: TENANT_ID, name: 'Legacy Service Availability Endpoint Containment', slug: `lsaec-${Date.now()}` });
  const canonicalServiceId = (await pool.query<{ id: string }>(`SELECT id::text AS id FROM canonical_services LIMIT 1`)).rows[0]?.id;
  if (!canonicalServiceId) throw new Error('Sem canonical_services no banco efêmero (migrate FULL deveria semear).');

  const alice = await mkUserActor(TENANT_ID, 'Alice');
  const serviceId = await mkService(TENANT_ID, alice.actorId, 'ServicoLegado', canonicalServiceId); // canônico-bound
  const legacyAvailId = await mkAvailability(TENANT_ID, 'service', serviceId); // janela LEGADA owner_type='service' futura
  const offeringId = await mkOffering(TENANT_ID, alice.actorId, canonicalServiceId, serviceId);
  const offeringAvailId = await mkAvailability(TENANT_ID, 'service_offering', offeringId); // janela canônica (oferta)

  const bankBefore = await count(`SELECT ((SELECT count(*) FROM bank_ledger)+(SELECT count(*) FROM bank_transactions))::int AS n`);

  // ── PRE — a janela legada owner_type='service' existe (o endpoint antigo a devolveria crua) ──
  {
    const n = await count(`SELECT count(*)::int AS n FROM availability WHERE tenant_id=$1 AND owner_type='service' AND owner_id=$2`, [TENANT_ID, serviceId]);
    record('PRE janela legada owner_type=service existe (endpoint antigo devolveria crua)', n === 1, `n=${n}`);
  }

  // App Fastify mínimo com tenant fixado (o endpoint é público, exige req.tenant.id).
  const app = Fastify();
  app.decorateRequest('tenant', null);
  app.decorateRequest('user', null);
  app.decorateRequest('actionContext', null);
  app.addHook('onRequest', async (req) => { (req as any).tenant = { id: TENANT_ID }; });
  await app.register(servicesRoutes);
  await app.ready();

  // ── T1 (CENTRAL) — GET público NÃO expõe janelas owner_type='service' como reserváveis (terminal honesto + vazio) ──
  {
    const res = await app.inject({ method: 'GET', url: `/${serviceId}/availability` });
    let body: any = {}; try { body = JSON.parse(res.body); } catch { /* noop */ }
    const empty = Array.isArray(body?.data) && body.data.length === 0;
    const contained = body?.contained === true && body?.reason === 'SERVICE_LEVEL_AVAILABILITY_LEGACY_CONTAINED';
    record('T1 GET /services/:id/availability CONTIDO: data vazio + terminal honesto (owner_type=service não é reservável)', res.statusCode === 200 && empty && contained, `status=${res.statusCode} body=${res.body?.slice(0, 200)}`);
  }

  await app.close();

  // ── T2 — PRESERVAÇÃO: a janela legada NÃO foi apagada ──
  {
    const still = await count(`SELECT count(*)::int AS n FROM availability WHERE tenant_id=$1 AND availability_id=$2 AND owner_type='service'`, [TENANT_ID, legacyAvailId]);
    record('T2 janela legada owner_type=service PRESERVADA no dado (contenção ≠ deleção)', still === 1, `n=${still}`);
  }

  // ── T3 — SSOT CANÔNICO INTACTO: a janela owner_type='service_offering' segue existindo ──
  {
    const canon = await count(`SELECT count(*)::int AS n FROM availability WHERE tenant_id=$1 AND availability_id=$2 AND owner_type='service_offering'`, [TENANT_ID, offeringAvailId]);
    record('T3 janela canônica owner_type=service_offering intacta (SSOT reservável preservado)', canon === 1, `n=${canon}`);
  }

  // ── T4 — enum owner_type='service' preservado (contenção ≠ remoção do enum) ──
  {
    record('T4 enum AvailabilityOwnerType.SERVICE preservado (compat)', AvailabilityOwnerType.SERVICE === 'service', `value=${AvailabilityOwnerType.SERVICE}`);
  }

  // ── T5 — A2 não regride: discoverServices segue suprimindo o availability_summary legado ──
  {
    const list = await servicesService.discoverServices(TENANT_ID, {});
    const mine = list.find((s) => s.serviceId === serviceId);
    record('T5 A2 não regride: discoverServices suprime availability_summary legado do serviço canônico', !!mine && mine.availability_summary === undefined, `summary=${JSON.stringify(mine?.availability_summary)}`);
  }

  // ── T6 — Bank intocado (Δbank=0) ──
  {
    const bankAfter = await count(`SELECT ((SELECT count(*) FROM bank_ledger)+(SELECT count(*) FROM bank_transactions))::int AS n`);
    record('T6 Bank intocado (bank_ledger + bank_transactions inalterados) — Δbank=0', bankAfter === bankBefore, `before=${bankBefore} after=${bankAfter}`);
  }

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${'═'.repeat(64)}`);
  console.log(`RESULTADO: ${results.length - failed.length}/${results.length} verdes`);
  if (failed.length > 0) {
    console.log('FALHAS:'); failed.forEach((f) => console.log(`  ❌ ${f.label} — ${f.reason ?? ''}`));
    await pool.end(); process.exit(1);
  }
  await pool.end();
  console.log('✨ Endpoint público legado /services/:id/availability contido: não expõe owner_type=service como reservável; dado/enum preservados; SSOT segue na oferta. R2 provado.');
}
main().catch(async (e) => { console.error('💥 Erro não tratado:', e); try { await pool.end(); } catch { /* noop */ } process.exit(1); });
