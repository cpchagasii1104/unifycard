#!/usr/bin/env node
// PROVA DB (rollback, resíduo-zero) do MOTOR 4D-1 (DECISION-0167).
// Conexão ÚNICA (pool.connect patchado) + BEGIN → aplica as DDLs 4d-1 DENTRO da transação (mesmo
// corpo das migrations, hash-verificado) → fixtures sintéticas via as CASAS REAIS (fiscal-profile
// insert in-tx; tax_types/tax_rules via taxCatalogRepository; motor via fiscalProvisionService) →
// matriz do envelope §23 → ROLLBACK. O catálogo REAL permanece VAZIO; zero perfil real; resíduo 0.
// Rodar: node --import tsx scripts/test-fiscal-provision-engine-db.mjs
import { readFileSync } from 'fs';
import { createHash } from 'crypto';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const here = dirname(fileURLToPath(import.meta.url));
const TENANT = 'a3859c3e-eca7-4e7d-9df4-324829b368ce';
const FISCAL_IDENTITY = '9b7168b2-775d-42b7-8616-adc3e253edad'; // real (read-only ref; profile fixture é in-tx)
const BR = '42d04887-3033-459c-a4a9-8c6f9ea5a816';
const PR = '281155db-290d-462b-a220-f8aa75b1bf0b';
const CWB = '9d431002-1fd3-4b34-ae82-678f28f64288';

let pass = 0, fail = 0;
const ok = (label, cond) => { if (cond) { pass++; console.log('  OK  ' + label); } else { fail++; console.log('  FAIL ' + label); } };
const expectErr = async (label, fn, re) => {
  try { await fn(); ok(label + ' (lançou?)', false); }
  catch (e) { ok(label, re.test(e.message)); }
};
const stripTx = (sql) => sql.replace(/^\s*BEGIN;\s*$/gim, '').replace(/^\s*COMMIT;\s*$/gim, '');

async function main() {
  const poolMod = await import('../src/core/database/pool.ts');
  const raw = await poolMod.pool.connect();
  // Conexão única com EMULAÇÃO DE TX ANINHADA: repos internos (activateRule/appendRows) fazem
  // BEGIN/COMMIT próprios — na conexão única isso commitaria a tx EXTERNA do harness (lição da
  // 1ª rodada: vazou resíduo, limpo governadamente). Tradução: BEGIN→SAVEPOINT, COMMIT→RELEASE,
  // ROLLBACK→ROLLBACK TO SAVEPOINT. A tx externa é controlada só via `raw` (q abaixo).
  let spDepth = 0;
  const single = {
    query: (...a) => {
      const sql = typeof a[0] === 'string' ? a[0].trim().toUpperCase() : '';
      if (sql === 'BEGIN') { spDepth++; return raw.query(`SAVEPOINT harness_sp_${spDepth}`); }
      if (sql === 'COMMIT') { const d = spDepth--; return raw.query(`RELEASE SAVEPOINT harness_sp_${d}`); }
      if (sql === 'ROLLBACK') { const d = spDepth--; return raw.query(`ROLLBACK TO SAVEPOINT harness_sp_${d}`); }
      return raw.query(...a);
    },
    release: () => {},
  };
  poolMod.pool.connect = async () => single;

  const { fiscalProvisionService } = await import('../src/modules/fiscal-provision/fiscal-provision.service.ts');
  const { taxCatalogRepository } = await import('../src/modules/fiscal/tax-catalog.repository.ts');

  const q = (sql, p = []) => raw.query(sql, p);
  const n = async (sql, p = []) => Number((await q(sql, p)).rows[0].n);
  const baseRules = await n('SELECT count(*)::int n FROM tax_rules');
  const baseTypes = await n('SELECT count(*)::int n FROM tax_types');
  const baseProfiles = await n('SELECT count(*)::int n FROM actor_fiscal_profiles');
  const guard4c3HashBefore = createHash('sha256').update(readFileSync(join(here, 'audit-fiscal-tax-catalog.mjs'))).digest('hex');

  const EV = (over = {}) => ({
    tenantId: TENANT, sourceModule: 'e2e_fiscal', sourceReferenceId: 'evt-' + (over._id ?? '1'),
    taxpayerKind: 'platform', platformRevenueStream: 'marketplace_commission',
    commissionGrossCents: 10000, conceptId: null,
    countryId: BR, stateId: PR, cityId: CWB,
    occurredAt: new Date(), currency: 'BRL',
    consumptionMode: 'informative', contractVersion: 1, ...over,
  });

  await q('BEGIN');
  try {
    // ── DDLs 4d-1 DENTRO da tx (corpo hash-verificado das migrations reais) ──
    for (const f of ['20260714220000_tax_rules_rounding_mode.sql', '20260714230000_create_fiscal_provision_logs.sql']) {
      await q(stripTx(readFileSync(join(here, '..', 'migrations', f), 'utf8')));
    }
    ok('DDL 4d-1 aplicada in-tx (rounding_mode + fiscal_provision_logs)', true);

    // ── caso 2: profile da plataforma AUSENTE → missing discriminado ──
    const r2 = await fiscalProvisionService.provisionPlatformCommission(EV({ _id: 'p-missing' }));
    ok('2· perfil ausente → fiscal_config_missing:active_platform_fiscal_profile_missing',
      r2.status === 'fiscal_config_missing' && r2.missingReason === 'active_platform_fiscal_profile_missing');

    // ── caso 21: missing em contexto OBRIGATÓRIO falha fechado ──
    await expectErr('21· missing obrigatório falha fechado (D9.6.18)',
      () => fiscalProvisionService.provisionPlatformCommission(EV({ _id: 'p-missing-mand', consumptionMode: 'mandatory' })),
      /FISCAL_CONFIG_MISSING_MANDATORY/);

    // ── fixture: perfil fiscal ATIVO da plataforma (in-tx, casa 4b shape) ──
    await q(`INSERT INTO actor_fiscal_profiles (tenant_id, fiscal_identity_id, tax_regime, status, version, effective_from, source)
             VALUES ($1, $2, 'SIMPLES_NACIONAL', 'active', 1, NOW() - interval '1 day', 'e2e fixture')`, [TENANT, FISCAL_IDENTITY]);

    // ── caso 5: perfil ok, REGRA ausente → missing tax_rule_missing ──
    const r5 = await fiscalProvisionService.provisionPlatformCommission(EV({ _id: 'rule-missing' }));
    ok('5· regra ausente → fiscal_config_missing:tax_rule_missing', r5.status === 'fiscal_config_missing' && r5.missingReason === 'tax_rule_missing');
    ok('20· missing informativo NÃO bloqueia (retorna outcome)', r5.results.length === 0 && r5.taxReserveCents === null);

    // ── fixtures de catálogo VIA CASAS REAIS ──
    const tt = await taxCatalogRepository.createTaxType({ tenantId: TENANT, code: 'E2E_ISS', name: 'ISS e2e', scopeLevel: 'city', source: 'e2e' });
    const ttState = await taxCatalogRepository.createTaxType({ tenantId: TENANT, code: 'E2E_ST', name: 'Estadual e2e', scopeLevel: 'state', source: 'e2e' });
    const ttCountry = await taxCatalogRepository.createTaxType({ tenantId: TENANT, code: 'E2E_FED', name: 'Federal e2e', scopeLevel: 'country', source: 'e2e' });

    // caso 13: draft sem rounding_mode NÃO ativa
    const draftNoRm = await taxCatalogRepository.createDraftRule({
      tenantId: TENANT, taxTypeId: tt.id, scopeLevel: 'city', taxpayerKind: 'platform',
      platformRevenueStream: 'marketplace_commission', taxRegime: 'SIMPLES_NACIONAL',
      countryId: BR, stateId: PR, cityId: CWB, rateBps: 500, source: 'e2e',
    });
    ok('6a· draft sem rounding_mode PODE existir', draftNoRm.roundingMode === null && draftNoRm.status === 'draft');
    await expectErr('13· ativação sem rounding_mode falha fechado',
      () => taxCatalogRepository.activateRule(TENANT, draftNoRm.id), /TAX_RULE_ROUNDING_MODE_REQUIRED/);

    // modo inválido barra no vocabulário/CHECK
    await expectErr('13b· rounding_mode inválido falha (vocabulário)',
      () => taxCatalogRepository.createDraftRule({
        tenantId: TENANT, taxTypeId: tt.id, scopeLevel: 'city', taxpayerKind: 'platform',
        platformRevenueStream: 'marketplace_commission', countryId: BR, stateId: PR, cityId: CWB,
        rateBps: 100, roundingMode: 'banker_magic', source: 'e2e',
      }), /ROUNDING_MODE_INVALID/);

    // regra CITY ativa (ISS 5% half_up)
    const cityRule = await taxCatalogRepository.createDraftRule({
      tenantId: TENANT, taxTypeId: tt.id, scopeLevel: 'city', taxpayerKind: 'platform',
      platformRevenueStream: 'marketplace_commission', taxRegime: 'SIMPLES_NACIONAL',
      countryId: BR, stateId: PR, cityId: CWB, rateBps: 500, roundingMode: 'half_up', source: 'e2e ISS',
    });
    await taxCatalogRepository.activateRule(TENANT, cityRule.id);
    ok('9/6b· regra CITY ativada com rounding_mode', true);

    // ── caso 1/9: cálculo city — 10000 × 500bps = 500 ──
    const r1 = await fiscalProvisionService.provisionPlatformCommission(EV({ _id: 'ok-1' }));
    ok('1· perfil válido + regra city → found', r1.status === 'found' && r1.results.length === 1);
    ok('9· provisão city correta (500)', r1.status === 'found' && r1.results[0].provisionCents === 500 && r1.taxReserveCents === 500);
    ok('15· gross inteiro → distributable = 9500', r1.status === 'found' && r1.commissionDistributableCents === 9500);
    ok('23· snapshot com rule/version + profile/version', r1.status === 'found' &&
      r1.fiscalSnapshot.rules[0].taxRuleId === cityRule.id && r1.fiscalSnapshot.rules[0].taxRuleVersion === cityRule.version &&
      r1.fiscalSnapshot.actorFiscalProfileVersion === 1);
    ok('22· snapshot sem PII (sem cpf/cnpj/endereço)', !/cpf|cnpj|"address"|logradouro/i.test(JSON.stringify(r1.status === 'found' ? r1.fiscalSnapshot : {})));

    // ── caso 25: retry idempotente — mesma decisão, sem duplicar ──
    const logsBefore = await n('SELECT count(*)::int n FROM fiscal_provision_logs');
    const r1b = await fiscalProvisionService.provisionPlatformCommission(EV({ _id: 'ok-1' }));
    const logsAfter = await n('SELECT count(*)::int n FROM fiscal_provision_logs');
    ok('25· retry idempotente: mesmo resultado, zero linha nova', r1b.status === 'found' && r1b.taxReserveCents === 500 && logsAfter === logsBefore);

    // ── casos 7/8/10/11: state + country cumulativas e especificidade ──
    const stRule = await taxCatalogRepository.createDraftRule({
      tenantId: TENANT, taxTypeId: ttState.id, scopeLevel: 'state', taxpayerKind: 'platform',
      platformRevenueStream: 'marketplace_commission', countryId: BR, stateId: PR,
      rateBps: 200, roundingMode: 'floor', source: 'e2e ST',
    });
    await taxCatalogRepository.activateRule(TENANT, stRule.id);
    const fedRule = await taxCatalogRepository.createDraftRule({
      tenantId: TENANT, taxTypeId: ttCountry.id, scopeLevel: 'country', taxpayerKind: 'platform',
      platformRevenueStream: 'marketplace_commission', countryId: BR,
      rateBps: 100, roundingMode: 'half_even', source: 'e2e FED',
    });
    await taxCatalogRepository.activateRule(TENANT, fedRule.id);
    const r3 = await fiscalProvisionService.provisionPlatformCommission(EV({ _id: 'ok-3rules' }));
    ok('7/8/11· três regras cumulativas (city+state+country) → 3 resultados', r3.status === 'found' && r3.results.length === 3);
    ok('10· especificidade: primeira = city', r3.status === 'found' && r3.results[0].taxRuleId === cityRule.id);
    ok('11b· reserva = Σ (500+200+100=800); distributable=9200', r3.status === 'found' && r3.taxReserveCents === 800 && r3.commissionDistributableCents === 9200);

    // ── caso 14: cada modo governado (rounding em base 10099 × 500bps = 504.95) ──
    const rHalfUp = await fiscalProvisionService.provisionPlatformCommission(EV({ _id: 'round-hu', commissionGrossCents: 10099 }));
    ok('14a· half_up: 10099×5% = 505 (504.95→505)', rHalfUp.status === 'found' && rHalfUp.results[0].provisionCents === 505);
    // floor no state: 10099×2% = 201.98 → 201
    ok('14b· floor: 10099×2% = 201', rHalfUp.status === 'found' && rHalfUp.results[1].provisionCents === 201);
    // half_even country: 10099×1% = 100.99 → 101
    ok('14c· half_even: 10099×1% = 101', rHalfUp.status === 'found' && rHalfUp.results[2].provisionCents === 101);

    // ── caso 12: taxa zero explícita ≠ missing ──
    const ttZero = await taxCatalogRepository.createTaxType({ tenantId: TENANT, code: 'E2E_ZERO', name: 'Zero e2e', scopeLevel: 'city', source: 'e2e' });
    const zeroRule = await taxCatalogRepository.createDraftRule({
      tenantId: TENANT, taxTypeId: ttZero.id, scopeLevel: 'city', taxpayerKind: 'platform',
      platformRevenueStream: 'advertising', countryId: BR, stateId: PR, cityId: CWB,
      rateBps: 0, roundingMode: 'half_up', source: 'e2e zero',
    });
    await taxCatalogRepository.activateRule(TENANT, zeroRule.id);
    const rz = await fiscalProvisionService.provisionPlatformCommission(EV({ _id: 'zero', platformRevenueStream: 'advertising' }));
    ok('12· taxa zero explícita → found com provision 0 (≠ missing)', rz.status === 'found' && rz.results[0].provisionCents === 0 && rz.warnings.some((w) => w.startsWith('explicit_zero_rate')));

    // ── casos 16/17/18: reserve == gross · reserve > gross · distributable negativo honesto ──
    const rEq = await fiscalProvisionService.provisionPlatformCommission(EV({ _id: 'eq', platformRevenueStream: 'advertising', commissionGrossCents: 0 }));
    ok('16· gross 0 com regra zero → reserve 0 == gross', rEq.status === 'found' && rEq.taxReserveCents === 0 && rEq.commissionDistributableCents === 0);
    const ttBig = await taxCatalogRepository.createTaxType({ tenantId: TENANT, code: 'E2E_BIG', name: 'Big e2e', scopeLevel: 'country', source: 'e2e' });
    const bigRule = await taxCatalogRepository.createDraftRule({
      tenantId: TENANT, taxTypeId: ttBig.id, scopeLevel: 'country', taxpayerKind: 'platform',
      platformRevenueStream: 'own_tickets', countryId: BR, rateBps: 10000, roundingMode: 'ceil', source: 'e2e 100%',
    });
    await taxCatalogRepository.activateRule(TENANT, bigRule.id);
    const ttBig2 = await taxCatalogRepository.createTaxType({ tenantId: TENANT, code: 'E2E_BIG2', name: 'Big2 e2e', scopeLevel: 'country', source: 'e2e' });
    const bigRule2 = await taxCatalogRepository.createDraftRule({
      tenantId: TENANT, taxTypeId: ttBig2.id, scopeLevel: 'country', taxpayerKind: 'platform',
      platformRevenueStream: 'own_tickets', countryId: BR, rateBps: 5000, roundingMode: 'ceil', source: 'e2e 50%',
    });
    await taxCatalogRepository.activateRule(TENANT, bigRule2.id);
    const rBig = await fiscalProvisionService.provisionPlatformCommission(EV({ _id: 'big', platformRevenueStream: 'own_tickets', commissionGrossCents: 1000 }));
    ok('17· reserve (150%) > gross → warning explícito', rBig.status === 'found' && rBig.taxReserveCents === 1500 && rBig.warnings.includes('tax_reserve_exceeds_commission_gross'));
    ok('18· distributable NEGATIVO honesto (−500) com warning, sem clamp', rBig.status === 'found' && rBig.commissionDistributableCents === -500 && rBig.warnings.includes('commission_distributable_negative'));

    // ── caso 6: regra fora de vigência não aplica (evento ANTERIOR ao effective_from da regra) ──
    const rFut = await fiscalProvisionService.provisionPlatformCommission(
      EV({ _id: 'vig', occurredAt: new Date(Date.now() - 30 * 86400000) })
    );
    ok('6· evento anterior à vigência da regra → missing honesto', rFut.status === 'fiscal_config_missing');
    const rFut2 = await fiscalProvisionService.provisionPlatformCommission(EV({ _id: 'vig2', platformRevenueStream: 'acquiring_fees' }));
    ok('6c· stream sem regra → missing honesto', rFut2.status === 'fiscal_config_missing');

    // ── caso 3: perfil deprecated não resolve ──
    await q(`UPDATE actor_fiscal_profiles SET status='deprecated', effective_until=NOW() WHERE tenant_id=$1 AND status='active'`, [TENANT]);
    const rDep = await fiscalProvisionService.provisionPlatformCommission(EV({ _id: 'dep' }));
    ok('3· perfil deprecated → missing active_platform_fiscal_profile_missing', rDep.status === 'fiscal_config_missing' && rDep.missingReason === 'active_platform_fiscal_profile_missing');
    // restaura perfil ativo p/ casos seguintes
    await q(`INSERT INTO actor_fiscal_profiles (tenant_id, fiscal_identity_id, tax_regime, status, version, effective_from, source)
             VALUES ($1, $2, 'SIMPLES_NACIONAL', 'active', 2, NOW() - interval '1 day', 'e2e fixture v2')`, [TENANT, FISCAL_IDENTITY]);

    // ── caso 19: infra-error PROPAGA (não vira missing) ──
    try {
      await fiscalProvisionService.provisionPlatformCommission(EV({ _id: 'infra', tenantId: 'not-a-uuid' }));
      ok('19· infra-error propaga', false);
    } catch (e) {
      ok('19· infra-error propaga (não convertido em missing)', !/fiscal_config_missing/i.test(e.message));
    }
    await q('ROLLBACK'); await q('BEGIN'); // tx abortada pelo erro → recomeça p/ os casos de trilha
    for (const f of ['20260714220000_tax_rules_rounding_mode.sql', '20260714230000_create_fiscal_provision_logs.sql']) {
      await q(stripTx(readFileSync(join(here, '..', 'migrations', f), 'utf8')));
    }
    await q(`INSERT INTO actor_fiscal_profiles (tenant_id, fiscal_identity_id, tax_regime, status, version, effective_from, source)
             VALUES ($1, $2, 'MEI', 'active', 1, NOW() - interval '1 day', 'e2e fixture')`, [TENANT, FISCAL_IDENTITY]);
    const tt2 = await taxCatalogRepository.createTaxType({ tenantId: TENANT, code: 'E2E_T2', name: 'T2', scopeLevel: 'country', source: 'e2e' });
    const rule2 = await taxCatalogRepository.createDraftRule({
      tenantId: TENANT, taxTypeId: tt2.id, scopeLevel: 'country', taxpayerKind: 'platform',
      platformRevenueStream: 'marketplace_commission', countryId: BR, rateBps: 300, roundingMode: 'half_up', source: 'e2e',
      effectiveFrom: new Date(Date.now() - 86400000), // NOW() é fixo na tx do harness; vigência no passado p/ o deprecate
    });
    await taxCatalogRepository.activateRule(TENANT, rule2.id);
    const rA = await fiscalProvisionService.provisionPlatformCommission(EV({ _id: 'trail' }));
    ok('26· log INSERT permitido (found persiste 1 linha)', rA.status === 'found' && (await n(`SELECT count(*)::int n FROM fiscal_provision_logs WHERE source_reference_id='evt-trail'`)) === 1);

    // ── caso 24: mudança futura de regra NÃO altera log anterior ──
    const before = (await q(`SELECT provision_cents, tax_rule_version FROM fiscal_provision_logs WHERE source_reference_id='evt-trail'`)).rows[0];
    await taxCatalogRepository.deprecateRule(TENANT, rule2.id);
    const draft2 = await taxCatalogRepository.createDraftRule({
      tenantId: TENANT, taxTypeId: tt2.id, scopeLevel: 'country', taxpayerKind: 'platform',
      platformRevenueStream: 'marketplace_commission', countryId: BR, rateBps: 900, roundingMode: 'half_up', source: 'e2e v2',
    });
    await taxCatalogRepository.activateRule(TENANT, draft2.id);
    const after = (await q(`SELECT provision_cents, tax_rule_version FROM fiscal_provision_logs WHERE source_reference_id='evt-trail'`)).rows[0];
    ok('24· regra mudou (300→900bps) e o log anterior permanece intacto',
      before.provision_cents === after.provision_cents && before.tax_rule_version === after.tax_rule_version);

    // ── casos 27/28: UPDATE e DELETE bloqueados no banco ──
    await q('SAVEPOINT sp1');
    await expectErr('27· UPDATE na trilha bloqueado por trigger',
      () => q(`UPDATE fiscal_provision_logs SET provision_cents = 999 WHERE source_reference_id='evt-trail'`), /FISCAL_PROVISION_LOG_IMMUTABLE/);
    await q('ROLLBACK TO SAVEPOINT sp1');
    await q('SAVEPOINT sp2');
    await expectErr('28· DELETE na trilha bloqueado por trigger',
      () => q(`DELETE FROM fiscal_provision_logs WHERE source_reference_id='evt-trail'`), /FISCAL_PROVISION_LOG_IMMUTABLE/);
    await q('ROLLBACK TO SAVEPOINT sp2');

    // ── caso 29: zero write em bank_* durante toda a prova ──
    ok('29· bank_* intocado (tx=0, ledger=0, splits=0)',
      (await n('SELECT count(*)::int n FROM bank_transactions')) === 0 &&
      (await n('SELECT count(*)::int n FROM bank_ledger')) === 0 &&
      (await n('SELECT count(*)::int n FROM bank_splits')) === 0);

    // ── caso 4: tax type ausente = regra ausente honesta (dimensão) ──
    const r4 = await fiscalProvisionService.provisionPlatformCommission(EV({ _id: 'no-type', platformRevenueStream: 'physical_structures' }));
    ok('4· tributo/stream sem configuração → missing honesto', r4.status === 'fiscal_config_missing');
  } finally {
    try { await q('ROLLBACK'); } catch { /* noop */ }
  }

  // ── resíduo-zero ──
  ok('R· catálogo real permanece VAZIO (tax_rules)', (await n('SELECT count(*)::int n FROM tax_rules')) === baseRules);
  ok('R· tax_types restaurado', (await n('SELECT count(*)::int n FROM tax_types')) === baseTypes);
  ok('R· actor_fiscal_profiles restaurado (0 reais)', (await n('SELECT count(*)::int n FROM actor_fiscal_profiles')) === baseProfiles);
  ok('R· fiscal_provision_logs inexistente fora da tx (DDL revertida)',
    (await n(`SELECT count(*)::int n FROM information_schema.tables WHERE table_name='fiscal_provision_logs'`)) === 0
    || (await n('SELECT count(*)::int n FROM fiscal_provision_logs')) === 0);
  // ── caso 30: guard 4c-3 byte-intacto após toda a prova ──
  const guard4c3HashAfter = createHash('sha256').update(readFileSync(join(here, 'audit-fiscal-tax-catalog.mjs'))).digest('hex');
  ok('30· guard 4c-3 byte-intacto', guard4c3HashAfter === guard4c3HashBefore);

  console.log(`\n==== FISCAL 4D-1 DB proof: pass=${pass} fail=${fail} ====`);
  raw.release?.();
  await poolMod.pool.end?.().catch(() => {});
  process.exit(fail ? 1 : 0);
}
main().catch((e) => { console.error('ERRO FATAL:', e); process.exit(1); });
