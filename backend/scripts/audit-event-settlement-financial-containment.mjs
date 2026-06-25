#!/usr/bin/env node
// Gate estrutural — F-EVENT-SETTLEMENT-STATUS-HOLD-CONTAINMENT.
// Trava a contenção fail-closed da transição de estado do settlement de evento (dinheiro = HOLD / PORTA-1):
//   - firewall existe, flag estrita (=== 'true'), default-off, sem NODE_ENV auto-enable, sem fail-open;
//   - settleEvent chama assertEventSettlementRuntimeEnabled ANTES de markAsSettled (UPDATE event_settlements);
//   - markAsSettled continua SEM bank_* (não virou money-write);
//   - os firewalls de checkout/pdv NÃO regrediram.
// Heurística textual (não AST). Integrado em validate:regression-guards.

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const ROOT = process.cwd();
const FW = join(ROOT, 'src/modules/marketplace/event-settlement-financial-firewall.ts');
const SVC = join(ROOT, 'src/modules/marketplace/event-settlement.service.ts');
const REPO = join(ROOT, 'src/modules/marketplace/event-settlement.repository.ts');
const CHECKOUT_FW = join(ROOT, 'src/core/checkout/checkout-financial-firewall.ts');
const PDV_FW = join(ROOT, 'src/modules/pdv/pdv-financial-firewall.ts');
const failures = [];
let checked = 0;

const read = (p) => (existsSync(p) ? readFileSync(p, 'utf8') : null);
const stripTs = (s) => s.replace(/(^|[^:"'`])\/\/[^\n]*/g, '$1').replace(/\/\*[\s\S]*?\*\//g, '');

// 1) Firewall: estrito, default-off, sem auto-enable, sem fail-open.
{
  const raw = read(FW);
  if (!raw) {
    failures.push('EVENT_SETTLEMENT_REGRESSION: event-settlement-financial-firewall.ts ausente (contenção some).');
  } else {
    checked++;
    const code = stripTs(raw);
    if (!/EVENT_SETTLEMENT_RUNTIME_ENABLED/.test(code)) failures.push('EVENT_SETTLEMENT_REGRESSION: flag EVENT_SETTLEMENT_RUNTIME_ENABLED ausente.');
    if (!/===\s*'true'/.test(code)) failures.push("EVENT_SETTLEMENT_REGRESSION: helper não é estrito (=== 'true').");
    if (!/EVENT_SETTLEMENT_RUNTIME_DISABLED/.test(code)) failures.push('EVENT_SETTLEMENT_REGRESSION: code EVENT_SETTLEMENT_RUNTIME_DISABLED ausente.');
    if (/NODE_ENV/.test(code)) failures.push('EVENT_SETTLEMENT_REGRESSION: firewall referencia NODE_ENV (proibido auto-enable).');
    if (/return\s+true\s*;/.test(code.replace(/return process\.env\[[^\]]*\]\s*===\s*'true';/g, ''))) {
      failures.push('EVENT_SETTLEMENT_REGRESSION: firewall tem `return true` fora do check estrito (fail-open).');
    }
  }
}

// 2) Service: firewall ANTES de markAsSettled em settleEvent.
{
  const raw = read(SVC);
  if (!raw) {
    failures.push('EVENT_SETTLEMENT_REGRESSION: event-settlement.service.ts ausente.');
  } else {
    checked++;
    const code = stripTs(raw);
    const m = code.match(/async settleEvent\([\s\S]*?(?=\n {2}(async|private) |\n}\s*$)/);
    const body = m ? m[0] : '';
    if (!body) {
      failures.push('EVENT_SETTLEMENT_REGRESSION: método settleEvent não localizado.');
    } else {
      const iFw = body.search(/assertEventSettlementRuntimeEnabled\s*\(/);
      const iMark = body.search(/markAsSettled\s*\(/);
      if (iFw < 0) {
        failures.push('EVENT_SETTLEMENT_REGRESSION: settleEvent NÃO chama assertEventSettlementRuntimeEnabled — contenção ausente/regrediu.');
      } else if (iMark >= 0 && iMark < iFw) {
        failures.push('EVENT_SETTLEMENT_REGRESSION: markAsSettled ANTES do firewall — o bloqueio deve vir primeiro.');
      }
    }
  }
}

// 3) Repository: markAsSettled continua SEM bank_* (não virou money-write).
{
  const raw = read(REPO);
  if (!raw) {
    failures.push('EVENT_SETTLEMENT_REGRESSION: event-settlement.repository.ts ausente.');
  } else {
    checked++;
    const code = stripTs(raw);
    const m = code.match(/async markAsSettled\([\s\S]*?(?=\n {2}(async|private) |\n}\s*$)/);
    const body = m ? m[0] : code;
    if (/\bbank_(transactions|ledger|accounts|splits)\b|bankTransactionService|bankIntegration|createTransaction/i.test(body)) {
      failures.push('EVENT_SETTLEMENT_REGRESSION: markAsSettled passou a tocar bank_* (virou money-write) — fora do escopo desta contenção; exige firewall de money.');
    }
  }
}

// 4) Checkout/PDV firewalls não regrediram.
for (const [p, flag] of [[CHECKOUT_FW, 'CHECKOUT_FINANCIAL_RUNTIME_ENABLED'], [PDV_FW, 'PDV_FINANCIAL_RUNTIME_ENABLED']]) {
  const raw = read(p);
  if (!raw) { failures.push(`EVENT_SETTLEMENT_REGRESSION: firewall ${flag} ausente (regressão de trilho).`); continue; }
  checked++;
  const code = stripTs(raw);
  if (!new RegExp(flag).test(code) || !/===\s*'true'/.test(code)) {
    failures.push(`EVENT_SETTLEMENT_REGRESSION: firewall ${flag} regrediu (flag estrita ausente).`);
  }
}

console.log(`[event-settlement-financial-containment] checked=${checked} failures=${failures.length}`);
if (failures.length > 0) {
  console.error('GATE FAIL [event-settlement-financial-containment]:');
  failures.forEach((f) => console.error('  ❌', f));
  process.exit(1);
}
console.log('GATE OK [event-settlement-financial-containment] — settle fail-closed default-off ANTES de markAsSettled; flag estrita; markAsSettled sem bank_*; checkout/pdv firewalls intactos.');
