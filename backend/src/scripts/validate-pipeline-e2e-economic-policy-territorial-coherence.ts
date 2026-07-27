/**
 * E2E — FATIA 0 (frente economic-policy) — convergência territorial de economic_policies para o
 * Location Core governado (country_id/state_id/city_id, FKs simples + compostas hierárquicas,
 * mirror de regional_fund_accounts). Roda SÓ em DB efêmera
 * (run-economic-policy-territorial-coherence-ephemeral.ps1). NUNCA unificard_dev.
 *
 * Prova:
 *   A · resolução escolhe a policy MAIS ESPECÍFICA: category+city > city > state > country,
 *       dirigida pelos seletores GOVERNADOS (countryId/stateId/cityId), não mais TEXT.
 *   B · a FK composta (state_id, city_id) → cities(state_id, city_id) REJEITA no banco uma
 *       combinação incoerente (cidade de outro estado) — assert de carga (LOAD-BEARING).
 *   C · fail-closed preservado: POLICY_NOT_FOUND quando nada casa; POLICY_AMBIGUITY em empate real.
 *   D · Δbank=0 — nenhuma linha em bank_transactions/bank_ledger/bank_splits para o tenant do E2E
 *       (economic_policies é substrato de REGRA, nunca dinheiro).
 */

import 'tsconfig-paths/register';
import { pool } from '../core/database/pool';
import { tenantService } from '../core/tenants/tenant.service';
import { economicPolicyRepository } from '../modules/economy/policy-engine/economic-policy.repository';
import { economicPolicyEngineService } from '../modules/economy/policy-engine/economic-policy-engine.service';
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
  if (!/territorial|coherence|ephemeral|test/i.test(db)) throw new Error(`ABORT: nome "${db}" não parece efêmero.`);
  console.log(`🔒 DB efêmera confirmada: ${db}`);
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

  const TENANT = randomUUID();
  await tenantService.createTenant({ id: TENANT, name: 'Economic Policy Territorial Coherence Tenant', slug: `epterr-${Date.now()}` });

  // ============================================================
  // Fixtures — Location Core JÁ GOVERNADO (seed F3-S5: BR + 27 estados + 27 capitais).
  // ============================================================
  const country = await pool.query<{ country_id: string }>(
    `SELECT country_id::text AS country_id FROM countries WHERE iso_alpha2 = 'BR' LIMIT 1`
  );
  if (!country.rows[0]) throw new Error('ABORT: país BR ausente no catálogo (seed F3-S5 esperado).');
  const countryId = country.rows[0].country_id;

  const statePR = await pool.query<{ state_id: string }>(
    `SELECT state_id::text AS state_id FROM states WHERE country_id = $1::uuid AND abbreviation = 'PR' LIMIT 1`,
    [countryId]
  );
  const stateSP = await pool.query<{ state_id: string }>(
    `SELECT state_id::text AS state_id FROM states WHERE country_id = $1::uuid AND abbreviation = 'SP' LIMIT 1`,
    [countryId]
  );
  if (!statePR.rows[0] || !stateSP.rows[0]) throw new Error('ABORT: estados PR/SP ausentes no catálogo.');
  const statePrId = statePR.rows[0].state_id;
  const stateSpId = stateSP.rows[0].state_id;

  const cityCuritiba = await pool.query<{ city_id: string }>(
    `SELECT city_id::text AS city_id FROM cities WHERE state_id = $1::uuid AND name = 'Curitiba' LIMIT 1`,
    [statePrId]
  );
  if (!cityCuritiba.rows[0]) throw new Error('ABORT: cidade Curitiba (capital PR) ausente no catálogo.');
  const cityCuritibaId = cityCuritiba.rows[0].city_id;

  const catRow = await pool.query<{ category_id: string }>(`SELECT category_id::text AS category_id FROM categories LIMIT 1`);
  if (!catRow.rows[0]) throw new Error('ABORT: nenhuma categoria disponível no catálogo.');
  const categoryId = catRow.rows[0].category_id;

  console.log(`\n— economic-policy territorial coherence (FATIA 0, Location Core) —`);
  console.log(`  ℹ  país=BR estado=PR/SP cidade=Curitiba(PR) tenant=${TENANT.slice(0, 8)}\n`);

  const MODULE_SPECIFICITY = 'epterr_e2e_specificity';
  const MODULE_NOTFOUND = 'epterr_e2e_notfound';
  const MODULE_AMBIGUITY = 'epterr_e2e_ambiguity';

  async function seedActivePolicy(opts: {
    code: string;
    countryId?: string | null;
    stateId?: string | null;
    cityId?: string | null;
    categoryId?: string | null;
    priority?: number;
    effectiveFrom?: Date;
    moduleContext?: string;
  }): Promise<string> {
    const policy = await economicPolicyRepository.createPolicy({
      tenantId: TENANT,
      policyCode: opts.code,
      policyType: 'COMMISSION_SPLIT',
      moduleContext: opts.moduleContext ?? MODULE_SPECIFICITY,
      countryId: opts.countryId ?? null,
      stateId: opts.stateId ?? null,
      cityId: opts.cityId ?? null,
      categoryId: opts.categoryId ?? null,
      priority: opts.priority ?? 0,
      effectiveFrom: opts.effectiveFrom ?? new Date(Date.now() - 60_000),
      status: 'draft',
    });
    await economicPolicyRepository.createPolicyLine(TENANT, {
      policyId: policy.id,
      lineType: 'revenue_share',
      destinationType: 'receiver_actor',
      bps: 10000,
      priority: 0,
      // DECISION-0178 D2: applies_to é intenção explícita obrigatória do caller — sem
      // fallback/default silencioso (assertWritableAppliesTo rejeita ausência).
      appliesTo: 'gross_transaction',
    });
    await pool.query(`SELECT set_config('app.current_tenant', $1, false)`, [TENANT]);
    await pool.query(`UPDATE economic_policies SET status = 'active' WHERE id = $1::uuid AND status = 'draft'`, [policy.id]);
    return policy.id;
  }

  // ============================================================
  // A1-A4 — cascata de specificity: category+city > city > state > country
  // ============================================================
  console.log('=== A — cascata de specificity (Location Core governado) ===');
  const pCountry = await seedActivePolicy({ code: `epterr_country_${Date.now()}`, countryId, priority: 0 });
  const pState = await seedActivePolicy({ code: `epterr_state_${Date.now()}`, countryId, stateId: statePrId, priority: 0 });
  const pCity = await seedActivePolicy({ code: `epterr_city_${Date.now()}`, countryId, stateId: statePrId, cityId: cityCuritibaId, priority: 0 });
  const pCityCategory = await seedActivePolicy({
    code: `epterr_city_category_${Date.now()}`,
    countryId,
    stateId: statePrId,
    cityId: cityCuritibaId,
    categoryId,
    priority: 0,
  });

  const rFull = await economicPolicyEngineService.resolveEconomicPolicy({
    tenantId: TENANT,
    moduleContext: MODULE_SPECIFICITY,
    countryId,
    stateId: statePrId,
    cityId: cityCuritibaId,
    categoryId,
  });
  record('A1 — categoryId+cityId (specificity 4) vence todas as demais', rFull.policy?.id === pCityCategory, `winner=${rFull.policy?.policyCode} esperado=epterr_city_category`);

  const rCityOnly = await economicPolicyEngineService.resolveEconomicPolicy({
    tenantId: TENANT,
    moduleContext: MODULE_SPECIFICITY,
    countryId,
    stateId: statePrId,
    cityId: cityCuritibaId,
    // sem categoryId — a policy category+city fica INELEGÍVEL (category_id NOT NULL, input não fornece).
  });
  record('A2 — cityId (specificity 3) vence stateId quando categoryId ausente no input', rCityOnly.policy?.id === pCity, `winner=${rCityOnly.policy?.policyCode} esperado=epterr_city`);

  const rStateOnly = await economicPolicyEngineService.resolveEconomicPolicy({
    tenantId: TENANT,
    moduleContext: MODULE_SPECIFICITY,
    countryId,
    stateId: statePrId,
    // sem cityId — a policy de city fica INELEGÍVEL.
  });
  record('A3 — stateId (specificity 2) vence countryId quando cityId ausente no input', rStateOnly.policy?.id === pState, `winner=${rStateOnly.policy?.policyCode} esperado=epterr_state`);

  const rCountryOnly = await economicPolicyEngineService.resolveEconomicPolicy({
    tenantId: TENANT,
    moduleContext: MODULE_SPECIFICITY,
    countryId,
    // sem stateId — a policy de state fica INELEGÍVEL.
  });
  record('A4 — só countryId (specificity 1) resolve para a policy country-only', rCountryOnly.policy?.id === pCountry, `winner=${rCountryOnly.policy?.policyCode} esperado=epterr_country`);

  // ============================================================
  // B — FK composta (state_id, city_id) REJEITA cidade de outro estado (LOAD-BEARING)
  // ============================================================
  console.log('\n=== B — FK composta rejeita cidade de outro estado (banco, não TS) ===');
  let bCaught = false;
  let bErr: any = null;
  try {
    await economicPolicyRepository.createPolicy({
      tenantId: TENANT,
      policyCode: `epterr_incoherent_${Date.now()}`,
      policyType: 'COMMISSION_SPLIT',
      moduleContext: MODULE_SPECIFICITY,
      countryId,
      stateId: stateSpId, // São Paulo...
      cityId: cityCuritibaId, // ...mas Curitiba pertence ao Paraná — INCOERENTE.
      effectiveFrom: new Date(Date.now() - 60_000),
      status: 'draft',
    });
  } catch (e: any) {
    bCaught = true;
    bErr = e;
  }
  record(
    'B1 — INSERT com state_id=SP + city_id=Curitiba(PR) é REJEITADO pelo Postgres (23503, fk_economic_policies_state_city)',
    bCaught && bErr?.code === '23503' && /fk_economic_policies_state_city/.test(String(bErr?.constraint ?? '')),
    `code=${bErr?.code} constraint=${bErr?.constraint} message=${bErr?.message}`
  );

  // ============================================================
  // C1 — POLICY_NOT_FOUND (nenhuma policy no módulo)
  // ============================================================
  console.log('\n=== C — fail-closed preservado (POLICY_NOT_FOUND / POLICY_AMBIGUITY) ===');
  const rNotFound = await economicPolicyEngineService.resolveEconomicPolicy({
    tenantId: TENANT,
    moduleContext: MODULE_NOTFOUND,
  });
  record('C1 — moduleContext sem nenhuma policy → POLICY_NOT_FOUND', rNotFound.status === 'not_found' && rNotFound.errorCode === 'POLICY_NOT_FOUND', JSON.stringify(rNotFound));

  // ============================================================
  // C2 — POLICY_AMBIGUITY (empate real: mesma specificity + priority + effective_from)
  // ============================================================
  const tieFrom = new Date(Date.now() - 30_000);
  const pTieA = await seedActivePolicy({ code: `epterr_tie_a_${Date.now()}`, countryId, priority: 50, effectiveFrom: tieFrom, moduleContext: MODULE_AMBIGUITY });
  const pTieB = await seedActivePolicy({ code: `epterr_tie_b_${Date.now()}`, countryId, priority: 50, effectiveFrom: tieFrom, moduleContext: MODULE_AMBIGUITY });
  const rAmbiguous = await economicPolicyEngineService.resolveEconomicPolicy({
    tenantId: TENANT,
    moduleContext: MODULE_AMBIGUITY,
    countryId,
  });
  record(
    'C2 — 2 policies com countryId igual + mesma priority/effective_from → POLICY_AMBIGUITY',
    rAmbiguous.status === 'ambiguous' && rAmbiguous.errorCode === 'POLICY_AMBIGUITY',
    `${JSON.stringify(rAmbiguous)} (pTieA=${pTieA.slice(0, 8)} pTieB=${pTieB.slice(0, 8)})`
  );

  // ============================================================
  // D — Δbank=0: economic_policies é substrato de REGRA, nunca dinheiro
  // ============================================================
  console.log('\n=== D — Δbank=0 (regra, nunca dinheiro) ===');
  const bankCounts = await pool.query<{ n1: string; n2: string; n3: string }>(
    `SELECT
       (SELECT COUNT(*) FROM bank_transactions WHERE tenant_id = $1::uuid)::text AS n1,
       (SELECT COUNT(*) FROM bank_ledger WHERE tenant_id = $1::uuid)::text AS n2,
       (SELECT COUNT(*) FROM bank_splits WHERE tenant_id = $1::uuid)::text AS n3`,
    [TENANT]
  );
  const row = bankCounts.rows[0]!;
  record(
    'D1 — Δbank=0 (zero linhas nas 3 tabelas do domínio Bank para o tenant do E2E)',
    row.n1 === '0' && row.n2 === '0' && row.n3 === '0',
    `n1=${row.n1} n2=${row.n2} n3=${row.n3}`
  );

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${failed.length === 0 ? '🎉 PASS' : '💥 FAIL'} — ${results.length - failed.length}/${results.length}`);
  await pool.end();
  process.exit(failed.length === 0 ? 0 : 1);
}

main().catch(async (e) => {
  console.error('💥 erro fatal:', e?.message ?? e);
  try { await pool.end(); } catch { /* noop */ }
  process.exit(1);
});
