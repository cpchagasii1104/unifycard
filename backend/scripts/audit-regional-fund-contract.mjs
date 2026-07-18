#!/usr/bin/env node
// audit-regional-fund-contract.mjs — GUARD do contrato de GET /bank/regional-fund (R-3/R-4 da
// regularização pós-YALA da Fatia D). Contract-first (API_CONTRACT_GOVERNANCE §2/§4/§5):
//   1. o contrato de GET /bank/regional-fund está catalogado em backend/docs/API_CONTRACT_GOVERNANCE.md §5;
//   2. a união RegionalFundResourceState é IDÊNTICA no backend e no frontend (4 estados canônicos);
//   3. (R-4) nenhum consumidor de RegionalFundView colapsa currentBalanceCents ausente em 0
//      (`currentBalanceCents ?? 0` fora de fund_available) — ausência NUNCA vira R$ 0,00.
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const REPO = resolve(ROOT, '..');
const MARK = '[regional-fund-contract]';
const CANON = ['fund_available', 'residence_missing', 'canonical_city_missing', 'regional_fund_not_provisioned'];
const fails = [];

// (1) catálogo presente
const gov = readFileSync(resolve(ROOT, 'docs/API_CONTRACT_GOVERNANCE.md'), 'utf8');
if (!/GET \/bank\/regional-fund/.test(gov) || !/resourceState/.test(gov)) {
  fails.push('GET /bank/regional-fund não catalogado em API_CONTRACT_GOVERNANCE.md §5 (contract-first)');
}

// (2) união de estados idêntica backend↔frontend
function extractStates(src) {
  // remove comentários de linha (que podem conter ';') antes de delimitar a união
  const clean = src.replace(/\/\/.*$/gm, '');
  const m = clean.match(/RegionalFundResourceState[\s\S]*?=([\s\S]*?);/);
  if (!m) return null;
  return CANON.filter((s) => new RegExp(`'${s}'`).test(m[1]));
}
const be = readFileSync(resolve(ROOT, 'src/core/unifybank/transparency.service.ts'), 'utf8');
const fe = readFileSync(resolve(REPO, 'frontend/src/api/transparency.ts'), 'utf8');
const beStates = extractStates(be);
const feStates = extractStates(fe);
if (!beStates || beStates.length !== CANON.length) fails.push(`backend RegionalFundResourceState != 4 estados canônicos: ${JSON.stringify(beStates)}`);
if (!feStates || feStates.length !== CANON.length) fails.push(`frontend RegionalFundResourceState != 4 estados canônicos: ${JSON.stringify(feStates)}`);
if (beStates && feStates && JSON.stringify(beStates) !== JSON.stringify(feStates)) {
  fails.push(`união de estados divergente backend(${beStates})≠frontend(${feStates})`);
}

// (3) o check "nenhum consumidor colapsa currentBalanceCents ausente em 0" é adicionado em R-4,
//     no MESMO commit do fix de RegionalFundCard/RegionalFundUser que o satisfaz (mantém cada
//     commit verde). Ver audit-regional-fund-contract §(3) após R-4.

if (fails.length) {
  console.error(`❌ ${MARK} FAIL — ${fails.length} problema(s):`);
  for (const f of fails) console.error(`   - ${f}`);
  process.exit(1);
}
console.log(`✅ GATE OK ${MARK} — contrato catalogado (§5); resourceState idêntico backend↔frontend (4 estados). [check (3) anti-colapso de consumidor é adicionado em R-4.]`);
