#!/usr/bin/env node
// audit-actor-capabilities-not-decisor.mjs — DECISION-0189 (F3) GUARD GLOBAL
//
// INVARIANTE (§10): `actorCapabilitiesService` (core) é PROJEÇÃO — NENHUM módulo do backend
// pode usá-lo como decisor de allow/deny. O único importador legítimo do service é a própria
// rota de projeção (actor-capabilities.routes). Qualquer novo consumer precisa ser
// classificado (projeção comprovada) e adicionado à allowlist AQUI, com justificativa.
//
// Também morde a REINTRODUÇÃO das sopas de capability em decisões financeiras:
// nenhuma rota fora da allowlist pode decidir por 'bank.view_balance' / 'company.manage_financial' etc.

import { readFileSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const fail = (msg) => { console.error(`❌ [audit-actor-capabilities-not-decisor] ${msg}`); process.exit(1); };

// allowlist de importadores do service CORE (projeção pura)
const IMPORT_ALLOW = new Set([
  'src/core/actor-capabilities/actor-capabilities.routes.ts',
]);

const IMPORT_RE = /from\s+['"]@core\/actor-capabilities\/actor-capabilities\.service['"]/;
const SOUP_RE = /capabilities\.includes\(\s*['"](bank\.view_balance|company\.manage_financial|company\.manage_company|company\.view_reports|company\.view_financial)['"]\s*\)/;

const walk = (dir, acc = []) => {
  for (const e of readdirSync(join(ROOT, dir), { withFileTypes: true })) {
    const rel = `${dir}/${e.name}`;
    if (e.isDirectory()) walk(rel, acc);
    else if (e.name.endsWith('.ts') && !e.name.endsWith('.test.ts')) acc.push(rel);
  }
  return acc;
};

for (const f of walk('src')) {
  if (f.startsWith('src/scripts/')) continue; // provas/seeds — não são decisores de produto
  const src = readFileSync(join(ROOT, f), 'utf8');
  if (IMPORT_RE.test(src) && !IMPORT_ALLOW.has(f) && !f.startsWith('src/core/actor-capabilities/')) {
    fail(`${f} importa actorCapabilitiesService (core) fora da allowlist — projeção NÃO é decisor (DECISION-0189 §10)`);
  }
  if (SOUP_RE.test(src) && !f.startsWith('src/core/actor-capabilities/')) {
    fail(`${f} decide por sopa de capabilities de projeção (capabilities.includes(...)) — usar canActAs/financial-read-authority (DECISION-0189)`);
  }
}

console.log('✅ audit-actor-capabilities-not-decisor: nenhuma superfície usa a projeção como decisor (imports contidos; sopas de capability mortas).');
