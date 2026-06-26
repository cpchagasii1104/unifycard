#!/usr/bin/env node
// Guard estrutural — F-MVP-SERVICE-CHAIN-UX-DEAD-END-SWEEP (2026-06-26).
//
// LEI DA ROTA (não do botão): uma `service_order` nasce SOMENTE pelo fluxo canônico
//   reserva de oferta → decisão ACCEPTED → confirmBookingFromDecision → ordem (auto-emit).
// POST /service-orders direto = 403 SERVICE_ORDER_DIRECT_CREATE_DISABLED (lei soberana do backend).
// Nenhuma superfície viva do frontend pode oferecer criação direta de ordem. Este guard protege:
//   (A) App.tsx: a rota legada /service-orders/new é terminal honesto (ServiceLegacyQuarantinePage
//       variant="order-create"), NÃO o formulário de criação direta (CreateServiceOrderPage).
//   (B) App.tsx: a rota legada /booking-requests é terminal honesto (ServiceLegacyQuarantinePage
//       variant="booking-requests"), NÃO a lista System-A viva (ServiceBookingRequestsPage).
//   (C) App.tsx não importa mais CreateServiceOrderPage nem ServiceBookingRequestsPage (legado órfão,
//       não destino vivo de rota).
//   (D) NENHUM arquivo .ts/.tsx do frontend/src navega/aponta para `/service-orders/new` (link vivo),
//       ignorando comentários — ZERO CTA/navigate/link/to/href para o dead-end.
//   (E) A própria página-guia é honesta: não cria ordem (createServiceOrder), não faz POST,
//       não navega para `/service-orders/new`, não reabre o caminho direto.
//   (F) A lei soberana do backend continua intacta: POST /service-orders responde 403
//       (SERVICE_ORDER_DIRECT_CREATE_DISABLED) — read-only cross-check, este guard NÃO toca backend/src.
// Heurística textual (não AST). Integrado em validate:regression-guards.

import { readFileSync, existsSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

const ROOT = process.cwd(); // backend/
const FE = join(ROOT, '..', 'frontend');
const FE_SRC = join(FE, 'src');
const APP = join(FE_SRC, 'App.tsx');
const QUARANTINE = join(FE_SRC, 'pages', 'ServiceLegacyQuarantinePage.tsx');
const SO_ROUTES = join(ROOT, 'src', 'modules', 'services', 'service-order.routes.ts');

const read = (p) => (existsSync(p) ? readFileSync(p, 'utf8') : null);
// remove comentários de linha (//) e bloco (/* */) — fiel ao stripTs dos guards vizinhos.
const stripComments = (s) =>
  s.replace(/(^|[^:"'`])\/\/[^\n]*/g, '$1').replace(/\/\*[\s\S]*?\*\//g, '');

function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) {
      if (name === 'node_modules' || name === 'dist' || name === '.vite') continue;
      out.push(...walk(p));
    } else if (/\.(ts|tsx)$/.test(name)) {
      out.push(p);
    }
  }
  return out;
}

const failures = [];
const must = (cond, msg) => { if (!cond) failures.push(msg); };
let checked = 0;

// (A)+(B)+(C) App.tsx: rotas legadas em quarentena, legado não importado/roteado ─────────────────
const appRaw = read(APP);
if (!appRaw) {
  failures.push('SERVICE_ORDER_DEAD_END_SWEEP: frontend/src/App.tsx ausente.');
} else {
  const app = stripComments(appRaw);
  checked++;
  // (A) /service-orders/new → quarentena order-create
  must(/path="service-orders\/new"\s+element=\{<ServiceLegacyQuarantinePage\s+variant="order-create"\s*\/>\}/.test(app),
    'SERVICE_ORDER_DEAD_END_SWEEP (A): rota service-orders/new não é o terminal honesto (ServiceLegacyQuarantinePage variant="order-create").');
  // (B) /booking-requests → quarentena booking-requests
  checked++;
  must(/path="booking-requests"\s+element=\{<ServiceLegacyQuarantinePage\s+variant="booking-requests"\s*\/>\}/.test(app),
    'SERVICE_ORDER_DEAD_END_SWEEP (B): rota booking-requests não é o terminal honesto (ServiceLegacyQuarantinePage variant="booking-requests").');
  // (C) legado não é destino vivo de rota nem importado
  checked++;
  must(!/element=\{<CreateServiceOrderPage\b/.test(app),
    'SERVICE_ORDER_DEAD_END_SWEEP (C): CreateServiceOrderPage voltou a ser destino vivo de rota (criação direta).');
  must(!/element=\{<ServiceBookingRequestsPage\b/.test(app),
    'SERVICE_ORDER_DEAD_END_SWEEP (C): ServiceBookingRequestsPage voltou a ser destino vivo de rota (System-A).');
  must(!/^\s*import\s+CreateServiceOrderPage\s+from/m.test(app),
    'SERVICE_ORDER_DEAD_END_SWEEP (C): App.tsx voltou a importar CreateServiceOrderPage.');
  must(!/^\s*import\s+ServiceBookingRequestsPage\s+from/m.test(app),
    'SERVICE_ORDER_DEAD_END_SWEEP (C): App.tsx voltou a importar ServiceBookingRequestsPage.');
}

// (D) nenhum arquivo do frontend/src navega/aponta para /service-orders/new (ignorando comentários) ─
if (!existsSync(FE_SRC)) {
  failures.push('SERVICE_ORDER_DEAD_END_SWEEP: frontend/src ausente.');
} else {
  checked++;
  const offenders = [];
  for (const f of walk(FE_SRC)) {
    const code = stripComments(read(f) || '');
    if (code.includes('/service-orders/new')) offenders.push(f.replace(FE, '').replace(/\\/g, '/'));
  }
  must(offenders.length === 0,
    `SERVICE_ORDER_DEAD_END_SWEEP (D): link/navegação viva para /service-orders/new reintroduzida em: ${offenders.join(', ')}`);
}

// (E) página-guia é honesta: não cria ordem, não faz POST, não navega para o dead-end ─────────────
const qRaw = read(QUARANTINE);
if (!qRaw) {
  failures.push('SERVICE_ORDER_DEAD_END_SWEEP (E): ServiceLegacyQuarantinePage.tsx ausente.');
} else {
  const q = stripComments(qRaw);
  checked++;
  must(!/\bcreateServiceOrder\b/.test(q),
    'SERVICE_ORDER_DEAD_END_SWEEP (E): a página-guia referencia createServiceOrder (não pode criar ordem).');
  must(!/\/service-orders\/new/.test(q),
    'SERVICE_ORDER_DEAD_END_SWEEP (E): a página-guia navega para /service-orders/new (dead-end recursivo).');
  must(!/method:\s*['"]POST['"]/i.test(q) && !/\.post\s*\(/.test(q),
    'SERVICE_ORDER_DEAD_END_SWEEP (E): a página-guia faz POST (deve ser terminal honesto, sem escrita).');
}

// (F) cross-check read-only: lei soberana do backend (POST /service-orders 403) intacta ───────────
const routes = read(SO_ROUTES);
checked++;
must(!!routes, 'SERVICE_ORDER_DEAD_END_SWEEP (F): service-order.routes.ts ausente.');
if (routes) {
  must(/SERVICE_ORDER_DIRECT_CREATE_DISABLED/.test(routes),
    'SERVICE_ORDER_DEAD_END_SWEEP (F): POST /service-orders direto perdeu o 403 (SERVICE_ORDER_DIRECT_CREATE_DISABLED).');
}

console.log(`[service-order-direct-create-dead-end-sweep] checked=${checked} failures=${failures.length}`);
if (failures.length > 0) {
  console.error('GATE FAIL [service-order-direct-create-dead-end-sweep]:');
  failures.forEach((f) => console.error('  ❌', f));
  process.exit(1);
}
console.log('GATE OK [service-order-direct-create-dead-end-sweep] — rotas legadas /service-orders/new e /booking-requests em terminal honesto; legado não importado/roteado; ZERO link vivo para /service-orders/new; página-guia sem criação/POST; backend 403 intacto.');
