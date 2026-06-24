#!/usr/bin/env node
// Guard — F-CAMADA-1-GATE-CONCEPT-COVERAGE (#6 da Matriz Consolidada Camada 1).
//
// Invariante: todo write de ledger resolve concept_id de forma DETERMINÍSTICA e FAIL-CLOSED, sem fallback por
// intent_type / categoria / slug-solto / metadata. Cadeia: bank-ledger exige concept_id (CONCEPT_ID_REQUIRED) →
// resolveFinancialConceptId fail-closed (0 match e ambíguo = throw) → UUID real seeded.
// MORDE se: (1) o resolver perder fail-closed (sumir um throw OU ganhar fallback/default); (2) bank-ledger perder
// CONCEPT_ID_REQUIRED; (3) algum literal `concept_id: '<slug>'` nos writers do bank NÃO existir em nenhuma seed de
// concepts (slug órfão → quebraria em runtime); (4) intent_type ser usado como concept.

import { readFileSync, readdirSync, existsSync, statSync } from 'fs';
import { join } from 'path';

const ROOT = process.cwd();
const read = (rel) => (existsSync(join(ROOT, rel)) ? readFileSync(join(ROOT, rel), 'utf-8') : null);
const failures = [];

// ── (A) chokepoint fail-closed: resolveFinancialConceptId ──────────────────────────────
const RESOLVER = 'src/modules/concept-resolution/concept-financial-resolver.service.ts';
const resolver = read(RESOLVER);
if (resolver === null) {
  failures.push(`${RESOLVER}: ausente (chokepoint de resolução de concept financeiro).`);
} else {
  if (!/nao encontrado|não encontrado/i.test(resolver) || !/throw new Error\([^)]*INVALID_CONCEPT_ID[^)]*nao encontrado/i.test(resolver.normalize('NFD').replace(/[̀-ͯ]/g, ''))) {
    failures.push(`${RESOLVER}: perdeu o throw de "slug não encontrado" — resolver deve ser fail-closed em 0 matches.`);
  }
  if (!/ambiguo|ambíguo/i.test(resolver)) {
    failures.push(`${RESOLVER}: perdeu o throw de "ambíguo" — resolver deve ser fail-closed em >1 matches.`);
  }
  // fallback proibido: um retorno de default/coalesce quando não resolve.
  if (/return\s+['"][a-z0-9-]+['"]/i.test(resolver) || /\|\|\s*['"][a-z0-9-]{3,}['"]/.test(resolver)) {
    failures.push(`${RESOLVER}: possível fallback/default de concept (return literal ou '|| "slug"') — proibido; resolução deve ser fail-closed.`);
  }
}

// ── (B) ledger exige concept_id ────────────────────────────────────────────────────────
const LEDGER = 'src/modules/bank/bank-ledger.service.ts';
const ledger = read(LEDGER);
if (ledger && !/CONCEPT_ID_REQUIRED/.test(ledger)) {
  failures.push(`${LEDGER}: perdeu CONCEPT_ID_REQUIRED — bank_transactions deve exigir concept_id.`);
}

// ── (C) cobertura: todo literal concept_id:'slug' nos writers existe em alguma seed de concepts ──
const seededSlugs = new Set();
for (const f of readdirSync(join(ROOT, 'migrations'))) {
  if (!/seed.*concept|concept.*seed/i.test(f) || !f.endsWith('.sql')) continue;
  const sql = readFileSync(join(ROOT, 'migrations', f), 'utf-8');
  for (const m of sql.matchAll(/'([a-z][a-z0-9-]{2,})'/g)) seededSlugs.add(m[1]);
}
const BANK_DIRS = ['src/modules/bank', 'src/core/bank'];
const tsFiles = [];
const walk = (dir) => {
  const abs = join(ROOT, dir);
  if (!existsSync(abs)) return;
  for (const e of readdirSync(abs)) {
    const rel = `${dir}/${e}`;
    if (statSync(join(ROOT, rel)).isDirectory()) walk(rel);
    else if (e.endsWith('.ts') && !e.endsWith('.test.ts')) tsFiles.push(rel);
  }
};
BANK_DIRS.forEach(walk);
const UUID_RE = /^[0-9a-f-]{36}$/i;
for (const rel of tsFiles) {
  const code = readFileSync(join(ROOT, rel), 'utf-8');
  for (const m of code.matchAll(/concept_id:\s*'([^']+)'/g)) {
    const slug = m[1];
    if (UUID_RE.test(slug)) continue;
    if (!seededSlugs.has(slug)) {
      failures.push(`${rel}: concept_id literal '${slug}' não encontrado em nenhuma seed de concepts — slug órfão (quebraria em runtime; semeie via DECISION ou use slug seeded).`);
    }
  }
  // (D) intent_type como concept.
  if (/concept_id:\s*[a-zA-Z_.]*intent_type/.test(code)) {
    failures.push(`${rel}: concept_id derivado de intent_type — proibido (intent_type é discriminador, não conceito).`);
  }
}

if (failures.length > 0) {
  console.error('GATE FAIL [concept-coverage-financial]:');
  for (const f of failures) console.error('   - ' + f);
  process.exit(1);
}
console.log(`GATE OK [concept-coverage-financial] — resolver fail-closed (0/ambíguo=throw, sem fallback); ledger exige concept_id; ${seededSlugs.size} slugs seeded; todo literal concept_id dos writers do bank é seeded; intent_type não vira concept.`);
