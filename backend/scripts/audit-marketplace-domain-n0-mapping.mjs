#!/usr/bin/env node
// Gate estrutural — F-MARKETPLACE-DOMAIN-N0-MATERIALIZATION (L3, materializa DECISION-0106).
// O mapa MarketplaceDomain→N0 é PROMULGADO (0106 D1-D6). Este guard trava a materialização contra o doc:
//   1) os 6 rótulos exatos (0106);
//   2) o mapa bate LITERALMENTE com D1-D6 (market→produtos-e-comercio, services→servicos,
//      events→cultura-lazer-e-eventos; jobs/real_estate/vehicles → null POR DECISÃO);
//   3) trava herdada (0106 §4): vehicles NUNCA mapeia p/ mobilidade-e-logistica (viga do rides).
// A existência dos N0-alvo em `domains` (banco) é provada pelo E2E, não aqui (guard é estático).
// Em validate:regression-guards (via agregador). Comment-stripped.

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const ROOT = process.cwd();
const MOD = join(ROOT, 'src', 'core', 'marketplace-domain', 'marketplace-domain-n0-mapping.ts');
const stripTs = (s) => s.replace(/(^|[^:"'`])\/\/[^\n]*/g, '$1').replace(/\/\*[\s\S]*?\*\//g, '');

const failures = [];
if (!existsSync(MOD)) {
  console.error('GATE FAIL [marketplace-domain-n0-mapping]: módulo ausente.');
  process.exit(1);
}
const code = stripTs(readFileSync(MOD, 'utf8'));

// 1) os 6 rótulos como CHAVES do mapa (o vocabulário em si vive em @unificard/contracts — o módulo
//    importa MARKETPLACE_DOMAIN_VALUES; aqui travamos que o MAPA cobre todos os 6).
for (const d of ['market', 'services', 'events', 'real_estate', 'vehicles', 'jobs']) {
  if (!new RegExp(`(^|[^\\w'])${d}\\s*:`, 'm').test(code)) failures.push(`chave '${d}' ausente do mapa (0106 tem 6 rótulos).`);
}
// 1b) o vocabulário é COMPOSTO do contracts (não literais próprios).
if (!/MARKETPLACE_DOMAIN_VALUES/.test(code) || !/@unificard\/contracts/.test(code)) {
  failures.push('módulo deve compor o vocabulário de @unificard/contracts (MARKETPLACE_DOMAIN_VALUES) — não redefinir literais (fork fechado).');
}
// 2) o mapa literal D1-D3 (os 3 com alvo N0).
const wants = [
  [/market:\s*'produtos-e-comercio'/, 'D1 market→produtos-e-comercio'],
  [/services:\s*'servicos'/, 'D2 services→servicos'],
  [/events:\s*'cultura-lazer-e-eventos'/, 'D3 events→cultura-lazer-e-eventos'],
  [/jobs:\s*null/, 'D4 jobs→null (capability, não domínio)'],
  [/real_estate:\s*null/, 'D5 real_estate→null (regulado)'],
  [/vehicles:\s*null/, 'D6 vehicles→null (regulado)'],
];
for (const [re, label] of wants) {
  if (!re.test(code)) failures.push(`mapa diverge de 0106: falta ${label}.`);
}
// 3) trava herdada: vehicles NUNCA → mobilidade-e-logistica.
if (/vehicles:\s*'mobilidade-e-logistica'/.test(code) || /vehicles.*mobilidade/.test(code)) {
  failures.push("VIOLAÇÃO 0106 §4: vehicles mapeado p/ mobilidade-e-logistica (viga do rides — proibido).");
}
// zero dinheiro / zero escrita (é mapa de navegação, read-only).
if (/INSERT\s+INTO|UPDATE\s+\w+\s+SET|bank_ledger|bank_transactions/i.test(code)) {
  failures.push('módulo de mapa não pode escrever/tocar dinheiro (é ponte de navegação read-only).');
}

console.log(`[marketplace-domain-n0-mapping] failures=${failures.length}`);
if (failures.length > 0) {
  console.error('GATE FAIL [marketplace-domain-n0-mapping]:');
  failures.forEach((f) => console.error('  ❌', f));
  process.exit(1);
}
console.log('GATE OK [marketplace-domain-n0-mapping] — mapa materializado bate com DECISION-0106 D1-D6; regulados (jobs/real_estate/vehicles)→null por decisão; vehicles não conflata com mobilidade-e-logistica.');
