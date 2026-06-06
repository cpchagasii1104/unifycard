/**
 * E2E F-SERVICE-SALON-AVAILABILITY-BANK-FREE (DECISION-0109).
 *
 * 🔒 DB EFÊMERA. Guard duro: current_database() === EXPECTED_DATABASE_NAME e NUNCA 'unificard_dev'.
 *    Orquestrado por scripts/run-service-salon-availability-bank-free-ephemeral.ps1.
 *
 * Prova: a agenda de um serviço de salão usa o CORE real `availability` (owner_type='service',
 * owner_id=service_id), via adapter fino em `services.service` — SEM SSOT paralelo, SEM booking, SEM Bank.
 * Escrita = dono; leitura = pública. Categoria de serviço inválida segue barrada pelo guard anterior.
 */
import 'tsconfig-paths/register';
import { pool } from '../core/database/pool';
import { tenantService } from '../core/tenants/tenant.service';
import { servicesService } from '../modules/services/services.service';
import { ForbiddenError } from '../core/errors';
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
  if (!/service|salon|availability|bank|free|ephemeral|smoke|test/i.test(db)) throw new Error(`ABORT: nome de banco "${db}" não parece efêmero.`);
  console.log(`🔒 DB efêmera confirmada: ${db}`);
}

const count = async (sql: string, p: unknown[] = []): Promise<number> => Number((await pool.query(sql, p)).rows[0].n);

async function main(): Promise<void> {
  await assertEphemeralDb();

  const TENANT_ID = randomUUID();
  await tenantService.createTenant({ id: TENANT_ID, name: 'Salon Availability', slug: `salon-av-${Date.now()}` });

  const salao = (await pool.query<{ id: string; concept: string }>(
    `SELECT ct.id::text, a.concept_id::text AS concept FROM company_types ct
       JOIN company_type_allowed_concepts a ON a.company_type_id=ct.id WHERE ct.slug='salao' LIMIT 1`
  )).rows[0];
  const superCt = (await pool.query<{ id: string; concept: string }>(
    `SELECT ct.id::text, a.concept_id::text AS concept FROM company_types ct
       JOIN company_type_allowed_concepts a ON a.company_type_id=ct.id WHERE ct.slug='supermercado' LIMIT 1`
  )).rows[0];
  const catCabeleireiro = (await pool.query<{ id: string }>(`SELECT category_id::text AS id FROM categories WHERE slug='servicos-cabeleireiro'`)).rows[0].id;

  // identidade → actor humano (responsável) + page-actors
  const gu = randomUUID();
  await pool.query(`INSERT INTO identities (global_user_id, tax_id, tax_id_type, kyc_status, kyc_level) VALUES ($1::uuid,$2,'cpf','approved','basic')`,
    [gu, String(Date.now()).padStart(11, '0').slice(-11)]);
  const humanId = (await pool.query<{ id: string }>(
    `INSERT INTO actors (tenant_id, actor_type, display_name, global_user_id) VALUES ($1,'user','Dono',$2::uuid) RETURNING id::text AS id`,
    [TENANT_ID, gu])).rows[0].id;
  const salaoCompany = (await pool.query<{ c: string }>(
    `INSERT INTO companies (tenant_id, company_name, primary_company_type_id, primary_concept_id) VALUES ($1,'Salão',$2::uuid,$3::uuid) RETURNING company_id::text AS c`,
    [TENANT_ID, salao.id, salao.concept])).rows[0].c;
  const salaoPage = (await pool.query<{ id: string }>(
    `INSERT INTO actors (tenant_id, actor_type, display_name, company_id, responsible_actor_id) VALUES ($1,'page','Salão Glamour',$2::uuid,$3::uuid) RETURNING id::text AS id`,
    [TENANT_ID, salaoCompany, humanId])).rows[0].id;
  const superCompany = (await pool.query<{ c: string }>(
    `INSERT INTO companies (tenant_id, company_name, primary_company_type_id, primary_concept_id) VALUES ($1,'Super',$2::uuid,$3::uuid) RETURNING company_id::text AS c`,
    [TENANT_ID, superCt.id, superCt.concept])).rows[0].c;
  const superPage = (await pool.query<{ id: string }>(
    `INSERT INTO actors (tenant_id, actor_type, display_name, company_id, responsible_actor_id) VALUES ($1,'page','Super',$2::uuid,$3::uuid) RETURNING id::text AS id`,
    [TENANT_ID, superCompany, humanId])).rows[0].id;

  const bankBefore = await count(`SELECT ((SELECT count(*) FROM bank_ledger)+(SELECT count(*) FROM bank_transactions))::int AS n`);

  // ═══ 1 — criar serviço válido de salão (passa pelo guard de categoria) ═══
  const service = await servicesService.createService(TENANT_ID, randomUUID(), {
    actorId: salaoPage, name: 'Corte Feminino', categoryId: catCabeleireiro, serviceType: 'service' as any, status: 'active' as any,
  } as any);
  record('1 serviço de salão criado (válido, passou pelo guard)', !!service.serviceId);
  const serviceId = service.serviceId;

  // ═══ 2/3 — criar availability via adapter → linha no CORE `availability` com owner=service ═══
  const av = await servicesService.createServiceAvailability(TENANT_ID, salaoPage, serviceId, {
    startDatetime: new Date('2026-07-01T09:00:00Z'),
    endDatetime: new Date('2026-07-01T12:00:00Z'),
    timezone: 'America/Sao_Paulo',
  });
  record('2 availability criada via adapter (delega ao core)', !!av.availabilityId);
  const row = (await pool.query<{ owner_type: string; owner_id: string }>(
    `SELECT owner_type, owner_id::text FROM availability WHERE availability_id=$1`, [av.availabilityId])).rows[0];
  record('3 linha em `availability` com owner_type=service, owner_id=service_id',
    !!row && row.owner_type === 'service' && row.owner_id === serviceId, JSON.stringify(row));

  // ═══ adapter delega ao core (mesma availability listável pelo core e pelo adapter) ═══
  const listed = await servicesService.listServiceAvailabilities(TENANT_ID, serviceId);
  record('9 adapter delega ao core: list devolve a availability (owner=service)',
    listed.length === 1 && listed[0].availabilityId === av.availabilityId && listed[0].ownerId === serviceId);

  // ═══ escrita = dono: outro actor NÃO cria agenda do serviço ═══
  let nonOwnerBlocked = false;
  try {
    await servicesService.createServiceAvailability(TENANT_ID, humanId, serviceId, {
      startDatetime: new Date('2026-07-02T09:00:00Z'), endDatetime: new Date('2026-07-02T10:00:00Z'),
    });
  } catch (e) { nonOwnerBlocked = e instanceof ForbiddenError; }
  record('escrita = dono: actor não-dono REJEITADO (ForbiddenError)', nonOwnerBlocked);

  // ═══ 10 — guard anterior ainda barra: supermercado não cria serviço de salão ═══
  let superBlocked = false;
  try {
    await servicesService.createService(TENANT_ID, randomUUID(), {
      actorId: superPage, name: 'Corte no Super', categoryId: catCabeleireiro, serviceType: 'service' as any,
    } as any);
  } catch (e) { superBlocked = e instanceof ForbiddenError; }
  record('10 supermercado segue barrado pelo guard de categoria (não cria serviço de salão)', superBlocked);

  // ═══ 4-6 — não-toque: zero booking / service_order / Bank ═══
  record('4 nenhum booking criado', (await count(`SELECT count(*)::int AS n FROM bookings`)) === 0);
  record('5 nenhum service_order criado', (await count(`SELECT count(*)::int AS n FROM service_orders`)) === 0);
  record('6 nenhum payment/escrow; Bank intocado', (await count(`SELECT ((SELECT count(*) FROM bank_ledger)+(SELECT count(*) FROM bank_transactions))::int AS n`)) === bankBefore);
  record('8 availability é a única verdade temporal (1 linha total, no core)', (await count(`SELECT count(*)::int AS n FROM availability`)) === 1);

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${'═'.repeat(64)}`);
  console.log(`RESULTADO: ${results.length - failed.length}/${results.length} verdes`);
  if (failed.length > 0) {
    console.log('FALHAS:');
    failed.forEach((f) => console.log(`  ❌ ${f.label} — ${f.reason ?? ''}`));
    await pool.end();
    process.exit(1);
  }
  await pool.end();
  console.log('✨ Agenda de serviço Bank-free sobre o core availability (owner=service) — verde.');
}

main().catch(async (e) => {
  console.error('💥 Erro não tratado:', e);
  try { await pool.end(); } catch { /* noop */ }
  process.exit(1);
});
