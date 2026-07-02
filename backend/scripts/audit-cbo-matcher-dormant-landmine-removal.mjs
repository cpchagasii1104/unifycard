#!/usr/bin/env node
// Guard estrutural — F-CBO-MATCHER-DORMANT-LANDMINE-REMOVAL (DT-CBO-MATCHER-DORMANT-LANDMINE,
// Opção A: remover o wiring morto). `cbo-matcher.service.ts` consultava `occupations_reference`,
// tabela que NUNCA foi aplicada no schema vivo (só em migrations_archive) — toda chamada falhava em
// silêncio (try/catch) e devolvia null. Landmine dormente: o dia que alguém aplicasse a tabela ou
// removesse o try-catch, comportamento mudaria sem aviso. Clayton escolheu (a): remover o wiring
// morto completamente, em vez de (b) redesenhar concept-bound (sem demanda de produto hoje).
//
// MORDE:
//   (A) `cbo-matcher.service.ts` voltar a existir;
//   (B) `categories.service.ts` voltar a importar/chamar `cboMatcherService`;
//   (C) `category-input-gate.service.ts` voltar a importar/chamar `cboMatcherService`.
// Heurística textual comment-stripped + existência de arquivo. Em validate:regression-guards.
// NÃO altera runtime.

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const ROOT = process.cwd();
const stripTs = (s) => s
  .replace(/(^|[^:"'`])\/\/[^\n]*/g, '$1')
  .replace(/\/\*[\s\S]*?\*\//g, '');

const failures = [];

// (A) o arquivo do serviço não pode voltar a existir.
const CBO_FILE = join(ROOT, 'src', 'core', 'categories', 'cbo-matcher.service.ts');
if (existsSync(CBO_FILE)) {
  failures.push(`cbo-matcher.service.ts voltou a existir — Opção A (remoção) foi revertida sem decisão nova.`);
}

// (B)/(C) nenhum caller pode voltar a referenciar cboMatcherService/cbo-matcher.
const CALLERS = [
  join('src', 'core', 'categories', 'categories.service.ts'),
  join('src', 'core', 'categories', 'category-input-gate.service.ts'),
];
for (const rel of CALLERS) {
  const full = join(ROOT, rel);
  if (!existsSync(full)) { failures.push(`arquivo ausente: ${rel}`); continue; }
  const src = stripTs(readFileSync(full, 'utf-8'));
  if (/cboMatcherService|cbo-matcher\.service/.test(src)) {
    failures.push(`${rel}: voltou a referenciar cboMatcherService/cbo-matcher.service — wiring morto reintroduzido.`);
  }
}

if (failures.length > 0) {
  console.error('GATE FAIL [cbo-matcher-dormant-landmine-removal]:');
  for (const f of failures) console.error('   - ' + f);
  process.exit(1);
}
console.log('GATE OK [cbo-matcher-dormant-landmine-removal] — cbo-matcher.service.ts removido, nenhum caller referencia o wiring morto. DT-CBO-MATCHER-DORMANT-LANDMINE blindada (Opção A).');
