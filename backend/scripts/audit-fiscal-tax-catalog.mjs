#!/usr/bin/env node
// Guard estrutural — F-BANK-SPLIT-POLICY-ADMIN-FOUNDATION Fase 4c-3 (DECISION-0166 D9.6, Lei do Contador).
//
// Trava o CATÁLOGO FISCAL GOVERNADO (tax_types + tax_rules, 4c-1) e sua camada de leitura (4c-2)
// contra regressão. O catálogo é: tenant-scoped, versionado, imutável-quando-ativo, VAZIO por design
// (D9.6.18 — vazio + regra exigida = fail-closed, não bug), com alíquota como DADO (rate_bps) e NUNCA
// como literal em código (D9.6.16). MORDE se:
//   (G1)  o substrato 4c-1 degradar (tabelas/RLS FORCE/source/vigência/regime D9.5/território FK/
//         concept_id→concepts/triggers de imutabilidade) ou migration futura dropar sem recriar;
//   (G2)  alíquota/cálculo fiscal HARDCODED aparecer em código (fiscal/invoicing/payment) — exceção
//         ÚNICA controlada: o 5% conhecido de invoicing/invoice.service.ts enquanto a
//         DT-INVOICING-HARDCODED-TAX-RATE estiver OPEN no cartório (expected finding, warning);
//         hardcode NOVO em qualquer outro lugar = FAIL; DT sumir/fechar com o hardcode vivo = FAIL;
//   (G3)  cálculo fiscal nascer na 4c (rate_bps × valor · tax_reserve · applies_to estendido ·
//         line_type fiscal em economic_policy_lines · motor);
//   (G4)  o módulo fiscal tocar Bank/ledger/split/orders/checkout/payment_intents;
//   (G5)  seed REAL de tributo (ISS/ICMS/PIS/COFINS/CBS/IBS/IPI/IRPJ/CSLL/INSS…) for semeado;
//   (G6)  vocabulário paralelo (TaxRegime redeclarado · PLATFORM_REVENUE_STREAMS divergindo do CHECK
//         da migration ou fora do manifesto · catálogo fiscal paralelo por tabela nova).
// stripComments OBRIGATÓRIO (TS e SQL) — comentário não é prova. NÃO altera runtime.
// Registrado em validate:regression-guards (run-regression-guards.mjs).

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
const warnings = [];
const readTs = (rel) => { const p = join(ROOT, rel); return existsSync(p) ? stripTs(readFileSync(p, 'utf-8')) : null; };
const readSql = (rel) => { const p = join(ROOT, rel); return existsSync(p) ? stripSql(readFileSync(p, 'utf-8')) : null; };
const need = (src, file, re, why) => { if (src === null) { failures.push(`arquivo ausente: ${file}`); return; } if (!re.test(src)) failures.push(`${file}: ${why}`); };
const forbid = (src, file, re, why) => { if (src !== null && re.test(src)) failures.push(`${file}: ${why}`); };

function walkTs(dir, out = []) {
  let entries; try { entries = readdirSync(dir, { withFileTypes: true }); } catch { return out; }
  for (const e of entries) {
    const full = join(dir, e.name);
    if (e.isDirectory()) { if (e.name !== 'node_modules') walkTs(full, out); }
    else if (e.name.endsWith('.ts')) out.push(full);
  }
  return out;
}

const MIG = 'migrations/20260710140000_create_tax_types_and_tax_rules.sql';
const TYPES = 'src/modules/fiscal/tax-catalog.types.ts';
const REPO = 'src/modules/fiscal/tax-catalog.repository.ts';
const MANIFEST = 'src/core/governance/governed-vocabularies.manifest.ts';
const CARTORIO = join(ROOT, '..', 'REMEDIATION_DT_LOG.md');

const mig = readSql(MIG);
const types = readTs(TYPES);
const repo = readTs(REPO);
const manifest = readTs(MANIFEST);

// ── (G1) substrato 4c-1 íntegro na migration ──
need(mig, MIG, /CREATE TABLE IF NOT EXISTS tax_types/, 'tax_types sumiu da migration 4c-1.');
need(mig, MIG, /CREATE TABLE IF NOT EXISTS tax_rules/, 'tax_rules sumiu da migration 4c-1.');
need(mig, MIG, /tax_types[\s\S]*?tenant_id UUID NOT NULL REFERENCES tenants\(id\)/, 'tax_types perdeu tenant_id NOT NULL (catálogo é TENANT-SCOPED — decisão de Clayton no GO 4c-1).');
need(mig, MIG, /tax_rules[\s\S]*?tenant_id UUID NOT NULL REFERENCES tenants\(id\)/, 'tax_rules perdeu tenant_id NOT NULL (tenant-scoped).');
need(mig, MIG, /ALTER TABLE tax_types ENABLE ROW LEVEL SECURITY;[\s\S]*?ALTER TABLE tax_types FORCE ROW LEVEL SECURITY;/, 'tax_types perdeu RLS ENABLE+FORCE.');
need(mig, MIG, /ALTER TABLE tax_rules ENABLE ROW LEVEL SECURITY;[\s\S]*?ALTER TABLE tax_rules FORCE ROW LEVEL SECURITY;/, 'tax_rules perdeu RLS ENABLE+FORCE.');
need(mig, MIG, /source TEXT NOT NULL\s*\n?\s*CONSTRAINT chk_tax_rules_source_nonempty CHECK \(btrim\(source\) <> ''\)/, 'tax_rules.source perdeu a obrigatoriedade (NOT NULL + não-vazio) — D9.6.17 exige FONTE registrável.');
need(mig, MIG, /CONSTRAINT chk_tax_rules_vigencia\s*\n?\s*CHECK \(effective_until IS NULL OR effective_until > effective_from\)/, 'tax_rules perdeu a VIGÊNCIA (chk_tax_rules_vigencia) — D9.6.17.');
need(mig, MIG, /CONSTRAINT chk_tax_types_vigencia/, 'tax_types perdeu a vigência (chk_tax_types_vigencia).');
need(mig, MIG, /tax_regime IN \(\s*'MEI', 'SIMPLES_NACIONAL', 'LUCRO_PRESUMIDO', 'LUCRO_REAL', 'OTHER'\s*\)/, 'CHECK do TaxRegime D9.5 divergiu (ou SIMPLES_NACIONAL removido) em tax_rules.');
forbid(mig, MIG, /tax_regime[^)]*IN \([^)]*'(SIMPLES|PRESUMIDO|REAL)'/, 'grafia curta SIMPLES/PRESUMIDO/REAL aceita como regime no CHECK — regride D9.5 (curtas NÃO são regime canônico).');
need(mig, MIG, /CONSTRAINT fk_tax_rules_tax_type_scope\s*\n?\s*FOREIGN KEY \(tax_type_id, scope_level\) REFERENCES tax_types\(id, scope_level\)/, 'FK composta nível-da-regra=nível-do-tributo (fk_tax_rules_tax_type_scope) sumiu — trava MATERIAL, não convenção.');
need(mig, MIG, /CONSTRAINT fk_tax_rules_state\s*\n?\s*FOREIGN KEY \(country_id, state_id\) REFERENCES states\(country_id, state_id\)/, 'FK composta territorial de estado sumiu (Location Core, molde 2a).');
need(mig, MIG, /CONSTRAINT fk_tax_rules_city\s*\n?\s*FOREIGN KEY \(state_id, city_id\) REFERENCES cities\(state_id, city_id\)/, 'FK composta territorial de cidade sumiu (city de outro estado deixaria de ser rejeitada pelo banco).');
need(mig, MIG, /CONSTRAINT chk_tax_rules_territory_shape/, 'CHECK de forma territorial por nível (chk_tax_rules_territory_shape) sumiu.');
need(mig, MIG, /platform_revenue_stream IN \(\s*'marketplace_commission', 'advertising', 'own_tickets',\s*\n?\s*'acquiring_fees', 'physical_structures', 'other'\s*\)/, 'CHECK do platform_revenue_stream divergiu do vocabulário D9.5 ×6.');
need(mig, MIG, /concept_id UUID NULL REFERENCES concepts\(concept_id\)/, 'concept_id deixou de referenciar concepts (SSOT semântico) — categoria/TREE não é identidade (§12).');
forbid(mig, MIG, /category_id\s+UUID|REFERENCES categories\b/, 'category_id/categories como COLUNA/FK no catálogo fiscal — TREE/navegação NÃO é identidade semântica (§2.3.3/§12); usar concept_id (menção em COMMENT ON é texto, não estrutura).');
need(mig, MIG, /CREATE TRIGGER tax_types_immutability/, 'trigger de imutabilidade de tax_types sumiu.');
need(mig, MIG, /CREATE TRIGGER tax_rules_immutability/, 'trigger de imutabilidade de tax_rules sumiu.');
need(mig, MIG, /rate_bps INTEGER NOT NULL\s*\n?\s*CONSTRAINT chk_tax_rules_rate_bps CHECK \(rate_bps >= 0\)/, 'rate_bps perdeu o contrato de DADO versionado (INTEGER NOT NULL CHECK >= 0).');
forbid(mig, MIG, /INSERT INTO tax_(types|rules)/, 'a migration 4c-1 ganhou SEED — o catálogo nasce VAZIO por design (D9.6.18).');

// ── (G1/G5/G6) migrations FUTURAS: anti-drop, anti-seed real, anti-catálogo-paralelo ──
const REAL_TAXES = /'(ISS|ICMS|PIS|COFINS|CBS|IBS|IPI|IRPJ|CSLL|INSS|ISSQN|IOF|ITBI|IPTU|IPVA)'/i;
const migDir = join(ROOT, 'migrations');
for (const f of readdirSync(migDir).filter((f) => f.endsWith('.sql'))) {
  const src = stripSql(readFileSync(join(migDir, f), 'utf-8'));
  if (/INSERT INTO tax_(types|rules)/.test(src) && REAL_TAXES.test(src)) {
    failures.push(`migrations/${f}: SEED de tributo REAL no catálogo fiscal — proibido (D9.6.18: catálogo nasce vazio/governado, contador configura; seed = REPROVA).`);
  }
  if (f > '20260710140000_z') {
    if (/DROP TRIGGER (IF EXISTS )?tax_(types|rules)_immutability/.test(src) && !/CREATE TRIGGER tax_(types|rules)_immutability/.test(src)) {
      failures.push(`migrations/${f}: dropa trigger de imutabilidade do catálogo fiscal SEM recriar — regressão de D9.6.17.`);
    }
    if (/ALTER TABLE tax_(types|rules)[\s\S]*?(DISABLE ROW LEVEL SECURITY|NO FORCE ROW LEVEL SECURITY)/.test(src)) {
      failures.push(`migrations/${f}: desliga RLS do catálogo fiscal.`);
    }
    if (/DROP CONSTRAINT (IF EXISTS )?(chk_tax_rules_source_nonempty|chk_tax_rules_vigencia|chk_tax_rules_regime|chk_tax_rules_territory_shape|fk_tax_rules_tax_type_scope|fk_tax_rules_state|fk_tax_rules_city)/.test(src) && !/ADD CONSTRAINT \2/.test(src)) {
      failures.push(`migrations/${f}: dropa constraint estrutural do catálogo fiscal sem recriar.`);
    }
    if (/CREATE TABLE (IF NOT EXISTS )?(tax_rates|tax_catalog|tax_tables|aliquotas|aliquots|fiscal_rules|fiscal_rates|tax_rules_v2|tax_types_v2)\b/i.test(src)) {
      failures.push(`migrations/${f}: cria CATÁLOGO FISCAL PARALELO — a casa canônica é tax_types/tax_rules (D9.4 anti-verdade-paralela).`);
    }
    // 4d/4e invertem conscientemente estas travas quando chegarem (com GO próprio): applies_to fiscal e tax_reserve.
    if (/applies_to[\s\S]{0,200}(commission_gross|commission_distributable|gross_transaction)/.test(src)) {
      failures.push(`migrations/${f}: estende applies_to com base fiscal — isso é a 4d (GO próprio D9.7); guard deve ser invertido CONSCIENTEMENTE nessa fatia, não contornado.`);
    }
    if (/line_type[\s\S]{0,200}'tax_reserve'/.test(src)) {
      failures.push(`migrations/${f}: adiciona line_type tax_reserve — isso é a 4e (após motor 4d com GO próprio).`);
    }
  }
}

// ── (G6) vocabulário: const = CHECK da migration; manifesto registra; sem redeclaração ──
const STREAMS = ['marketplace_commission', 'advertising', 'own_tickets', 'acquiring_fees', 'physical_structures', 'other'];
need(types, TYPES, new RegExp(`PLATFORM_REVENUE_STREAMS = \\[\\s*${STREAMS.map((s) => `'${s}',`).join('\\s*')}\\s*\\] as const`), 'PLATFORM_REVENUE_STREAMS divergiu do vocabulário D9.5 ×6 (fonte canônica).');
if (mig && types) {
  const migList = (mig.match(/platform_revenue_stream IN \(([^)]+)\)/) || [])[1] || '';
  for (const s of STREAMS) {
    if (!migList.includes(`'${s}'`)) failures.push(`${MIG}: CHECK de platform_revenue_stream perdeu '${s}' — divergiu da const governada.`);
  }
}
need(types, TYPES, /import (type )?\{[^}]*TAX_REGIMES[^}]*\} from '\.\/fiscal-profile\.types'|import \{ TAX_REGIMES, FISCAL_CONFIG_MISSING \} from '\.\/fiscal-profile\.types'/, 'tax-catalog.types parou de IMPORTAR TAX_REGIMES da casa 4b (reuso obrigatório — D9.4).');
forbid(types, TYPES, /TAX_REGIMES\s*=\s*\[/, 'TAX_REGIMES REDECLARADO em tax-catalog.types — segunda verdade de vocabulário (a fonte é fiscal-profile.types).');
forbid(types, TYPES, /'MEI'|'SIMPLES_NACIONAL'|'LUCRO_PRESUMIDO'|'LUCRO_REAL'/, 'literal de regime em tax-catalog.types — compor do símbolo importado, não copiar valores.');
need(manifest, MANIFEST, /name: 'tax_rules\.platform_revenue_stream'/, 'PLATFORM_REVENUE_STREAMS saiu do manifesto de vocabulários governados.');
need(manifest, MANIFEST, /symbol: 'PLATFORM_REVENUE_STREAMS'/, 'entrada do manifesto perdeu o símbolo canônico PLATFORM_REVENUE_STREAMS.');
// redeclaração do TaxRegime em qualquer lugar fora da fonte (o guard 4b cobre company/tax-profile; aqui cobre o resto)
for (const f of walkTs(join(ROOT, 'src'))) {
  const rel = f.replace(ROOT, '.').replace(/\\/g, '/');
  if (/fiscal-profile\.types\.ts$|\.test\.|__tests__|\.spec\./.test(rel)) continue;
  const src = stripTs(readFileSync(f, 'utf-8'));
  if (/TAX_REGIMES\s*=\s*\[\s*'MEI'/.test(src)) {
    failures.push(`${rel}: TAX_REGIMES redeclarado fora de fiscal-profile.types — vocabulário paralelo (D9.4).`);
  }
}

// ── (G3/G4) módulo fiscal: sem cálculo, sem Bank, leitura honesta ──
const fiscalDir = join(ROOT, 'src', 'modules', 'fiscal');
for (const f of walkTs(fiscalDir)) {
  const rel = f.replace(ROOT, '.').replace(/\\/g, '/');
  const src = stripTs(readFileSync(f, 'utf-8'));
  if (/rate_bps\s*\*|\*\s*rate_bps|rateBps\s*\*|\*\s*rateBps/.test(src)) {
    failures.push(`${rel}: MULTIPLICA rate_bps — cálculo fiscal é a 4d (GO próprio D9.7); a 4c só LOCALIZA regra.`);
  }
  if (/\*\s*0?\.\d+|\*\s*\d+\s*\/\s*100/.test(src)) {
    failures.push(`${rel}: aritmética de percentual literal no módulo fiscal — alíquota é DADO de tax_rules, nunca código (D9.6.16).`);
  }
  if (/'tax_reserve'/.test(src)) {
    failures.push(`${rel}: 'tax_reserve' materializado no módulo fiscal — isso é a 4e, após motor 4d com GO próprio.`);
  }
  if (/(FROM|INTO|UPDATE|JOIN)\s+(bank_ledger|bank_splits|bank_transactions|bank_accounts|payment_intents|orders|checkout)\b/i.test(src)
    || /modules\/bank|createTransactionWith|bankSplitEngine|@modules\/bank/.test(src)) {
    failures.push(`${rel}: módulo fiscal tocando Bank/ledger/split/orders/checkout/payment_intents — PROIBIDO (Lei de Coerência §4.6; fiscal configura, Bank executa).`);
  }
  if (/DELETE FROM tax_(types|rules)/.test(src)) {
    failures.push(`${rel}: DELETE contra o catálogo fiscal em runtime — active/deprecated são protegidos por trigger; repo não deleta (rito = deprecate/supersede).`);
  }
}
need(repo, REPO, /status = 'draft'/, 'activateRule perdeu o gate "só draft ativa" — editaria active in-place.');
need(repo, REPO, /FISCAL_CONFIG_MISSING/, 'a leitura perdeu o contrato fiscal_config_missing (D9.2) — ausência tem que ser honesta, nunca inventada.');
forbid(repo, REPO, /taxRegime:\s*'(MEI|SIMPLES_NACIONAL|LUCRO_PRESUMIDO|LUCRO_REAL|OTHER|SIMPLES|PRESUMIDO|REAL)'/, 'repository INVENTANDO regime literal como fallback (D9.2 proíbe).');

// ── (G3) applies_to/economic_policy_lines intocados no baseline ──
const EPL = 'migrations/20260530561000_create_economic_policy_lines.sql';
const epl = readSql(EPL);
need(epl, EPL, /CHECK \(applies_to IN \('gross', 'net'\)\)/, 'applies_to do baseline mudou — extensão fiscal de base é a 4d (GO próprio D9.7).');
forbid(epl, EPL, /'tax_reserve'/, 'line_type tax_reserve entrou no baseline de economic_policy_lines — isso é a 4e.');

// ── (G2) anti-alíquota-hardcoded (fiscal + invoicing + caminho de pagamento) ──
// Exceção ÚNICA controlada: invoicing/invoice.service.ts (achado do GATE 4c) enquanto a
// DT-INVOICING-HARDCODED-TAX-RATE estiver OPEN no cartório. Qualquer outro arquivo = FAIL.
const KNOWN_HARDCODE_FILE = 'src/modules/invoicing/invoice.service.ts';
const HARDCODE_PATTERNS = [
  /tax(es)?Cents\s*=\s*Math\.(round|floor|ceil)\(/,
  /taxRate\s*[:=]\s*0?\.\d+/,
  /tax\w*\s*=\s*[^;\n]*\*\s*0?\.\d+/,
  /tax\w*\s*=\s*[^;\n]*\*\s*\d+\s*\/\s*100/,
];
const SCAN_DIRS = ['src/modules/fiscal', 'src/modules/invoicing', 'src/modules/marketplace', 'src/modules/payments', 'src/modules/pdv'];
const hardcodeHits = [];
for (const d of SCAN_DIRS) {
  for (const f of walkTs(join(ROOT, d))) {
    const rel = f.replace(ROOT + '\\', '').replace(ROOT + '/', '').replace(/\\/g, '/');
    if (/\.test\.|__tests__|\.spec\./.test(rel)) continue;
    const src = stripTs(readFileSync(f, 'utf-8'));
    for (const re of HARDCODE_PATTERNS) {
      if (re.test(src)) { hardcodeHits.push(rel); break; }
    }
  }
}
const cartorio = existsSync(CARTORIO) ? readFileSync(CARTORIO, 'utf-8') : '';
const dtOpen = /## DT-INVOICING-HARDCODED-TAX-RATE — 🔴 OPEN/.test(cartorio);
for (const hit of [...new Set(hardcodeHits)]) {
  if (hit === KNOWN_HARDCODE_FILE) {
    if (dtOpen) {
      warnings.push(`EXPECTED FINDING: ${hit} mantém o 5% hardcoded conhecido — coberto pela DT-INVOICING-HARDCODED-TAX-RATE (OPEN no cartório; correção = frente própria com GO). NÃO adicionar novos.`);
    } else {
      failures.push(`${hit}: hardcode fiscal conhecido presente MAS a DT-INVOICING-HARDCODED-TAX-RATE não está OPEN no cartório — ou a DT sumiu/fechou com o risco vivo (regressão documental), ou o fix esqueceu o registro. Reconciliar.`);
    }
  } else {
    failures.push(`${hit}: ALÍQUOTA/CÁLCULO FISCAL HARDCODED NOVO — proibido (D9.6.16: alíquota é DADO versionado em tax_rules; D9.2: sistema não inventa cálculo).`);
  }
}
if (!hardcodeHits.includes(KNOWN_HARDCODE_FILE) && dtOpen) {
  warnings.push(`o hardcode conhecido de ${KNOWN_HARDCODE_FILE} não foi encontrado (corrigido?) mas a DT-INVOICING-HARDCODED-TAX-RATE segue OPEN — se o fix aconteceu, fechar a DT com re-carimbo no cartório.`);
}

// ── veredito ──
console.log(`[fiscal-tax-catalog] failures=${failures.length} warnings=${warnings.length}`);
for (const w of warnings) console.log('  🟡', w);
if (failures.length > 0) {
  console.error('GATE FAIL [fiscal-tax-catalog]:');
  failures.forEach((f) => console.error('  ❌', f));
  process.exit(1);
}
console.log('GATE OK [fiscal-tax-catalog] — DECISION-0166 D9.6 travado: catálogo fiscal governado íntegro (tenant-scoped, RLS FORCE, source+vigência+regime D9.5+território FK+concept_id, imutabilidade viva, nasce VAZIO sem tributo real); alíquota só como DADO (hardcode novo morde; o conhecido do invoicing segue rastreado por DT OPEN); zero cálculo/tax_reserve/applies_to/motor na 4c; módulo fiscal sem tocar Bank; vocabulário sem paralelo (const=CHECK=manifesto). 4d/4e invertem conscientemente com GO próprio.');
