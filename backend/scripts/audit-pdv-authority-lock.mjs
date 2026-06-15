#!/usr/bin/env node
// Guard estrutural — PDV-F0-LOCK (WAVE-1 BATCH-5 / DECISION-0131 · DECISION-0113 canal-1 · Art.17).
//
// LOCK (read-only + cerca; NÃO corrige): o módulo PDV (src/modules/pdv) grava AUTORIA por
// `actionContext.actorId` (canal-1 DECISION-0113) SEM binding server-side (sem canRepresentActor/
// assertActorRepresentable). O `require-permission.guard` resolve a capability do ACTOR DECLARADO, não
// vincula req.user → actor. `actionContext.actorId` NÃO é coberto pelo audit-actor-authority-boundary
// (gap conhecido). Este guard congela o estado e FALHA se:
//   (a) surgir uma rota PDV NOVA (path fora do REGISTRO classificado);
//   (b) a rota de pagamento (CANONICAL pós PDV-F2A) perder o binding real (canRepresentActor sobre
//       order.sellerActorId resolvido por getOrderById), OU o gate deixar de vir ANTES de payOrderFromPdv,
//       OU for apresentada como CANONICAL sem binding;
//   (c) o PDV tocar bank_ledger/bank_transactions DIRETO (BANK_TOUCH não classificado) — hoje passa por
//       marketplace/Core (paymentExecutionService), sem ledger direto;
//   (d) o módulo PDV perder a marca canal-1 (deixar de usar actionContext.actorId — sinal de mudança
//       silenciosa de modelo de autoridade que exige reclassificação).
// Integrado em validate:regression-guards. NÃO altera runtime.

import { readFileSync, readdirSync, existsSync, statSync } from 'fs';
import { join, resolve, extname } from 'path';
import { fileURLToPath } from 'url';

const ROOT = process.cwd();
const PDV_DIR = join(ROOT, 'src', 'modules', 'pdv');
const ROUTES = join(PDV_DIR, 'pdv.routes.ts');
const stripComments = (s) => s
  .replace(/(^|[^:"'`])\/\/[^\n]*/g, '$1')
  .replace(/\/\*[\s\S]*?\*\//g, '');

// REGISTRO de classificação (READ-FIRST 1ª mão 2026-06-15). "METHOD path" → classe. Nenhuma é canônica:
// todas gravam/filtram autoria por actionContext.actorId (canal-1) sem binding.
const PDV_ROUTES = {
  'POST /sessions/open':                    'DIVERGENT (cria pdv_session; actor_id=actionContext.actorId; money-adjacent)',
  'POST /sessions/:id/close':               'DIVERGENT (fecha sessão; closed_by=actionContext.actorId; money-adjacent)',
  'GET /sessions/open':                     'DIVERGENT (reader filtra por actionContext.actorId, sem binding; money-adjacent)',
  'GET /sessions':                          'DIVERGENT (reader filtra por actionContext.actorId, sem binding; money-adjacent)',
  'GET /sessions/:id/summary':              'DIVERGENT (resumo de qualquer sessão por id, sem ownership; money-adjacent)',
  'POST /sessions/:id/close-with-summary':  'DIVERGENT (fecha+resumo; closed_by=actionContext.actorId; money-adjacent)',
  'POST /orders':                           'DIVERGENT (cria order marketplace; autoria actionContext.actorId; money-adjacent)',
  'POST /orders/:orderId/items/unit':       'DIVERGENT (add item; autoria actionContext.actorId; money-adjacent)',
  'POST /orders/:orderId/items/weight':     'DIVERGENT (add item; autoria actionContext.actorId; money-adjacent)',
  'POST /orders/:orderId/pay':              'CANONICAL (PDV-F2A: canRepresentActor sobre order.sellerActorId server-side, ANTES de payOrderFromPdv; requirePermission = camada adicional, não autoridade única; actionContext.actorId = audit, não autoridade)',
};
const PAY_KEY = 'POST /orders/:orderId/pay';
const PAY_PATH = '/orders/:orderId/pay';

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
      failures.push(`rota PDV NÃO classificada: "${key}" — toda rota PDV que grava autoria por canal-1 (actionContext.actorId) sem binding deve entrar no REGISTRO classificado (PDV-F0-LOCK).`);
    }
  }

  // (d) baseline canal-1: PDV usa actionContext.actorId (sem isso, modelo mudou → exige reclassificação).
  if (!/actionContext(\.|\?\.|\[)/.test(code) && !/actionContext\.actorId/.test(code)) {
    failures.push('pdv.routes.ts não usa mais actionContext.actorId — modelo de autoridade mudou; reclassifique o REGISTRO (LOCK).');
  }

  // (b) rota de pagamento (PDV-F2A): CANONICAL exige binding REAL (canRepresentActor) + order resolvido
  // server-side (getOrderById) + gate ANTES do side-effect (payOrderFromPdv). Declassificar p/ CANONICAL
  // sem binding, ou chamar payOrderFromPdv antes do gate, MORDE.
  const payIdx = code.indexOf(PAY_PATH);
  if (payIdx < 0) {
    failures.push('rota de pagamento PDV (/orders/:orderId/pay) não encontrada — REGISTRO precisa revisão.');
  } else {
    const payBlock = code.slice(payIdx);
    const payHasBinding = /\b(canRepresentActor|assertActorRepresentable)\s*\(/.test(payBlock);
    const payClass = PDV_ROUTES[PAY_KEY] || '';
    if (payClass.startsWith('CANONICAL')) {
      if (!payHasBinding) {
        failures.push('pay classificada CANONICAL SEM canRepresentActor/assertActorRepresentable — proibido apresentar money como canônica sem binding.');
      }
      if (!/\bgetOrderById\s*\(/.test(payBlock)) {
        failures.push('pay: order NÃO resolvido server-side (orderService.getOrderById) para obter o seller — autoridade não pode vir do body.');
      }
      const bindIdx = payBlock.search(/\b(canRepresentActor|assertActorRepresentable)\s*\(/);
      const sideIdx = payBlock.search(/\bpayOrderFromPdv\s*\(/);
      if (bindIdx < 0 || sideIdx < 0 || bindIdx > sideIdx) {
        failures.push('pay: o gate canônico (canRepresentActor) deve vir ANTES de payOrderFromPdv (side-effect de pagamento).');
      }
    } else if (!payClass.startsWith('DIVERGENT-MONEY') && !payHasBinding) {
      failures.push('pay declassificada de DIVERGENT-MONEY SEM binding real — proibido.');
    }
  }

  // (c) PDV não pode tocar bank_ledger/bank_transactions DIRETO (sem classificação BANK_TOUCH).
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
  const divergent = Object.values(PDV_ROUTES).filter((v) => v.startsWith('DIVERGENT')).length;
  const canonical = Object.values(PDV_ROUTES).filter((v) => v.startsWith('CANONICAL')).length;
  console.log(`[pdv-authority-lock] ${Object.keys(PDV_ROUTES).length} rotas PDV classificadas (${divergent} DIVERGENT canal-1 sem binding [DT] + ${canonical} CANONICAL: pay com canRepresentActor sobre order.sellerActorId antes do side-effect [PDV-F2A]); PDV não toca bank_ledger direto (via Core).`);
  console.log('GATE OK [pdv-authority-lock] — pay (money) com binding canônico antes do payOrderFromPdv; demais rotas PDV canal-1 LOCKED + classificadas; novas rotas/declassificação/bank-touch direto mordem.');
}

const isMain = process.argv[1] ? resolve(process.argv[1]) === fileURLToPath(import.meta.url) : false;
if (isMain) runGuard();

export { runGuard };
