#!/usr/bin/env node
// Gate estrutural — F-COMPOSER-CONTRACT-C1 (contrato server-driven do compositor).
// 🔴 O compositor PROJETA o SSOT de intents (ActorIntent + validateIntent), NÃO inventa vocabulário.
// Este gate trava a violação que a auditoria de 2026-07-06 pegou (registry paralelo + economicFlow):
//   1) SSOT: importa ActorIntent do contrato canônico (modules/social/actor-intents.types);
//   2) DELEGA a decisão: chama actorIntentsService.validateIntent (não re-implementa capacidade/permissão);
//   3) SEM verdade paralela: proíbe enum de intent próprio, INTENT_REGISTRY e economicFlow (invenção);
//   4) read-only + autoridade fail-closed na rota (canRepresentActor 403) + zero dinheiro no contrato.
// Heurística textual comment-stripped. Em validate:regression-guards. Falso positivo = mais restritivo.

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const ROOT = process.cwd();
const DIR = join(ROOT, 'src', 'modules', 'composer');
const SERVICE = join(DIR, 'composer.service.ts');
const TYPES = join(DIR, 'composer.types.ts');
const ROUTES = join(DIR, 'composer.routes.ts');
const stripTs = (s) => s.replace(/(^|[^:"'`])\/\/[^\n]*/g, '$1').replace(/\/\*[\s\S]*?\*\//g, '');

const failures = [];
const readOrFail = (rel, p) => { if (!existsSync(p)) { failures.push(`arquivo ausente: ${rel}`); return null; } return stripTs(readFileSync(p, 'utf8')); };

// Fronteiras comuns a service+routes+types.
for (const [rel, p] of [['composer.service.ts', SERVICE], ['composer.routes.ts', ROUTES], ['composer.types.ts', TYPES]]) {
  const code = readOrFail(rel, p);
  if (code === null) continue;
  if (/INSERT\s+INTO|UPDATE\s+\w+\s+SET|DELETE\s+FROM/i.test(code)) {
    failures.push(`${rel}: contém escrita SQL — o compositor é READ-MODEL (só projeta capacidade de criação).`);
  }
  if (/amount_cents|price_cents|\bbalance\b|bank_ledger|bank_transactions/i.test(code)) {
    failures.push(`${rel}: referencia valor monetário/bank_* — o contrato do compositor nunca carrega dinheiro.`);
  }
  // 3) proibição de verdade paralela: nada de vocabulário de intent próprio.
  if (/economicFlow|INTENT_REGISTRY/.test(code)) {
    failures.push(`${rel}: contém economicFlow/INTENT_REGISTRY — vocabulário de intent PARALELO é proibido (SSOT = ActorIntent + INTENTS_ACTOR_CONTRATO.md).`);
  }
  if (/enum\s+ComposerIntent|enum\s+\w*Intent\b/.test(code)) {
    failures.push(`${rel}: define enum de intent próprio — a IDENTIDADE do intent vive só em ActorIntent (SSOT).`);
  }
}

const svc = existsSync(SERVICE) ? stripTs(readFileSync(SERVICE, 'utf8')) : null;
if (svc !== null) {
  // 1) SSOT: importa e itera ActorIntent.
  if (!/from '@modules\/social\/actor-intents\.types'/.test(svc) || !/ActorIntent/.test(svc)) {
    failures.push('composer.service.ts: não importa/usa ActorIntent — a enumeração deve partir do SSOT canônico.');
  }
  // 2) DELEGA a decisão ao validador central (não re-implementa capacidade/permissão).
  if (!/actorIntentsService\.validateIntent\s*\(/.test(svc)) {
    failures.push('composer.service.ts: não delega ao actorIntentsService.validateIntent — o enabled/gated do intent é decisão CENTRAL, não local.');
  }
  // não pode re-derivar autoridade de intent por conta própria (capability map local, if(actorType), etc.)
  if (/INTENT_CAPABILITY_MAP/.test(svc)) {
    failures.push('composer.service.ts: usa INTENT_CAPABILITY_MAP diretamente — deve DELEGAR a validateIntent, não re-implementar a checagem.');
  }
}

const types = existsSync(TYPES) ? stripTs(readFileSync(TYPES, 'utf8')) : null;
if (types !== null) {
  // A chave do ComposerIntent é o ActorIntent governado (não string literal inventada).
  if (!/intent:\s*ActorIntent/.test(types)) {
    failures.push('composer.types.ts: ComposerIntent.intent deve ser do tipo ActorIntent (chave governada), não string própria.');
  }
}

const routes = existsSync(ROUTES) ? stripTs(readFileSync(ROUTES, 'utf8')) : null;
if (routes !== null) {
  if (!/canRepresentActor\s*\(/.test(routes)) failures.push('composer.routes.ts: perdeu canRepresentActor (autoridade fail-closed).');
  if (!/status\(\s*403\s*\)/.test(routes)) failures.push('composer.routes.ts: perdeu o 403 fail-closed do gate de autoridade.');
}

console.log(`[composer-contract] failures=${failures.length}`);
if (failures.length > 0) {
  console.error('GATE FAIL [composer-contract]:');
  failures.forEach((f) => console.error('  ❌', f));
  process.exit(1);
}
console.log('GATE OK [composer-contract] — projeta o SSOT ActorIntent + delega a validateIntent (zero vocabulário paralelo, sem economicFlow/registry/enum próprio); read-only; canRepresentActor fail-closed; zero dinheiro.');
