/**
 * E2E F-SERVICE-AVAILABILITY-LEGACY-SERVICE-OWNER-READER-CONTAINMENT-SLICE-A2
 * (DECISION-0156 / DT-SERVICE-AVAILABILITY-RUNTIME-DRIFT-FROM-SSOT).
 *
 * 🔒 DB EFÊMERA. Guard duro: current_database() === EXPECTED_DATABASE_NAME e NUNCA 'unificard_dev'.
 *    Orquestrado por scripts/run-legacy-service-availability-reader-containment-ephemeral.ps1.
 *
 * Prova que o reader legado de disponibilidade `owner_type='service'` NÃO é mais apresentado como agenda
 * reservável verdadeira na descoberta: `servicesService.discoverServices` deixa de expor `availability_summary`
 * para serviço canônico-bound (SSOT temporal reservável = a OFERTA, owner_type='service_offering'), mesmo que
 * exista janela legada `owner_type='service'` futura. Sem apagar dados, sem tocar o SSOT canônico, sem dinheiro.
 */
import 'tsconfig-paths/register';
import { pool } from '../core/database/pool';
import { tenantService } from '../core/tenants/tenant.service';
import { servicesService } from '../modules/services/services.service';
import { AvailabilityOwnerType, UnifiedAvailabilityStatus } from '../core/availability/unified-availability.types';
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
  if (!/legacy|service|availability|containment|ephemeral|smoke|test/i.test(db)) throw new Error(`ABORT: nome de banco "${db}" não parece efêmero.`);
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
// Janela LEGADA owner_type='service', owner_id=serviceId, futura (o "espelho velho").
async function mkLegacyServiceAvailability(tenantId: string, serviceId: string): Promise<string> {
  return (await pool.query<{ id: string }>(
    `INSERT INTO availability (tenant_id, owner_type, owner_id, availability_type, status, start_datetime, end_datetime, timezone, capacity, metadata)
       VALUES ($1::uuid,'service',$2::uuid,'fixed','active',$3,$4,'America/Sao_Paulo',1,'{}'::jsonb) RETURNING availability_id::text AS id`,
    [tenantId, serviceId, new Date('2026-12-01T12:00:00Z'), new Date('2026-12-01T13:00:00Z')]
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
  await tenantService.createTenant({ id: TENANT_ID, name: 'Legacy Service Availability Containment', slug: `lsac-${Date.now()}` });
  const canonicalServiceId = (await pool.query<{ id: string }>(`SELECT id::text AS id FROM canonical_services LIMIT 1`)).rows[0]?.id;
  if (!canonicalServiceId) throw new Error('Sem canonical_services no banco efêmero (migrate FULL deveria semear).');

  const alice = await mkUserActor(TENANT_ID, 'Alice');
  const serviceId = await mkService(TENANT_ID, alice.actorId, 'ServicoLegado', canonicalServiceId); // canônico-bound (canonical_service_id NOT NULL sob F-OFFER-2A)
  const availId = await mkLegacyServiceAvailability(TENANT_ID, serviceId); // janela legada owner_type='service' FUTURA

  const bankBefore = await count(`SELECT ((SELECT count(*) FROM bank_ledger)+(SELECT count(*) FROM bank_transactions))::int AS n`);

  // ── Pré-condição — a janela legada owner_type='service' EXISTE e é futura (produziria has_availability=true no reader antigo) ──
  {
    const legacy = await servicesService.listServiceAvailabilities(TENANT_ID, serviceId, { status: UnifiedAvailabilityStatus.ACTIVE });
    const future = legacy.some((a) => a.ownerType === AvailabilityOwnerType.SERVICE && new Date(a.startDatetime) > new Date());
    record('PRE janela legada owner_type=service existe e é futura (reader antigo mostraria "Agenda aberta")', legacy.length === 1 && future, `n=${legacy.length} future=${future}`);
  }

  // ── T1 (CENTRAL) — discoverServices NÃO expõe availability_summary para serviço canônico-bound ──
  {
    const list = await servicesService.discoverServices(TENANT_ID, {});
    const mine = list.find((s) => s.serviceId === serviceId);
    const appears = !!mine; // o serviço continua descobrível (contenção ≠ sumiço)
    const suppressed = !!mine && mine.availability_summary === undefined; // summary legado NÃO apresentado
    const isCanonical = !!mine && !!mine.canonicalServiceId;
    record('T1 discoverServices: serviço canônico aparece MAS availability_summary legado é SUPRIMIDO (não mente agenda reservável)', appears && suppressed && isCanonical, `appears=${appears} suppressed=${suppressed} canonical=${isCanonical} summary=${JSON.stringify(mine?.availability_summary)}`);
  }

  // ── T2 — PRESERVAÇÃO: a janela legada NÃO foi apagada (contenção de reader ≠ deleção) ──
  {
    const stillThere = await count(`SELECT count(*)::int AS n FROM availability WHERE tenant_id=$1 AND availability_id=$2 AND owner_type='service'`, [TENANT_ID, availId]);
    record('T2 janela legada owner_type=service PRESERVADA no dado (não apagada)', stillThere === 1, `n=${stillThere}`);
  }

  // ── T3 — o enum/policy owner_type='service' segue existindo (contenção ≠ remoção do enum) ──
  {
    const enumOk = AvailabilityOwnerType.SERVICE === 'service';
    record('T3 enum AvailabilityOwnerType.SERVICE preservado (compat; contenção não remove enum)', enumOk, `value=${AvailabilityOwnerType.SERVICE}`);
  }

  // ── T4 — Bank intocado (Δbank=0) ──
  {
    const bankAfter = await count(`SELECT ((SELECT count(*) FROM bank_ledger)+(SELECT count(*) FROM bank_transactions))::int AS n`);
    record('T4 Bank intocado (bank_ledger + bank_transactions inalterados) — Δbank=0', bankAfter === bankBefore, `before=${bankBefore} after=${bankAfter}`);
  }

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${'═'.repeat(64)}`);
  console.log(`RESULTADO: ${results.length - failed.length}/${results.length} verdes`);
  if (failed.length > 0) {
    console.log('FALHAS:'); failed.forEach((f) => console.log(`  ❌ ${f.label} — ${f.reason ?? ''}`));
    await pool.end(); process.exit(1);
  }
  await pool.end();
  console.log('✨ Reader legado owner_type=service contido no discover: não é mais apresentado como agenda reservável; janela preservada; SSOT segue na oferta. DT-SERVICE-AVAILABILITY-RUNTIME-DRIFT-FROM-SSOT provada.');
}
main().catch(async (e) => { console.error('💥 Erro não tratado:', e); try { await pool.end(); } catch { /* noop */ } process.exit(1); });
