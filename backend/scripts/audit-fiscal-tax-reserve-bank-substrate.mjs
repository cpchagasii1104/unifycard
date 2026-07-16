#!/usr/bin/env node
// audit-fiscal-tax-reserve-bank-substrate.mjs — Guard dedicado FISCAL-4E (posição 186 do runner).
// DECISION-0179 / DECISION-0182 / DECISION-0183. Congela o SUBSTRATO DORMENTE da reserva fiscal no Bank:
// vocabulário+schema, tabelas+integridade, resolver, fingerprint, existingClient, source-line+D10,
// zero-bucket, conservação, full reversal atômica, read-back target-first, dormência e preservações.
// Prova de CONTRATO (não mera presença textual): comment-aware. Fail-closed (exit!=0 em qualquer divergência).
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(resolve(ROOT, p), 'utf8');
const strip = (s) => s.replace(/(^|[^:"'`])\/\/[^\n]*/g, '$1').replace(/\/\*[\s\S]*?\*\//g, '');
const stripSql = (s) => s.replace(/--[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '');
const fails = [];
const note = (m) => fails.push(m);
const has = (s, re) => re.test(s);

const F = {
  TYPES: 'src/modules/bank/bank-split.types.ts',
  MAN: 'src/core/governance/governed-vocabularies.manifest.ts',
  NOM: '../docs/01_normative/07_NOMENCLATURA_CANONICA.md',
  MIG: 'migrations/20260716120000_fiscal_tax_reserve_bank_substrate.sql',
  RESOLVER: 'src/modules/bank/fiscal-reserve-account.resolver.ts',
  FP: 'src/modules/fiscal-provision/fiscal-economic-fingerprint.ts',
  EVREPO: 'src/modules/fiscal-provision/fiscal-provision-event.repository.ts',
  COMP: 'src/modules/bank/fiscal-reserve-bank-composition.service.ts',
  SPLITREPO: 'src/modules/bank/bank-split.repository.ts',
  REV: 'src/modules/reversal/reversal.service.ts',
  RUNNER: 'scripts/run-regression-guards.mjs',
  APPBUILDER: 'src/app.builder.ts',
};
const S = Object.fromEntries(Object.entries(F).map(([k, p]) => {
  if (!existsSync(resolve(ROOT, p))) { note(`arquivo material ausente: ${p}`); return [k, { raw: '', s: '', sql: '' }]; }
  const raw = read(p);
  return [k, { raw, s: p.endsWith('.sql') ? stripSql(raw) : strip(raw), sql: stripSql(raw) }];
}));

const CANON7 = ['fee', 'regional_fund', 'reserve', 'escrow', 'revenue_share', 'referral', 'tax_reserve'];

// ── A · vocabulário e schema ──
{
  const t = S.TYPES.s;
  const tuple = (t.match(/BANK_SPLIT_TYPES = \[[\s\S]*?\] as const/) || [''])[0];
  const tv = [...tuple.matchAll(/'([a-z_]+)'/g)].map((m) => m[1]);
  if (tv.length !== 7 || !CANON7.every((v, i) => tv[i] === v)) note('A1: BANK_SPLIT_TYPES não são os 7 valores canônicos na ordem (fee..tax_reserve)');
  if (!has(t, /export type BankSplitType = \(typeof BANK_SPLIT_TYPES\)\[number\]/)) note('A2: BankSplitType não é DERIVADO do tuple');
  const man = S.MAN.s;
  const manBlock = (man.match(/values:\s*\[[^\]]*'tax_reserve'[^\]]*\]/) || [''])[0];
  const mv = [...manBlock.matchAll(/'([a-z_]+)'/g)].map((m) => m[1]);
  if (mv.length !== 7 || !CANON7.every((v, i) => mv[i] === v)) note('A3: manifesto (bank_splits.split_type) não tem os mesmos 7 na ordem');
  const nom = S.NOM.s;
  if (!CANON7.every((v) => new RegExp(`'${v}'`).test(nom))) note('A4: §4.55 (NOMENCLATURA) não lista os 7 valores');
  const mig = S.MIG.s;
  if (!has(mig, /ADD CONSTRAINT chk_bank_splits_split_type[\s\S]*?CHECK[\s\S]*?'tax_reserve'/)) note('A5: 1º CHECK físico de bank_splits.split_type com tax_reserve ausente');
  if (!CANON7.every((v) => new RegExp(`'${v}'`).test((mig.match(/chk_bank_splits_split_type[\s\S]*?\)/) || [''])[0]))) note('A5b: CHECK de split_type não contém os 7 valores');
  if (!has(mig, /account_type[\s\S]*?'fiscal_reserve'/)) note('A6: fiscal_reserve ausente do CHECK de bank_accounts.account_type');
  // 14 tipos anteriores preservados no CHECK de account_type (15 total)
  const acctCheck = (mig.match(/bank_accounts_account_type_check[\s\S]*?CHECK \([\s\S]*?\)\)/) || mig.match(/account_type IN \([\s\S]*?\)/) || [''])[0];
  const acctVals = [...acctCheck.matchAll(/'([a-z_]+)'/g)].map((m) => m[1]);
  if (acctVals.length && acctVals.length < 15) note(`A7: account_type CHECK tem ${acctVals.length} valores (<15: 14 preservados + fiscal_reserve)`);
  if (has(mig, /INSERT INTO (fiscal_reserve_accounts|bank_accounts)[\s\S]*?VALUES/i)) note('A8: seed/conta fiscal real na migration (proibido — substrato dormente)');
}

// ── B · tabelas e integridade ──
{
  const mig = S.MIG.s;
  if (!has(mig, /CREATE TABLE fiscal_reserve_accounts/)) note('B1: tabela fiscal_reserve_accounts ausente');
  if (!has(mig, /CREATE TABLE fiscal_provision_events/)) note('B2: tabela fiscal_provision_events ausente');
  for (const tbl of ['fiscal_reserve_accounts', 'fiscal_provision_events']) {
    if (!new RegExp(`${tbl}[\\s\\S]*?ENABLE ROW LEVEL SECURITY`).test(mig) || !new RegExp(`${tbl}[\\s\\S]*?FORCE ROW LEVEL SECURITY`).test(mig)) note(`B3: RLS ENABLE+FORCE ausente em ${tbl}`);
  }
  if (!has(mig, /UNIQUE\s*\([^)]*tenant_id[^)]*fiscal_identity_id[^)]*currency/i)) note('B4: unicidade governada (tenant,fiscal_identity,currency) ausente');
  if (!has(mig, /current_setting\('app\.current_tenant'/)) note('B5: tenant isolation (RLS policy via app.current_tenant) ausente');
  if (!has(mig, /BEFORE UPDATE OR DELETE ON fiscal_provision_events/) && !(has(mig, /BEFORE UPDATE ON fiscal_provision_events/) && has(mig, /BEFORE DELETE ON fiscal_provision_events/))) note('B6: imutabilidade append-only (trigger BEFORE UPDATE OR DELETE) ausente em fiscal_provision_events');
  // direção Bank→fiscal: bank_transactions referencia fiscal_provision_events; fiscal NÃO referencia bank_*
  if (!has(mig, /ALTER TABLE bank_transactions[\s\S]*?REFERENCES fiscal_provision_events/)) note('B7: FK Bank→fiscal (bank_transactions.fiscal_provision_event_id) ausente');
  if (has(mig, /fiscal_provision_events[\s\S]*?REFERENCES bank_/)) note('B8: FK inversa fiscal→bank_* (proibida — direção é Bank→fiscal)');
}

// ── C · resolver (lookup-only, MISSING×INTEGRITY×AMBIGUOUS, V24) ──
{
  const r = S.RESOLVER.s;
  if (!has(r, /FiscalReserveAccountMissingError/) || !has(r, /FiscalReserveAccountIntegrityError/) || !has(r, /FiscalReserveAccountAmbiguousError/)) note('C1: erros MISSING/INTEGRITY/AMBIGUOUS ausentes');
  if (/INSERT INTO|UPDATE |DELETE FROM/i.test(r)) note('C2: resolver escreve (deve ser SELECT lookup-only)');
  if (!has(r, /res\.rows\.length === 0[\s\S]*?FiscalReserveAccountMissingError/)) note('C3: 0 linhas não vira MISSING');
  if (!has(r, /res\.rows\.length > 1[\s\S]*?FiscalReserveAccountAmbiguousError/)) note('C4: >1 não vira AMBIGUOUS fail-closed');
  if (!has(r, /account_type !== 'fiscal_reserve'[\s\S]*?FiscalReserveAccountIntegrityError/)) note('C5: account_type incoerente não vira INTEGRITY');
  if (has(r, /catch[\s\S]{0,80}(Missing|Integrity)/)) note('C6: erro de infra capturado/convertido (V24: deve PROPAGAR)');
}

// ── D · fingerprint e idempotência ──
{
  const fp = S.FP.s;
  if (has(fp, /referenceType|referenceId|reference_type|reference_id/)) note('D1: reference_type/reference_id no preimage do fingerprint (D11: fora)');
  if (!has(fp, /FISCAL_FINGERPRINT_NON_INTEGER/)) note('D2: fingerprint sem validação inteiro fail-closed');
  if (!has(fp, /sourceLineIdentity/) || !has(fp, /sourceDestination/)) note('D3: source identity/destination fora do preimage');
  if (!has(fp, /fiscalJurisdiction/) || !has(fp, /buyerTerritory/)) note('D4: snapshots territoriais separados ausentes do preimage');
  if (!has(fp, /taxRuleVersions/)) note('D5: rule versions ausentes do preimage');
  const ev = S.EVREPO.s;
  if (!has(ev, /IdempotencyPayloadMismatchError/) || !has(ev, /!== input\.fiscalEconomicContextFingerprint/)) note('D6: mismatch de payload não é fail-closed');
  if (!has(ev, /pg_advisory_xact_lock/)) note('D7: advisory lock (race-safe find-then-decide) ausente');
}

// ── E · existingClient (original + reversal) ──
{
  const comp = S.COMP.s;
  if (!has(comp, /composePlatformCommission\([\s\S]*?existingClient: PoolClient/)) note('E1: composePlatformCommission não exige existingClient');
  if (!has(comp, /reverseFullPlatformCommission\([\s\S]*?existingClient: PoolClient/)) note('E2: reverseFullPlatformCommission não exige existingClient');
  const rev = S.REV.s;
  if (!has(rev, /existingClient\?: PoolClient/)) note('E3: executeReversal/requestAndExecuteReversalSync sem existingClient');
  if (!has(rev, /const ownsTx = existingClient == null/)) note('E4: guarda ownsTx ausente no motor de reversão');
  if (!has(rev, /if \(ownsTx\) await client\.query\('BEGIN'\)/) || !has(rev, /if \(ownsTx\) await client\.query\('COMMIT'\)/)) note('E5: BEGIN/COMMIT não guardados por ownsTx (caminho externo)');
  if (!has(rev, /if \(ownsTx\) client\.release\(\)/)) note('E6: release não guardado por ownsTx');
}

// ── F · source line e D10 ──
{
  const comp = S.COMP.s;
  if (!has(comp, /commissionGrossSourceLineId/)) note('F1: source line não é identidade explícita');
  if (!has(comp, /FISCAL_COMPOSITION_SOURCE_LINE_MISSING/) || !has(comp, /FISCAL_COMPOSITION_SOURCE_LINE_DUPLICATE/)) note('F2: source ausente/duplicada não fail-closed');
  if (!has(comp, /economicPolicyId: null/)) note('F3: allowlist distributable NÃO vazia (economicPolicyId deveria ser null na 4E)');
  if (has(comp, /regional_fund|regionalFund|regional_fund_accounts/)) note('F4: regional_fund referenciado na composição 4E (fora)');
}

// ── G/H · zero-bucket + conservação ──
{
  const comp = S.COMP.s;
  if (!has(comp, /commissionDistributableCents > 0/)) note('G1: continuation não condicional a distributable>0');
  if (!has(comp, /taxReserveCents > 0/)) note('G2: tax_reserve/resolver não condicional a reserve>0');
  if (!has(comp, /FISCAL_COMPOSITION_INVARIANT_VIOLATION/)) note('G3: (reserve=0 ∧ dist=0) não é INVARIANT VIOLATION fail-closed');
  if (!has(comp, /commissionGrossCents !== taxReserveCents \+ commissionDistributableCents/)) note('H1: conservação por bucket (gross=reserve+dist) ausente');
  if (!has(comp, /transformedSum !== amountCents/)) note('H2: conservação do split set (Σtransformadas==amount) ausente');
  if (!has(comp, /COMMISSION_DISTRIBUTABLE_NEGATIVE/)) note('H3: distributable negativo não fail-closed');
}

// ── I · full reversal (atômica, reuso, target-first) ──
{
  const comp = S.COMP.s;
  if (!has(comp, /event_kind='full_reversal'|eventKind: 'full_reversal'/)) note('I1: reversal não é full-only (event_kind=full_reversal)');
  if (!has(comp, /getProvisionEventById/) || has(comp, /provisionPlatformCommission[\s\S]{0,200}reverseFull/)) note('I2: reversal recomputa (deve REUSAR snapshots via getProvisionEventById)');
  if (!has(comp, /FISCAL_COMPOSITION_REVERSAL_NO_ORIGINAL/)) note('I3: reversal sem original não fail-closed');
  const sr = S.SPLITREPO.s;
  if (!has(sr, /COALESCE\(bs\.target_account_id/)) note('I4: read-back não é target-account-first (COALESCE FK persistida)');
  if (!has(sr, /BANK_SPLIT_TARGET_ACCOUNT_CROSS_TENANT/)) note('I5: read-back cross-tenant não fail-closed');
}

// ── J · dormência ──
{
  const comp = S.COMP.s + S.SPLITREPO.s;
  if (/fastify|FastifyPluginAsync|\.routes\b|router\./.test(S.COMP.s)) note('J1: rota HTTP na composição (dormência)');
  if (has(S.APPBUILDER.s, /fiscal-reserve-bank-composition/)) note('J2: composição registrada no app.builder (reachability viva)');
  // firewall default OFF: o sink permanece a única porta; a composição não liga o flag
  if (/BANK_TRANSACTION_SINK_FIREWALL_ENABLED\s*=\s*'true'/.test(S.COMP.s)) note('J3: composição liga o firewall (deve ficar OFF por padrão)');
  // caller vivo: nenhum arquivo de produto (fora de __tests__/scripts) importa a composição
  const srcDir = resolve(ROOT, 'src');
  const callers = [];
  const walk = (d) => { for (const e of readdirSync(d, { withFileTypes: true })) {
    const p = resolve(d, e.name);
    if (e.isDirectory()) { if (!/__tests__|__mocks__/.test(e.name)) walk(p); }
    else if (e.name.endsWith('.ts') && !p.includes('fiscal-reserve-bank-composition')) {
      if (/fiscalReserveBankCompositionService|fiscal-reserve-bank-composition/.test(readFileSync(p, 'utf8'))) callers.push(p);
    }
  } };
  walk(srcDir);
  if (callers.length) note(`J4: caller vivo da composição (dormência quebrada): ${callers.map((c) => c.replace(ROOT, '')).join(', ')}`);
}

// ── K · preservações + runner 186 ──
{
  const runner = S.RUNNER.s;
  if (!has(runner, /audit-fiscal-tax-reserve-bank-substrate\.mjs/)) note('K1: guard 186 não registrado no runner');
  // audit-governed-vocabulary-manifest.mjs roda via a SUITE audit-authority-residual-hygiene-suite.mjs.
  for (const g of ['audit-fiscal-tax-catalog.mjs', 'audit-fiscal-provision-engine.mjs', 'audit-fiscal-economic-policy-composition.mjs', 'audit-bank-city-curitiba-foundation.mjs', 'audit-authority-residual-hygiene-suite.mjs']) {
    if (!has(runner, new RegExp(g.replace('.', '\\.')))) note(`K2: guard preservado ausente do runner: ${g}`);
  }
}

if (fails.length) {
  console.error('\nGATE FAIL [fiscal-tax-reserve-bank-substrate]:');
  for (const f of fails) console.error('   - ' + f);
  process.exit(1);
}
console.log('GATE OK [fiscal-tax-reserve-bank-substrate] — FISCAL-4E dormente (DECISION-0179/0182/0183): '
  + 'BANK_SPLIT_TYPES=7 (tax_reserve) derivado+manifesto+§4.55+CHECK físico; account_type=fiscal_reserve (14+1); '
  + 'fiscal_reserve_accounts/fiscal_provision_events com RLS FORCE + unicidade + append-only + FK Bank→fiscal (sem inversa); '
  + 'resolver lookup-only MISSING×INTEGRITY×AMBIGUOUS (V24 propaga); fingerprint sem reference tuple, com source/territórios/rule-versions e mismatch fail-closed; '
  + 'existingClient no original E no reversal (ownsTx; caminho legado preservado); source line explícita + allowlist distributable VAZIA (regional_fund fora); '
  + 'zero-bucket condicional + INVARIANT VIOLATION; conservação por bucket+split-set; full reversal full-only reusando snapshots; '
  + 'read-back target-account-first + cross-tenant fail-closed; dormência (zero rota/app.builder/firewall-on/caller vivo); runner 186. (Comment-aware, fail-closed.)');
