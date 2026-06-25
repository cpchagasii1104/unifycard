#!/usr/bin/env node
// Gate estrutural — F-PAYMENT-METHOD-QUARANTINE-GATE (§4.8.4).
// Trava a cobertura de quarentena na mutação de método de pagamento (declarativo, money-free):
//   - createMethod chama assertActorNotQuarantined(scopeActor=input.actorId) ANTES de unsetDefaultForActor (UPDATE)
//     E antes de createMethod (INSERT) — a "cerca" tem duas tábuas (default + create);
//   - também checa o acting/createdBy actor quando difere do scope;
//   - o gate recebe actorId RESOLVIDO (input.actorId/createdByActorId), NUNCA userId cru;
//   - canRepresentActor NÃO recebeu quarentena (segue puro);
//   - payment-method continua DECLARATIVO: não chama executePayment/checkout/payout/settlement/bank writer.
// Heurística textual (não AST). Integrado em validate:regression-guards.

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const SVC = join(process.cwd(), 'src/modules/marketplace/payment-method.service.ts');
const AUTHZ = join(process.cwd(), 'src/core/authorization/authorization.service.ts');
const failures = [];
let checked = 0;

const stripTs = (s) => s.replace(/(^|[^:"'`])\/\/[^\n]*/g, '$1').replace(/\/\*[\s\S]*?\*\//g, '');
const read = (p) => (existsSync(p) ? readFileSync(p, 'utf8') : null);
function sliceMethod(code, sig) {
  const start = code.indexOf(sig);
  if (start < 0) return '';
  const after = code.slice(start);
  const nextM = after.slice(sig.length).search(/\n  (async|private|public)\s/);
  return nextM >= 0 ? after.slice(0, nextM + sig.length) : after;
}

const raw = read(SVC);
if (!raw) {
  failures.push('PAYMENT_METHOD_QUARANTINE_REGRESSION: payment-method.service.ts ausente.');
} else {
  const code = stripTs(raw);

  // helper de quarentena
  checked++;
  const helper = sliceMethod(code, 'private async assertActorNotQuarantined(');
  if (!helper || !/isActorEffectivelyBlocked\s*\(\s*tenantId,\s*actorId\s*\)/.test(helper)) {
    failures.push('PAYMENT_METHOD_QUARANTINE_REGRESSION: helper assertActorNotQuarantined ausente/sem isActorEffectivelyBlocked.');
  }

  // createMethod: gate scopeActor ANTES de unsetDefaultForActor E de createMethod + grantee
  {
    checked++;
    const body = sliceMethod(code, 'async createMethod(');
    const iGate = body.search(/this\.assertActorNotQuarantined\(tenantId,\s*input\.actorId\)/);
    const iActing = body.search(/this\.assertActorNotQuarantined\(tenantId,\s*createdByActorId\)/);
    const iUnset = body.search(/unsetDefaultForActor\s*\(/);
    const iInsert = body.search(/paymentMethodRepository\.createMethod\s*\(/);
    const firstWrite = Math.min(...[iUnset, iInsert].filter((i) => i >= 0));
    if (iGate < 0) failures.push('PAYMENT_METHOD_QUARANTINE_REGRESSION: createMethod NÃO checa scopeActor (input.actorId).');
    else if (Number.isFinite(firstWrite) && iGate > firstWrite) {
      failures.push('PAYMENT_METHOD_QUARANTINE_REGRESSION: gate vem DEPOIS da 1ª escrita (unsetDefaultForActor/createMethod) — tarde demais (a tábua do default ficou aberta).');
    }
    if (iActing < 0) failures.push('PAYMENT_METHOD_QUARANTINE_REGRESSION: createMethod NÃO checa o acting/createdBy actor.');
    if (/assertActorNotQuarantined\(tenantId,\s*createdByUserId\b|assertActorNotQuarantined\(tenantId,\s*userId\b/.test(body)) {
      failures.push('PAYMENT_METHOD_QUARANTINE_REGRESSION: gate usa userId CRU (deve ser actorId resolvido).');
    }
  }

  // payment-method continua DECLARATIVO (não vira execução financeira)
  checked++;
  if (/executePayment|processCheckout|createTransactionWithSplit|bankIntegration|payment_intents|\bbank_(ledger|transactions|splits|accounts)\b|payoutService|settlementService/i.test(code)) {
    failures.push('PAYMENT_METHOD_QUARANTINE_REGRESSION: payment-method.service passou a tocar execução financeira (executePayment/checkout/bank_*/payout/settlement) — proibido (declarativo).');
  }
}

// canRepresentActor não recebeu quarentena
{
  const authz = read(AUTHZ);
  if (authz) {
    checked++;
    const m = stripTs(authz).match(/async canRepresentActor\([\s\S]*?\n  \}/);
    if (m && /isActorEffectivelyBlocked/.test(m[0])) {
      failures.push('PAYMENT_METHOD_QUARANTINE_REGRESSION: canRepresentActor passou a checar quarentena — representação deve ficar PURA.');
    }
  }
}

console.log(`[payment-method-quarantine-gate] checked=${checked} failures=${failures.length}`);
if (failures.length > 0) {
  console.error('GATE FAIL [payment-method-quarantine-gate]:');
  failures.forEach((f) => console.error('  ❌', f));
  process.exit(1);
}
console.log('GATE OK [payment-method-quarantine-gate] — createMethod bloqueia scopeActor E acting quarentenado ANTES de unsetDefault+create; payment-method segue declarativo (money-free); canRepresentActor puro.');
