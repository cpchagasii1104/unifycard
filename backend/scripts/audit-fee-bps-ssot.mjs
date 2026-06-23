#!/usr/bin/env node
// Guard estrutural — F-UNIFYCARD-FEE-BPS-SSOT-LOCK-IN (DECISION-0140/0141).
//
// LACRA a calibração já conquistada: a taxa do path VIVO (marketplace/UnifyCard) resolve SEMPRE via
// economic_policy_engine em basis points (bps), NUNCA por fee_percentage. O READ-FIRST provou que
// fee_percentage só existe em tabelas archived/ghost + readers dormant/snapshot — NÃO no path vivo.
// Este guard impede REGRESSÃO: nenhum código vivo novo pode voltar a ler fee_percentage para fee.
//
// MORDE se: o resolver vivo perder o engine/bps; um consumidor vivo deixar de usar o resolver; QUALQUER
// arquivo fora da allowlist (ghost/dormant/snapshot) passar a conter fee_percentage/feePercentage (em código,
// pós comment-strip). Estático, comment-stripped. Em validate:regression-guards.

import { readdirSync, readFileSync, statSync, existsSync } from 'fs';
import { join } from 'path';

const ROOT = process.cwd();
const stripTs = (s) => s.replace(/(^|[^:"'`])\/\/[^\n]*/g, '$1').replace(/\/\*[\s\S]*?\*\//g, '');
const rel = (p) => p.slice(ROOT.length + 1).replace(/\\/g, '/');
const readRel = (r) => { const p = join(ROOT, r); return existsSync(p) ? stripTs(readFileSync(p, 'utf-8')) : null; };
const fails = [];
const need = (src, file, re, why) => { if (src === null || !re.test(src)) fails.push(`${file}: ${why}`); };
const forbid = (src, file, re, why) => { if (src !== null && re.test(src)) fails.push(`${file}: ${why}`); };

const FEE_PCT = /fee_percentage|feePercentage/;

// ── POSITIVO: resolver VIVO usa economic_policy_engine em bps (SSOT), sem fee_percentage ──
const RES = 'src/modules/marketplace/marketplace-fee-policy.ts';
const res = readRel(RES);
need(res, RES, /resolveMarketplaceFeeViaPolicy/, 'resolver canônico de fee ausente.');
need(res, RES, /economicPolicyEngineService/, 'resolver não usa economic_policy_engine (SSOT bps, DECISION-0141).');
need(res, RES, /feeRateBps/, 'resolver não expõe feeRateBps (unidade bps, DECISION-0140).');
forbid(res, RES, FEE_PCT, 'resolver VIVO não pode ler fee_percentage (path vivo é bps).');

// ── LIVE consumers resolvem via o resolver canônico (não fee_percentage) ──
for (const f of ['src/modules/marketplace/payment-execution.service.ts', 'src/modules/marketplace/unifycard.service.ts']) {
  const s = readRel(f);
  need(s, f, /resolveMarketplaceFeeViaPolicy/, 'consumidor vivo de fee não usa o resolver canônico (bps).');
  forbid(s, f, FEE_PCT, 'consumidor vivo não pode ler fee_percentage (pós comment-strip).');
}

// ── COMPLETUDE: fee_percentage SÓ pode aparecer em ghost/dormant/snapshot (allowlist) ──
// Qualquer arquivo VIVO novo com fee_percentage (em código) = regressão → MORDE.
const ALLOWED = new Set([
  'src/modules/marketplace/payment-intent.service.ts',        // snapshot auditável imutável (deprecated)
  'src/modules/marketplace/payment-method.repository.ts',     // ghost (payment_methods archived)
  'src/modules/marketplace/payment-method.service.ts',        // ghost
  'src/modules/marketplace/payment-method.types.ts',          // tipo legado
  'src/modules/marketplace/regional-fee.repository.ts',       // dead/snapshot (regional_fees ghost) — DT própria
  'src/modules/marketplace/settlement.service.ts',            // proxy-dead — DT própria
  'src/modules/marketplace/unifycard-method.repository.ts',   // dormant (R8Q 501)
  'src/modules/marketplace/unifycard-method.service.ts',      // dormant (R8Q 501)
  'src/modules/marketplace/unifycard-method.types.ts',        // tipo legado
  'src/scripts/validate-pipeline-e2e-unifycard-fee-bps.ts',   // E2E que PROVA ausência de fee_percentage (asserts)
]);

function walk(dir, acc = []) {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    const st = statSync(p);
    if (st.isDirectory()) { if (e !== 'node_modules') walk(p, acc); }
    else if (e.endsWith('.ts')) acc.push(p);
  }
  return acc;
}

for (const abs of walk(join(ROOT, 'src'))) {
  const r = rel(abs);
  const s = stripTs(readFileSync(abs, 'utf-8'));
  if (FEE_PCT.test(s) && !ALLOWED.has(r)) {
    fails.push(`${r}: fee_percentage/feePercentage em código VIVO fora da allowlist ghost/dormant — regressão do SSOT bps (DECISION-0140/0141). Migre para feeRateBps via resolveMarketplaceFeeViaPolicy.`);
  }
}

if (fails.length > 0) {
  console.error('GATE FAIL [fee-bps-ssot]:');
  for (const f of fails) console.error('   - ' + f);
  process.exit(1);
}
console.log('GATE OK [fee-bps-ssot] — taxa do path VIVO resolve via economic_policy_engine em bps (resolveMarketplaceFeeViaPolicy/feeRateBps); nenhum consumidor vivo lê fee_percentage; fee_percentage confinado a ghost/dormant/snapshot allowlistados. Lock-in DECISION-0140/0141.');
