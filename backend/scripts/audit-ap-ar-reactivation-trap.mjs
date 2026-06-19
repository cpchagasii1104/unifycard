#!/usr/bin/env node
// Guard estrutural — F-AUTHORITY-Z2-R8H-AP-AR-REACTIVATION-TRAP-CONTAINMENT (DECISION-0113 / DECISION-0131 §B7 / Z2; DECISION-0114 D5).
//
// AP/AR foram migrados para o Bank (service = Proxy reject-all "migrated to Bank"; tabelas accounts_payable/
// accounts_receivable schema-ghost). As rotas públicas liam actionContext.actorId/query.actorId (canal-1) sem
// canRepresentActor → reativação futura do repo escreveria com autoridade não-vinculada (reactivation trap).
// DECISÃO: CONTER fail-closed (403 nomeado) + travar a reativação silenciosa. Este gate MORDE se:
//   (a) uma rota AP/AR voltar a chamar o service (accounts*Service.) ou ler actionContext.actorId;
//   (b) uma rota perder o 403 ACCOUNTS_*_DISABLED;
//   (c) uma rota referenciar bank_ledger/bank_transactions/bank_splits;
//   (d) um service AP/AR PERDER o Proxy reject-all (= reativação do repo sem decisão/binding — DECISION-0114 D5).
// Em validate:regression-guards. Heurística textual comment-stripped (não AST).

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const ROOT = process.cwd();
const stripTs = (s) => s
  .replace(/(^|[^:"'`])\/\/[^\n]*/g, '$1')
  .replace(/\/\*[\s\S]*?\*\//g, '');
const read = (rel) => { const p = join(ROOT, rel); return existsSync(p) ? stripTs(readFileSync(p, 'utf-8')) : null; };

const failures = [];

const SURFACES = [
  {
    routes: 'src/modules/marketplace/accounts-payable.routes.ts',
    service: 'src/modules/marketplace/accounts-payable.service.ts',
    code: 'ACCOUNTS_PAYABLE_DISABLED',
    serviceVar: /accountsPayableService\./,
    proxyMsg: 'AccountsPayable migrated to Bank',
    minRoutes: 7,
  },
  {
    routes: 'src/modules/marketplace/accounts-receivable.routes.ts',
    service: 'src/modules/marketplace/accounts-receivable.service.ts',
    code: 'ACCOUNTS_RECEIVABLE_DISABLED',
    serviceVar: /accountsReceivableService\./,
    proxyMsg: 'AccountsReceivable migrated to Bank',
    minRoutes: 5,
  },
];

for (const s of SURFACES) {
  // ── ROTAS contidas ──
  const rc = read(s.routes);
  if (rc === null) { failures.push(`arquivo ausente: ${s.routes}`); }
  else {
    if (!new RegExp(s.code).test(rc)) failures.push(`${s.routes}: perdeu o código de contenção ${s.code}.`);
    const routeRegs = (rc.match(/fastify\.(get|post|put|patch|delete)\b/g) || []).length;
    if (routeRegs < s.minRoutes) failures.push(`${s.routes}: esperado >= ${s.minRoutes} rotas registradas, encontradas ${routeRegs} — não remover rotas.`);
    const contained403 = (rc.match(/reply\.status\(\s*403\s*\)\.send\(\s*DISABLED\s*\)/g) || []).length;
    if (contained403 < s.minRoutes) failures.push(`${s.routes}: esperado >= ${s.minRoutes} rotas contidas (403 DISABLED), encontradas ${contained403}.`);
    if (s.serviceVar.test(rc)) failures.push(`${s.routes}: voltou a chamar o service (${s.serviceVar}) — reactivation trap; religação exige frente própria (DECISION-0114 D5).`);
    if (/actionContext\s*\.\s*actorId/.test(rc)) failures.push(`${s.routes}: voltou a referenciar actionContext.actorId (canal-1) — a rota contida não lê ator do cliente.`);
    if (/bank_ledger|bank_transactions|bank_splits/.test(rc)) failures.push(`${s.routes}: referencia bank_ledger/transactions/splits — money-path proibido na rota contida.`);
  }
  // ── SERVICE mantém o Proxy reject-all (anti-reactivation do repo) ──
  const sc = read(s.service);
  if (sc === null) { failures.push(`arquivo ausente: ${s.service}`); }
  else {
    const hasProxyRejectAll = /new Proxy\([\s\S]*?Promise\.reject\([\s\S]*?\)/.test(sc) && sc.includes(s.proxyMsg);
    if (!hasProxyRejectAll) {
      failures.push(`${s.service}: PERDEU o Proxy reject-all ("${s.proxyMsg}") — o repo pode ter sido reativado SEM decisão/binding (DECISION-0114 D5). Reativação exige frente própria com canRepresentActor/canActAs.`);
    }
  }
}

if (failures.length > 0) {
  console.error('GATE FAIL [ap-ar-reactivation-trap]:');
  for (const f of failures) console.error('   - ' + f);
  process.exit(1);
}
console.log('GATE OK [ap-ar-reactivation-trap] — AP/AR rotas contidas (403 ACCOUNTS_*_DISABLED; zero service/actionContext/bank); services mantêm Proxy reject-all (repo não reativável sem frente própria). Reactivation trap blindado.');
