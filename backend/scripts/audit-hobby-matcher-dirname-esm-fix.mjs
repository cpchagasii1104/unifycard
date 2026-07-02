#!/usr/bin/env node
// Guard estrutural — F-HOBBY-MATCHER-DIRNAME-ESM-FIX (DT-HOBBY-MATCHER-DIRNAME-ESM-CRASH).
// hobby-matcher.service.ts usava __dirname (indisponível sob tsx/ESM, como `dev` roda —
// `tsx watch BOOT.ts`) na construção de um array de candidatos de caminho — a construção do array
// lançava ReferenceError ANTES de qualquer fallback rodar, quebrando TODA validação de hobby (fail
// para DENY/erro, mesmo para hobbies legítimos). Corrigido: só process.cwd() (funciona sob tsx E
// node dist/server.js), dataset self-contained em backend/docs/seed/hobbies.json.
//
// MORDE:
//   (A) __dirname voltar a aparecer em hobby-matcher.service.ts;
//   (B) backend/docs/seed/hobbies.json sumir (dataset self-contained removido sem substituto).
// Heurística textual comment-stripped + existência de arquivo. Em validate:regression-guards.
// NÃO altera runtime.

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const ROOT = process.cwd();
const stripTs = (s) => s
  .replace(/(^|[^:"'`])\/\/[^\n]*/g, '$1')
  .replace(/\/\*[\s\S]*?\*\//g, '');

const failures = [];

const SERVICE = join(ROOT, 'src', 'core', 'categories', 'hobby-matcher.service.ts');
if (!existsSync(SERVICE)) {
  failures.push(`arquivo ausente: ${SERVICE}`);
} else {
  const src = stripTs(readFileSync(SERVICE, 'utf-8'));
  if (/__dirname/.test(src)) {
    failures.push(`${SERVICE}: __dirname reintroduzido — quebra sob tsx/ESM (ReferenceError antes de qualquer fallback), exatamente o bug original.`);
  }
  if (!/process\.cwd\(\).*docs\/seed\/hobbies\.json/.test(src)) {
    failures.push(`${SERVICE}: resolução via process.cwd() de docs/seed/hobbies.json ausente.`);
  }
}

const DATASET = join(ROOT, 'docs', 'seed', 'hobbies.json');
if (!existsSync(DATASET)) {
  failures.push(`dataset ausente: ${DATASET} — hobby-matcher self-contained removido sem substituto.`);
}

if (failures.length > 0) {
  console.error('GATE FAIL [hobby-matcher-dirname-esm-fix]:');
  for (const f of failures) console.error('   - ' + f);
  process.exit(1);
}
console.log('GATE OK [hobby-matcher-dirname-esm-fix] — sem __dirname, resolução via process.cwd() + dataset self-contained em backend/docs/seed/hobbies.json. DT-HOBBY-MATCHER-DIRNAME-ESM-CRASH blindada.');
