#!/usr/bin/env node
// Guard — F-INTERNAL-FINANCIAL-TENANT-BODY-SPOOF-CONTAINMENT (anti-regressão de SUPERFÍCIE NOVA).
//
// Os guards de CONTEÚDO (audit-internal-financial-authority-containment.mjs + audit-internal-surfaces-
// containment.mjs) travam uma LISTA FIXA de controllers /internal já contidos (501/403). Eles NÃO pegam
// uma rota /internal NOVA registrada fora dessa lista. Este guard fecha esse flanco: toda registração
// `await app.register(X, { prefix: '/internal' })` em app.builder.ts DEVE apontar p/ um controller da
// ALLOWLIST classificada (todos hoje contidos a 501/403, sem ler tenant do cliente como autoridade).
//
// Rota /internal NOVA → este guard MORDE até ela ser: (a) contida (501/403) + adicionada aqui e ao guard de
// conteúdo, OU (b) movida p/ protectedScope (authPlugin+tenantPlugin) com tenant derivado server-side.
// /internal é montado FORA do protectedScope (sem auth) — nenhuma rota nova de dinheiro pode nascer ali aberta.

import { readFileSync } from 'fs';
import { join } from 'path';

const ROOT = process.cwd();
const BUILDER = join(ROOT, 'src/app.builder.ts');

// Controllers /internal classificados (CONTIDOS a 501/403; ver guards de conteúdo). Import path exato.
const CLASSIFIED_INTERNAL = new Set([
  './modules/observability/financial-simulator.controller',
  './modules/observability/financial-dashboard.controller',
  './modules/observability/financial-operations-panel.controller',
  './modules/audit/financial-audit-export.controller',
  './modules/disputes/financial-dispute.controller',
  './modules/freezes/financial-freeze.controller',
  './modules/governance/governance-proposal.controller',
  './modules/treasury/treasury-account.controller',
]);

const src = readFileSync(BUILDER, 'utf-8');

// Captura: const X = (await import('PATH')).default;  ...  await app.register(X, { prefix: '/internal' });
// Mapeia identificador -> import path.
const importMap = new Map();
for (const m of src.matchAll(/const\s+(\w+)\s*=\s*\(await import\('([^']+)'\)\)\.default;/g)) {
  importMap.set(m[1], m[2]);
}

const failures = [];
// Toda registração no escopo `app` (NÃO protectedScope) com prefix '/internal'.
for (const m of src.matchAll(/await\s+app\.register\(\s*(\w+)\s*,\s*\{\s*prefix:\s*['"]\/internal['"]/g)) {
  const ident = m[1];
  const path = importMap.get(ident);
  if (!path) {
    failures.push(`registração /internal de '${ident}' sem import resolvível — verifique app.builder.ts.`);
    continue;
  }
  if (!CLASSIFIED_INTERNAL.has(path)) {
    failures.push(
      `NOVA rota /internal NÃO classificada: '${ident}' (${path}). Toda superfície /internal é montada SEM auth ` +
      `(fora do protectedScope). Contenha a 501/403 (INTERNAL_FINANCIAL_AUTHORITY_CONTAINED) + adicione à ALLOWLIST ` +
      `deste guard e ao audit-internal-financial-authority-containment.mjs, OU mova p/ protectedScope (authPlugin+` +
      `tenantPlugin) com tenant derivado server-side. tenant_id de body/query NUNCA é autoridade (DECISION-0113).`
    );
  }
}

// Stale: controller na allowlist que não está mais registrado em /internal (mantém a lista honesta — só warn).
const registeredPaths = new Set(
  [...src.matchAll(/await\s+app\.register\(\s*(\w+)\s*,\s*\{\s*prefix:\s*['"]\/internal['"]/g)]
    .map((m) => importMap.get(m[1]))
    .filter(Boolean)
);
const stale = [...CLASSIFIED_INTERNAL].filter((p) => !registeredPaths.has(p));

if (failures.length > 0) {
  console.error('GATE FAIL [internal-route-registration-classified]:');
  for (const f of failures) console.error('   - ' + f);
  process.exit(1);
}
console.log(
  `GATE OK [internal-route-registration-classified] — ${registeredPaths.size} registração(ões) /internal, todas classificadas/contidas` +
  (stale.length ? ` (warn: ${stale.length} na allowlist não mais registrada(s): ${stale.join(', ')})` : '') +
  '. Nenhuma rota /internal nova aberta lendo tenant do cliente.'
);
