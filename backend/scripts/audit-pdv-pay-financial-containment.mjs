#!/usr/bin/env node
// Gate estrutural — F-PDV-PAY-MONEY-HOLD-CONTAINMENT.
// Trava a contenção fail-closed do pagamento do PDV (dinheiro = HOLD / PORTA-1):
//   - firewall PDV existe, flag estrita (=== 'true'), default-off, sem NODE_ENV auto-enable, sem fail-open;
//   - payOrderFromPdv chama assertPdvFinancialRuntimeEnabled ANTES de createPaymentIntent/authorize/executePayment;
//   - o firewall de checkout (CHECKOUT_FINANCIAL_RUNTIME_ENABLED) NÃO regrediu.
// Heurística textual (não AST). Integrado em validate:regression-guards.

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const ROOT = process.cwd();
const FW = join(ROOT, 'src/modules/pdv/pdv-financial-firewall.ts');
const SVC = join(ROOT, 'src/modules/pdv/pdv.service.ts');
const CHECKOUT_FW = join(ROOT, 'src/core/checkout/checkout-financial-firewall.ts');
const failures = [];
let checked = 0;

const read = (p) => (existsSync(p) ? readFileSync(p, 'utf8') : null);
const stripTs = (s) => s.replace(/(^|[^:"'`])\/\/[^\n]*/g, '$1').replace(/\/\*[\s\S]*?\*\//g, '');

// 1) Firewall PDV: estrito, default-off, sem auto-enable, sem fail-open.
{
  const raw = read(FW);
  if (!raw) {
    failures.push('PDV_MONEY_REGRESSION: pdv-financial-firewall.ts ausente (contenção PDV-pay some).');
  } else {
    checked++;
    const code = stripTs(raw);
    if (!/PDV_FINANCIAL_RUNTIME_ENABLED/.test(code)) {
      failures.push('PDV_MONEY_REGRESSION: flag PDV_FINANCIAL_RUNTIME_ENABLED ausente no firewall.');
    }
    if (!/===\s*'true'/.test(code)) {
      failures.push("PDV_MONEY_REGRESSION: helper não é estrito (=== 'true') — fail-closed exige igualdade exata.");
    }
    if (!/PDV_FINANCIAL_RUNTIME_DISABLED/.test(code)) {
      failures.push('PDV_MONEY_REGRESSION: code de erro PDV_FINANCIAL_RUNTIME_DISABLED ausente (bloqueio honesto).');
    }
    if (/NODE_ENV/.test(code)) {
      failures.push('PDV_MONEY_REGRESSION: firewall PDV referencia NODE_ENV (proibido auto-enable por ambiente).');
    }
    // fail-open: o helper não pode retornar true por outro caminho que não o === 'true'.
    if (/return\s+true\s*;/.test(code.replace(/return process\.env\[[^\]]*\]\s*===\s*'true';/g, ''))) {
      failures.push('PDV_MONEY_REGRESSION: firewall PDV tem `return true` fora do check estrito (fail-open).');
    }
  }
}

// 2) Service: firewall ANTES de qualquer side-effect financeiro no payOrderFromPdv.
{
  const raw = read(SVC);
  if (!raw) {
    failures.push('PDV_MONEY_REGRESSION: pdv.service.ts ausente.');
  } else {
    checked++;
    const code = stripTs(raw);
    const m = code.match(/async payOrderFromPdv\([\s\S]*?(?=\n {2}async |\n {2}\/\*\*|\n}\s*$)/);
    const body = m ? m[0] : '';
    if (!body) {
      failures.push('PDV_MONEY_REGRESSION: método payOrderFromPdv não localizado.');
    } else {
      const iFw = body.search(/assertPdvFinancialRuntimeEnabled\s*\(/);
      const iIntent = body.search(/createPaymentIntent\s*\(/);
      const iAuth = body.search(/authorizePaymentIntent\s*\(/);
      const iExec = body.search(/executePayment\s*\(/);
      if (iFw < 0) {
        failures.push('PDV_MONEY_REGRESSION: payOrderFromPdv NÃO chama assertPdvFinancialRuntimeEnabled — contenção ausente/regrediu.');
      } else {
        const moneyIdxs = [iIntent, iAuth, iExec].filter((i) => i >= 0);
        for (const mi of moneyIdxs) {
          if (mi < iFw) {
            failures.push('PDV_MONEY_REGRESSION: side-effect financeiro (payment_intent/authorize/execute) ANTES do firewall — bloqueio deve vir primeiro.');
            break;
          }
        }
      }
    }
  }
}

// 3) Checkout firewall não regrediu.
{
  const raw = read(CHECKOUT_FW);
  if (!raw) {
    failures.push('PDV_MONEY_REGRESSION: checkout-financial-firewall.ts ausente (regressão do trilho de checkout).');
  } else {
    checked++;
    const code = stripTs(raw);
    if (!/CHECKOUT_FINANCIAL_RUNTIME_ENABLED/.test(code) || !/===\s*'true'/.test(code)) {
      failures.push("PDV_MONEY_REGRESSION: checkout firewall regrediu (CHECKOUT_FINANCIAL_RUNTIME_ENABLED estrito ausente).");
    }
  }
}

console.log(`[pdv-pay-financial-containment] checked=${checked} failures=${failures.length}`);
if (failures.length > 0) {
  console.error('GATE FAIL [pdv-pay-financial-containment]:');
  failures.forEach((f) => console.error('  ❌', f));
  process.exit(1);
}
console.log('GATE OK [pdv-pay-financial-containment] — PDV-pay fail-closed default-off ANTES de payment_intent/bank_*; flag estrita; sem NODE_ENV/fail-open; checkout firewall intacto.');
