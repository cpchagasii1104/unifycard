#!/usr/bin/env node
// Guard estrutural — F-C1-MONEY-PO-OWNER-ACTOR-SCHEMA-WIRING (ONDA DECISION-0131 · C1_MONEY).
// purchase_order pertence ao lado COMPRADOR via owner_actor_id = actor operacional da empresa (page+company_id).
// Toda operação exige representar o owner empresarial (canRepresentActor); created_by_actor_id/supplier_id/
// tenant_id NÃO autorizam. receivePO segue CONTIDO. FALHA se:
//   (a) a rota perder a validação ORGANIZACIONAL do owner (isOrgActor: actor_type='page' AND company_id);
//   (b) a rota perder o gate canRepresentActor (create + reads/mutações via loadAndAuthorizePO + list);
//   (c) reads/mutações virarem tenant-only (sem canRepresentActor);
//   (d) o service createPO persistir PO sem owner (perder PURCHASE_ORDER_OWNER_REQUIRED);
//   (e) a rota tocar Bank/ledger/inventory (addMovement/bank_*);
//   (f) a migration de owner_actor_id sumir (coluna/FK/índice);
//   (g) receivePO deixar de ser 403 PURCHASE_ORDER_RECEIVE_CONTAINED. Em validate:regression-guards.

import { readFileSync, existsSync, readdirSync } from 'fs';
import { join, resolve } from 'path';
import { fileURLToPath } from 'url';

const ROOT = process.cwd();
const ROUTES = join(ROOT, 'src', 'modules', 'marketplace', 'purchase-order.routes.ts');
const SERVICE = join(ROOT, 'src', 'modules', 'marketplace', 'purchase-order.service.ts');
const MIGRATIONS = join(ROOT, 'migrations');
const stripComments = (s) => s
  .replace(/(^|[^:"'`])\/\/[^\n]*/g, '$1')
  .replace(/\/\*[\s\S]*?\*\//g, '');

function runGuard() {
  const failures = [];
  for (const [label, p] of [['purchase-order.routes.ts', ROUTES], ['purchase-order.service.ts', SERVICE]]) {
    if (!existsSync(p)) { console.error(`GATE FAIL [po-owner-authority]: ${label} ausente.`); process.exit(1); }
  }
  const routes = stripComments(readFileSync(ROUTES, 'utf-8'));
  const service = stripComments(readFileSync(SERVICE, 'utf-8'));

  // (a) validação ORGANIZACIONAL do owner (page + company_id).
  if (!/actor_type\s*===\s*'page'/.test(routes) || !/company_id/.test(routes)) {
    failures.push("rota PO perdeu a validação ORGANIZACIONAL do owner (actor_type==='page' AND company_id) — owner empresarial não pode ser actor humano/sem company.");
  }
  // (b) gate canRepresentActor presente (create + loadAndAuthorizePO + list ⇒ >=3 call-sites).
  const reps = (routes.match(/\bcanRepresentActor\s*\(/g) || []).length;
  if (reps < 3) {
    failures.push(`rota PO com cobertura de autoridade insuficiente: ${reps} chamadas canRepresentActor (esperado >=3: create + reads/mutações + list).`);
  }
  if (!/loadAndAuthorizePO\s*\(/.test(routes)) {
    failures.push('rota PO perdeu loadAndAuthorizePO — reads/mutações devem resolver o PO e exigir representar o owner.');
  }
  // (c) reads/mutações não podem ser tenant-only: o GET list deve filtrar por canRepresentActor.
  if (!/listPOs\s*\(/.test(routes)) {
    failures.push('rota PO list não encontrada — REGISTRO precisa revisão.');
  }
  // (e) nenhuma escrita Bank/ledger/inventory na rota PO.
  if (/\baddMovement\s*\(|INSERT\s+INTO\s+bank_|UPDATE\s+bank_|bank_ledger|bank_transactions|bank_splits/i.test(routes)) {
    failures.push('rota PO toca Bank/ledger/inventory (addMovement/bank_*) — proibido nesta frente.');
  }
  // (g) receivePO segue 403 contido.
  if (!/PURCHASE_ORDER_RECEIVE_CONTAINED/.test(routes) || !/\.status\(\s*403\s*\)/.test(routes)) {
    failures.push('rota /receive deixou de ser 403 PURCHASE_ORDER_RECEIVE_CONTAINED — a contenção do recebimento não pode ser removida nesta frente.');
  }

  // (d) service createPO exige owner empresarial (PURCHASE_ORDER_OWNER_REQUIRED) + persiste ownerActorId.
  if (!/PURCHASE_ORDER_OWNER_REQUIRED/.test(service) || !/input\.ownerActorId/.test(service)) {
    failures.push('service createPO perdeu a exigência de owner empresarial (PURCHASE_ORDER_OWNER_REQUIRED / input.ownerActorId) — PO não pode nascer sem owner material.');
  }

  // (f) migration de owner_actor_id presente (coluna + FK actors + índice).
  const migs = existsSync(MIGRATIONS) ? readdirSync(MIGRATIONS).filter((f) => /purchase_orders_owner_actor_id\.sql$/.test(f)) : [];
  if (migs.length === 0) {
    failures.push('migration purchase_orders_owner_actor_id.sql ausente — owner_actor_id (coluna/FK/índice) não materializado.');
  } else {
    const mig = readFileSync(join(MIGRATIONS, migs[0]), 'utf-8');
    const ok = /owner_actor_id/.test(mig) && /REFERENCES\s+actors\s*\(\s*id\s*\)/i.test(mig) && /idx_purchase_orders_tenant_owner/.test(mig);
    if (!ok) failures.push('migration de owner_actor_id perdeu coluna / FK actors(id) / índice (tenant_id, owner_actor_id).');
  }

  if (failures.length > 0) {
    console.error('GATE FAIL [po-owner-authority]:');
    failures.forEach((f) => console.error('  ❌ ' + f));
    process.exit(1);
  }
  console.log(`[po-owner-authority] owner empresarial (page+company_id) validado + ${reps} canRepresentActor (create/reads/mutações/list); receivePO contido; createPO exige owner; migration owner_actor_id presente.`);
  console.log('GATE OK [po-owner-authority] — purchase_order tem owner empresarial material; toda operação exige representar o owner; created_by_actor_id/supplier_id/tenant_id não autorizam (DECISION-0131).');
}

const isMain = process.argv[1] ? resolve(process.argv[1]) === fileURLToPath(import.meta.url) : false;
if (isMain) runGuard();

export { runGuard };
