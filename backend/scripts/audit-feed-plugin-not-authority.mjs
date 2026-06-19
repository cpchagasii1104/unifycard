#!/usr/bin/env node
// Guard estrutural — F-AUTHORITY-Z2-R8G (feed-plugin) — NOT-AUTHORITY (DECISION-0113 / Z2).
//
// feed-plugin.routes.ts é orquestrador VISUAL read-only ("BLINDAGEM: rotas apenas expõem informação, não
// executam ações de domínio"). O actionContext.actorId é PURE PRESENCE-GATE (400-if-missing), NUNCA threadado a
// um service e NUNCA governa write/read sensível — não há write sink no arquivo. Este gate prova o not-authority
// (justifica a saída do baseline canal-1, SEM mascarar): MORDE se a rota ganhar um write, OU se actionContext.actorId
// passar a ser usado fora de um presence-gate (`!`), OU se for threadado a uma chamada. Em validate:regression-guards.

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const ROOT = process.cwd();
const REL = 'src/core/feed/feed-plugin.routes.ts';
const stripTs = (s) => s
  .replace(/(^|[^:"'`])\/\/[^\n]*/g, '$1')
  .replace(/\/\*[\s\S]*?\*\//g, '');

const failures = [];
const p = join(ROOT, REL);
if (!existsSync(p)) {
  console.error(`GATE FAIL [feed-plugin-not-authority]: arquivo ausente: ${REL}.`);
  process.exit(1);
}
const code = stripTs(readFileSync(p, 'utf-8'));

// 1) PROIBIDO write sink: nenhum INSERT/UPDATE/DELETE nem chamada de escrita óbvia no arquivo.
for (const re of [/\bINSERT\b/i, /\bUPDATE\b/i, /\bDELETE\b/i, /runQueryWithTenant|runQueriesWithTenant|pool\.query/, /\.create\(|\.update\(|\.delete\(|\.insert\(/]) {
  if (re.test(code)) failures.push(`${REL}: apareceu write/DB (${re}) — feed-plugin deixou de ser read-only; reclassificar (NÃO é mais not-authority).`);
}

// 2) actionContext.actorId só pode aparecer em PRESENCE-GATE (linha com `!`). Qualquer uso como valor/arg = falha.
const lines = code.split('\n');
let presenceGates = 0;
for (const line of lines) {
  if (/actionContext\s*\.\s*actorId/.test(line)) {
    if (/!\s*req\.actionContext|!\s*actionContext/.test(line)) { presenceGates += 1; continue; }
    failures.push(`${REL}: actionContext.actorId usado FORA de presence-gate (linha: "${line.trim().slice(0, 80)}") — em feed-plugin deve ser só 400-if-missing.`);
  }
}
if (presenceGates < 1) {
  failures.push(`${REL}: nenhum presence-gate de actionContext encontrado (mudou a forma? revisar — o reconhecimento not-authority depende disto).`);
}

// 3) PROIBIDO threadar actionContext.actorId a uma chamada de service (arg).
if (/feedPluginService\.\w+\([^)]*actionContext\.actorId/.test(code)) {
  failures.push(`${REL}: actionContext.actorId threadado a feedPluginService — passou a governar a chamada; não é mais not-authority.`);
}

if (failures.length > 0) {
  console.error('GATE FAIL [feed-plugin-not-authority]:');
  for (const f of failures) console.error('   - ' + f);
  process.exit(1);
}
console.log(`GATE OK [feed-plugin-not-authority] — read-only (sem write/DB); actionContext.actorId só presence-gate (${presenceGates}×), nunca threadado/autoridade. Not-authority provado (fora do baseline canal-1).`);
