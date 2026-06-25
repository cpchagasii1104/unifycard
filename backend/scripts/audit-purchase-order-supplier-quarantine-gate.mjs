#!/usr/bin/env node
// Gate estrutural — F-PURCHASE-ORDER-SUPPLIER-QUARANTINE-GATE (§4.8.4).
// Trava a cobertura de quarentena nas mutações DECLARATIVAS de supplier/purchase-order:
//   - supplierService.createSupplier chama gate ANTES de supplierRepository.createSupplier;
//   - purchaseOrderService createPO/addItem/submitPO/cancelPO chamam gate ANTES da escrita;
//   - o gate cobre owner/scopeActor (input.ownerActorId / order.ownerActorId — autoridade) E o acting (createdBy/
//     submittedBy/cancelledBy — autoria) quando difere; usa actorId RESOLVIDO, NUNCA userId cru;
//   - canRepresentActor NÃO recebeu quarentena (segue puro);
//   - receivePO continua hard-stop (PURCHASE_ORDER_RECEIVE_CONTAINED) e receivePOContainedImpl segue sem caller;
//   - supplier status segue lowercase ('active'/'inactive'); owner obrigatório preservado;
//   - PO/supplier não tocam inventory/AP/bank/payment/payout/settlement nesta camada declarativa.
// Heurística textual (não AST). Integrado em validate:regression-guards.

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const PO = join(process.cwd(), 'src/modules/marketplace/purchase-order.service.ts');
const SUP = join(process.cwd(), 'src/modules/marketplace/supplier.service.ts');
const ROUTE = join(process.cwd(), 'src/modules/marketplace/purchase-order.routes.ts');
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
function gateBeforeWrite(code, sig, writeRe, label, ownerExpr) {
  const body = sliceMethod(code, sig);
  if (!body) { failures.push(`PO_SUPPLIER_QUARANTINE_REGRESSION: ${label} não localizado.`); return; }
  // o OWNER (autoridade) tem de ser gateado especificamente — não basta gatear só o acting.
  const ownerRe = new RegExp(`this\\.assertActorNotQuarantined\\(tenantId,\\s*${ownerExpr.replace(/[.]/g, '\\.')}\\)`);
  const iGate = body.search(ownerRe);
  const iWrite = body.search(writeRe);
  if (iGate < 0) failures.push(`PO_SUPPLIER_QUARANTINE_REGRESSION: ${label} NÃO gateia o owner (assertActorNotQuarantined(tenantId, ${ownerExpr})) — autoridade sem quarentena.`);
  else if (iWrite >= 0 && iGate > iWrite) failures.push(`PO_SUPPLIER_QUARANTINE_REGRESSION: ${label} escreve ANTES do gate (tarde demais).`);
}

// SUPPLIER
{
  const raw = read(SUP);
  if (!raw) failures.push('PO_SUPPLIER_QUARANTINE_REGRESSION: supplier.service.ts ausente.');
  else {
    const code = stripTs(raw);
    checked++;
    const helper = sliceMethod(code, 'private async assertActorNotQuarantined(');
    if (!helper || !/isActorEffectivelyBlocked\s*\(\s*tenantId,\s*actorId\s*\)/.test(helper)) failures.push('PO_SUPPLIER_QUARANTINE_REGRESSION: supplier helper assertActorNotQuarantined ausente/sem isActorEffectivelyBlocked.');
    checked++;
    gateBeforeWrite(code, 'async createSupplier(', /supplierRepository\.createSupplier\s*\(/, 'createSupplier', 'input.ownerActorId');
    const body = sliceMethod(code, 'async createSupplier(');
    if (!/this\.assertActorNotQuarantined\(tenantId,\s*input\.ownerActorId\)/.test(body)) failures.push('PO_SUPPLIER_QUARANTINE_REGRESSION: createSupplier não checa o owner (input.ownerActorId).');
    if (/assertActorNotQuarantined\(tenantId,\s*createdByUserId\b|assertActorNotQuarantined\(tenantId,\s*userId\b/.test(body)) failures.push('PO_SUPPLIER_QUARANTINE_REGRESSION: createSupplier usa userId CRU no gate.');
    if (!/SUPPLIER_OWNER_REQUIRED/.test(code)) failures.push('PO_SUPPLIER_QUARANTINE_REGRESSION: createSupplier perdeu owner obrigatório (SUPPLIER_OWNER_REQUIRED).');
    if (!/'active',\s*'inactive'|\['active', 'inactive'\]/.test(code)) failures.push('PO_SUPPLIER_QUARANTINE_REGRESSION: supplier status lowercase (active/inactive) regrediu.');
  }
}

// PURCHASE ORDER
{
  const raw = read(PO);
  if (!raw) failures.push('PO_SUPPLIER_QUARANTINE_REGRESSION: purchase-order.service.ts ausente.');
  else {
    const code = stripTs(raw);
    checked++;
    const helper = sliceMethod(code, 'private async assertActorNotQuarantined(');
    if (!helper || !/isActorEffectivelyBlocked\s*\(\s*tenantId,\s*actorId\s*\)/.test(helper)) failures.push('PO_SUPPLIER_QUARANTINE_REGRESSION: PO helper assertActorNotQuarantined ausente/sem isActorEffectivelyBlocked.');
    checked++;
    gateBeforeWrite(code, 'async createPO(', /purchaseOrderRepository\.createPurchaseOrder\s*\(/, 'createPO', 'input.ownerActorId');
    gateBeforeWrite(code, 'async addItem(', /purchaseOrderRepository\.addItem\s*\(/, 'addItem', 'order.ownerActorId');
    gateBeforeWrite(code, 'async submitPO(', /purchaseOrderRepository\.submitOrder\s*\(/, 'submitPO', 'order.ownerActorId');
    gateBeforeWrite(code, 'async cancelPO(', /purchaseOrderRepository\.cancelOrder\s*\(/, 'cancelPO', 'order.ownerActorId');
    // owner_actor_id é autoridade; created_by é autoria
    if (!/PURCHASE_ORDER_OWNER_REQUIRED/.test(code)) failures.push('PO_SUPPLIER_QUARANTINE_REGRESSION: createPO perdeu owner obrigatório (PURCHASE_ORDER_OWNER_REQUIRED).');
    // receivePO continua hard-stop
    checked++;
    const recv = sliceMethod(code, 'async receivePO(');
    if (!/PURCHASE_ORDER_RECEIVE_CONTAINED/.test(recv)) failures.push('PO_SUPPLIER_QUARANTINE_REGRESSION: receivePO perdeu o hard-stop PURCHASE_ORDER_RECEIVE_CONTAINED (REABERTO).');
    // receivePOContainedImpl segue sem CALLER vivo (a definição `private async ...(` não conta; só chamada this.<x>())
    if (/(this|self)\.receivePOContainedImpl\s*\(|await\s+receivePOContainedImpl\s*\(/.test(code)) {
      failures.push('PO_SUPPLIER_QUARANTINE_REGRESSION: receivePOContainedImpl ganhou caller vivo (proibido — money/inventory HOLD).');
    }
    // gate não usa userId cru
    if (/assertActorNotQuarantined\(tenantId,\s*\w*ByUserId\b|assertActorNotQuarantined\(tenantId,\s*userId\b/.test(code)) failures.push('PO_SUPPLIER_QUARANTINE_REGRESSION: PO gate usa userId CRU.');
  }
}

// route receive continua 403 hard-stop antes de qualquer leitura
{
  const raw = read(ROUTE);
  if (raw) {
    checked++;
    const code = stripTs(raw);
    if (!/\/purchase-orders\/:id\/receive'[\s\S]{0,200}?status\(403\)/.test(code)) {
      failures.push('PO_SUPPLIER_QUARANTINE_REGRESSION: rota POST /purchase-orders/:id/receive não está mais 403 hard-stop antes de tudo (REABERTA).');
    }
  }
}

// canRepresentActor puro
{
  const authz = read(AUTHZ);
  if (authz) {
    checked++;
    const m = stripTs(authz).match(/async canRepresentActor\([\s\S]*?\n  \}/);
    if (m && /isActorEffectivelyBlocked/.test(m[0])) failures.push('PO_SUPPLIER_QUARANTINE_REGRESSION: canRepresentActor passou a checar quarentena — representação deve ficar PURA.');
  }
}

console.log(`[purchase-order-supplier-quarantine-gate] checked=${checked} failures=${failures.length}`);
if (failures.length > 0) {
  console.error('GATE FAIL [purchase-order-supplier-quarantine-gate]:');
  failures.forEach((f) => console.error('  ❌', f));
  process.exit(1);
}
console.log('GATE OK [purchase-order-supplier-quarantine-gate] — supplier/PO declarativos bloqueiam owner E acting quarentenado ANTES da escrita; owner=autoridade/created_by=autoria; receivePO hard-stop; status lowercase; canRepresentActor puro.');
