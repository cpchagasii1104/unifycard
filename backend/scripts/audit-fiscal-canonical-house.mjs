#!/usr/bin/env node
// Guard estrutural — F-BANK-SPLIT-POLICY-ADMIN-FOUNDATION Fase 4b (DECISION-0166 D9, Lei do Contador).
//
// Trava a CASA FISCAL CANÔNICA ÚNICA (actor_fiscal_profiles ancorada em fiscal_identities) e a
// aposentadoria das DUAS casas fantasmas de regime (company_profiles e tax_profiles — tabelas que
// NUNCA existiram no banco, com código vivo apontando para elas + 2 vocabulários TaxRegime
// conflitantes). MORDE se:
//   (1/2) company_profiles ou tax_profiles voltarem a ser lidas/escritas como fonte (SQL vivo);
//   (3/4) TaxRegime paralelo reaparecer redeclarado em company-profile.types/tax-profile.types;
//   (5)   grafias curtas SIMPLES/PRESUMIDO/REAL voltarem como regime canônico;
//   (6-8) payment-execution/business-segment/fiscal-kyc consultarem tabela fantasma;
//   (9)   fiscal-document/invoicing abrirem emissão/cálculo fiscal fora do escopo 4b;
//   (10)  fallback inventar regime fiscal sem configuração;
//   (11)  o módulo fiscal tocar Bank/ledger/split/orders/checkout/payment_intents;
//   (12)  actor_fiscal_profiles perder a âncora em fiscal_identities ou a imutabilidade.
// stripComments OBRIGATÓRIO (TS e SQL) — comentário não é prova. NÃO altera runtime.
// Em validate:regression-guards via agregador audit-legacy-service-availability-containment-suite.mjs.

import { readFileSync, existsSync, readdirSync } from 'fs';
import { join } from 'path';

const ROOT = process.cwd();
const stripTs = (s) => s
  .replace(/(^|[^:"'`])\/\/[^\n]*/g, '$1')
  .replace(/\/\*[\s\S]*?\*\//g, '');
const stripSql = (s) => s
  .replace(/--[^\n]*/g, '')
  .replace(/\/\*[\s\S]*?\*\//g, '');
const failures = [];
const readTs = (rel) => { const p = join(ROOT, rel); return existsSync(p) ? stripTs(readFileSync(p, 'utf-8')) : null; };
const readSql = (rel) => { const p = join(ROOT, rel); return existsSync(p) ? stripSql(readFileSync(p, 'utf-8')) : null; };
const need = (src, file, re, why) => { if (src === null) { failures.push(`arquivo ausente: ${file}`); return; } if (!re.test(src)) failures.push(`${file}: ${why}`); };
const forbid = (src, file, re, why) => { if (src !== null && re.test(src)) failures.push(`${file}: ${why}`); };

function walkTs(dir, out = []) {
  let entries; try { entries = readdirSync(dir, { withFileTypes: true }); } catch { return out; }
  for (const e of entries) {
    const full = join(dir, e.name);
    if (e.isDirectory()) walkTs(full, out);
    else if (e.name.endsWith('.ts')) out.push(full);
  }
  return out;
}

// ── (12) casa canônica íntegra: migration com âncora + vocabulário + imutabilidade + RLS ──
const MIG = 'migrations/20260710130000_create_actor_fiscal_profiles.sql';
const mig = readSql(MIG);
need(mig, MIG, /fiscal_identity_id UUID NOT NULL REFERENCES fiscal_identities\(fiscal_identity_id\)/, 'âncora em fiscal_identities sumiu — casa fiscal solta (D9.4).');
need(mig, MIG, /tax_regime IN \('MEI', 'SIMPLES_NACIONAL', 'LUCRO_PRESUMIDO', 'LUCRO_REAL', 'OTHER'\)/, 'CHECK do vocabulário canônico D9.5 sumiu (ou SIMPLES_NACIONAL removido).');
need(mig, MIG, /CREATE TRIGGER actor_fiscal_profiles_immutability/, 'trigger de imutabilidade do perfil fiscal sumiu — ativa voltaria a ser editável in-place.');
need(mig, MIG, /FORCE ROW LEVEL SECURITY/, 'RLS FORCE sumiu de actor_fiscal_profiles.');
// vocabulário canônico no código
const TYPES = 'src/modules/fiscal/fiscal-profile.types.ts';
const types = readTs(TYPES);
need(types, TYPES, /'SIMPLES_NACIONAL'/, 'SIMPLES_NACIONAL removido do vocabulário canônico TAX_REGIMES.');
need(types, TYPES, /TAX_REGIMES = \[\s*'MEI',\s*'SIMPLES_NACIONAL',\s*'LUCRO_PRESUMIDO',\s*'LUCRO_REAL',\s*'OTHER',?\s*\]/, 'TAX_REGIMES divergiu do vocabulário ratificado D9.5.');
const REPO = 'src/modules/fiscal/fiscal-profile.repository.ts';
const repo = readTs(REPO);
need(repo, REPO, /FROM actor_fiscal_profiles/, 'repository canônico não lê actor_fiscal_profiles.');
forbid(repo, REPO, /company_profiles|tax_profiles\b/, 'repository canônico consultando tabela fantasma como fallback.');

// ── (1/2/6/7/8) NENHUM SQL vivo contra as tabelas fantasmas em TODO o src ──
for (const f of walkTs(join(ROOT, 'src'))) {
  const src = stripTs(readFileSync(f, 'utf-8'));
  if (/(FROM|INTO|UPDATE)\s+company_profiles\b/.test(src)) failures.push(`${f.replace(ROOT, '.')}: SQL vivo contra company_profiles (tabela fantasma aposentada — D9.4).`);
  if (/(FROM|INTO|UPDATE)\s+tax_profiles\b/.test(src)) failures.push(`${f.replace(ROOT, '.')}: SQL vivo contra tax_profiles (tabela fantasma aposentada — D9.4).`);
}
// migrations futuras não materializam os fantasmas como fonte fiscal
const migDir = join(ROOT, 'migrations');
for (const f of readdirSync(migDir).filter((f) => f.endsWith('.sql') && f > '20260710130000_z')) {
  const src = stripSql(readFileSync(join(migDir, f), 'utf-8'));
  if (/CREATE TABLE (IF NOT EXISTS )?(company_profiles|tax_profiles)\b/.test(src)) {
    failures.push(`migrations/${f}: materializa tabela fantasma (company_profiles/tax_profiles) — segunda casa fiscal (D9.4 REPROVA).`);
  }
}

// ── (3/4/5) vocabulário único: sem redeclaração paralela nem grafias curtas ──
const CPT = 'src/modules/marketplace/company-profile.types.ts';
const cpt = readTs(CPT);
forbid(cpt, CPT, /export type TaxRegime\s*=\s*'/, 'TaxRegime REDECLARADO em company-profile.types — segunda verdade de vocabulário.');
need(cpt, CPT, /export type \{ TaxRegime \} from '\.\.\/fiscal\/fiscal-profile.types'/, 'company-profile.types não re-exporta o TaxRegime canônico.');
const TPT = 'src/modules/marketplace/tax-profile.types.ts';
const tpt = readTs(TPT);
forbid(tpt, TPT, /export type TaxRegime\s*=\s*'/, 'TaxRegime REDECLARADO em tax-profile.types — terceira verdade de vocabulário.');
forbid(tpt, TPT, /'SIMPLES'\s*:|'PRESUMIDO'\s*:|'REAL'\s*:/, 'grafias curtas SIMPLES/PRESUMIDO/REAL voltaram como chave de regime (não-canônicas).');
const KYC_RULES = 'src/modules/marketplace/fiscal-kyc.rules.ts';
const kycRules = readTs(KYC_RULES);
forbid(kycRules, KYC_RULES, /\bSIMPLES\s*:|\bPRESUMIDO\s*:|\bREAL\s*:/, 'fiscal-kyc.rules voltou a chavear por grafia curta (SIMPLES/PRESUMIDO/REAL).');
need(kycRules, KYC_RULES, /SIMPLES_NACIONAL\s*:/, 'fiscal-kyc.rules perdeu a chave SIMPLES_NACIONAL.');

// ── (6) payment-execution lê a casa canônica, sem fantasma e sem engolir exceção como dado ──
const PE = 'src/modules/marketplace/payment-execution.service.ts';
const pe = readTs(PE);
need(pe, PE, /fiscalProfileRepository.getActiveProfileForTenant/, 'payment-execution não lê a casa canônica (regressão ao fantasma?).');
forbid(pe, PE, /companyProfileService.getProfile/, 'payment-execution voltou ao reader fantasma de company_profiles.');
need(pe, PE, /fiscal_config_missing/, 'payment-execution perdeu o rastro honesto de configuração ausente.');

// ── (7) business-segment gate canônico ──
const BS = 'src/modules/marketplace/business-segment.service.ts';
const bs = readTs(BS);
forbid(bs, BS, /companyProfileRepository/, 'business-segment voltou a consultar o repository fantasma.');
need(bs, BS, /fiscal_config_missing/, 'business-segment perdeu o gate honesto (fiscal_config_missing).');

// ── (10) tombstones fail-honest: readers null, writers RETIRED, sem inventar regime ──
const CPR = 'src/modules/marketplace/company-profile.repository.ts';
const cpr = readTs(CPR);
need(cpr, CPR, /COMPANY_PROFILE_RETIRED/, 'tombstone de company-profile.repository perdeu o RETIRED.');
forbid(cpr, CPR, /runQueryWithTenant|runQueriesWithTenant|pool\.query/, 'company-profile.repository voltou a ter SQL.');
const TPR = 'src/modules/marketplace/tax-profile.repository.ts';
const tpr = readTs(TPR);
need(tpr, TPR, /TAX_PROFILE_RETIRED/, 'tombstone de tax-profile.repository perdeu o RETIRED.');
forbid(tpr, TPR, /runQueryWithTenant|runQueriesWithTenant|pool\.query/, 'tax-profile.repository voltou a ter SQL.');
const TPS = 'src/modules/marketplace/tax-profile.service.ts';
const tps = readTs(TPS);
need(tps, TPS, /fiscalProfileRepository.getActiveProfileForTenant/, 'tax-profile.service não redireciona leitura à casa canônica.');
forbid(tps, TPS, /taxRegime:\s*'(MEI|SIMPLES|PRESUMIDO|REAL|SIMPLES_NACIONAL|LUCRO_PRESUMIDO|LUCRO_REAL|OTHER)'/, 'tax-profile.service INVENTANDO regime literal (fallback proibido — D9.2).');

// ── (11) módulo fiscal não toca dinheiro/pedidos ──
for (const f of walkTs(join(ROOT, 'src', 'modules', 'fiscal'))) {
  const src = stripTs(readFileSync(f, 'utf-8'));
  if (/bank_ledger|bank_splits|bank_transactions|createTransactionWith|payment_intents\b|\borders\b|checkout/i.test(src)) {
    failures.push(`${f.replace(ROOT, '.')}: módulo fiscal tocando Bank/ledger/split/orders/checkout/payment_intents (fora do escopo 4b).`);
  }
  // (16 do D9.6) alíquota hardcoded: percentuais/bps literais não pertencem ao perfil fiscal
  if (/aliquota|bps\s*[:=]\s*\d|rate\s*[:=]\s*\d/i.test(src)) {
    failures.push(`${f.replace(ROOT, '.')}: possível alíquota/percentual hardcoded no módulo fiscal (D9.6 — regra fiscal é DADO versionado, 4c).`);
  }
}

// ── (9) fiscal-document/invoicing: sem novo fluxo de emissão/cálculo nesta fase ──
const FD = 'src/modules/marketplace/fiscal-document.service.ts';
const fd = readTs(FD);
forbid(fd, FD, /aliquota|taxAmount|calculateTax|imposto\s*=|sefaz/i, 'fiscal-document abriu cálculo fiscal/emissão fora do escopo 4b.');

if (failures.length > 0) {
  console.error('GATE FAIL [fiscal-canonical-house]:');
  for (const f of failures) console.error('   - ' + f);
  process.exit(1);
}
console.log('GATE OK [fiscal-canonical-house] — DECISION-0166 D9 travada: casa fiscal ÚNICA (actor_fiscal_profiles ancorada em fiscal_identities, vocabulário D9.5 com SIMPLES_NACIONAL, imutável quando ativa, RLS FORCE); fantasmas company_profiles/tax_profiles sem SQL vivo e não-materializáveis; vocabulário TaxRegime sem redeclaração paralela nem grafias curtas; payment-execution/business-segment/tax-profile.service lendo a casa canônica com fiscal_config_missing honesto; writers RETIRED; módulo fiscal sem tocar dinheiro; sem alíquota hardcoded.');
