#!/usr/bin/env node
// PROVA DB + E2E (rollback, resíduo-zero) da FISCAL 4D-2 (DECISION-0178).
// Conexão ÚNICA (pool.connect patchado, emulação de tx aninhada BEGIN→SAVEPOINT) + BEGIN → aplica as
// DDLs 4d-1 (rounding_mode + fiscal_provision_logs) e a DDL 4d-2 (applies_to composition) DENTRO da
// transação → prova SCHEMA + PRESERVAÇÃO + FÍSICO×GRAVÁVEL + COMPOSIÇÃO fiscal×policy (matriz §24/§25)
// → ROLLBACK. Zero policy/rule/perfil real persistido; histórico congelado intocado; resíduo 0.
// Rodar: node --import tsx scripts/test-fiscal-economic-policy-composition-db.mjs
import { readFileSync } from 'fs';
import { createHash } from 'crypto';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const here = dirname(fileURLToPath(import.meta.url));
const TENANT = 'a3859c3e-eca7-4e7d-9df4-324829b368ce';
const FISCAL_IDENTITY = '9b7168b2-775d-42b7-8616-adc3e253edad';
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
  const { economicPolicyRepository } = await import('../src/modules/economy/policy-engine/economic-policy.repository.ts');
  const { fiscalEconomicPolicyCompositionService } = await import('../src/modules/economy/fiscal-policy-composition/fiscal-economic-policy-composition.service.ts');
  const ctxMod = await import('../src/modules/economy/fiscal-policy-composition/economic-policy-evaluation-context.ts');
  const typesMod = await import('../src/modules/economy/policy-engine/economic-policy.types.ts');

  const q = (sql, p = []) => raw.query(sql, p);
  const n = async (sql, p = []) => Number((await q(sql, p)).rows[0].n);
  // savepoint isolado p/ statements raw que PODEM falhar (uma violação de CHECK aborta a tx inteira).
  let rsp = 0;
  const rawTry = async (sql, p = []) => {
    const s = `probe_sp_${++rsp}`;
    await raw.query(`SAVEPOINT ${s}`);
    try { await raw.query(sql, p); await raw.query(`RELEASE SAVEPOINT ${s}`); return true; }
    catch (e) { await raw.query(`ROLLBACK TO SAVEPOINT ${s}`); return e; }
  };
  const guard4c3Before = createHash('sha256').update(readFileSync(join(here, 'audit-fiscal-tax-catalog.mjs'))).digest('hex');

  // spy: fiscal-provision chamado exatamente 1× por avaliação
  const realProvision = fiscalProvisionService.provisionPlatformCommission.bind(fiscalProvisionService);
  let provisionCalls = 0;
  fiscalProvisionService.provisionPlatformCommission = async (ev) => { provisionCalls++; return realProvision(ev); };

  let uid = 0;
  const makeActivePolicy = async (moduleContext, lines) => {
    const policy = await economicPolicyRepository.createPolicy({
      tenantId: TENANT, policyCode: `e2e_4d2_${moduleContext}_${uid++}`, policyType: 'COMMISSION_SPLIT',
      moduleContext, status: 'draft', effectiveFrom: new Date(Date.now() - 86400000),
    });
    for (const ln of lines) {
      await economicPolicyRepository.createPolicyLine(TENANT, {
        policyId: policy.id, lineType: 'revenue_share', destinationType: 'receiver_actor',
        bps: ln.bps, appliesTo: ln.appliesTo, priority: ln.priority ?? 0,
      });
    }
    await q(`UPDATE economic_policies SET status='active' WHERE id=$1`, [policy.id]);
    return policy;
  };
  const facts = (over = {}) => ({
    tenantId: TENANT, moduleContext: over.moduleContext, platformRevenueStream: 'marketplace_commission',
    grossTransactionCents: 20000, commissionGrossCents: 10000, conceptId: null,
    countryId: BR, stateId: PR, cityId: CWB, occurredAt: new Date(), currency: 'BRL',
    fiscalConsumptionMode: 'informative', policyEvaluationMode: 'preview',
    sourceModule: 'e2e_4d2', sourceReferenceId: 'evt-' + (over._id ?? String(uid)), ...over,
  });

  await q('BEGIN');
  try {
    // 4d-1 (rounding_mode + fiscal_provision_logs) JÁ estão aplicadas no DB real (seladas); só a 4d-2 é pendente.
    await q(stripTx(readFileSync(join(here, '..', 'migrations', '20260715120000_economic_policy_applies_to_composition.sql'), 'utf8')));
    ok('DDL 4d-2 aplicada in-tx', true);

    // ── §24 SCHEMA ──
    const checkDef = (await q(`SELECT pg_get_constraintdef(c.oid) AS d FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid WHERE t.relname='economic_policy_lines' AND c.conname='economic_policy_lines_applies_to_check'`)).rows[0].d;
    ok('S1· CHECK físico com os 5 valores', ['gross', 'net', 'gross_transaction', 'commission_gross', 'commission_distributable'].every((v) => checkDef.includes(`'${v}'`)));
    ok('S2· default removido', (await n(`SELECT count(*)::int n FROM information_schema.columns WHERE table_name='economic_policy_lines' AND column_name='applies_to' AND column_default IS NOT NULL`)) === 0);
    ok('S3· applies_to NOT NULL preservado', (await n(`SELECT count(*)::int n FROM information_schema.columns WHERE table_name='economic_policy_lines' AND column_name='applies_to' AND is_nullable='NO'`)) === 1);

    // ── §24 PRESERVAÇÃO ──
    ok('P1· 75 linhas gross intactas / 0 net', (await n(`SELECT count(*)::int n FROM economic_policy_lines WHERE applies_to='gross'`)) === 75 && (await n(`SELECT count(*)::int n FROM economic_policy_lines WHERE applies_to='net'`)) === 0);
    ok('P2· 45 policies deprecated / 0 active / 0 draft (histórico)', (await n(`SELECT count(*)::int n FROM economic_policies WHERE status='deprecated'`)) === 45 && (await n(`SELECT count(*)::int n FROM economic_policies WHERE status IN ('active','draft')`)) === 0);

    // ── §24 FÍSICO ACEITA 5 × WRITER GRAVA 3 ──
    // policy DRAFT p/ INSERT direto (freeze permite draft); serve de sonda física.
    const probe = await economicPolicyRepository.createPolicy({ tenantId: TENANT, policyCode: `e2e_probe_${uid++}`, policyType: 'COMMISSION_SPLIT', moduleContext: 'probe', status: 'draft', effectiveFrom: new Date(Date.now() - 86400000) });
    for (const v of ['gross', 'net', 'gross_transaction', 'commission_gross', 'commission_distributable']) {
      const r = await rawTry(`INSERT INTO economic_policy_lines (policy_id, line_type, destination_type, bps, applies_to, condition_json, priority, metadata) VALUES ($1,'revenue_share','receiver_actor',10000,$2,'{}',0,'{}')`, [probe.id, v]);
      ok(`F1· DB físico aceita '${v}' (CHECK)`, r === true);
    }
    const r6 = await rawTry(`INSERT INTO economic_policy_lines (policy_id, line_type, destination_type, bps, applies_to, condition_json, priority, metadata) VALUES ($1,'revenue_share','receiver_actor',10000,'gross_v2','{}',0,'{}')`, [probe.id]);
    ok('F2· DB físico REJEITA 6º valor', r6 !== true && /applies_to_check|check constraint/i.test(r6.message));
    // writer governado: grava só os 3
    for (const v of ['gross_transaction', 'commission_gross', 'commission_distributable']) {
      let okw = false;
      try { await economicPolicyRepository.createPolicyLine(TENANT, { policyId: probe.id, lineType: 'revenue_share', destinationType: 'receiver_actor', bps: 10000, appliesTo: v, priority: 0 }); okw = true; } catch { okw = false; }
      ok(`W1· writer grava '${v}'`, okw);
    }
    await expectErr("W2· writer REJEITA legado 'gross'", () => economicPolicyRepository.createPolicyLine(TENANT, { policyId: probe.id, lineType: 'revenue_share', destinationType: 'receiver_actor', bps: 10000, appliesTo: 'gross', priority: 0 }), /ECONOMIC_POLICY_APPLIES_TO_LEGACY_READONLY/);
    await expectErr("W3· writer REJEITA legado 'net'", () => economicPolicyRepository.createPolicyLine(TENANT, { policyId: probe.id, lineType: 'revenue_share', destinationType: 'receiver_actor', bps: 10000, appliesTo: 'net', priority: 0 }), /ECONOMIC_POLICY_APPLIES_TO_LEGACY_READONLY/);
    await expectErr('W4· writer REJEITA ausência de applies_to', () => economicPolicyRepository.createPolicyLine(TENANT, { policyId: probe.id, lineType: 'revenue_share', destinationType: 'receiver_actor', bps: 10000, priority: 0 }), /ECONOMIC_POLICY_APPLIES_TO_REQUIRED/);
    // validador unit: legado discriminado, não alias
    ok('W5· assertWritableAppliesTo(commission_gross) ok', typesMod.assertWritableAppliesTo('commission_gross') === 'commission_gross');

    // ── §25 fixture fiscal: perfil ATIVO da plataforma ──
    await q(`INSERT INTO actor_fiscal_profiles (tenant_id, fiscal_identity_id, tax_regime, status, version, effective_from, source) VALUES ($1,$2,'SIMPLES_NACIONAL','active',1,NOW()-interval '1 day','e2e')`, [TENANT, FISCAL_IDENTITY]);

    // ── §25 MISSING (antes de qualquer regra) ──
    const polDistM = await makeActivePolicy('m_missing', [{ appliesTo: 'commission_distributable', bps: 10000 }]);
    provisionCalls = 0;
    const evMissInfo = await fiscalEconomicPolicyCompositionService.evaluate(facts({ _id: 'miss-info', moduleContext: 'm_missing' }));
    ok('E-fiscal1x· fiscal-provision chamado EXATAMENTE 1×', provisionCalls === 1);
    ok('E-missInfo· informativo: linha distributable = fiscal_missing_blocked', evMissInfo.status === 'evaluated' && evMissInfo.context.fiscalStatus === 'fiscal_config_missing' && evMissInfo.lines[0].status === 'fiscal_missing_blocked' && evMissInfo.lines[0].amountCents === null);
    await expectErr('E-missMand· obrigatório: fail-closed', () => fiscalEconomicPolicyCompositionService.evaluate(facts({ _id: 'miss-mand', moduleContext: 'm_missing', fiscalConsumptionMode: 'mandatory' })), /FISCAL_CONFIG_MISSING_MANDATORY/);

    // ── §25 catálogo: regra CITY 500bps (distributable=9500 positivo) ──
    const ttCity = await taxCatalogRepository.createTaxType({ tenantId: TENANT, code: 'E2E_ISS_4D2', name: 'ISS', scopeLevel: 'city', source: 'e2e' });
    const cityRule = await taxCatalogRepository.createDraftRule({ tenantId: TENANT, taxTypeId: ttCity.id, scopeLevel: 'city', taxpayerKind: 'platform', platformRevenueStream: 'marketplace_commission', taxRegime: 'SIMPLES_NACIONAL', countryId: BR, stateId: PR, cityId: CWB, rateBps: 500, roundingMode: 'half_up', source: 'e2e ISS' });
    await taxCatalogRepository.activateRule(TENANT, cityRule.id);

    const polGT = await makeActivePolicy('m_gt', [{ appliesTo: 'gross_transaction', bps: 10000 }]);
    const polCG = await makeActivePolicy('m_cg', [{ appliesTo: 'commission_gross', bps: 10000 }]);
    const polCD = await makeActivePolicy('m_cd', [{ appliesTo: 'commission_distributable', bps: 10000 }]);
    const polMulti = await makeActivePolicy('m_multi', [{ appliesTo: 'commission_gross', bps: 10000, priority: 0 }, { appliesTo: 'commission_distributable', bps: 10000, priority: 1 }]);

    const evGT = await fiscalEconomicPolicyCompositionService.evaluate(facts({ _id: 'gt', moduleContext: 'm_gt' }));
    ok('E-gt· gross_transaction → base=grossTransactionCents(20000)', evGT.status === 'evaluated' && evGT.lines[0].base === 'gross_transaction' && evGT.lines[0].amountCents === 20000);
    const evCG = await fiscalEconomicPolicyCompositionService.evaluate(facts({ _id: 'cg', moduleContext: 'm_cg' }));
    ok('E-cg· commission_gross → base=commissionGrossCents(10000)', evCG.status === 'evaluated' && evCG.lines[0].base === 'commission_gross' && evCG.lines[0].amountCents === 10000);
    const evCD = await fiscalEconomicPolicyCompositionService.evaluate(facts({ _id: 'cd', moduleContext: 'm_cd' }));
    ok('E-cd· commission_distributable(9500) positivo → amount=9500', evCD.status === 'evaluated' && evCD.context.commissionDistributableCents === 9500 && evCD.lines[0].amountCents === 9500 && evCD.lines[0].status === 'allocatable');
    const evMulti = await fiscalEconomicPolicyCompositionService.evaluate(facts({ _id: 'multi', moduleContext: 'm_multi' }));
    ok('E-multi· 2 bases distintas na MESMA avaliação (cg=10000, cd=9500)', evMulti.status === 'evaluated' && evMulti.lines.length === 2 && evMulti.lines[0].amountCents === 10000 && evMulti.lines[1].amountCents === 9500);
    ok('E-uniform· contexto uniforme (mesmo economicPolicyId/snapshot/jurisdição/tempos p/ todas as linhas)', evMulti.status === 'evaluated' && evMulti.context.economicPolicyId === polMulti.id && evMulti.context.countryId === BR && evMulti.context.fiscalStatus === 'found' && Object.isFrozen(evMulti.context));
    ok('E-policyver· economicPolicyId = economic_policies.id', evCD.status === 'evaluated' && evCD.context.economicPolicyId === polCD.id);

    // ── §25 ZERO: ativa country 9500 → reserve=10000 → distributable=0 ──
    const ttFed = await taxCatalogRepository.createTaxType({ tenantId: TENANT, code: 'E2E_FED_4D2', name: 'FED', scopeLevel: 'country', source: 'e2e' });
    const fedRule = await taxCatalogRepository.createDraftRule({ tenantId: TENANT, taxTypeId: ttFed.id, scopeLevel: 'country', taxpayerKind: 'platform', platformRevenueStream: 'marketplace_commission', countryId: BR, rateBps: 9500, roundingMode: 'half_up', source: 'e2e FED' });
    await taxCatalogRepository.activateRule(TENANT, fedRule.id);
    const evZero = await fiscalEconomicPolicyCompositionService.evaluate(facts({ _id: 'zero', moduleContext: 'm_cd' }));
    ok('E-zero· distributable=0 → status zero, amount=0 (preservado, não missing/erro)', evZero.status === 'evaluated' && evZero.context.commissionDistributableCents === 0 && evZero.lines[0].status === 'zero' && evZero.lines[0].amountCents === 0);

    // ── §25 NEGATIVO: ativa state 2000 → reserve=12000 → distributable=-2000 ──
    const ttSt = await taxCatalogRepository.createTaxType({ tenantId: TENANT, code: 'E2E_ST_4D2', name: 'ST', scopeLevel: 'state', source: 'e2e' });
    const stRule = await taxCatalogRepository.createDraftRule({ tenantId: TENANT, taxTypeId: ttSt.id, scopeLevel: 'state', taxpayerKind: 'platform', platformRevenueStream: 'marketplace_commission', countryId: BR, stateId: PR, rateBps: 2000, roundingMode: 'half_up', source: 'e2e ST' });
    await taxCatalogRepository.activateRule(TENANT, stRule.id);
    const evNegPrev = await fiscalEconomicPolicyCompositionService.evaluate(facts({ _id: 'neg-prev', moduleContext: 'm_cd', policyEvaluationMode: 'preview' }));
    ok('E-negPreview· preview: negativo honesto (-2000), warning, amount=null, sem clamp', evNegPrev.status === 'evaluated' && evNegPrev.context.commissionDistributableCents === -2000 && evNegPrev.lines[0].status === 'negative_preview' && evNegPrev.lines[0].amountCents === null && evNegPrev.warnings.includes('commission_distributable_negative'));
    await expectErr('E-negMonetary· monetária: fail-closed COMMISSION_DISTRIBUTABLE_NEGATIVE', () => fiscalEconomicPolicyCompositionService.evaluate(facts({ _id: 'neg-mon', moduleContext: 'm_cd', policyEvaluationMode: 'monetary' })), /COMMISSION_DISTRIBUTABLE_NEGATIVE/);

    // ── §25 LEGADO fail-closed em avaliação (seleção discrimina; nunca alias) ──
    const ctxProbe = ctxMod.buildEconomicPolicyEvaluationContext({ economicPolicyId: polCD.id, fiscalStatus: 'found', fiscalSnapshot: null, fiscalCalculationVersion: 1, countryId: BR, occurredAt: new Date().toISOString(), effectiveAt: new Date().toISOString(), grossTransactionCents: 20000, commissionGrossCents: 10000, taxReserveCents: 500, commissionDistributableCents: 9500, currency: 'BRL' });
    ok("E-legacyGross· selectAppliesToBaseCents('gross') → legacy_readonly (não alias)", ctxMod.selectAppliesToBaseCents('gross', ctxProbe).kind === 'legacy_readonly');
    ok("E-legacyNet· selectAppliesToBaseCents('net') → legacy_readonly", ctxMod.selectAppliesToBaseCents('net', ctxProbe).kind === 'legacy_readonly');

    // ── §25 policy ausente/deprecated ──
    const evNoPolicy = await fiscalEconomicPolicyCompositionService.evaluate(facts({ _id: 'nopol', moduleContext: 'no_such_module_ctx' }));
    ok('E-noPolicy· policy ausente → policy_unresolved (comportamento canônico preservado)', evNoPolicy.status === 'policy_unresolved');
    ok('E-deprecatedNotReeval· 45 deprecated seguem deprecated (nenhuma reativada)', (await n(`SELECT count(*)::int n FROM economic_policies WHERE status='deprecated'`)) === 45);

    // ── fronteira Bank intocada ──
    ok('B-bank· bank tx/ledger/splits=0 (zero Bank em 4d-2)', (await n(`SELECT count(*)::int n FROM bank_transactions`)) === 0 && (await n(`SELECT count(*)::int n FROM bank_ledger`)) === 0 && (await n(`SELECT count(*)::int n FROM bank_splits`)) === 0);

    await q('ROLLBACK');
    const guard4c3After = createHash('sha256').update(readFileSync(join(here, 'audit-fiscal-tax-catalog.mjs'))).digest('hex');
    ok('Z1· guard 4c-3 byte-intacto durante a prova', guard4c3Before === guard4c3After);
  } catch (e) {
    try { await q('ROLLBACK'); } catch { /* noop */ }
    console.error('ERRO NA PROVA:', e.stack || e.message);
    fail++;
  } finally {
    raw.release();
    await poolMod.pool.end();
  }

  console.log(`\n== FISCAL 4D-2 DB+E2E: ${pass} OK, ${fail} FAIL ==`);
  process.exit(fail ? 1 : 0);
}
main();
