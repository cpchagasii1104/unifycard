#!/usr/bin/env node
// Guard estrutural — PDV authority binding (WAVE-1 / DECISION-0131 · DECISION-0113 canal-1 · Art.17).
//
// PDV-F0-LOCK congelou o estado; PDV-F2A tornou a rota /pay CANÔNICA; **PDV-F2B** vinculou as 9 rotas
// restantes: toda rota PDV agora prova server-side que `req.user` REPRESENTA o actor material da ação
// (operador da sessão OU seller da ordem) via `canRepresentActor`/`assertRepresents` ANTES de agir/ler,
// e NENHUMA grava autoria por `actionContext.actorId` cru. `actionContext.actorId` é só HINT.
// Integrado em validate:regression-guards. NÃO altera runtime. FALHA se:
//   (a) surgir uma rota PDV NOVA (path fora do REGISTRO classificado);
//   (b) a rota de pagamento perder o binding real (canRepresentActor sobre order.sellerActorId resolvido
//       por getOrderById), OU o gate deixar de vir ANTES de payOrderFromPdv;
//   (c) o PDV tocar bank_ledger/bank_transactions/bank_splits DIRETO (BANK_TOUCH não classificado);
//   (d) o módulo PDV perder a marca canal-1 (deixar de usar actionContext.actorId como HINT);
//   (e) o helper `assertRepresents` sumir OU deixar de conter o primitivo real (canRepresentActor);
//   (f) a cobertura de binding cair (menos chamadas a `assertRepresents` que as 9 rotas não-pay);
//   (g) reaparecer autoria CRUA `actor_id: actionContext.actorId` (canal-1 como autoridade final).

import { readFileSync, readdirSync, existsSync, statSync } from 'fs';
import { join, resolve, extname } from 'path';
import { fileURLToPath } from 'url';

const ROOT = process.cwd();
const PDV_DIR = join(ROOT, 'src', 'modules', 'pdv');
const ROUTES = join(PDV_DIR, 'pdv.routes.ts');
const stripComments = (s) => s
  .replace(/(^|[^:"'`])\/\/[^\n]*/g, '$1')
  .replace(/\/\*[\s\S]*?\*\//g, '');

// REGISTRO de classificação (READ-FIRST 1ª mão; PDV-F2B 2026-06-16). "METHOD path" → classe.
// Todas CANONICAL: binding server-side por representabilidade (canRepresentActor), role-independente.
const PDV_ROUTES = {
  'POST /sessions/open':                    'CANONICAL (Modelo A: assertRepresents sobre o actor operacional declarado antes de openSession; autoria = operador validado)',
  'POST /sessions/:id/close':               'CANONICAL (Modelo B: resolve session.actor_id + assertRepresents antes de closeSession; closed_by = operador validado)',
  'GET /sessions/open':                     'CANONICAL (Modelo A reader: assertRepresents sobre actionContext.actorId antes de ler; anti-spoof)',
  'GET /sessions':                          'CANONICAL (Modelo A reader: assertRepresents sobre actionContext.actorId antes de ler; anti-spoof)',
  'GET /sessions/:id/summary':              'CANONICAL (Modelo B reader: resolve session.actor_id + assertRepresents antes de ler; anti-spoof por id)',
  'POST /sessions/:id/close-with-summary':  'CANONICAL (Modelo B: resolve session.actor_id + assertRepresents antes de fechar; closed_by = operador validado)',
  'POST /orders':                           'CANONICAL (Modelo C: resolve session.actor_id via sessionId + assertRepresents; autoria = operador validado)',
  'POST /orders/:orderId/items/unit':       'CANONICAL (Modelo D: resolve order.seller_actor_id + assertRepresents; autoria = seller validado)',
  'POST /orders/:orderId/items/weight':     'CANONICAL (Modelo D: resolve order.seller_actor_id + assertRepresents; autoria = seller validado)',
  'POST /orders/:orderId/pay':              'CANONICAL (PDV-F2A/F2B: canRepresentActor sobre order.sellerActorId server-side, ANTES de payOrderFromPdv; autoria = seller validado; actionContext.actorId = hint)',
};
const PAY_KEY = 'POST /orders/:orderId/pay';
const PAY_PATH = '/orders/:orderId/pay';
const NON_PAY_ROUTES = Object.keys(PDV_ROUTES).filter((k) => k !== PAY_KEY).length; // 9 rotas via assertRepresents

function walk(dir, files = []) {
  if (!existsSync(dir)) return files;
  for (const e of readdirSync(dir)) {
    const full = join(dir, e);
    if (statSync(full).isDirectory()) walk(full, files);
    else if (extname(full) === '.ts') files.push(full);
  }
  return files;
}

function runGuard() {
  const failures = [];
  if (!existsSync(ROUTES)) { console.error('GATE FAIL [pdv-authority-lock]: pdv.routes.ts ausente.'); process.exit(1); }
  const code = stripComments(readFileSync(ROUTES, 'utf8'));

  // (a) toda rota declarada deve estar no REGISTRO classificado.
  const routeRe = /fastify\.(get|post|put|patch|delete)(?:<[^>]*>)?\s*\(\s*['"]([^'"]+)['"]/g;
  let m;
  const seen = new Set();
  while ((m = routeRe.exec(code)) !== null) {
    const key = `${m[1].toUpperCase()} ${m[2]}`;
    seen.add(key);
    if (!(key in PDV_ROUTES)) {
      failures.push(`rota PDV NÃO classificada: "${key}" — toda rota PDV deve entrar no REGISTRO classificado e provar representabilidade (assertRepresents/canRepresentActor).`);
    }
  }

  // (d) baseline canal-1: PDV usa actionContext.actorId como HINT (sem isso, modelo mudou → reclassificar).
  if (!/actionContext(\.|\?\.|\[)/.test(code) && !/actionContext\.actorId/.test(code)) {
    failures.push('pdv.routes.ts não usa mais actionContext.actorId — modelo de autoridade mudou; reclassifique o REGISTRO.');
  }

  // (e) helper de binding presente E contendo o primitivo REAL (canRepresentActor/assertActorRepresentable).
  const helperDefRe = /assertRepresents\s*=\s*async\s*\(/;
  if (!helperDefRe.test(code)) {
    failures.push('helper de binding `assertRepresents` ausente — toda rota não-pay prova representabilidade por ele.');
  } else {
    // O helper deve invocar o primitivo canônico real (não um stub renomeado).
    if (!/canRepresentActor\s*\(/.test(code) && !/assertActorRepresentable\s*\(/.test(code)) {
      failures.push('binding PDV sem o primitivo canônico real (canRepresentActor/assertActorRepresentable) — representabilidade não pode ser stub.');
    }
  }

  // (f) cobertura de binding: pelo menos uma chamada a assertRepresents por rota não-pay (>= 9).
  const callMatches = code.match(/\bassertRepresents\s*\(/g) || [];
  if (callMatches.length < NON_PAY_ROUTES) {
    failures.push(`cobertura de binding insuficiente: ${callMatches.length} chamadas a assertRepresents < ${NON_PAY_ROUTES} rotas não-pay — alguma rota perdeu o gate de representabilidade.`);
  }

  // (g) NENHUMA autoria CRUA: actor_id de auditoria não pode vir de actionContext.actorId direto.
  if (/actor_id:\s*actionContext\.actorId/.test(code)) {
    failures.push('autoria CRUA detectada: `actor_id: actionContext.actorId` — auditoria deve gravar o actor VALIDADO (operador/seller resolvido), nunca o canal-1 cru.');
  }

  // (b) rota de pagamento: CANONICAL exige binding REAL (canRepresentActor) + order resolvido server-side
  // (getOrderById) + gate ANTES do side-effect (payOrderFromPdv).
  const payIdx = code.indexOf(PAY_PATH);
  if (payIdx < 0) {
    failures.push('rota de pagamento PDV (/orders/:orderId/pay) não encontrada — REGISTRO precisa revisão.');
  } else {
    const payBlock = code.slice(payIdx);
    const payHasBinding = /\b(canRepresentActor|assertActorRepresentable|assertRepresents)\s*\(/.test(payBlock);
    if (!payHasBinding) {
      failures.push('pay SEM binding (canRepresentActor/assertRepresents) — proibido apresentar money como canônica sem binding.');
    }
    if (!/\bgetOrderById\s*\(/.test(payBlock)) {
      failures.push('pay: order NÃO resolvido server-side (orderService.getOrderById) para obter o seller — autoridade não pode vir do body.');
    }
    const bindIdx = payBlock.search(/\b(canRepresentActor|assertActorRepresentable|assertRepresents)\s*\(/);
    const sideIdx = payBlock.search(/\bpayOrderFromPdv\s*\(/);
    if (bindIdx < 0 || sideIdx < 0 || bindIdx > sideIdx) {
      failures.push('pay: o gate canônico (canRepresentActor) deve vir ANTES de payOrderFromPdv (side-effect de pagamento).');
    }
  }

  // (c) PDV não pode tocar bank_ledger/bank_transactions/bank_splits DIRETO (sem classificação BANK_TOUCH).
  for (const f of walk(PDV_DIR)) {
    const c = stripComments(readFileSync(f, 'utf8'));
    if (/(INSERT\s+INTO|UPDATE|DELETE\s+FROM)\s+bank_(ledger|transactions|splits)\b/i.test(c)) {
      failures.push(`${f.replace(ROOT, '').replace(/\\/g, '/')} escreve bank_ledger/transactions/splits DIRETO — PDV deve passar pelo Core/marketplace (paymentExecutionService); BANK_TOUCH direto = risco crítico não classificado.`);
    }
  }

  if (failures.length > 0) {
    console.error('GATE FAIL [pdv-authority-lock]:');
    failures.forEach((x) => console.error(`  ❌ ${x}`));
    process.exit(1);
  }
  const canonical = Object.values(PDV_ROUTES).filter((v) => v.startsWith('CANONICAL')).length;
  console.log(`[pdv-authority-lock] ${Object.keys(PDV_ROUTES).length} rotas PDV classificadas (${canonical} CANONICAL com binding por representabilidade; ${callMatches.length} chamadas assertRepresents + pay com canRepresentActor); nenhuma autoria crua actionContext.actorId; PDV não toca bank_ledger direto.`);
  console.log('GATE OK [pdv-authority-lock] — toda rota PDV prova req.user representa o actor material antes de agir/ler; pay com binding antes do payOrderFromPdv; novas rotas/perda-de-binding/autoria-crua/bank-touch direto mordem.');
}

const isMain = process.argv[1] ? resolve(process.argv[1]) === fileURLToPath(import.meta.url) : false;
if (isMain) runGuard();

export { runGuard };
