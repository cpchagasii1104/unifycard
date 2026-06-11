/**
 * E2E F-PJ-LIFECYCLE-DRAFT-TO-PROVISIONAL — empresa nasce DRAFT, finaliza vira PROVISIONAL.
 *
 * Caminho 1 (decisão Clayton): a empresa é criada `company_status='DRAFT'` (em configuração,
 * não aparece como cadastrada/pronta). A finalização do onboarding — activateCompanyOperationally,
 * Momento 2 — promove `DRAFT → PROVISIONAL` no MESMO UPDATE atômico que grava o par soberano.
 * KYB (fiscal_identities.kyb_status) é eixo SEPARADO e NÃO é tocado aqui.
 *
 * Prova:
 *   L1 — createCompany nasce company_status='DRAFT' (não PROVISIONAL).
 *   L2 — activateCompanyOperationally promove DRAFT → PROVISIONAL.
 *   L3 — promoção é atômica com o par soberano (primary_* gravados na mesma linha).
 *   L4 — reativação idempotente (mesmo par) NÃO regride/muda company_status.
 *   L5 — anti-fraude conta DRAFT no limite de onboarding (DRAFT + PROVISIONAL ≥ 3 bloqueia).
 *
 * Base: tenant DEV + PF canônica (dev@unificard.local). Empresas de teste LIMPAS ao fim (DEV intacto).
 * Modo: npx tsx backend/src/scripts/validate-pipeline-e2e-pj-lifecycle-draft-to-provisional.ts
 */

import dotenv from 'dotenv';
import { join } from 'path';

import { pool } from '../core/database/pool';
import { deleteCompaniesAndFiscal } from './helpers/pj-fiscal-cleanup';
import { companiesService } from '../core/companies/companies.service';

dotenv.config({ path: join(process.cwd(), '.env') });

const TENANT_ID = process.env.E2E_TENANT_ID || 'fbe13b78-4516-493d-905a-363796aea1d1';
const DEV_EMAIL = 'dev@unificard.local';

type Res = { label: string; ok: boolean; reason?: string };
const results: Res[] = [];
function record(label: string, ok: boolean, reason?: string): void {
  results.push({ label, ok, reason });
  console.log(`  ${ok ? '✅' : '❌'} ${label}${ok ? '' : ` — ${reason ?? ''}`}`);
}

async function bootstrap(): Promise<void> {
  const { socialPortsRegistry } = await import('../core/social/ports-registry');
  const adapters = await import('../modules/social/adapters');
  socialPortsRegistry.setActorRepository(adapters.actorRepositoryAdapter);
  socialPortsRegistry.setActorUtils(adapters.actorUtilsAdapter);
  socialPortsRegistry.setSocialRepository(adapters.socialRepositoryAdapter);
  socialPortsRegistry.setSocialService(adapters.socialServiceAdapter);
  socialPortsRegistry.setEventFeedHandlers(adapters.eventFeedHandlersAdapter);
}

function randomCnpj(): string {
  // 12 dígitos base + 2 verificadores (algoritmo oficial), p/ passar o guard de check-digit.
  const n: number[] = [];
  for (let i = 0; i < 12; i++) n.push(Math.floor(Math.random() * 10));
  const dv = (base: number[]): number => {
    const weights = base.length === 12
      ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
      : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const sum = base.reduce((acc, d, i) => acc + d * weights[i], 0);
    const r = sum % 11;
    return r < 2 ? 0 : 11 - r;
  };
  const d1 = dv(n);
  const d2 = dv([...n, d1]);
  return [...n, d1, d2].join('');
}

async function statusOf(companyId: string): Promise<string | null> {
  const r = await pool.query<{ s: string }>(
    `SELECT company_status AS s FROM companies WHERE company_id = $1`,
    [companyId]
  );
  return r.rows[0]?.s ?? null;
}

async function main(): Promise<void> {
  await bootstrap();

  const dev = await pool.query<{ user_id: string; global_user_id: string }>(
    `SELECT user_id::text, global_user_id::text FROM users WHERE email = $1 AND tenant_id = $2 LIMIT 1`,
    [DEV_EMAIL, TENANT_ID]
  );
  if (dev.rowCount === 0) {
    console.error('❌ PF DEV não encontrada — rode bootstrap-dev-canonical antes.');
    process.exit(1);
  }
  const devUserId = dev.rows[0].user_id;
  const devGlobalUserId = dev.rows[0].global_user_id;

  const pairRes = await pool.query<{ company_type_id: string; concept_id: string }>(
    `SELECT ctac.company_type_id::text, ctac.concept_id::text
       FROM company_type_allowed_concepts ctac
       JOIN company_types ct ON ct.id = ctac.company_type_id
      ORDER BY ct.slug LIMIT 1`
  );
  const pair = pairRes.rows[0];

  const createdCompanyIds: string[] = [];

  try {
    // ═══ L1 — nasce DRAFT ════════════════════════════════════════════════════
    console.log('\n— L (lifecycle) —');
    const c1 = await companiesService.createCompany(
      devGlobalUserId,
      { cnpj: randomCnpj(), companyName: 'E2E Lifecycle C1', role: 'owner', fetchFromRevenue: false, isPrimary: true },
      TENANT_ID
    );
    const c1Id = c1.company.companyId;
    createdCompanyIds.push(c1Id);

    const born = await statusOf(c1Id);
    record('L1 createCompany nasce company_status=DRAFT', born === 'DRAFT', `status=${born}`);

    // ═══ L2/L3 — finalizar promove DRAFT → PROVISIONAL, atômico com o par ════
    const act = await companiesService.activateCompanyOperationally({
      tenantId: TENANT_ID,
      companyId: c1Id,
      responsibleUserId: devUserId,
      primaryCompanyTypeId: pair.company_type_id,
      primaryConceptId: pair.concept_id,
    });
    record('L2.0 ativação ocorre (alreadyActive=false)', act.alreadyActive === false);

    const afterActivate = await pool.query<{ s: string; t: string | null; c: string | null }>(
      `SELECT company_status AS s, primary_company_type_id::text AS t, primary_concept_id::text AS c
         FROM companies WHERE company_id = $1`,
      [c1Id]
    );
    record('L2 finalizar promove DRAFT → PROVISIONAL', afterActivate.rows[0].s === 'PROVISIONAL', `status=${afterActivate.rows[0].s}`);
    record(
      'L3 promoção atômica com par soberano (primary_* na mesma linha)',
      afterActivate.rows[0].t === pair.company_type_id && afterActivate.rows[0].c === pair.concept_id
    );

    // ═══ L4 — reativação idempotente NÃO muda company_status ═════════════════
    const act2 = await companiesService.activateCompanyOperationally({
      tenantId: TENANT_ID,
      companyId: c1Id,
      responsibleUserId: devUserId,
      primaryCompanyTypeId: pair.company_type_id,
      primaryConceptId: pair.concept_id,
    });
    const afterIdem = await statusOf(c1Id);
    record('L4 reativação idempotente mantém PROVISIONAL (não regride)', act2.alreadyActive === true && afterIdem === 'PROVISIONAL', `status=${afterIdem}`);

    // ═══ L5 — anti-fraude conta DRAFT no limite de onboarding ════════════════
    // c1 já PROVISIONAL conta 1. Criar mais 2 DRAFT → total 3 (limite). A 4ª deve falhar.
    const c2 = await companiesService.createCompany(
      devGlobalUserId,
      { cnpj: randomCnpj(), companyName: 'E2E Lifecycle C2', role: 'owner', fetchFromRevenue: false, isPrimary: false },
      TENANT_ID
    );
    createdCompanyIds.push(c2.company.companyId);
    const c3 = await companiesService.createCompany(
      devGlobalUserId,
      { cnpj: randomCnpj(), companyName: 'E2E Lifecycle C3', role: 'owner', fetchFromRevenue: false, isPrimary: false },
      TENANT_ID
    );
    createdCompanyIds.push(c3.company.companyId);

    let blocked = false;
    try {
      const c4 = await companiesService.createCompany(
        devGlobalUserId,
        { cnpj: randomCnpj(), companyName: 'E2E Lifecycle C4', role: 'owner', fetchFromRevenue: false, isPrimary: false },
        TENANT_ID
      );
      createdCompanyIds.push(c4.company.companyId); // se passou, registra p/ cleanup
    } catch (e) {
      blocked = /Limite de 3 empresas em onboarding/.test((e as Error).message);
    }
    record('L5 anti-fraude conta DRAFT no limite de onboarding (4ª bloqueada)', blocked);
  } finally {
    console.log('\n— cleanup —');
    if (createdCompanyIds.length > 0) {
      const ids = createdCompanyIds;
      const tables = ['company_opportunity_preferences', 'company_domains', 'company_users'];
      for (const t of tables) {
        try {
          await pool.query(`DELETE FROM ${t} WHERE company_id = ANY($1::uuid[])`, [ids]);
        } catch (e) {
          if ((e as { code?: string }).code !== '42P01') console.warn(`cleanup ${t}:`, (e as Error).message);
        }
      }
      await pool.query(`DELETE FROM actors WHERE company_id = ANY($1::uuid[])`, [ids]);
      await deleteCompaniesAndFiscal(pool, "company_id = ANY($1::uuid[])", [ids]);
      const left = await pool.query<{ n: string }>(`SELECT count(*)::text AS n FROM companies WHERE company_id = ANY($1::uuid[])`, [ids]);
      const actorsLeft = await pool.query<{ n: string }>(`SELECT count(*)::text AS n FROM actors WHERE company_id = ANY($1::uuid[])`, [ids]);
      console.log(`  companies restantes=${left.rows[0].n} · page-actors restantes=${actorsLeft.rows[0].n}`);
      record('CLEANUP DEV intacto (companies/page-actors de teste = 0)', left.rows[0].n === '0' && actorsLeft.rows[0].n === '0');
    }
  }

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${'═'.repeat(60)}`);
  console.log(`RESULTADO: ${results.length - failed.length}/${results.length} verdes`);
  if (failed.length > 0) {
    console.log('FALHAS:');
    failed.forEach((f) => console.log(`  ❌ ${f.label} — ${f.reason ?? ''}`));
    await pool.end();
    process.exit(1);
  }
  await pool.end();
  console.log('✨ Lifecycle DRAFT → PROVISIONAL verde.');
}

main().catch(async (e) => {
  console.error('💥 Erro não tratado:', e);
  try { await pool.end(); } catch { /* noop */ }
  process.exit(1);
});
