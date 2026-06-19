#!/usr/bin/env node
// Guard estrutural — F-UNIFYCARD-METHOD-FEE-BPS-MATERIAL-MIGRATION (DECISION-0140 unidade bps + DECISION-0141
// schema-of-record economic_policy_engine). Garante que os consumers de taxa UnifyCard/marketplace resolvem a
// taxa via economic_policy_engine em bps — e NUNCA via fee_percentage/100, *100 órfão, ou cálculo hardcoded
// sobre o gross. "engine resolve; método no máximo espelha." Comment-stripped. Em validate:regression-guards.
//
// MORDE se (NP1) reaparecer /100 em cálculo de fee; (NP2) *100 órfão sobre bps/fee; (NP3) feePercentage/
// fee_percentage voltar como contrato no path de fee; (NP4) fee calculado fora do engine (Math.round/floor sobre
// gross no consumer); (NP5) payment_methods/unifycard_payment_methods virar read-path soberano de fee (.feePercentage).

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const ROOT = process.cwd();
const stripTs = (s) => s
  .replace(/(^|[^:"'`])\/\/[^\n]*/g, '$1')
  .replace(/\/\*[\s\S]*?\*\//g, '');

const REL = {
  pe: 'src/modules/marketplace/payment-execution.service.ts',
  uc: 'src/modules/marketplace/unifycard.service.ts',
  fp: 'src/modules/marketplace/marketplace-fee-policy.ts',
};

const failures = [];
const read = (rel) => {
  const p = join(ROOT, rel);
  if (!existsSync(p)) { failures.push(`arquivo ausente: ${rel}`); return null; }
  return stripTs(readFileSync(p, 'utf-8'));
};

// Regras comuns a TODOS os consumers de fee (pe, uc, fp): proibições de origem ambígua de taxa.
for (const rel of [REL.pe, REL.uc, REL.fp]) {
  const code = read(rel);
  if (code === null) continue;

  // NP3: feePercentage / fee_percentage não podem ser contrato (identificador) no path de fee.
  if (/\bfeePercentage\b|\bfee_percentage\b/.test(code)) {
    failures.push(`${rel}: usa feePercentage/fee_percentage como contrato — proibido (DECISION-0140/0141: bps via engine).`);
  }
  // NP1: /100 em cálculo de fee (gross * (.../100) ou feePercentage/100).
  if (/grossAmountCents\s*\*\s*\([^)]*\/\s*100\b/.test(code) || /\/\s*100\b/.test(code)) {
    failures.push(`${rel}: contém "/100" — divisão por 100 ambígua proibida no path de fee (use bps via engine: floor(gross*bps/10000)).`);
  }
  // NP2: *100 órfão sobre fee/bps.
  if (/\b(?:bps|fee|feeRateBps|feeAmountCents)\w*\s*\*\s*100\b/i.test(code) || /\*\s*100\b/.test(code)) {
    failures.push(`${rel}: contém "*100" órfão — conversão de fee/bps por *100 proibida (engine usa /10000).`);
  }
  // NP5: payment_methods/unifycard_payment_methods como read-path soberano de fee (.feePercentage de um method).
  if (/paymentMethod\s*\.\s*feePercentage|unifycard_payment_methods/.test(code)) {
    failures.push(`${rel}: lê payment_methods/unifycard_payment_methods como fonte de taxa — proibido (não-SSOT; SSOT é o engine).`);
  }
}

// payment-execution.service.ts e unifycard.service.ts: fee DEVE vir do resolvedor de policy (engine), não de Math local sobre gross.
for (const rel of [REL.pe, REL.uc]) {
  const code = read(rel);
  if (code === null) continue;
  if (!/resolveMarketplaceFeeViaPolicy\s*\(/.test(code)) {
    failures.push(`${rel}: não resolve a taxa via resolveMarketplaceFeeViaPolicy (engine) — fee deve vir do economic_policy_engine.`);
  }
  // NP4: fee calculado fora do engine — Math.round/floor sobre grossAmountCents no consumer.
  if (/feeAmountCents\s*=\s*Math\.(?:round|floor)\s*\([^;]*grossAmountCents/.test(code)) {
    failures.push(`${rel}: feeAmountCents calculado por Math.* sobre grossAmountCents — proibido (fee vem do engine, não de cálculo local).`);
  }
}

// marketplace-fee-policy.ts: DEVE usar o engine canônico (resolveEconomicPolicy + calculatePolicySplits).
{
  const code = read(REL.fp);
  if (code) {
    if (!/economicPolicyEngineService/.test(code)) failures.push(`${REL.fp}: não importa/usa economicPolicyEngineService (SSOT de fee/split).`);
    if (!/resolveEconomicPolicy\s*\(/.test(code)) failures.push(`${REL.fp}: não chama resolveEconomicPolicy (resolução de policy fail-closed).`);
    if (!/calculatePolicySplits\s*\(/.test(code)) failures.push(`${REL.fp}: não chama calculatePolicySplits (split em bps floor(gross*bps/10000)).`);
  }
}

if (failures.length > 0) {
  console.error('GATE FAIL [unifycard-fee-bps-consumer]:');
  for (const f of failures) console.error('   - ' + f);
  process.exit(1);
}
console.log('GATE OK [unifycard-fee-bps-consumer] — taxa UnifyCard/marketplace resolvida via economic_policy_engine em bps (DECISION-0140/0141); sem fee_percentage/ /100 / *100 órfão / read-path de method como SSOT; payment-execution + unifycard.service consomem resolveMarketplaceFeeViaPolicy; marketplace-fee-policy usa resolveEconomicPolicy + calculatePolicySplits.');
