#!/usr/bin/env node
// Guard estrutural — F-MVP-SERVICE-CHAIN-FRONTEND-WIRING-SLICE-1 (2026-06-27).
//
// LEI: "Frontend nunca cria verdade — projeta verdade resolvida." Esta fatia ligou o FRONTEND do
//   operador-por-concessão (GAP-B = conceder service_order:view; GAP-C = ver ordens por concessão)
//   ao substrato CANÔNICO actor_capability_grants (DECISION-0136). O guard de BACKEND
//   (audit-operator-service-order-view-grant.mjs) já sela os invariantes do backend; ESTE é o
//   complemento de FRONTEND — nenhum guard de backend morde o browser. Protege:
//   (A) api/authority-grants.ts é a ponte CANÔNICA: fala /authority/grants via apiFetchJson; NÃO usa
//       business-permissions (RBAC legado de CHECAGEM, jamais concessor), NÃO usa organization_*, NÃO
//       toca Bank/payout/settlement/financial-terms; NÃO envia capability financeira/de-escrita/estado.
//   (B) OperatorGrantsManager.tsx (GAP-B) só concede a capability NÃO-financeira de LEITURA fixa
//       'service_order:view'; passa pela ponte canônica; sem business-permissions/organization/Bank.
//   (C) OperatorOrdersPage.tsx (GAP-C) é READ-ONLY: lê via api/service-orders (listServiceOrders) e
//       abre o detalhe existente; NÃO lê financial-terms; NÃO confirma/inicia/conclui/cancela/atualiza
//       status; NÃO cria ordem direta; NÃO importa service-bookings/schedules/organization/Bank.
//   (D) App.tsx expõe a rota contida /operator/service-orders → OperatorOrdersPage (superfície honesta).
//   (E) cross-check read-only: o backend ainda resolve a leitura por grant (service-order.service.ts
//       mantém canViewOrderForParty) — contrato do qual o GAP-C depende. (ESTE guard NÃO toca backend/src.)
// Heurística textual (não AST). Integrado em validate:regression-guards.

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const ROOT = process.cwd(); // backend/
const FE_SRC = join(ROOT, '..', 'frontend', 'src');
const GRANTS_API = join(FE_SRC, 'api', 'authority-grants.ts');
const GRANTS_MANAGER = join(FE_SRC, 'components', 'authority', 'OperatorGrantsManager.tsx');
const OPERATOR_PAGE = join(FE_SRC, 'pages', 'OperatorOrdersPage.tsx');
const APP = join(FE_SRC, 'App.tsx');
const BE_SVC = join(ROOT, 'src', 'modules', 'services', 'service-order.service.ts');

const read = (p) => (existsSync(p) ? readFileSync(p, 'utf8') : null);
const stripComments = (s) =>
  s.replace(/(^|[^:"'`])\/\/[^\n]*/g, '$1').replace(/\/\*[\s\S]*?\*\//g, '');

const failures = [];
const must = (cond, msg) => { if (!cond) failures.push(msg); };
let checked = 0;

// Capabilities financeiras / de escrita / de estado que esta superfície JAMAIS pode conceder/enviar.
const FORBIDDEN_CAPS = [
  'service_order:update', 'service_order:update_status', 'service_order:cancel',
  'service_order:complete', 'service_order:start', 'service_order:dispute',
  'service_order:refund', 'service_order:payout', 'booking:manage',
];
const hasForbiddenCap = (code) =>
  FORBIDDEN_CAPS.find((k) => new RegExp(`['"\`]${k.replace(/[:]/g, '[:]')}['"\`]`).test(code));

// (A) api/authority-grants.ts — ponte canônica honesta ─────────────────────────────────────────────
const apiRaw = read(GRANTS_API);
if (!apiRaw) {
  failures.push('OPERATOR_GRANT_FE (A): frontend/src/api/authority-grants.ts ausente (ponte canônica).');
} else {
  const api = stripComments(apiRaw);
  checked++;
  must(/['"]\/authority\/grants/.test(api),
    'OPERATOR_GRANT_FE (A): authority-grants.ts não fala mais o endpoint canônico /authority/grants.');
  must(/apiFetchJson/.test(api),
    'OPERATOR_GRANT_FE (A): authority-grants.ts não usa mais o client canônico (apiFetchJson).');
  must(!/business-permissions/.test(api),
    'OPERATOR_GRANT_FE (A): authority-grants.ts passou a usar business-permissions (RBAC legado como concessor é PROIBIDO).');
  must(!/\borganization/i.test(api),
    'OPERATOR_GRANT_FE (A): authority-grants.ts passou a referenciar organization_* (ghost proibido).');
  must(!/api\/bank|\/payout|settlement|financial-terms|ledger/i.test(api),
    'OPERATOR_GRANT_FE (A): authority-grants.ts passou a tocar dinheiro (Bank/payout/settlement/financial-terms/ledger).');
  const cap = hasForbiddenCap(api);
  must(!cap,
    `OPERATOR_GRANT_FE (A): authority-grants.ts passou a permitir capability financeira/de-escrita/estado ('${cap}').`);
}

// (B) OperatorGrantsManager.tsx (GAP-B) — concede só LEITURA, pela ponte canônica ─────────────────
const mgrRaw = read(GRANTS_MANAGER);
if (!mgrRaw) {
  failures.push('OPERATOR_GRANT_FE (B): OperatorGrantsManager.tsx ausente (GAP-B).');
} else {
  const mgr = stripComments(mgrRaw);
  checked++;
  must(/from\s+['"][^'"]*api\/authority-grants['"]/.test(mgr),
    'OPERATOR_GRANT_FE (B): OperatorGrantsManager.tsx não usa mais a ponte canônica api/authority-grants.');
  must(/['"]service_order:view['"]/.test(mgr),
    "OPERATOR_GRANT_FE (B): OperatorGrantsManager.tsx não concede mais a capability fixa 'service_order:view'.");
  must(!/business-permissions/.test(mgr),
    'OPERATOR_GRANT_FE (B): OperatorGrantsManager.tsx passou a usar business-permissions como concessor (PROIBIDO).');
  must(!/\borganization/i.test(mgr),
    'OPERATOR_GRANT_FE (B): OperatorGrantsManager.tsx passou a referenciar organization_* (ghost proibido).');
  must(!/api\/bank|\/payout|settlement|financial-terms/i.test(mgr),
    'OPERATOR_GRANT_FE (B): OperatorGrantsManager.tsx passou a tocar dinheiro (Bank/payout/settlement/financial-terms).');
  const cap = hasForbiddenCap(mgr);
  must(!cap,
    `OPERATOR_GRANT_FE (B): OperatorGrantsManager.tsx passou a conceder capability não-leitura ('${cap}').`);
}

// (C) OperatorOrdersPage.tsx (GAP-C) — READ-ONLY honesto ──────────────────────────────────────────
const pageRaw = read(OPERATOR_PAGE);
if (!pageRaw) {
  failures.push('OPERATOR_GRANT_FE (C): OperatorOrdersPage.tsx ausente (GAP-C).');
} else {
  const page = stripComments(pageRaw);
  checked++;
  must(/from\s+['"][^'"]*api\/service-orders['"]/.test(page),
    'OPERATOR_GRANT_FE (C): OperatorOrdersPage.tsx não lê mais via api/service-orders.');
  must(!/financial-terms|getServiceOrderFinancialTerms|financialTerms/i.test(page),
    'OPERATOR_GRANT_FE (C): OperatorOrdersPage.tsx passou a tocar financial-terms (FIREWALL: negado a grant).');
  must(!/confirmServiceOrder|startServiceOrder|completeServiceOrder|cancelServiceOrder|updateOrderStatus|update_status|confirmBookingFromDecision/.test(page),
    'OPERATOR_GRANT_FE (C): OperatorOrdersPage.tsx passou a MUTAR ordem (confirm/start/complete/cancel/update_status) — deve ser read-only.');
  must(!/createServiceOrder/.test(page),
    'OPERATOR_GRANT_FE (C): OperatorOrdersPage.tsx passou a criar ordem direta (proibido — ordem nasce do fluxo canônico).');
  must(!/api\/service-bookings|\/schedules\b|schedule_slots/.test(page),
    'OPERATOR_GRANT_FE (C): OperatorOrdersPage.tsx passou a usar service-bookings/schedules (fora do escopo do MVP).');
  must(!/\borganization/i.test(page),
    'OPERATOR_GRANT_FE (C): OperatorOrdersPage.tsx passou a referenciar organization_* (ghost proibido).');
  must(!/api\/bank|\/payout|settlement\b/i.test(page),
    'OPERATOR_GRANT_FE (C): OperatorOrdersPage.tsx passou a tocar dinheiro (Bank/payout/settlement).');
}

// (D) App.tsx — rota contida do operador ──────────────────────────────────────────────────────────
const appRaw = read(APP);
checked++;
must(!!appRaw, 'OPERATOR_GRANT_FE (D): App.tsx ausente.');
if (appRaw) {
  const app = stripComments(appRaw);
  must(/operator\/service-orders/.test(app) && /OperatorOrdersPage/.test(app),
    'OPERATOR_GRANT_FE (D): App.tsx não registra mais a rota contida /operator/service-orders → OperatorOrdersPage.');
}

// (E) cross-check read-only — o backend ainda resolve leitura por grant (contrato do GAP-C) ────────
const beSvc = read(BE_SVC);
checked++;
must(!!beSvc, 'OPERATOR_GRANT_FE (E): service-order.service.ts ausente (cross-check do contrato de leitura por grant).');
if (beSvc) {
  must(/canViewOrderForParty/.test(beSvc),
    'OPERATOR_GRANT_FE (E): backend perdeu canViewOrderForParty — o GAP-C depende dessa resolução de leitura por grant.');
}

console.log(`[operator-service-order-view-grant-frontend] checked=${checked} failures=${failures.length}`);
if (failures.length > 0) {
  console.error('GATE FAIL [operator-service-order-view-grant-frontend]:');
  failures.forEach((f) => console.error('  ❌', f));
  process.exit(1);
}
console.log('GATE OK [operator-service-order-view-grant-frontend] — ponte canônica /authority/grants honesta; GAP-B concede só service_order:view; GAP-C read-only sem financial-terms/mutação/dinheiro; rota contida; backend mantém canViewOrderForParty (DECISION-0136).');
