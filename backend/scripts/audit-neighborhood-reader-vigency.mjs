#!/usr/bin/env node
// Guard — N3-PRE · VIGÊNCIA nos readers canônicos de neighborhoods.
// Pergunta própria: "os 3 readers vivos (findNeighborhoodsByCity, findNeighborhoodById,
// validateNeighborhoodBelongsToCity) aplicam, na query VIVA, o predicado canônico de vigência
// (is_active=true E valid_from_at<=CURRENT_TIMESTAMP E (valid_until_at IS NULL OR >CURRENT_TIMESTAMP)),
// via a fonte única NEIGHBORHOOD_CURRENT_SQL — sem enfraquecimento (>=, COALESCE, OR permissivo,
// is_active de outra tabela), sem predicado só em comentário, e sem fallback textual (name/display_text/CEP/LIMIT 1)?"
// Comment-aware (strip léxico JS preservando strings/templates) e prova LIVENESS por método. Parse fail = FAIL.

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const ROOT = process.cwd();
const failures = [];
const note = (m) => failures.push(m);

function stripJsComments(src) {
  let out = '', i = 0, mode = 'code'; const n = src.length;
  while (i < n) {
    const c = src[i], d = src[i + 1];
    if (mode === 'code') {
      if (c === '/' && d === '/') { mode = 'line'; i += 2; continue; }
      if (c === '/' && d === '*') { mode = 'block'; i += 2; continue; }
      if (c === "'") { mode = 'sq'; out += c; i++; continue; }
      if (c === '"') { mode = 'dq'; out += c; i++; continue; }
      if (c === '`') { mode = 'tpl'; out += c; i++; continue; }
      out += c; i++; continue;
    }
    if (mode === 'line') { if (c === '\n') { mode = 'code'; out += c; } i++; continue; }
    if (mode === 'block') { if (c === '*' && d === '/') { mode = 'code'; i += 2; } else i++; continue; }
    if (c === '\\') { out += c + (d || ''); i += 2; continue; }
    if (mode === 'sq' && c === "'") mode = 'code';
    else if (mode === 'dq' && c === '"') mode = 'code';
    else if (mode === 'tpl' && c === '`') mode = 'code';
    out += c; i++;
  }
  return out;
}

const REPO = join(ROOT, 'src', 'core', 'location', 'location.repository.ts');
const RUNNER = join(ROOT, 'scripts', 'run-regression-guards.mjs');
if (!existsSync(REPO)) {
  console.error('GATE FAIL [neighborhood-reader-vigency] — location.repository.ts ausente');
  process.exit(1);
}
const bare = stripJsComments(readFileSync(REPO, 'utf8'));

// 1. FONTE ÚNICA: const NEIGHBORHOOD_CURRENT_SQL com os 3 clauses corretos e sem enfraquecimento
const constM = bare.match(/const\s+NEIGHBORHOOD_CURRENT_SQL\s*=\s*`([\s\S]*?)`/);
if (!constM) {
  note('A1: fonte única NEIGHBORHOOD_CURRENT_SQL ausente (predicado de vigência deve ser único)');
} else {
  const v = constM[1];
  if (!/n\.is_active\s*=\s*true/.test(v)) note("A2: predicado sem 'n.is_active = true'");
  if (!/n\.valid_from_at\s*<=\s*CURRENT_TIMESTAMP/.test(v)) note("A3: predicado sem 'n.valid_from_at <= CURRENT_TIMESTAMP'");
  if (!/n\.valid_until_at\s+IS\s+NULL\s+OR\s+n\.valid_until_at\s*>\s*CURRENT_TIMESTAMP/i.test(v)) note("A4: predicado sem '(valid_until_at IS NULL OR valid_until_at > CURRENT_TIMESTAMP)' estrito");
  if (/valid_until_at\s*>=\s*CURRENT_TIMESTAMP/i.test(v)) note('A5: valid_until inclusivo (>=) — deve ser estrito (>)');
  if (/valid_from_at\s*>=/i.test(v)) note('A6: valid_from comparação invertida (>=)');
  if (/COALESCE\s*\(\s*n?\.?valid_until_at/i.test(v)) note('A7: COALESCE permissivo no valid_until');
  if (/\bOR\s+n\.is_active\b/i.test(v) || /\bOR\s+TRUE\b/i.test(v)) note('A8: OR permissivo na vigência');
  if (/actor_active_location/i.test(v)) note('A9: is_active de actor_active_location (tabela errada)');
}

// 2. LIVENESS: cada um dos 3 métodos interpola ${NEIGHBORHOOD_CURRENT_SQL} na query viva (comment-stripped)
const METHODS = ['findNeighborhoodsByCity', 'findNeighborhoodById', 'validateNeighborhoodBelongsToCity'];
for (const m of METHODS) {
  const defIdx = bare.search(new RegExp('async\\s+' + m + '\\s*\\('));
  if (defIdx < 0) { note(`B0: método ${m} ausente`); continue; }
  // janela precisa: do def até o PRÓXIMO 'async <nome>(' (evita vazamento entre métodos)
  const after = bare.slice(defIdx + 1);
  const nextIdx = after.search(/\n\s*async\s+\w+\s*\(/);
  const body = nextIdx >= 0 ? after.slice(0, nextIdx) : after.slice(0, 1500);
  if (!/\$\{NEIGHBORHOOD_CURRENT_SQL\}/.test(body)) note(`B1: ${m} não interpola o predicado de vigência na query viva`);
  if (!/FROM\s+neighborhoods\s+n\b/i.test(body)) note(`B2: ${m} não usa 'FROM neighborhoods n' (alias n exigido pelo predicado)`);
  // sem fallback textual dentro do método
  if (/\bILIKE\b|display_text|name_normalized|\bLIMIT\s+1\b/i.test(body)) note(`B3: ${m}: fallback textual/LIMIT-1 (resolução por texto proibida)`);
}

// 3. WIRING no runner
if (existsSync(RUNNER)) {
  if (!/audit-neighborhood-reader-vigency\.mjs/.test(readFileSync(RUNNER, 'utf8'))) note('C1: guard fora do runner (run-regression-guards.mjs)');
}

if (failures.length) {
  console.error('GATE FAIL [neighborhood-reader-vigency]\n' + failures.map((f) => '  - ' + f).join('\n'));
  process.exit(1);
}
console.log('GATE OK [neighborhood-reader-vigency] — os 3 readers canônicos de neighborhoods (findNeighborhoodsByCity/findNeighborhoodById/validateNeighborhoodBelongsToCity) aplicam, na query VIVA (comment-stripped), a fonte única NEIGHBORHOOD_CURRENT_SQL: is_active=true AND valid_from_at<=CURRENT_TIMESTAMP AND (valid_until_at IS NULL OR valid_until_at>CURRENT_TIMESTAMP) — sem >=/COALESCE/OR-permissivo/tabela-errada, sem predicado só em comentário, sem fallback textual/LIMIT-1. (Liveness por método.)');
