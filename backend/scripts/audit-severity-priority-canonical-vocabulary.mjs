#!/usr/bin/env node
// Guard estrutural — F-SEVERITY-CANONICAL-CONVERGENCE (2026-07-31).
// Norma: docs/01_normative/07_NOMENCLATURA_CANONICA.md §4.34 — severity/priority são
// VARCHAR(20), UPPER_CASE, vocabulários DIFERENTES e NÃO-SINÔNIMOS:
//   severity: CRITICAL, ERROR, WARNING, INFO, AUDIT
//   priority: BLOCKING, CRITICAL, HIGH, MEDIUM, LOW, ATTENTION
//
// MORDE se, no ESTADO FINAL (forward-only: migration mais recente vence por table.coluna /
// por tipo ENUM — nunca a ocorrência isolada em migration antiga e já substituída, Lei 2 proíbe
// editá-las): (a) coluna/CHECK/ENUM *severity* aceitar valor fora do vocabulário de severity;
// (b) coluna/CHECK/ENUM *priority* aceitar valor fora do vocabulário de priority; (c) qualquer
// valor fora de UPPER_CASE; (d) vocabulário de priority colado em coluna severity (ou o
// contrário) — o "não são sinônimos" de §4.34, raiz do defeito original desta frente; (e) coluna
// *severity*/*priority* DEFINIDA sem CHECK nem ENUM — achado 2026-07-31 (auditoria da direção,
// e95fb825f): sem constraint, "UPPER_CASE" é INEXEQUÍVEL no banco — foi assim que
// financial_alerts.severity nasceu (TEXT, zero constraint) antes desta frente existir.
//
// Exceção NOMEADA (não allowlist genérica de arquivo/domínio): actor_relationships.
// requester_feed_priority / target_feed_priority são preferência de EXIBIÇÃO de feed
// (padrao/ver_primeiro/ver_mais/ver_menos) — não é prioridade de TRATAMENTO. Excluídas pelo
// NOME COMPLETO da coluna, não por padrão de nome de arquivo/tabela.
//
// Comment-stripped. Estado final resolvido por replay estatal das migrations em ordem
// (CREATE/ALTER TABLE define contexto de tabela; CHECK/CREATE TYPE registram o vocabulário
// vigente; RENAME/DROP TYPE e novo CHECK substituem o anterior). Em validate:regression-guards.

import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

const ROOT = process.cwd();
const stripSql = (s) => s.replace(/--[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '');

const SEVERITY_VALUES = ['CRITICAL', 'ERROR', 'WARNING', 'INFO', 'AUDIT'];
const PRIORITY_VALUES = ['BLOCKING', 'CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'ATTENTION'];

// Exceção nomeada — feed preference, não prioridade de tratamento (§4.34 não rege este campo).
const EXCLUDED_COLUMNS = new Set(['requester_feed_priority', 'target_feed_priority']);

function splitStatements(src) {
  // Trata blocos DO $$ ... $$ como UM statement (contêm ';' internos). Fora deles, splita por ';'.
  const stmts = [];
  let i = 0;
  let buf = '';
  while (i < src.length) {
    if (src.startsWith('DO $$', i) || src.startsWith('DO $ ', i) || src.startsWith('DO $', i)) {
      const end = src.indexOf('END $$;', i);
      const end2 = end === -1 ? src.indexOf('END $;', i) : end;
      const stop = end2 === -1 ? src.length : end2 + (end === -1 ? 6 : 7);
      buf += src.slice(i, stop);
      stmts.push(buf.trim());
      buf = '';
      i = stop;
      continue;
    }
    if (src[i] === ';') {
      buf += ';';
      stmts.push(buf.trim());
      buf = '';
      i += 1;
      continue;
    }
    buf += src[i];
    i += 1;
  }
  if (buf.trim()) stmts.push(buf.trim());
  return stmts.filter(Boolean);
}

function extractParenBody(s, openIdx) {
  // s[openIdx] === '(' — retorna o conteúdo até o ')' correspondente (respeita aninhamento).
  let depth = 0;
  for (let i = openIdx; i < s.length; i++) {
    if (s[i] === '(') depth += 1;
    else if (s[i] === ')') { depth -= 1; if (depth === 0) return s.slice(openIdx + 1, i); }
  }
  return null;
}

function splitTopLevelCommas(s) {
  const parts = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < s.length; i++) {
    if (s[i] === '(') depth += 1;
    else if (s[i] === ')') depth -= 1;
    else if (s[i] === ',' && depth === 0) { parts.push(s.slice(start, i)); start = i + 1; }
  }
  parts.push(s.slice(start));
  return parts;
}

const NON_COLUMN_KEYWORDS = /^(CONSTRAINT|PRIMARY|FOREIGN|UNIQUE|CHECK|EXCLUDE|LIKE)$/i;
// §4.34 é "Tipo: VARCHAR(20)" — ancora pelo TIPO da coluna, não só pelo nome. Um INTEGER
// chamado "priority" (ordem de aplicação, ex.: economic_policies.priority) NÃO é o vocabulário
// de §4.34 — é campo numérico de ordenação, achado real ao ligar esta checagem (2026-07-31).
// ENUM nativo (ex.: alert_severity) também conta — é a forma tipada do vocabulário, não foge.
const STRING_TYPE_RE = /^(TEXT|VARCHAR|CHAR|CHARACTER)/i;
const isStringLikeType = (typeToken) => STRING_TYPE_RE.test(typeToken) || /severity|priority/i.test(typeToken);

// ── replay estatal ao longo de TODAS as migrations, em ordem ──
const checkTargets = new Map(); // key "table.column" -> string[] valores
const enumTypes = new Map(); // key "typeName" -> string[] valores (undefined = tipo morto/renomeado)
const columnEnumType = new Map(); // key "table.column" -> typeName (ENUM nativo)
const definedColumns = new Map(); // key "table.column" -> true (existe no estado final; DROP COLUMN remove)

const migDir = join(ROOT, 'migrations');
const files = readdirSync(migDir).filter((f) => f.endsWith('.sql')).sort();

for (const f of files) {
  const src = stripSql(readFileSync(join(migDir, f), 'utf-8'));
  const statements = splitStatements(src);
  let currentTable = null;

  for (const stmt of statements) {
    const tableMatch = stmt.match(/^\s*(CREATE TABLE(?:\s+IF NOT EXISTS)?|ALTER TABLE(?:\s+IF EXISTS)?)\s+(\w+)/i);
    if (tableMatch) currentTable = tableMatch[2];

    // CREATE TYPE <name> AS ENUM (...)
    const typeCreate = stmt.match(/CREATE TYPE\s+(\w+)\s+AS ENUM\s*\(([\s\S]*?)\)/i);
    if (typeCreate) {
      const values = [...typeCreate[2].matchAll(/'([^']*)'/g)].map((m) => m[1]);
      enumTypes.set(typeCreate[1], values);
    }

    // ALTER TYPE <old> RENAME TO <new> — tipo velho morre, valores migram pro novo nome
    const typeRename = stmt.match(/ALTER TYPE\s+(\w+)\s+RENAME TO\s+(\w+)/i);
    if (typeRename) {
      const vals = enumTypes.get(typeRename[1]);
      enumTypes.delete(typeRename[1]);
      if (vals) enumTypes.set(typeRename[2], vals);
    }

    // DROP TYPE <name>
    const typeDrop = stmt.match(/DROP TYPE(?:\s+IF EXISTS)?\s+(\w+)/i);
    if (typeDrop) enumTypes.delete(typeDrop[1]);

    // coluna tipada com ENUM nativo: "<col> <enumType> ..." dentro de CREATE/ALTER TABLE, ou
    // "ALTER COLUMN <col> TYPE <enumType>"
    if (currentTable) {
      const alterColType = stmt.match(/ALTER COLUMN\s+(\w+)\s+TYPE\s+(\w+)/i);
      if (alterColType) columnEnumType.set(`${currentTable}.${alterColType[1]}`, alterColType[2]);
      // declaração inline (best-effort): "  severity alert_severity NOT NULL"
      for (const m of stmt.matchAll(/^\s*(\w+)\s+(\w*_severity|\w*_priority)\b/gim)) {
        const [, col, typ] = m;
        if (enumTypes.has(typ)) columnEnumType.set(`${currentTable}.${col}`, typ);
      }
    }

    // CHECK (<col> IN (...)) — registra table.column -> valores (substitui o anterior)
    if (currentTable) {
      for (const m of stmt.matchAll(/CHECK\s*\(\s*(\w+)\s+IN\s*\(([\s\S]*?)\)\s*\)/gi)) {
        const [, col, body] = m;
        const values = [...body.matchAll(/'([^']*)'/g)].map((x) => x[1]);
        checkTargets.set(`${currentTable}.${col}`, values);
      }
    }

    // existência de coluna (independente de ter constraint) — achado 2026-07-31: coluna sem
    // CHECK/ENUM passava livre por nunca ser REGISTRADA em lugar nenhum.
    if (currentTable) {
      // CREATE TABLE <t> ( <col> <tipo> ..., <col2> <tipo2> ..., CONSTRAINT ..., ... )
      const createOpen = stmt.match(/CREATE TABLE(?:\s+IF NOT EXISTS)?\s+\w+\s*\(/i);
      if (createOpen) {
        const openIdx = createOpen.index + createOpen[0].length - 1;
        const body = extractParenBody(stmt, openIdx);
        if (body) {
          for (const piece of splitTopLevelCommas(body)) {
            const m = piece.trim().match(/^(\w+)\s+(\w+)/);
            if (m && !NON_COLUMN_KEYWORDS.test(m[1]) && isStringLikeType(m[2])) {
              definedColumns.set(`${currentTable}.${m[1]}`, true);
            }
          }
        }
      }
      // ALTER TABLE <t> ADD COLUMN [IF NOT EXISTS] <col> <tipo>
      for (const m of stmt.matchAll(/ADD COLUMN\s+(?:IF NOT EXISTS\s+)?(\w+)\s+(\w+)/gi)) {
        if (isStringLikeType(m[2])) definedColumns.set(`${currentTable}.${m[1]}`, true);
      }
      // ALTER TABLE <t> DROP COLUMN [IF EXISTS] <col> — some do estado final (e do que a coluna sabia)
      for (const m of stmt.matchAll(/DROP COLUMN\s+(?:IF EXISTS\s+)?(\w+)/gi)) {
        const key = `${currentTable}.${m[1]}`;
        definedColumns.delete(key);
        checkTargets.delete(key);
        columnEnumType.delete(key);
      }
    }
  }
}

// ── validação do ESTADO FINAL ──
const failures = [];

function classify(col) {
  if (/severity/i.test(col)) return 'severity';
  if (/priority/i.test(col)) return 'priority';
  return null;
}

function validate(where, col, values) {
  if (EXCLUDED_COLUMNS.has(col)) return;
  const domain = classify(col);
  if (!domain) return;
  const validSet = domain === 'severity' ? SEVERITY_VALUES : PRIORITY_VALUES;
  const otherSet = domain === 'severity' ? PRIORITY_VALUES : SEVERITY_VALUES;
  for (const lit of values) {
    const upper = lit.toUpperCase();
    if (lit !== upper) {
      failures.push(`${where}: ${domain} "${col}" tem valor fora de UPPER_CASE ("${lit}") — §4.34 exige maiúsculo.`);
      continue;
    }
    if (validSet.includes(upper)) continue;
    if (otherSet.includes(upper)) {
      failures.push(`${where}: ${domain} "${col}" aceita "${upper}" — vocabulário de ${domain === 'severity' ? 'priority' : 'severity'} colado em coluna de ${domain} (§4.34: "não são sinônimos").`);
      continue;
    }
    failures.push(`${where}: ${domain} "${col}" aceita "${upper}" — fora do vocabulário §4.34 (${validSet.join('/')}).`);
  }
}

let checked = 0;
for (const [key, values] of checkTargets) {
  const col = key.split('.').pop();
  if (!classify(col)) continue;
  checked += 1;
  validate(`estado final (CHECK) ${key}`, col, values);
}
for (const [key, typeName] of columnEnumType) {
  const col = key.split('.').pop();
  if (!classify(col)) continue;
  const values = enumTypes.get(typeName);
  if (values === undefined) continue; // tipo morto/renomeado — não é o estado final
  checked += 1;
  validate(`estado final (ENUM ${typeName}) ${key}`, col, values);
}

// (e) coluna definida SEM CHECK e SEM ENUM no estado final — §4.34 inexequível no banco.
let relevantDefinedColumns = 0;
for (const [key] of definedColumns) {
  const col = key.split('.').pop();
  if (EXCLUDED_COLUMNS.has(col)) continue;
  const domain = classify(col);
  if (!domain) continue;
  relevantDefinedColumns += 1;
  const hasCheck = checkTargets.has(key);
  const hasEnum = columnEnumType.has(key) && enumTypes.get(columnEnumType.get(key)) !== undefined;
  if (hasCheck || hasEnum) continue;
  failures.push(`estado final (SEM CONSTRAINT) ${key}: coluna *${domain}* existe sem CHECK nem ENUM — §4.34 "UPPER_CASE" é inexequível no banco sem constraint (foi assim que financial_alerts.severity nasceu antes desta frente).`);
}

if (failures.length > 0) {
  console.error('GATE FAIL [severity-priority-canonical-vocabulary]:');
  for (const f of failures) console.error('   - ' + f);
  process.exit(1);
}
console.log(`GATE OK [severity-priority-canonical-vocabulary] — estado final de ${checked} coluna(s) *severity*/*priority* (de ${checkTargets.size + columnEnumType.size} CHECK/ENUM totais varridos) batem com §4.34 (UPPER_CASE, vocabulário correto, sem mistura priority↔severity); ${relevantDefinedColumns} coluna(s) *severity*/*priority* definida(s) no schema (de ${definedColumns.size} colunas totais varridas), TODAS com CHECK ou ENUM (0 sem constraint). Exceção nomeada: actor_relationships.{requester,target}_feed_priority (preferência de feed, não prioridade de tratamento). Resolvido por replay forward-only — migrations antigas já substituídas não mordem.`);
