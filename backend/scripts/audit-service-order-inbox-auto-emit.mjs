#!/usr/bin/env node
// Guard estrutural — F-SERVICE-ORDER-INBOX-AUTO-EMIT (2026-06-26).
// O inbox de "atendimento mínimo" do provider passa a NASCER no fluxo canônico (confirmBookingFromDecision),
// como READ MODEL (não mais seed/test-only). Este guard prova e protege a contenção:
//   (A) confirmBookingFromDecision AUTO-EMITE o inbox via o writer canônico do módulo inbox
//       (socialInboxProjector.projectServiceOrderConfirmed) — não pode perder o auto-emit silenciosamente.
//   (B) o writer canônico reusa socialInboxRepository.upsert + InboxSourceType.ORDER (sem SQL solto, sem novo writer).
//   (C) o auto-emit é MONEY-FREE: nem o método do projector nem o módulo inbox referenciam Bank/payment/
//       ledger/split/payout; metadata do item não carrega valor financeiro.
//   (D) o auto-emit é CRM/ghost-free: o módulo inbox não importa agreements/evidence/invoice.
//   (E) os E2Es da jornada de serviço NÃO reinserem inbox test-only (sem socialInboxRepository.upsert,
//       sem `origin: 'e2e-test-only'`) e provam o auto-emit (InboxSourceType.ORDER).
//   (F) POST /service-orders direto continua 403 (SERVICE_ORDER_DIRECT_CREATE_DISABLED) — não reaberto.
//   (G) o caminho NÃO reintroduz agenda paralela (schedules/schedule_slots) em confirmBookingFromDecision.
// Heurística textual (não AST). Integrado em validate:regression-guards.

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const ROOT = process.cwd();
const SO_SVC = join(ROOT, 'src/modules/services/service-order.service.ts');
const SO_ROUTES = join(ROOT, 'src/modules/services/service-order.routes.ts');
const PROJECTOR = join(ROOT, 'src/modules/inbox/social-inbox.projector.ts');
const REPO = join(ROOT, 'src/modules/inbox/social-inbox.repository.ts');
const TYPES = join(ROOT, 'src/modules/inbox/social-inbox.types.ts');
const E2E_SEED = join(ROOT, 'src/scripts/validate-pipeline-e2e-mvp-service-journey-seed.ts');
const E2E_PJ = join(ROOT, 'src/scripts/validate-pipeline-e2e-mvp-service-journey-pj-provider.ts');

const read = (p) => (existsSync(p) ? readFileSync(p, 'utf8') : null);
const stripTs = (s) => s.replace(/(^|[^:"'`])\/\/[^\n]*/g, '$1').replace(/\/\*[\s\S]*?\*\//g, '');
function sliceMethod(code, sig) {
  const start = code.indexOf(sig);
  if (start < 0) return '';
  const after = code.slice(start);
  const nextM = after.slice(sig.length).search(/\n  (async|private|public)\s/);
  return nextM >= 0 ? after.slice(0, nextM + sig.length) : after;
}
// substrato financeiro proibido no caminho do inbox (money-free)
const MONEY_RX = /\b(bank_ledger|bank_transactions|bank_splits|bank_accounts|payment_intent|payout|settlement|bankLedger|bankAccountService|splitService)\b/;
const CRM_RX = /\b(agreement|evidence|invoice)\b/i;

const failures = [];
const must = (cond, msg) => { if (!cond) failures.push(msg); };
let checked = 0;

// (A) confirmBookingFromDecision auto-emite via writer canônico ───────────────────────────────────
const svcRaw = read(SO_SVC);
if (!svcRaw) {
  failures.push('SERVICE_ORDER_INBOX_AUTO_EMIT: service-order.service.ts ausente.');
} else {
  const code = stripTs(svcRaw);
  const body = sliceMethod(code, 'async confirmBookingFromDecision(');
  checked++;
  must(!!body, 'SERVICE_ORDER_INBOX_AUTO_EMIT: confirmBookingFromDecision sumiu.');
  const callIdx = body.indexOf('projectServiceOrderConfirmed(');
  must(callIdx >= 0,
    'SERVICE_ORDER_INBOX_AUTO_EMIT: confirmBookingFromDecision perdeu o auto-emit do inbox (projectServiceOrderConfirmed).');
  // destinatário = provider soberano (owner.authorityActorId), checado DENTRO da janela da chamada do auto-emit
  // (não em qualquer ponto do body — o metadata da própria ordem também carrega providerActorId).
  const callWindow = callIdx >= 0 ? body.slice(callIdx, callIdx + 500) : '';
  must(/providerActorId:\s*owner\.authorityActorId/.test(callWindow),
    'SERVICE_ORDER_INBOX_AUTO_EMIT: auto-emit não usa owner.authorityActorId como provider (provider soberano).');
  // (G) sem agenda paralela no caminho
  checked++;
  must(!/\bschedule_slots\b/.test(body) && !/from\s+schedules\b/i.test(body),
    'SERVICE_ORDER_INBOX_AUTO_EMIT: confirmBookingFromDecision reintroduziu agenda paralela (schedules/schedule_slots).');
}

// (B)+(C) writer canônico: reusa upsert + InboxSourceType.ORDER, money-free ────────────────────────
const projRaw = read(PROJECTOR);
if (!projRaw) {
  failures.push('SERVICE_ORDER_INBOX_AUTO_EMIT: social-inbox.projector.ts ausente.');
} else {
  const code = stripTs(projRaw);
  const method = sliceMethod(code, 'async projectServiceOrderConfirmed(');
  checked++;
  must(!!method, 'SERVICE_ORDER_INBOX_AUTO_EMIT: projectServiceOrderConfirmed sumiu do projector.');
  must(/socialInboxRepository\.upsert\s*\(/.test(method),
    'SERVICE_ORDER_INBOX_AUTO_EMIT: projectServiceOrderConfirmed não reusa o writer canônico socialInboxRepository.upsert (SQL solto?).');
  must(/InboxSourceType\.ORDER/.test(method),
    'SERVICE_ORDER_INBOX_AUTO_EMIT: projectServiceOrderConfirmed não usa InboxSourceType.ORDER (source semântico).');
  // money-free no método de projeção
  checked++;
  must(!MONEY_RX.test(method),
    'SERVICE_ORDER_INBOX_AUTO_EMIT: projectServiceOrderConfirmed referencia substrato financeiro (deve ser money-free).');
}

// (C)+(D) módulo inbox inteiro é money/CRM/ghost-free (projector + repository + types) ──────────────
for (const [label, p] of [['projector', PROJECTOR], ['repository', REPO], ['types', TYPES]]) {
  const raw = read(p);
  if (!raw) { failures.push(`SERVICE_ORDER_INBOX_AUTO_EMIT: social-inbox.${label} ausente.`); continue; }
  const code = stripTs(raw);
  checked++;
  must(!MONEY_RX.test(code),
    `SERVICE_ORDER_INBOX_AUTO_EMIT: social-inbox.${label} referencia substrato financeiro (inbox deve ser money-free).`);
  // CRM/ghost: o módulo inbox não pode importar agreements/evidence/invoice
  const importLines = (raw.match(/^\s*import[^\n]*$/gm) || []).join('\n');
  must(!CRM_RX.test(importLines),
    `SERVICE_ORDER_INBOX_AUTO_EMIT: social-inbox.${label} importa agreements/evidence/invoice (inbox não vira CRM).`);
}

// (E) E2Es não reinserem inbox test-only e provam o auto-emit ──────────────────────────────────────
for (const [label, p] of [['seed', E2E_SEED], ['pj-provider', E2E_PJ]]) {
  const raw = read(p);
  if (!raw) { failures.push(`SERVICE_ORDER_INBOX_AUTO_EMIT: E2E ${label} ausente.`); continue; }
  checked++;
  // sem o writer direto de test-only
  must(!/socialInboxRepository\.upsert\s*\(/.test(raw),
    `SERVICE_ORDER_INBOX_AUTO_EMIT: E2E ${label} reintroduziu inbox test-only (socialInboxRepository.upsert direto).`);
  // sem metadata test-only (forma objeto `origin: 'e2e-test-only'`; NÃO confundir com a asserção `origin !== ...`)
  must(!/origin:\s*['"]e2e-test-only['"]/.test(raw),
    `SERVICE_ORDER_INBOX_AUTO_EMIT: E2E ${label} ainda insere metadata test-only (origin: 'e2e-test-only').`);
  // prova positiva do auto-emit canônico
  must(/InboxSourceType\.ORDER/.test(raw),
    `SERVICE_ORDER_INBOX_AUTO_EMIT: E2E ${label} não prova o auto-emit canônico (InboxSourceType.ORDER ausente).`);
}

// (F) POST /service-orders direto continua 403 ─────────────────────────────────────────────────────
{
  const routes = read(SO_ROUTES);
  checked++;
  must(!!routes, 'SERVICE_ORDER_INBOX_AUTO_EMIT: service-order.routes.ts ausente.');
  if (routes) {
    must(/SERVICE_ORDER_DIRECT_CREATE_DISABLED/.test(routes),
      'SERVICE_ORDER_INBOX_AUTO_EMIT: POST /service-orders direto perdeu o 403 (SERVICE_ORDER_DIRECT_CREATE_DISABLED).');
  }
}

console.log(`[service-order-inbox-auto-emit] checked=${checked} failures=${failures.length}`);
if (failures.length > 0) {
  console.error('GATE FAIL [service-order-inbox-auto-emit]:');
  failures.forEach((f) => console.error('  ❌', f));
  process.exit(1);
}
console.log('GATE OK [service-order-inbox-auto-emit] — service_order auto-emite inbox (read-model) via writer canônico (upsert + InboxSourceType.ORDER); money/CRM/ghost-free; E2Es sem test-only e provando ORDER; POST direto 403; sem agenda paralela.');
