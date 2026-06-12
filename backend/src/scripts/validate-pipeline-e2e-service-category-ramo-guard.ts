/**
 * E2E F-SERVICE-CREATION-CATEGORY-RAMO-GUARD (DECISION-0109 D1/D3/D6).
 *
 * 🔒 DB EFÊMERA. Guard duro: current_database() === EXPECTED_DATABASE_NAME e NUNCA 'unificard_dev'.
 *    Orquestrado por scripts/run-service-category-ramo-guard-ephemeral.ps1.
 *
 * Prova: a criação de serviço só aceita categoria `domain='servicos'` E (quando a empresa do page-actor
 * está classificada) pertencente à ponte `company_type_service_categories` do company_type. Marketplace
 * rejeitado; servicos fora da ponte rejeitado; empresa-produto rejeitada; empresa não classificada rejeitada;
 * PF/legado sem empresa = compat (domínio sim, ramo não). Bank-free; zero availability/booking.
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
  if (!/service|category|ramo|guard|ephemeral|smoke|test/i.test(db)) throw new Error(`ABORT: nome de banco "${db}" não parece efêmero.`);
  console.log(`🔒 DB efêmera confirmada: ${db}`);
}

const count = async (sql: string, p: unknown[] = []): Promise<number> => Number((await pool.query(sql, p)).rows[0].n);

type Out = { ok: boolean; forbidden: boolean; err?: string };
// DECISION-0117 D: o writer passou a EXIGIR canonical_service_id ativo (identidade
// compartilhada). O eixo testado AQUI segue sendo categoria/ramo — usamos o serviço
// canônico GLOBAL seed (corte-de-cabelo-masculino) em todas as criações.
let CANONICAL_SERVICE_ID = '';
async function tryCreate(tenantId: string, actorId: string, name: string, categoryId: string | null): Promise<Out> {
  try {
    await servicesService.createService(tenantId, randomUUID(), {
      actorId, name, categoryId, serviceType: 'service' as any, status: 'draft' as any,
      canonicalServiceId: CANONICAL_SERVICE_ID,
    } as any); // intent undefined → pula validação de intent; o guard roda antes do create
    return { ok: true, forbidden: false };
  } catch (e) {
    return { ok: false, forbidden: e instanceof ForbiddenError, err: e instanceof Error ? e.message : String(e) };
  }
}

async function main(): Promise<void> {
  await assertEphemeralDb();

  const TENANT_ID = randomUUID();
  await tenantService.createTenant({ id: TENANT_ID, name: 'Service Guard', slug: `svc-guard-${Date.now()}` });

  // DECISION-0117 D: canônico global ativo do seed (identidade compartilhada do writer).
  CANONICAL_SERVICE_ID = (await pool.query<{ id: string }>(
    `SELECT id::text AS id FROM canonical_services WHERE scope='global' AND slug='corte-de-cabelo-masculino' LIMIT 1`
  )).rows[0].id;

  const ct = (await pool.query<{ id: string; slug: string; concept: string }>(
    `SELECT ct.id::text, ct.slug, a.concept_id::text AS concept FROM company_types ct
       JOIN company_type_allowed_concepts a ON a.company_type_id=ct.id WHERE ct.slug IN ('salao','supermercado')`
  )).rows;
  const salaoRow = ct.find((x) => x.slug === 'salao')!;
  const superRow = ct.find((x) => x.slug === 'supermercado')!;

  const C = async (slug: string): Promise<string> =>
    (await pool.query<{ id: string }>(`SELECT category_id::text AS id FROM categories WHERE slug=$1`, [slug])).rows[0].id;
  const catCabeleireiro = await C('servicos-cabeleireiro');
  const catBarbearia = await C('servicos-barbearia');
  const catManicure = await C('servicos-manicure');
  const catEsteticaFacial = await C('servicos-estetica-facial');
  const catEncanador = await C('servicos-encanador'); // servicos, mas FORA da ponte do salão
  const catMarketplaceCabelo = await C('marketplace-cabelo'); // domain=marketplace

  // identidade → actor humano (PF) e responsável dos page-actors
  const gu = randomUUID();
  await pool.query(`INSERT INTO identities (global_user_id, tax_id, tax_id_type, kyc_status, kyc_level) VALUES ($1::uuid,$2,'cpf','approved','basic')`,
    [gu, String(Date.now()).padStart(11, '0').slice(-11)]);
  const humanId = (await pool.query<{ id: string }>(
    `INSERT INTO actors (tenant_id, actor_type, display_name, global_user_id) VALUES ($1,'user','PF Cabeleireiro',$2::uuid) RETURNING id::text AS id`,
    [TENANT_ID, gu])).rows[0].id;

  const mkCompany = async (name: string, ctId: string | null, concept: string | null): Promise<string> => {
    if (ctId) return (await pool.query<{ c: string }>(
      `INSERT INTO companies (tenant_id, company_name, primary_company_type_id, primary_concept_id) VALUES ($1,$2,$3::uuid,$4::uuid) RETURNING company_id::text AS c`,
      [TENANT_ID, name, ctId, concept])).rows[0].c;
    return (await pool.query<{ c: string }>(
      `INSERT INTO companies (tenant_id, company_name) VALUES ($1,$2) RETURNING company_id::text AS c`, [TENANT_ID, name])).rows[0].c;
  };
  const mkPage = async (name: string, companyId: string): Promise<string> =>
    (await pool.query<{ id: string }>(
      `INSERT INTO actors (tenant_id, actor_type, display_name, company_id, responsible_actor_id) VALUES ($1,'page',$2,$3::uuid,$4::uuid) RETURNING id::text AS id`,
      [TENANT_ID, name, companyId, humanId])).rows[0].id;

  const salaoPage = await mkPage('Salão Glamour', await mkCompany('Salão Glamour', salaoRow.id, salaoRow.concept));
  const superPage = await mkPage('Super', await mkCompany('Super', superRow.id, superRow.concept));
  const unclassPage = await mkPage('Empresa Nova', await mkCompany('Empresa Nova', null, null));

  const bankBefore = await count(`SELECT ((SELECT count(*) FROM bank_ledger)+(SELECT count(*) FROM bank_transactions))::int AS n`);
  const availBefore = await count(`SELECT count(*)::int AS n FROM availability`);

  // ═══ 1-4 — salão cria serviço com cada categoria da SUA ponte → OK ═══
  record('1 salão + servicos-cabeleireiro → OK', (await tryCreate(TENANT_ID, salaoPage, 'Corte Masculino', catCabeleireiro)).ok);
  record('2 salão + servicos-barbearia → OK', (await tryCreate(TENANT_ID, salaoPage, 'Barba', catBarbearia)).ok);
  record('3 salão + servicos-manicure → OK', (await tryCreate(TENANT_ID, salaoPage, 'Manicure', catManicure)).ok);
  record('4 salão + servicos-estetica-facial → OK', (await tryCreate(TENANT_ID, salaoPage, 'Limpeza de Pele', catEsteticaFacial)).ok);

  // ═══ 5 — salão + categoria marketplace → REJEITA (domain≠servicos) ═══
  const r5 = await tryCreate(TENANT_ID, salaoPage, 'Servico Marketplace', catMarketplaceCabelo);
  record('5 salão + marketplace-cabelo REJEITADO (domain≠servicos, ForbiddenError)', r5.forbidden, r5.err);

  // ═══ 6 — salão + servicos FORA da ponte (encanador) → REJEITA ═══
  const r6 = await tryCreate(TENANT_ID, salaoPage, 'Encanamento', catEncanador);
  record('6 salão + servicos-encanador (fora da ponte) REJEITADO', r6.forbidden, r6.err);

  // ═══ 7 — empresa PRODUTO (supermercado) tenta serviço de salão → REJEITA ═══
  const r7 = await tryCreate(TENANT_ID, superPage, 'Corte no Super', catCabeleireiro);
  record('7 supermercado + servicos-cabeleireiro REJEITADO (sem ponte de serviço)', r7.forbidden, r7.err);

  // ═══ 8 — empresa NÃO classificada → REJEITA ═══
  const r8 = await tryCreate(TENANT_ID, unclassPage, 'Corte Sem Classe', catCabeleireiro);
  record('8 empresa não classificada (sem primary_company_type_id) REJEITADO', r8.forbidden, r8.err);

  // ═══ 9 — PF/legado sem empresa: domínio sim, ramo NÃO (compat) ═══
  record('9a PF (user actor, sem company) + servicos-cabeleireiro → OK (compat, ramo não aplica)',
    (await tryCreate(TENANT_ID, humanId, 'PF Corte', catCabeleireiro)).ok);
  const r9b = await tryCreate(TENANT_ID, humanId, 'PF Marketplace', catMarketplaceCabelo);
  record('9b PF + marketplace-cabelo REJEITADO (domínio vale para todos)', r9b.forbidden, r9b.err);

  // ═══ 10 — não-toque: só os serviços OK foram criados; zero availability/booking; Bank intocado ═══
  const svcCount = await count(`SELECT count(*)::int AS n FROM services WHERE tenant_id=$1`, [TENANT_ID]);
  record('10a apenas serviços válidos criados (5: 4 salão + 1 PF)', svcCount === 5, `services=${svcCount}`);
  record('10b nenhuma availability criada', (await count(`SELECT count(*)::int AS n FROM availability`)) === availBefore && availBefore === 0);
  record('10c nenhum booking', (await count(`SELECT count(*)::int AS n FROM bookings`)) === 0);
  record('10d Bank intocado', (await count(`SELECT ((SELECT count(*) FROM bank_ledger)+(SELECT count(*) FROM bank_transactions))::int AS n`)) === bankBefore);

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
  console.log('✨ Guard de categoria/ramo na criação de serviço: domínio servicos + ponte do company_type — verde.');
}

main().catch(async (e) => {
  console.error('💥 Erro não tratado:', e);
  try { await pool.end(); } catch { /* noop */ }
  process.exit(1);
});
