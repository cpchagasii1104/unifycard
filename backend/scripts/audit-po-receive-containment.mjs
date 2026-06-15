#!/usr/bin/env node
// Guard estrutural — F-C1-MONEY-PO-RECEIVE-EXPLICIT-CONTAINMENT (ONDA DECISION-0131 · C1_MONEY).
// Decisão Clayton: purchase_order NÃO é creator-owned; o efeito material de recebimento (inventory IN via
// order.createdByActorId, status RECEIVED/COMPLETED, accounts payable) fica CONTIDO fail-closed até existir
// OWNER EMPRESARIAL MATERIAL (company-owned). Esta contenção é EXPLÍCITA (não acidental). FALHA se:
//   (a) purchaseOrderService.receivePO perder o hard-stop (throw PURCHASE_ORDER_RECEIVE_CONTAINED);
//   (b) receivePO voltar a conter QUALQUER mutação (addMovement / updateItemQuantityReceived / markAsReceived
//       / markAsCompleted / createFromPurchaseOrder) — elas devem viver só no impl contido NÃO chamado;
//   (c) o impl contido (receivePOContainedImpl) ganhar um caller (qualquer invocação reabilita a mutação);
//   (d) a rota POST /purchase-orders/:id/receive deixar de ser 403 PURCHASE_ORDER_RECEIVE_CONTAINED, OU voltar
//       a chamar purchaseOrderService.receivePO. Integrado em validate:regression-guards. NÃO altera runtime.

import { readFileSync, existsSync } from 'fs';
import { join, resolve } from 'path';
import { fileURLToPath } from 'url';

const ROOT = process.cwd();
const SERVICE = join(ROOT, 'src', 'modules', 'marketplace', 'purchase-order.service.ts');
const ROUTES = join(ROOT, 'src', 'modules', 'marketplace', 'purchase-order.routes.ts');
const stripComments = (s) => s
  .replace(/(^|[^:"'`])\/\/[^\n]*/g, '$1')
  .replace(/\/\*[\s\S]*?\*\//g, '');

const MUTATIONS = ['addMovement', 'updateItemQuantityReceived', 'markAsReceived', 'markAsCompleted', 'createFromPurchaseOrder'];

function runGuard() {
  const failures = [];
  for (const [label, p] of [['purchase-order.service.ts', SERVICE], ['purchase-order.routes.ts', ROUTES]]) {
    if (!existsSync(p)) { console.error(`GATE FAIL [po-receive-containment]: ${label} ausente.`); process.exit(1); }
  }
  const svc = stripComments(readFileSync(SERVICE, 'utf-8'));
  const routes = stripComments(readFileSync(ROUTES, 'utf-8'));

  // Recorta o corpo de receivePO (de `async receivePO(` até o próximo método).
  const start = svc.search(/async\s+receivePO\s*\(/);
  if (start < 0) {
    failures.push('purchaseOrderService.receivePO não encontrado — REGISTRO precisa revisão.');
  } else {
    const rest = svc.slice(start + 1);
    const nextIdx = rest.search(/\n\s{2}(?:private\s+|public\s+)?async\s+[A-Za-z_]\w*\s*\(/);
    const body = nextIdx > 0 ? rest.slice(0, nextIdx) : rest;
    // (a) hard-stop presente.
    if (!/throw\s+new\s+AppError/.test(body) || !/PURCHASE_ORDER_RECEIVE_CONTAINED/.test(body)) {
      failures.push('receivePO perdeu o hard-stop fail-closed (throw new AppError(403, …, PURCHASE_ORDER_RECEIVE_CONTAINED)).');
    }
    // (b) nenhuma mutação dentro de receivePO.
    for (const m of MUTATIONS) {
      if (new RegExp(`\\b${m}\\s*\\(`).test(body)) {
        failures.push(`receivePO voltou a conter a mutação ${m}( — toda mutação deve ficar no impl contido NÃO chamado, após o hard-stop.`);
      }
    }
  }

  // (c) o impl contido NÃO pode ter caller (só a definição existe).
  const implCalls = (svc.match(/\breceivePOContainedImpl\s*\(/g) || []).length;
  if (implCalls > 1) {
    failures.push(`receivePOContainedImpl tem caller (${implCalls - 1} invocação(ões) além da definição) — reabilita a mutação contida. Proibido até owner empresarial material.`);
  }
  if (implCalls === 0) {
    failures.push('receivePOContainedImpl sumiu — a implementação material contida deve permanecer separada e NÃO chamada.');
  }

  // (d) rota receive = 403 contido + não chama o service receivePO.
  if (!/PURCHASE_ORDER_RECEIVE_CONTAINED/.test(routes) || !/\.status\(\s*403\s*\)/.test(routes)) {
    failures.push('rota POST /purchase-orders/:id/receive deixou de ser 403 PURCHASE_ORDER_RECEIVE_CONTAINED (fail-closed).');
  }
  if (/purchaseOrderService\.receivePO\s*\(/.test(routes)) {
    failures.push('rota /receive voltou a chamar purchaseOrderService.receivePO — a rota deve ser 403 contido, sem invocar o service de recebimento.');
  }

  if (failures.length > 0) {
    console.error('GATE FAIL [po-receive-containment]:');
    failures.forEach((f) => console.error('  ❌ ' + f));
    process.exit(1);
  }
  console.log('[po-receive-containment] receivePO = hard-stop 403 PURCHASE_ORDER_RECEIVE_CONTAINED (zero mutação); impl material contido NÃO chamado; rota /receive 403 fail-closed.');
  console.log('GATE OK [po-receive-containment] — recebimento de PO contido EXPLICITAMENTE até owner empresarial material; created_by_actor_id não autoriza; inventory/status/payable inalcançáveis.');
}

const isMain = process.argv[1] ? resolve(process.argv[1]) === fileURLToPath(import.meta.url) : false;
if (isMain) runGuard();

export { runGuard };
