#!/usr/bin/env node
// audit-regional-fund-contract.mjs — GUARD do contrato de GET /bank/regional-fund (R-3/R-4 da
// regularização pós-YALA da Fatia D). Contract-first (API_CONTRACT_GOVERNANCE §2/§4/§5):
//   1. o contrato de GET /bank/regional-fund está catalogado em backend/docs/API_CONTRACT_GOVERNANCE.md §5;
//   2. a união RegionalFundResourceState é IDÊNTICA no backend e no frontend (4 estados canônicos);
//   3. (R-4) nenhum consumidor de RegionalFundView colapsa currentBalanceCents ausente em 0
//      (`currentBalanceCents ?? 0` fora de fund_available) — ausência NUNCA vira R$ 0,00.
import { readFileSync, readdirSync, statSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve, join } from 'path';

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

// (3) F-3 · DESCOBERTA REPO-WIDE dos consumidores (sem allowlist fechada). Consumidor do contrato do
//     Fundo Regional do USUÁRIO = qualquer arquivo do frontend (fora de src/api/, que é a fonte do
//     contrato) que CHAME `getUserRegionalFund` — assim novos consumidores futuros são detectados
//     automaticamente. Para CADA consumidor, o padrão INSEGURO é colapsar `currentBalanceCents`
//     null/undefined em 0 (`?? 0`/`|| 0`) SEM ramificar por `fund_available`, OU deixar o frontend
//     escolher região (city/region enviado a getUserRegionalFund). Padrões HONESTOS aceitos:
//       (a) `?? 0`/`|| 0` presente MAS o arquivo ramifica por `'fund_available'` (colapso dentro do
//           branch de saldo real) — DashboardHome/RegionalFundCard/RegionalFundUser;
//       (b) NENHUM `?? 0`/`|| 0` — a ausência é tratada pela nulidade de currentBalanceCents
//           (ex.: `!== null ? saldo : "indisponível"`) — MFIBankSummary.
function walk(dir, out = []) {
  for (const e of readdirSync(dir)) {
    if (e === 'node_modules' || e === 'dist' || e === '.vite') continue;
    const full = join(dir, e);
    const st = statSync(full);
    if (st.isDirectory()) walk(full, out);
    else if (/\.(tsx?|jsx?)$/.test(e)) out.push(full);
  }
  return out;
}
const FE_SRC = resolve(REPO, 'frontend/src');
const allFiles = walk(FE_SRC);
const consumers = [];
for (const full of allFiles) {
  const rel = full.slice(REPO.length + 1).replace(/\\/g, '/');
  if (/frontend\/src\/api\//.test(rel)) continue; // a api é a FONTE do contrato, não consumidor
  const src = readFileSync(full, 'utf8');
  if (/getUserRegionalFund\s*\(/.test(src)) consumers.push({ rel, src });
}
// prova de que a descoberta é repo-wide: MFIBankSummary (4º consumidor, fora do radar anterior) DEVE aparecer.
if (!consumers.some((c) => /MFIBankSummary\.tsx$/.test(c.rel))) {
  fails.push('descoberta de consumidores não encontrou MFIBankSummary.tsx — varredura repo-wide quebrada (não usar allowlist fechada)');
}
if (consumers.length === 0) {
  fails.push('nenhum consumidor de getUserRegionalFund descoberto — varredura repo-wide quebrada');
}
for (const { rel, src } of consumers) {
  const collapses = /currentBalanceCents\s*(\?\?|\|\|)\s*0/.test(src);
  const gatesFundAvailable = /'fund_available'/.test(src);
  if (collapses && !gatesFundAvailable) {
    fails.push(`${rel}: colapsa currentBalanceCents ausente em 0 (?? 0 / || 0) SEM ramificar por 'fund_available' — ausência vira R$ 0,00 cego`);
  }
  if (/getUserRegionalFund\s*\([^)]*(city|region)/i.test(src)) {
    fails.push(`${rel}: envia city/region a getUserRegionalFund — o frontend NÃO decide região (território vem da residência canônica no backend)`);
  }
}
console.log(`   [${MARK}] consumidores descobertos (repo-wide): ${consumers.map((c) => c.rel.replace('frontend/src/', '')).join(', ')}`);

if (fails.length) {
  console.error(`❌ ${MARK} FAIL — ${fails.length} problema(s):`);
  for (const f of fails) console.error(`   - ${f}`);
  process.exit(1);
}
console.log(`✅ GATE OK ${MARK} — contrato catalogado (§5); resourceState idêntico backend↔frontend (4 estados); ${consumers.length} consumidor(es) descoberto(s) repo-wide (inclui MFIBankSummary), nenhum colapsa currentBalanceCents ausente em 0 fora de fund_available nem decide região no frontend.`);
