#!/usr/bin/env node
// Gate estrutural — F-COMPOSER-CONTRACT-C1 (contrato server-driven do compositor).
// O compositor ENUMERA atos criáveis server-side (resolve a violação: intent-classifier.ts enumerava
// no client). Este gate trava as fronteiras do módulo (espelha audit-actor-page-contract):
//   1) READ-ONLY: o módulo composer NUNCA escreve (sem INSERT/UPDATE/DELETE, sem repos de escrita);
//   2) autoridade: a ROTA exige canRepresentActor fail-closed (o composer age COMO um actor);
//   3) anti-dinheiro-embutido: o contrato não carrega valor monetário (sem amount/price/cents/bank_*);
//   4) enumeração server-side: o service tem o INTENT_REGISTRY (o cliente não inventa atos).
// Heurística textual comment-stripped. Em validate:regression-guards. Falso positivo = mais restritivo.

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const ROOT = process.cwd();
const DIR = join(ROOT, 'src', 'modules', 'composer');
const SERVICE = join(DIR, 'composer.service.ts');
const ROUTES = join(DIR, 'composer.routes.ts');
const stripTs = (s) => s.replace(/(^|[^:"'`])\/\/[^\n]*/g, '$1').replace(/\/\*[\s\S]*?\*\//g, '');

const failures = [];

for (const [rel, p] of [['composer.service.ts', SERVICE], ['composer.routes.ts', ROUTES]]) {
  if (!existsSync(p)) { failures.push(`arquivo ausente: ${rel}`); continue; }
  const code = stripTs(readFileSync(p, 'utf8'));

  // 1) READ-ONLY: nenhuma escrita SQL nem chamada de escrita.
  if (/INSERT\s+INTO|UPDATE\s+\w+\s+SET|DELETE\s+FROM/i.test(code)) {
    failures.push(`${rel}: contém escrita SQL — o compositor é READ-MODEL (só enumera capacidade de criação).`);
  }
  // 3) anti-dinheiro embutido no contrato.
  if (/amount_cents|price_cents|\bbalance\b|bank_ledger|bank_transactions/i.test(code)) {
    failures.push(`${rel}: referencia valor monetário/bank_* — o contrato do compositor nunca carrega dinheiro (anti-PII/anti-dinheiro).`);
  }
}

if (existsSync(SERVICE)) {
  const code = stripTs(readFileSync(SERVICE, 'utf8'));
  // 4) enumeração server-side: o registry existe.
  if (!/INTENT_REGISTRY/.test(code)) {
    failures.push('composer.service.ts: perdeu o INTENT_REGISTRY — enumeração de atos deixaria de ser server-driven.');
  }
  // gate honesto de substrato morto: vote precisa nascer gated (votes contido/L4).
  if (!/SUBSTRATO_CONTIDO_L4/.test(code)) {
    failures.push('composer.service.ts: vote perdeu o gate SUBSTRATO_CONTIDO_L4 — não pode oferecer substrato contido como vivo.');
  }
}

if (existsSync(ROUTES)) {
  const code = stripTs(readFileSync(ROUTES, 'utf8'));
  // 2) autoridade fail-closed na rota: canRepresentActor + 403.
  if (!/canRepresentActor\s*\(/.test(code)) {
    failures.push('composer.routes.ts: perdeu canRepresentActor — enumerar como um actor exige representá-lo (DECISION-0113).');
  }
  if (!/status\(\s*403\s*\)/.test(code)) {
    failures.push('composer.routes.ts: perdeu o 403 fail-closed do gate de autoridade.');
  }
}

console.log(`[composer-contract] failures=${failures.length}`);
if (failures.length > 0) {
  console.error('GATE FAIL [composer-contract]:');
  failures.forEach((f) => console.error('  ❌', f));
  process.exit(1);
}
console.log('GATE OK [composer-contract] — enumeração server-side (INTENT_REGISTRY); read-only; canRepresentActor fail-closed 403; zero dinheiro no contrato; substrato contido (vote) gated.');
