#!/usr/bin/env node
// audit-economic-policy-territorial-coherence.mjs — Guard da FATIA 0 (frente economic-policy).
//
// economic_policies convergiu os seletores territoriais de TEXTO livre (country/region/city) para
// o Location Core governado (countries/states/cities, FKs, name_normalized anti-duplicata),
// mirando o padrão hierárquico MATERIAL já provado por regional_fund_accounts: FKs compostas
// MATCH SIMPLE (country_id,state_id)→states / (state_id,city_id)→cities, ON DELETE SET NULL
// (nunca CASCADE/RESTRICT — apagar um país/estado/cidade DEGRADA specificity, nunca quebra a
// policy nem reescreve retroativamente). country/region/city TEXT ficam DEPRECATED (COMMENT ON
// COLUMN), não dropados (Lei 4). category_id NÃO é tocado (DECISION-0048 — categoria SELECIONA
// policy, não é identidade semântica; boundary contra virar concept_id).
//
// MORDE se:
//  (a) código NOVO (engine resolver / repository WHERE de decisão) ler ou decidir specificity a
//      partir dos seletores TEXT deprecated country/region/city — SELECTOR_FIELDS do resolver deve
//      usar countryId/stateId/cityId; o filtro WHERE do repository deve comparar country_id/
//      state_id/city_id, nunca country/region/city como igualdade de decisão;
//  (b) as FKs compostas hierárquicas (country_id,state_id)→states / (state_id,city_id)→cities
//      sumirem ou enfraquecerem (ex.: virar FK simples solta sem o par, perdendo a coerência
//      hierárquica MATERIAL que o banco impõe);
//  (c) ON DELETE das 3 colunas territoriais (country_id/state_id/city_id) virar CASCADE ou
//      RESTRICT — regressão contra o padrão SET NULL (mesmo papel de category_id);
//  (d) o fail-closed do resolver (POLICY_NOT_FOUND / POLICY_AMBIGUITY) for perdido;
//  (e) category_id for substituído por concept_id em economic_policies (violaria a partição já
//      ratificada em DECISION-0048 — category SELECIONA, NÃO é identidade semântica);
//  (f) a migration territorial (ou os 3 arquivos do policy-engine) tocar bank_ledger/
//      bank_transactions/bank_splits/bank_accounts (fronteira Bank-free, Δbank=0 — regra é
//      substrato, nunca dinheiro).
//
// Region-anchored; comment/literal-aware (strip TS + strip SQL + strip de literais). Fail-closed.
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const stripTs = (s) => s.replace(/(^|[^:"'`])\/\/[^\n]*/g, '$1').replace(/\/\*[\s\S]*?\*\//g, '');
const stripJsLiterals = (s) => s.replace(/'(?:\\.|[^'\\])*'|"(?:\\.|[^"\\])*"|`(?:\\.|[^`\\])*`/g, "''");
const stripSql = (s) => s.replace(/--[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '');
const stripSqlLiterals = (s) => s.replace(/'(?:''|[^'])*'/g, "''");
// Extrai a REGIÃO entre dois marcadores (mesmo mecanismo já usado em audit-event-sector-meia-floor.mjs)
// para ancorar checks a UMA função específica, não ao arquivo inteiro.
const regionBetween = (code, startMarker, endMarker) => {
  const s = code.indexOf(startMarker);
  if (s < 0) return '';
  const rest = code.slice(s + startMarker.length);
  const eRel = endMarker ? rest.indexOf(endMarker) : -1;
  return eRel >= 0 ? code.slice(s, s + startMarker.length + eRel) : code.slice(s);
};
const fails = [];
const note = (marker, m) => fails.push(`[${marker}] ${m}`);

const readOrFail = (rel, marker) => {
  const abs = resolve(ROOT, rel);
  if (!existsSync(abs)) { note(marker, `arquivo material ausente: ${rel}`); return ''; }
  return readFileSync(abs, 'utf8');
};

// Token financeiro proibido no caminho da FATIA 0 (fronteira Bank-free, regra ≠ dinheiro).
const BANK_TOKEN = /\b(bank_ledger|bank_transactions|bank_splits|bank_accounts)\b/i;

// ══════════════════════ MIGRATION: FKs territoriais + ON DELETE SET NULL + deprecação + Bank-free ═══
{
  const MIG_DIR = join(ROOT, 'migrations');
  if (!existsSync(MIG_DIR)) {
    note('MIGRATIONS', 'diretorio migrations ausente');
  } else {
    let foundMigration = false;
    let migFile = null;
    let sqlNoLit = '';
    let sqlCommentsOnly = ''; // só comentários removidos — preserva literais para achar COMMENT ON COLUMN.
    for (const f of readdirSync(MIG_DIR)) {
      if (!f.endsWith('.sql')) continue;
      const raw = readFileSync(join(MIG_DIR, f), 'utf8');
      const sql = stripSql(raw);
      if (!/\bALTER\s+TABLE\s+economic_policies\b[\s\S]*?\bADD\s+COLUMN\s+country_id\b/i.test(sql)) continue;
      foundMigration = true;
      migFile = f;
      sqlNoLit = stripSqlLiterals(sql);
      sqlCommentsOnly = sql;

      // (b) FKs compostas hierárquicas — mirror exato de regional_fund_accounts.
      if (!/FOREIGN\s+KEY\s*\(\s*country_id\s*,\s*state_id\s*\)\s*REFERENCES\s+states\s*\(\s*country_id\s*,\s*state_id\s*\)/i.test(sqlNoLit)) {
        note('COMPOSITE-FK', `migration ${f}: FK composta (country_id,state_id)→states(country_id,state_id) ausente/enfraquecida — coerência hierárquica MATERIAL perdida.`);
      }
      if (!/FOREIGN\s+KEY\s*\(\s*state_id\s*,\s*city_id\s*\)\s*REFERENCES\s+cities\s*\(\s*state_id\s*,\s*city_id\s*\)/i.test(sqlNoLit)) {
        note('COMPOSITE-FK', `migration ${f}: FK composta (state_id,city_id)→cities(state_id,city_id) ausente/enfraquecida — coerência hierárquica MATERIAL perdida.`);
      }
      // FKs simples de cada coluna (fecham o buraco que a composta deixa quando o pai é NULL).
      for (const [col, table, pk] of [['country_id', 'countries', 'country_id'], ['state_id', 'states', 'state_id'], ['city_id', 'cities', 'city_id']]) {
        const re = new RegExp(`FOREIGN\\s+KEY\\s*\\(\\s*${col}\\s*\\)\\s*REFERENCES\\s+${table}\\s*\\(\\s*${pk}\\s*\\)`, 'i');
        if (!re.test(sqlNoLit)) {
          note('SIMPLE-FK', `migration ${f}: FK simples ${col}→${table}(${pk}) ausente — sem ela, ${col} isolado (sem o pai preenchido) escapa de qualquer checagem referencial.`);
        }
      }

      // (c) ON DELETE SET NULL nas 3 colunas — NUNCA CASCADE/RESTRICT. Cada FK statement isolado
      // (split por vírgula de topo seria frágil; comparamos por trecho ancorado no nome da coluna/par).
      const fkStatements = [
        sqlNoLit.match(/FOREIGN\s+KEY\s*\(\s*country_id\s*\)[\s\S]{0,120}/i)?.[0] ?? '',
        sqlNoLit.match(/FOREIGN\s+KEY\s*\(\s*state_id\s*\)[\s\S]{0,120}/i)?.[0] ?? '',
        sqlNoLit.match(/FOREIGN\s+KEY\s*\(\s*city_id\s*\)[\s\S]{0,120}/i)?.[0] ?? '',
        sqlNoLit.match(/FOREIGN\s+KEY\s*\(\s*country_id\s*,\s*state_id\s*\)[\s\S]{0,160}/i)?.[0] ?? '',
        sqlNoLit.match(/FOREIGN\s+KEY\s*\(\s*state_id\s*,\s*city_id\s*\)[\s\S]{0,160}/i)?.[0] ?? '',
      ];
      const fkLabels = ['country_id', 'state_id', 'city_id', '(country_id,state_id)', '(state_id,city_id)'];
      fkStatements.forEach((stmt, i) => {
        if (!stmt) { note('ON-DELETE', `migration ${f}: FK de ${fkLabels[i]} não encontrada para checar ON DELETE.`); return; }
        if (/ON\s+DELETE\s+(CASCADE|RESTRICT)/i.test(stmt)) {
          note('ON-DELETE', `migration ${f}: FK de ${fkLabels[i]} usa ON DELETE CASCADE/RESTRICT — REGRESSÃO; deve ser SET NULL (degradar specificity, nunca quebrar/reescrever a policy).`);
        }
        if (!/ON\s+DELETE\s+SET\s+NULL/i.test(stmt)) {
          note('ON-DELETE', `migration ${f}: FK de ${fkLabels[i]} sem ON DELETE SET NULL explícito.`);
        }
      });

      // (a)/deprecação — COMMENT ON COLUMN marcando country/region/city como DEPRECATED.
      for (const col of ['country', 'region', 'city']) {
        const re = new RegExp(`COMMENT\\s+ON\\s+COLUMN\\s+economic_policies\\.${col}\\s+IS[\\s\\S]{0,200}DEPRECATED`, 'i');
        if (!re.test(sqlCommentsOnly)) {
          note('DEPRECATION-COMMENT', `migration ${f}: COMMENT ON COLUMN economic_policies.${col} marcando DEPRECATED ausente.`);
        }
      }

      // (f) fronteira Bank-free na migration territorial.
      const bk = sqlNoLit.match(BANK_TOKEN);
      if (bk) {
        note('BANK-FRONTIER', `migration ${f}: token '${bk[0]}' na migration territorial — economic_policies é substrato de REGRA, nunca dinheiro (Δbank=0).`);
      }

      // ACHADO do MAP desta fatia: a trigger de imutabilidade de policy ATIVA
      // (enforce_economic_policies_immutability, 20260709140000/DECISION-0166 D5) compara uma
      // lista EXPLÍCITA de colunas materiais — sem as 3 novas na lista, UPDATE em country_id/
      // state_id/city_id de uma policy ATIVA escaparia da trava. Exige CREATE OR REPLACE
      // FUNCTION cobrindo as 3 colunas novas (mesmo nome de function; Lei 3 permite substituir).
      if (/CREATE\s+OR\s+REPLACE\s+FUNCTION\s+enforce_economic_policies_immutability/i.test(sqlNoLit)) {
        for (const col of ['country_id', 'state_id', 'city_id']) {
          const re = new RegExp(`NEW\\.${col}\\s+IS\\s+DISTINCT\\s+FROM\\s+OLD\\.${col}`, 'i');
          if (!re.test(sqlNoLit)) {
            note('IMMUTABILITY-GAP', `migration ${f}: enforce_economic_policies_immutability foi recriada mas não compara NEW.${col} IS DISTINCT FROM OLD.${col} — a trava de imutabilidade de policy ATIVA ficaria cega pro seletor territorial governado ${col}.`);
          }
        }
      } else {
        note('IMMUTABILITY-GAP', `migration ${f}: CREATE OR REPLACE FUNCTION enforce_economic_policies_immutability ausente — as 3 colunas territoriais novas (country_id/state_id/city_id) ficariam FORA da trava de imutabilidade de policy ATIVA (a lista de colunas materiais da function antecede esta fatia).`);
      }

      // (e) category_id não pode ter sido substituído por concept_id nesta migration.
      if (/\bALTER\s+TABLE\s+economic_policies\b[\s\S]*?\bconcept_id\b/i.test(sqlNoLit)) {
        note('CATEGORY-BOUNDARY', `migration ${f}: 'concept_id' aparece em ALTER TABLE economic_policies — category_id NÃO pode virar concept_id (DECISION-0048: category SELECIONA policy, não é identidade semântica).`);
      }
    }
    if (!foundMigration) {
      note('MIGRATIONS', 'migration que adiciona country_id/state_id/city_id a economic_policies ausente.');
    }
  }
}

// ══════════════════════ ENGINE (resolver): SELECTOR_FIELDS + fail-closed ═══════════════════════════
{
  const SVC_PATH = 'src/modules/economy/policy-engine/economic-policy-engine.service.ts';
  const SVC_RAW = readOrFail(SVC_PATH, 'FILE');
  if (SVC_RAW) {
    const code = stripTs(SVC_RAW);
    const region = regionBetween(code, 'const SELECTOR_FIELDS', 'function computeSpecificity');
    if (!region) {
      note('SELECTOR-FIELDS', `${SVC_PATH}: array SELECTOR_FIELDS não encontrado (marcador ausente) — não foi possível ancorar o check de specificity.`);
    } else {
      // (a) specificity NUNCA mais conta os seletores TEXT deprecated — busca por item de array
      // isolado ('country' / 'region' / 'city' entre aspas, separado por vírgula/quebra de linha),
      // não por substring (evita falso-positivo em 'countryId'/'settlementFlow').
      for (const dep of ['country', 'region', 'city']) {
        const re = new RegExp(`['"]${dep}['"]\\s*,`, '');
        if (re.test(region)) {
          note('SELECTOR-FIELDS', `${SVC_PATH}: SELECTOR_FIELDS ainda conta o seletor TEXT deprecated '${dep}' — specificity deve usar ${dep}Id (Location Core), nunca o TEXT livre.`);
        }
      }
      for (const req of ['countryId', 'stateId', 'cityId']) {
        if (!region.includes(`'${req}'`)) {
          note('SELECTOR-FIELDS', `${SVC_PATH}: SELECTOR_FIELDS perdeu o seletor governado '${req}' (Location Core).`);
        }
      }
    }
    // (d) fail-closed do resolver.
    if (!/POLICY_NOT_FOUND/.test(code) || !/POLICY_AMBIGUITY/.test(code)) {
      note('FAIL-CLOSED', `${SVC_PATH}: resolver perdeu o fail-closed POLICY_NOT_FOUND/POLICY_AMBIGUITY — nenhuma policy elegível ou empate real NUNCA podem cair num fallback silencioso.`);
    }
    // (f) fronteira Bank-free no engine.
    const codeNoStr = stripJsLiterals(code);
    const bk = codeNoStr.match(BANK_TOKEN);
    if (bk) {
      note('BANK-FRONTIER', `${SVC_PATH}: token '${bk[0]}' no engine — economic_policies é substrato de REGRA, nunca dinheiro (Δbank=0).`);
    }
    // (e) category_id não pode ter sido trocado por concept_id como seletor.
    if (/conceptId/.test(codeNoStr) && !/categoryId/.test(codeNoStr)) {
      note('CATEGORY-BOUNDARY', `${SVC_PATH}: 'categoryId' sumiu e 'conceptId' apareceu — category_id NÃO pode virar concept_id (DECISION-0048).`);
    }
  }
}

// ══════════════════════ REPOSITORY: WHERE de decisão por ID (não por TEXT) ══════════════════════════
{
  const REPO_PATH = 'src/modules/economy/policy-engine/economic-policy.repository.ts';
  const REPO_RAW = readOrFail(REPO_PATH, 'FILE');
  if (REPO_RAW) {
    const code = stripTs(REPO_RAW);
    const region = regionBetween(code, 'async findEligiblePolicies(', 'async findPolicyLines(');
    if (!region) {
      note('FIND-ELIGIBLE', `${REPO_PATH}: função findEligiblePolicies não encontrada (marcador ausente).`);
    } else {
      // NOTA: a query SQL vive dentro de um template literal (backtick) — NÃO usar
      // stripJsLiterals aqui (mascararia o próprio SQL que este check precisa inspecionar).
      // (a) o WHERE de DECISÃO (igualdade de filtro) precisa comparar as colunas _id, não as TEXT.
      for (const idCol of ['country_id', 'state_id', 'city_id']) {
        const re = new RegExp(`${idCol}\\s*IS\\s*NULL\\s*OR\\s*${idCol}\\s*=\\s*\\$\\d+`, 'i');
        if (!re.test(region)) {
          note('FIND-ELIGIBLE', `${REPO_PATH}#findEligiblePolicies: filtro por ${idCol} ausente — a decisão de elegibilidade territorial precisa comparar a coluna governada (Location Core), não o TEXT deprecated.`);
        }
      }
      // Anti-regressão: filtro de DECISÃO (dentro do WHERE, fora do SELECT) não pode voltar a
      // comparar as colunas TEXT deprecated por igualdade (ex.: "country = $9"). O SELECT list
      // (leitura/mapping) pode continuar citando country/region/city — só a IGUALDADE de filtro
      // é proibida ("= $N" logo após o nome da coluna TEXT, sem sufixo _id).
      for (const dep of ['country', 'region', 'city']) {
        const re = new RegExp(`\\b${dep}\\s*=\\s*\\$\\d+`, 'i');
        if (re.test(region)) {
          note('FIND-ELIGIBLE', `${REPO_PATH}#findEligiblePolicies: WHERE voltou a decidir por '${dep}' (TEXT deprecated) — REGRESSÃO; a decisão de elegibilidade deve usar ${dep}_id.`);
        }
      }
      if (!/category_id\s*IS\s*NULL\s*OR\s*category_id\s*=\s*\$\d+/i.test(region)) {
        note('CATEGORY-BOUNDARY', `${REPO_PATH}#findEligiblePolicies: filtro por category_id ausente/alterado — category_id permanece seletor (DECISION-0048), não pode virar concept_id.`);
      }
      if (/concept_id/i.test(region)) {
        note('CATEGORY-BOUNDARY', `${REPO_PATH}#findEligiblePolicies: 'concept_id' apareceu no filtro — category_id NÃO pode virar concept_id (DECISION-0048).`);
      }
    }
    // (f) fronteira Bank-free no repository (checado sobre o code já sem comentários; o SQL em
    // si nunca deve citar essas tabelas — stripJsLiterals nukaria o próprio SQL a inspecionar).
    const bk = code.match(BANK_TOKEN);
    if (bk) {
      note('BANK-FRONTIER', `${REPO_PATH}: token '${bk[0]}' no repository — economic_policies é substrato de REGRA, nunca dinheiro (Δbank=0).`);
    }
  }
}

// ══════════════════════ TYPES: seletores governados presentes, category_id preservado ══════════════
{
  const TYPES_PATH = 'src/modules/economy/policy-engine/economic-policy.types.ts';
  const TYPES_RAW = readOrFail(TYPES_PATH, 'FILE');
  if (TYPES_RAW) {
    const code = stripTs(TYPES_RAW);
    for (const req of ['countryId', 'stateId', 'cityId']) {
      if (!code.includes(req)) {
        note('TYPES', `${TYPES_PATH}: campo governado '${req}' ausente — EconomicPolicy/PolicyResolutionInput/CreateEconomicPolicyInput devem expor os 3 seletores Location Core.`);
      }
    }
    if (!/categoryId/.test(code)) {
      note('CATEGORY-BOUNDARY', `${TYPES_PATH}: 'categoryId' ausente — category_id permanece seletor (DECISION-0048).`);
    }
  }
}

if (fails.length) {
  console.error('❌ audit-economic-policy-territorial-coherence FALHOU:');
  for (const f of fails) console.error('  - ' + f);
  process.exit(1);
}
console.log('✅ audit-economic-policy-territorial-coherence OK — seletores territoriais de economic_policies convergidos para o Location Core governado (country_id/state_id/city_id, FKs simples + compostas hierárquicas MATERIAL mirror de regional_fund_accounts, ON DELETE SET NULL em todas, nunca CASCADE/RESTRICT) · country/region/city TEXT DEPRECATED via COMMENT ON COLUMN (não dropados, Lei 4) · specificity do resolver usa só os seletores governados · fail-closed POLICY_NOT_FOUND/POLICY_AMBIGUITY intacto · category_id preservado (boundary DECISION-0048, nunca concept_id) · fronteira Bank-free (Δbank=0).');
